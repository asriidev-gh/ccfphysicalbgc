import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Db, Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import { audit } from "./audit";
import { uploadPhoto } from "./photo";

export const CONSENT_VERSION = "2026-v1";

// Crockford-style base32 without ambiguous characters; 12 chars ≈ 60 bits of entropy.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export function newReference(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `PB-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export const CODE_PREFIX = "CCFBGC-";
const CODE_RE = /^CCFBGC-\d{4}$/;
export function isShortCode(v: string): boolean {
  return CODE_RE.test(v.trim().toUpperCase());
}
function randomCode(): string {
  return CODE_PREFIX + String(randomInt(0, 10000)).padStart(4, "0");
}

export function normalizeMobile(v: string): string {
  const digits = v.replace(/[^\d+]/g, "");
  if (digits.startsWith("+63")) return "0" + digits.slice(3);
  if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2);
  return digits;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Public registration input. There is deliberately no role, status, or participant id
 * field: whatever else a client sends is stripped by zod.
 */
export const registrationInput = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().toLowerCase().min(1, "Please enter your email").email("Enter a valid email").max(200),
  mobile: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? normalizeMobile(v) : undefined))
    .refine((v) => v === undefined || /^(\+?\d{10,13}|0\d{10})$/.test(v), "Enter a valid mobile number"),
  affiliation: optionalText(100),
  /** JPEG data URL (resized by the browser). Optional here; the public form requires it. */
  photo: z.string().max(220_000).optional(),
  /** Omitted on the public form: the participant is enrolled in every activity of the event. */
  activityIds: z.array(z.string().uuid()).max(20).optional(),
  consent: z.literal(true, { error: "You must accept the terms to register" }),
  eligibilityConfirmed: z.literal(true, { error: "Please confirm you are fit to participate" }),
});

export type RegistrationInput = z.input<typeof registrationInput>;

