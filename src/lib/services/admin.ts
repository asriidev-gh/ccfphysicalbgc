import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import { hashPassword } from "@/lib/auth/hash";
import { parseScoringConfig } from "@/lib/scoring/schema";
import { publish } from "@/lib/realtime/bus";
import { slugify } from "@/lib/utils";
import { audit } from "./audit";
import { formatValue } from "./leaderboard";

function zodToAppError(e: z.ZodError): AppError {
  const fieldErrors: Record<string, string> = {};
  for (const i of e.issues) fieldErrors[i.path.join(".") || "form"] ??= i.message;
  return new AppError("VALIDATION", Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
}
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw zodToAppError(r.error);
  return r.data;
}

// ───────── Sports ─────────

const sportInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(""),
  icon: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,30}$/, "Icon must be a lucide icon name")
    .default("trophy"),
  defaultScoring: z.unknown(),
  active: z.boolean().default(true),
});

export async function saveSport(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = parse(sportInput, raw);
  const scoring = parseScoringConfig(input.defaultScoring);
  if (!scoring.success) throw new AppError("VALIDATION", `Scoring template invalid: ${scoring.error.issues[0].message}`);
  const data = {
    name: input.name,
    description: input.description,
    icon: input.icon,
    defaultScoring: scoring.data as Prisma.InputJsonValue,
    active: input.active,
  };
  if (input.id) {
    const prev = await db.sport.findUnique({ where: { id: input.id } });
    if (!prev) throw new AppError("NOT_FOUND", "Sport not found.");
    const s = await db.sport.update({ where: { id: input.id }, data });
    await audit(db, {
      actorId: actor.id,
      action: "sport.update",
      entityType: "Sport",
      entityId: s.id,
      previous: { name: prev.name, active: prev.active },
      next: { name: s.name, active: s.active },
    });
    return s;
  }
  const slug = slugify(input.name);
  if (await db.sport.findUnique({ where: { slug } })) throw new AppError("CONFLICT", "A sport with this name already exists.");
  const s = await db.sport.create({ data: { ...data, slug } });
  await audit(db, { actorId: actor.id, action: "sport.create", entityType: "Sport", entityId: s.id, next: { name: s.name } });
  return s;
}

// ───────── Event activities ─────────

const activityInput = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  sportId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(4000).default(""),
  location: z.string().trim().max(120).default(""),
  capacity: z.number().int().min(1).max(100000).nullable().default(null),
  waitlistEnabled: z.boolean().default(false),
  participation: z.enum(["INDIVIDUAL", "TEAM"]).default("INDIVIDUAL"),
  scoringConfig: z.unknown(),
  requireApproval: z.boolean().default(false),
  independentApproval: z.boolean().default(true),
  leaderboardPublished: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