export function parseRegistration(input: unknown) {
  const r = registrationInput.safeParse(input);
  if (!r.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of r.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    throw new AppError("VALIDATION", Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
  }
  return r.data;
}

async function lockActivities(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  // Row locks serialise concurrent registrations so capacity can never be oversold.
  await tx.$queryRaw`SELECT id FROM "EventActivity" WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
}

/**
 * Reconcile a participant's activity enrolments with the desired set inside a transaction.
 * New enrolments are CONFIRMED, WAITLISTED (if enabled), or rejected when full.
 */
async function applyActivities(tx: Tx, args: { participantId: string; eventId: string; desired: string[]; allowMultiple: boolean }) {
  const { participantId, eventId, desired, allowMultiple } = args;
  if (!allowMultiple && desired.length > 1) throw new AppError("VALIDATION", "Only one activity can be selected for this event.");
  const acts = await tx.eventActivity.findMany({ where: { id: { in: desired }, eventId } });
  if (acts.length !== new Set(desired).size) throw new AppError("VALIDATION", "One of the selected activities is not available.");
  await lockActivities(tx, desired);

  const existing = await tx.activityRegistration.findMany({ where: { participantId, activity: { eventId } } });
  const byActivity = new Map(existing.map((e) => [e.activityId, e]));
  const result: { activityId: string; status: "CONFIRMED" | "WAITLISTED" }[] = [];

  // Removals
  for (const e of existing) {
    if (!desired.includes(e.activityId) && e.status !== "CANCELLED") {
      const started = await tx.challengeAttempt.count({ where: { activityRegistrationId: e.id, status: { not: "CANCELLED" } } });
      if (started > 0) throw new AppError("CONFLICT", "You cannot drop an activity that already has attempts.");
      await tx.activityRegistration.update({ where: { id: e.id }, data: { status: "CANCELLED", queueStatus: "WITHDRAWN" } });
      await promoteWaitlist(tx, e.activityId);
    }
  }
  // Additions
  for (const a of acts) {
    const cur = byActivity.get(a.id);
    if (cur && cur.status !== "CANCELLED") {
      result.push({ activityId: a.id, status: cur.status as "CONFIRMED" | "WAITLISTED" });
      continue;
    }
    if (a.registrationStatus !== "OPEN" || a.challengeStatus === "COMPLETED")
      throw new AppError("CONFLICT", `Registration for ${a.name} is closed.`);
    const confirmed = await tx.activityRegistration.count({ where: { activityId: a.id, status: "CONFIRMED" } });
    const full = a.capacity !== null && confirmed >= a.capacity;
    if (full && !a.waitlistEnabled) throw new AppError("CONFLICT", `${a.name} is full.`);
    const status = full ? "WAITLISTED" : "CONFIRMED";
    if (cur) await tx.activityRegistration.update({ where: { id: cur.id }, data: { status, queueStatus: "NOT_ARRIVED" } });
    else await tx.activityRegistration.create({ data: { participantId, activityId: a.id, status } });
    result.push({ activityId: a.id, status });
  }
  return result;
}

/** Enrol a participant in every activity of the event (no capacity or per-activity registration window). */
export async function enrolInAllActivities(tx: Tx, participantId: string, eventId: string) {
  const acts = await tx.eventActivity.findMany({ where: { eventId }, select: { id: true } });
  await tx.activityRegistration.createMany({
    data: acts.map((a) => ({ participantId, activityId: a.id, status: "CONFIRMED" as const })),
    skipDuplicates: true,
  });
  return acts.map((a) => ({ activityId: a.id, status: "CONFIRMED" as const }));
}

/** Promote the oldest waitlisted enrolments while capacity is free. Caller holds the activity lock. */
export async function promoteWaitlist(tx: Tx, activityId: string): Promise<number> {
  const a = await tx.eventActivity.findUnique({ where: { id: activityId }, select: { capacity: true } });
  if (!a) return 0;
  const confirmed = await tx.activityRegistration.count({ where: { activityId, status: "CONFIRMED" } });
  const free = a.capacity === null ? Infinity : a.capacity - confirmed;
  if (free <= 0) return 0;
  const next = await tx.activityRegistration.findMany({
    where: { activityId, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
    take: Number.isFinite(free) ? free : undefined,
  });
  for (const n of next) await tx.activityRegistration.update({ where: { id: n.id }, data: { status: "CONFIRMED" } });
  return next.length;
}

export interface RegisterOptions {
  /** Present only for walk-ins entered by an administrator; bypasses the public window. */
  walkInBy?: Actor;
}

export async function registerParticipant(db: Db, eventSlug: string, rawInput: unknown, opts: RegisterOptions = {}) {
  const input = parseRegistration(rawInput);
  if (opts.walkInBy) assertAdmin(opts.walkInBy);

  const event = await db.event.findUnique({ where: { slug: eventSlug } });
  if (!event) throw new AppError("NOT_FOUND", "Event not found.");
  const now = new Date();
  if (!opts.walkInBy) {
    if (event.status !== "PUBLISHED" && event.status !== "LIVE") throw new AppError("CONFLICT", "Registration is not open for this event.");
    if (now < event.registrationOpensAt) throw new AppError("CONFLICT", "Registration has not opened yet.");
    if (now > event.registrationClosesAt) throw new AppError("CONFLICT", "Registration is closed.");
  } else if (event.status === "ARCHIVED") {
    throw new AppError("CONFLICT", "This event is archived.");
  }

  // Uploaded before the transaction so a slow network call never holds database locks.
  const photoUrl = input.photo ? await uploadPhoto(input.photo) : undefined;
  try {
    return await db.$transaction(async (tx) => {
      // Duplicate = same person: same name AND same email/mobile. Relatives often share one contact.
      const or: Prisma.ParticipantWhereInput[] = [];
      if (input.email) or.push({ email: input.email });
      if (input.mobile) or.push({ mobile: input.mobile });
      const dup = await tx.registration.findFirst({
        where: {
          eventId: event.id,
          status: { not: "CANCELLED" },
          participant: { fullName: { equals: input.fullName, mode: "insensitive" }, OR: or },
        },
        select: { id: true },
      });
      if (dup)
        throw new AppError(
          "CONFLICT",
          "This person is already registered with these contact details. Use “Find my registration” to view or change it.",
          {
            email: "Already registered",
          },
        );

      const participant = await tx.participant.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          mobile: input.mobile,
          affiliation: input.affiliation,
          photoUrl,
          eligibility: { confirmed: true },
        },
      });
      // 10,000 codes per event; retry on the rare collision (300 registrants fill ~3%).
      let code = randomCode();
      for (let i = 0; i < 50 && (await tx.registration.findUnique({ where: { eventId_code: { eventId: event.id, code } } })); i++) {
        code = randomCode();
      }
      const registration = await tx.registration.create({
        data: {
          reference: newReference(),
          code,
          participantId: participant.id,
          eventId: event.id,
          consentAcceptedAt: now,
          consentVersion: CONSENT_VERSION,
          walkIn: Boolean(opts.walkInBy),
        },
      });
      const activities = input.activityIds
        ? await applyActivities(tx, {
            participantId: participant.id,
            eventId: event.id,
            desired: [...new Set(input.activityIds)],
            allowMultiple: event.allowMultipleActivities,
          })
        : await enrolInAllActivities(tx, participant.id, event.id);
      await audit(tx, {
        actorId: opts.walkInBy?.id ?? null,
        action: opts.walkInBy ? "registration.walk_in" : "registration.create",
        entityType: "Registration",
        entityId: registration.id,
        next: { eventId: event.id, activities },
      });
      return { reference: registration.reference, code: registration.code, activities };
    });
  } catch (e) {
    // Unique-constraint backstop for racing duplicate submissions.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new AppError("CONFLICT", "You appear to be registered already.");
    throw e;
  }
}

// ───────── Participant self-service (reference + contact proof) ─────────

export interface PublicRegistration {
  reference: string;
  status: string;
  eventName: string;
  eventSlug: string;
  participantName: string;
  checkedIn: boolean;
  activities: { id: string; name: string; status: string; queueStatus: string }[];
  results: { activityName: string; rank: number | null; value: string | null; status: string; published: boolean }[];
}

/** Everything the participant may see about their own registration (never other people's data). */
export async function getRegistrationByReference(db: Db, reference: string, eventFilter?: string) {
  return db.registration.findUnique({
    where: { reference: reference.trim().toUpperCase() },
    include: {
      event: { select: { id: true, name: true, slug: true, timeZone: true, startsAt: true, venue: true, registrationClosesAt: true } },
      participant: {
        include: {
          activityRegistrations: {
            where: { activity: eventFilter ? { eventId: eventFilter } : undefined },
            include: { activity: { select: { id: true, name: true, instructions: true, location: true } } },
          },
        },
      },
    },
  });
}

/** The caller proves ownership with the reference plus the email or mobile used to register. */
export async function verifyOwnership(db: Db, reference: string, contact: string) {
  const c = contact.trim();
  const matches = (r: NonNullable<Awaited<ReturnType<typeof getRegistrationByReference>>>) =>
    c.length > 0 &&
    ((r.participant.email && r.participant.email === c.toLowerCase()) ||
      (r.participant.mobile && r.participant.mobile === normalizeMobile(c)));
  let reg: Awaited<ReturnType<typeof getRegistrationByReference>> = null;
  if (isShortCode(reference)) {
    // A short code is guessable, so it only ever works together with the contact proof.
    const code = reference.trim().toUpperCase();
    const found = await db.registration.findMany({ where: { code }, select: { reference: true } });
    for (const f of found) {
      const r = await getRegistrationByReference(db, f.reference);
      if (r && matches(r)) {
        reg = r;
        break;
      }
    }
  } else {
    reg = await getRegistrationByReference(db, reference);
    if (reg && !matches(reg)) reg = null;
  }
  if (!reg) throw new AppError("NOT_FOUND", "We could not find a registration matching those details.");
  return reg;
}

export async function participantCancel(db: Db, reference: string, contact: string) {
  const reg = await verifyOwnership(db, reference, contact);
  return cancelRegistrationById(db, reg.id, null, "participant");
}

export async function participantUpdateActivities(db: Db, reference: string, contact: string, activityIds: string[]) {
  const reg = await verifyOwnership(db, reference, contact);
  if (reg.status === "CANCELLED") throw new AppError("CONFLICT", "This registration was cancelled.");
  if (new Date() > reg.event.registrationClosesAt) throw new AppError("CONFLICT", "Registration is closed; changes are no longer allowed.");
  return updateActivitiesById(db, reg.id, activityIds, null);
}

export async function updateActivitiesById(db: Db, registrationId: string, activityIds: string[], actorId: string | null) {
  return db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
    if (!reg) throw new AppError("NOT_FOUND", "Registration not found.");
    const desired = [...new Set(z.array(z.string().uuid()).parse(activityIds))];
    const result = await applyActivities(tx, {
      participantId: reg.participantId,
      eventId: reg.eventId,
      desired,
      allowMultiple: reg.event.allowMultipleActivities,
    });
    await audit(tx, {
      actorId,
      action: "registration.update_activities",
      entityType: "Registration",
      entityId: reg.id,
      next: { activities: result },
    });
    return result;
  });
}

export async function cancelRegistrationById(db: Db, registrationId: string, actorId: string | null, via: "participant" | "admin") {
  return db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new AppError("NOT_FOUND", "Registration not found.");
    if (reg.status === "CANCELLED") return { cancelled: true };
    const ars = await tx.activityRegistration.findMany({
      where: { participantId: reg.participantId, activity: { eventId: reg.eventId }, status: { not: "CANCELLED" } },
    });
    await lockActivities(
      tx,
      ars.map((a) => a.activityId),
    );
    const attempted = await tx.challengeAttempt.count({
      where: { activityRegistrationId: { in: ars.map((a) => a.id) }, status: { not: "CANCELLED" } },
    });
    if (attempted > 0 && via === "participant")
      throw new AppError("CONFLICT", "Registration can no longer be cancelled online; please see an organizer.");
    await tx.activityRegistration.updateMany({
      where: { id: { in: ars.map((a) => a.id) } },
      data: { status: "CANCELLED", queueStatus: "WITHDRAWN" },
    });
    await tx.registration.update({ where: { id: reg.id }, data: { status: "CANCELLED" } });
    for (const a of ars) await promoteWaitlist(tx, a.activityId);
    await audit(tx, {
      actorId,
      action: `registration.cancel.${via}`,
      entityType: "Registration",
      entityId: reg.id,
      previous: { status: reg.status },
      next: { status: "CANCELLED" },
    });
    return { cancelled: true };
  });
}