export async function saveActivity(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = parse(activityInput, raw);
  const cfg = parseScoringConfig(input.scoringConfig);
  if (!cfg.success) {
    const fe: Record<string, string> = {};
    for (const i of cfg.error.issues) fe[`scoring.${i.path.join(".")}`] ??= i.message;
    throw new AppError("VALIDATION", `Scoring configuration invalid: ${cfg.error.issues[0].message}`, fe);
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new AppError("VALIDATION", "End must be after start.");
  const { id, scoringConfig: _drop, ...rest } = input;
  void _drop;

  return db.$transaction(async (tx) => {
    if (id) {
      const prev = await tx.eventActivity.findUnique({ where: { id }, include: { _count: { select: { attempts: true } } } });
      if (!prev) throw new AppError("NOT_FOUND", "Activity not found.");
      const changed = JSON.stringify(parseScoringConfig(prev.scoringConfig).data ?? prev.scoringConfig) !== JSON.stringify(cfg.data);
      let scoringVersion = prev.scoringVersion;
      if (changed) {
        // Finalised/in-flight results were scored under the existing rules; never rewrite them silently.
        if (prev._count.attempts > 0)
          throw new AppError(
            "CONFLICT",
            "Scoring rules are locked once attempts exist. Create a new activity or correct individual results.",
          );
        scoringVersion += 1;
        await tx.scoringConfigVersion.create({
          data: { activityId: id, version: scoringVersion, config: cfg.data as Prisma.InputJsonValue },
        });
      }
      const a = await tx.eventActivity.update({
        where: { id },
        data: { ...rest, scoringConfig: cfg.data as Prisma.InputJsonValue, scoringVersion },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "activity.update",
        entityType: "EventActivity",
        entityId: a.id,
        previous: { name: prev.name, capacity: prev.capacity },
        next: { name: a.name, capacity: a.capacity, scoringVersion },
      });
      return a;
    }
    const slug = slugify(rest.name);
    if (await tx.eventActivity.findUnique({ where: { eventId_slug: { eventId: rest.eventId, slug } } }))
      throw new AppError("CONFLICT", "An activity with this name already exists for the event.");
    const a = await tx.eventActivity.create({ data: { ...rest, slug, scoringConfig: cfg.data as Prisma.InputJsonValue } });
    await tx.scoringConfigVersion.create({ data: { activityId: a.id, version: 1, config: cfg.data as Prisma.InputJsonValue } });
    await audit(tx, { actorId: actor.id, action: "activity.create", entityType: "EventActivity", entityId: a.id, next: { name: a.name } });
    return a;
  });
}

export async function setActivityState(
  db: Db,
  actor: Actor,
  activityId: string,
  patch: { challengeStatus?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"; registrationStatus?: "OPEN" | "CLOSED" },
) {
  assertAdmin(actor);
  const a = await db.eventActivity.findUnique({ where: { id: activityId } });
  if (!a) throw new AppError("NOT_FOUND", "Activity not found.");
  if (patch.challengeStatus === "ACTIVE") {
    // Never activate with invalid or incomplete scoring configuration.
    const cfg = parseScoringConfig(a.scoringConfig);
    if (!cfg.success) throw new AppError("VALIDATION", `Cannot activate: ${cfg.error.issues[0].message}`);
    if (cfg.data.fields.length === 0) throw new AppError("VALIDATION", "Cannot activate: no scoring fields are defined.");
    const snap = await db.scoringConfigVersion.findUnique({ where: { activityId_version: { activityId, version: a.scoringVersion } } });
    if (!snap) throw new AppError("VALIDATION", "Cannot activate: scoring version snapshot missing. Re-save the activity.");
  }
  const u = await db.eventActivity.update({ where: { id: activityId }, data: patch });
  await audit(db, {
    actorId: actor.id,
    action: "activity.state",
    entityType: "EventActivity",
    entityId: a.id,
    previous: { challengeStatus: a.challengeStatus, registrationStatus: a.registrationStatus },
    next: patch,
  });
  await publish(db, { kind: "display", eventId: a.eventId });
  return u;
}

// ───────── Users & assignments ─────────

const userCreate = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "ACTIVITY_LEAD"]),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
});

function assertCanGrant(actor: Actor, role: string) {
  // Only a super admin may mint admins; plain admins can create activity leads.
  if (role !== "ACTIVITY_LEAD" && actor.role !== "SUPER_ADMIN")
    throw new AppError("FORBIDDEN", "Only a super admin can create administrator accounts.");
}

export async function createUser(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = parse(userCreate, raw);
  assertCanGrant(actor, input.role);
  if (await db.user.findUnique({ where: { email: input.email } }))
    throw new AppError("CONFLICT", "An account with this email already exists.", { email: "Already in use" });
  const u = await db.user.create({
    data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) },
  });
  await audit(db, { actorId: actor.id, action: "user.create", entityType: "User", entityId: u.id, next: { email: u.email, role: u.role } });
  return { id: u.id };
}

export async function updateUser(db: Db, actor: Actor, userId: string, patch: { active?: boolean; password?: string; name?: string }) {
  assertAdmin(actor);
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError("NOT_FOUND", "User not found.");
  if (target.role !== "ACTIVITY_LEAD" && actor.role !== "SUPER_ADMIN")
    throw new AppError("FORBIDDEN", "Only a super admin can modify administrator accounts.");
  if (patch.active === false && target.id === actor.id) throw new AppError("VALIDATION", "You cannot deactivate your own account.");
  const data: Prisma.UserUpdateInput = {};
  if (patch.name) data.name = parse(z.string().trim().min(2).max(100), patch.name);
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.password) data.passwordHash = await hashPassword(parse(userCreate.shape.password, patch.password));
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data });
    // Deactivation or password reset revokes every live session.
    if (patch.active === false || patch.password) await tx.session.deleteMany({ where: { userId } });
    await audit(tx, {
      actorId: actor.id,
      action: "user.update",
      entityType: "User",
      entityId: userId,
      next: { active: patch.active, passwordReset: Boolean(patch.password), name: patch.name },
    });
  });
}

export async function assignLead(db: Db, actor: Actor, userId: string, activityId: string) {
  assertAdmin(actor);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ACTIVITY_LEAD" || !user.active) throw new AppError("VALIDATION", "Select an active activity-lead account.");
  if (!(await db.eventActivity.findUnique({ where: { id: activityId }, select: { id: true } })))
    throw new AppError("NOT_FOUND", "Activity not found.");
  await db.activityAssignment.upsert({ where: { userId_activityId: { userId, activityId } }, create: { userId, activityId }, update: {} });
  await audit(db, { actorId: actor.id, action: "assignment.add", entityType: "EventActivity", entityId: activityId, next: { userId } });
}

export async function unassignLead(db: Db, actor: Actor, userId: string, activityId: string) {
  assertAdmin(actor);
  await db.activityAssignment.deleteMany({ where: { userId, activityId } });
  await audit(db, {
    actorId: actor.id,
    action: "assignment.remove",
    entityType: "EventActivity",
    entityId: activityId,
    previous: { userId },
  });
}

// ───────── Events, announcements, display ─────────

const eventInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).default(""),
    organizer: z.string().trim().max(120).default(""),
    occasion: z.string().trim().max(120).default(""),
    venue: z.string().trim().min(2).max(200),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    registrationOpensAt: z.coerce.date(),
    registrationClosesAt: z.coerce.date(),
    status: z.enum(["DRAFT", "PUBLISHED", "LIVE", "COMPLETED", "ARCHIVED"]),
    timeZone: z.string().default("Asia/Manila"),
    allowMultipleActivities: z.boolean().default(true),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "Event must end after it starts", path: ["endsAt"] })
  .refine((v) => v.registrationClosesAt > v.registrationOpensAt, {
    message: "Registration must close after it opens",
    path: ["registrationClosesAt"],
  });

export async function saveEvent(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const { id, ...data } = parse(eventInput, raw);
  try {
    new Intl.DateTimeFormat("en", { timeZone: data.timeZone });
  } catch {
    throw new AppError("VALIDATION", "Unknown time zone.");
  }
  if (id) {
    const e = await db.event.update({ where: { id }, data });
    await audit(db, { actorId: actor.id, action: "event.update", entityType: "Event", entityId: e.id, next: { status: e.status } });
    return e;
  }
  const slug = slugify(data.name);
  if (await db.event.findUnique({ where: { slug } })) throw new AppError("CONFLICT", "An event with this name already exists.");
  const e = await db.event.create({ data: { ...data, slug } });
  await audit(db, { actorId: actor.id, action: "event.create", entityType: "Event", entityId: e.id, next: { name: e.name } });
  return e;
}

const announcementInput = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(1000),
  published: z.boolean().default(false),
  showOnDisplay: z.boolean().default(false),
});

export async function saveAnnouncement(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const { id, ...data } = parse(announcementInput, raw);
  const publishedAt = data.published ? new Date() : null;
  const a = id
    ? await db.announcement.update({ where: { id }, data: { ...data, publishedAt: data.published ? undefined : null } })
    : await db.announcement.create({ data: { ...data, publishedAt } });
  if (id && data.published && !a.publishedAt) await db.announcement.update({ where: { id }, data: { publishedAt: new Date() } });
  await audit(db, {
    actorId: actor.id,
    action: id ? "announcement.update" : "announcement.create",
    entityType: "Announcement",
    entityId: a.id,
    next: { published: a.published },
  });
  await publish(db, { kind: "announcement", eventId: data.eventId });
  return a;
}

export async function deleteAnnouncement(db: Db, actor: Actor, id: string) {
  assertAdmin(actor);
  const a = await db.announcement.delete({ where: { id } });
  await audit(db, {
    actorId: actor.id,
    action: "announcement.delete",
    entityType: "Announcement",
    entityId: id,
    previous: { title: a.title },
  });
  await publish(db, { kind: "announcement", eventId: a.eventId });
}

const displayInput = z.object({
  eventId: z.string().uuid(),
  activityId: z.string().uuid().nullable().default(null),
  mode: z.enum(["SINGLE_ACTIVITY", "ALL_SPORTS", "ROTATE"]),
  topN: z.number().int().min(0).max(1000),
  rotate: z.boolean(),
  rotateSeconds: z.number().int().min(5).max(300),
  paused: z.boolean(),
  showAnnouncements: z.boolean(),
});

export async function saveDisplaySettings(db: Db, actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const { eventId, ...data } = parse(displayInput, raw);
  if (data.activityId && !(await db.eventActivity.findFirst({ where: { id: data.activityId, eventId }, select: { id: true } })))
    throw new AppError("VALIDATION", "Activity does not belong to this event.");
  const s = await db.leaderboardDisplaySettings.upsert({ where: { eventId }, create: { eventId, ...data }, update: data });
  await audit(db, { actorId: actor.id, action: "display.update", entityType: "LeaderboardDisplaySettings", entityId: s.id, next: data });
  await publish(db, { kind: "display", eventId });
  return s;
}

// ───────── Participants ─────────

export interface ParticipantListQuery {
  eventId: string;
  q?: string;
  status?: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  page?: number;
  pageSize?: number;
}

export async function listRegistrations(db: Db, actor: Actor, query: ParticipantListQuery) {
  assertAdmin(actor);
  const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const q = query.q?.trim();
  const where: Prisma.RegistrationWhereInput = {
    eventId: query.eventId,
    ...(query.status ? { status: query.status } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { participant: { fullName: { contains: q, mode: "insensitive" } } },
            { participant: { email: { contains: q, mode: "insensitive" } } },
            { participant: { mobile: { contains: q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.registration.count({ where }),
    db.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        participant: {
          include: {
            activityRegistrations: { where: { activity: { eventId: query.eventId } }, include: { activity: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), rows };
}

const participantEdit = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  mobile: z.string().trim().max(30).optional(),
  affiliation: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "WITHDRAWN", "DISQUALIFIED"]),
});

/** Admins may edit only these permitted fields; ids, event and reference are immutable. */
export async function editParticipant(db: Db, actor: Actor, participantId: string, raw: unknown) {
  assertAdmin(actor);
  const input = parse(participantEdit, raw);
  const prev = await db.participant.findUnique({ where: { id: participantId } });
  if (!prev) throw new AppError("NOT_FOUND", "Participant not found.");
  await db.participant.update({
    where: { id: participantId },
    data: { ...input, mobile: input.mobile || null, affiliation: input.affiliation || null },
  });
  await audit(db, {
    actorId: actor.id,
    action: "participant.update",
    entityType: "Participant",
    entityId: participantId,
    previous: { status: prev.status, fullName: prev.fullName },
    next: { status: input.status, fullName: input.fullName },
  });
}

/** Neutralise spreadsheet formula injection in exported cells. */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Admin-only results export: one row per current result, including the heat number for group starts. */
export async function exportResultsCsv(db: Db, actor: Actor, eventId: string): Promise<string> {
  assertAdmin(actor);
  const results = await db.challengeResult.findMany({
    where: { current: true, attempt: { activity: { eventId } } },
    orderBy: [{ attempt: { activity: { sortOrder: "asc" } } }, { attempt: { heat: "asc" } }, { submittedAt: "asc" }],
    include: {
      attempt: {
        select: {
          attemptNumber: true,
          heat: true,
          elapsedMs: true,
          activity: { select: { name: true, scoringConfig: true } },
          activityRegistration: { select: { participant: { select: { fullName: true } } } },
        },
      },
    },
  });
  const head = [
    "Activity",
    "Heat",
    "Participant",
    "Attempt",
    "Outcome",
    "Result",
    "Elapsed (ms)",
    "Approval",
    "Published",
    "Version",
    "Submitted at",
  ];
  const lines = [head.map(csvCell).join(",")];
  for (const r of results) {
    const cfg = parseScoringConfig(r.attempt.activity.scoringConfig);
    const shown =
      r.resultStatus !== "VALID"
        ? r.resultStatus
        : cfg.success
          ? formatValue(cfg.data, r.finalValue ? r.finalValue.toNumber() : null)
          : r.finalValue?.toString();
    lines.push(
      [
        r.attempt.activity.name,
        r.attempt.heat ?? "",
        r.attempt.activityRegistration.participant.fullName,
        r.attempt.attemptNumber,
        r.resultStatus,
        shown,
        r.attempt.elapsedMs,
        r.approvalStatus,
        r.published ? "yes" : "no",
        r.version,
        r.submittedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(db, { actorId: actor.id, action: "export.results", entityType: "Event", entityId: eventId, next: { rows: results.length } });
  return lines.join("\r\n");
}

export async function exportRegistrationsCsv(db: Db, actor: Actor, eventId: string): Promise<string> {
  assertAdmin(actor);
  const regs = await db.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: {
      participant: {
        include: { activityRegistrations: { where: { activity: { eventId } }, include: { activity: { select: { name: true } } } } },
      },
    },
  });
  const head = [
    "Code",
    "Reference",
    "Name",
    "Email",
    "Mobile",
    "Affiliation",
    "Status",
    "Checked in",
    "Walk-in",
    "Activities",
    "Registered at",
  ];
  const lines = [head.map(csvCell).join(",")];
  for (const r of regs) {
    lines.push(
      [
        r.code,
        r.reference,
        r.participant.fullName,
        r.participant.email,
        r.participant.mobile,
        r.participant.affiliation,
        r.status,
        r.checkedInAt ? "yes" : "no",
        r.walkIn ? "yes" : "no",
        r.participant.activityRegistrations
          .filter((a) => a.status !== "CANCELLED")
          .map((a) => `${a.activity.name} (${a.status})`)
          .join("; "),
        r.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(db, {
    actorId: actor.id,
    action: "export.registrations",
    entityType: "Event",
    entityId: eventId,
    next: { rows: regs.length },
  });
  return lines.join("\r\n");
}

export async function overviewStats(db: Db, actor: Actor, eventId: string) {
  assertAdmin(actor);
  const [registrations, checkedIn, activityRegs, running, completed, pending, activeActivities] = await Promise.all([
    db.registration.count({ where: { eventId, status: { not: "CANCELLED" } } }),
    db.registration.count({ where: { eventId, status: { not: "CANCELLED" }, checkedInAt: { not: null } } }),
    db.activityRegistration.count({ where: { activity: { eventId }, status: "CONFIRMED" } }),
    db.challengeAttempt.count({ where: { activity: { eventId }, status: "RUNNING" } }),
    db.challengeAttempt.count({ where: { activity: { eventId }, status: "SUBMITTED" } }),
    db.challengeResult.count({ where: { attempt: { activity: { eventId } }, current: true, approvalStatus: "PENDING" } }),
    db.eventActivity.count({ where: { eventId, challengeStatus: "ACTIVE" } }),
  ]);
  return { registrations, checkedIn, activityRegs, running, completed, pending, activeActivities };
}
