import { createHash } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import {
  PRAYER_CATEGORY_IDS,
  PRAYER_COLOR_IDS,
  PRAYER_MAX_LENGTH,
  PRAYER_MIN_LENGTH,
  PRAYER_NAME_MAX,
  PRAYER_REPORT_HIDE_AT,
  type PrayerItem,
} from "@/lib/prayer/notes";
import { audit } from "./audit";

export const PRAYER_COOKIE = "prayer_voter";

/** Visitors are anonymous: a random cookie id, hashed with the app secret before it touches the database. */
export function prayerVoterHash(voterId: string): string {
  return createHash("sha256")
    .update(`${process.env.APP_SECRET ?? ""}:prayer:${voterId}`)
    .digest("hex");
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const createSchema = z.object({
  body: z
    .string()
    .transform((s) =>
      s
        .replace(CONTROL, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(PRAYER_MIN_LENGTH, "Write a little more so we know how to pray.")
        .max(PRAYER_MAX_LENGTH, `Keep it under ${PRAYER_MAX_LENGTH} characters.`),
    ),
  authorName: z
    .string()
    .transform((s) => s.replace(CONTROL, "").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(PRAYER_NAME_MAX, `Name is at most ${PRAYER_NAME_MAX} characters.`))
    .nullable()
    .transform((s) => s || null),
  category: z.string().refine((c) => PRAYER_CATEGORY_IDS.includes(c), "Pick a topic."),
  color: z.string().refine((c) => PRAYER_COLOR_IDS.includes(c), "Pick a colour."),
});

export async function createPrayer(db: Db, owner: string, raw: unknown) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "body")] ??= i.message;
    throw new AppError("VALIDATION", Object.values(fieldErrors)[0] ?? "Check your prayer request.", fieldErrors);
  }
  const { body, authorName, category, color } = parsed.data;
  return db.prayerRequest.create({ data: { body, authorName, category, color, ownerHash: owner } });
}

export async function listPrayers(db: Db, opts: { category: string | null; take: number; voter: string | null }) {
  const take = Math.min(Math.max(opts.take, 1), 200);
  const rows = await db.prayerRequest.findMany({
    where: {
      hidden: false,
      ...(opts.category && PRAYER_CATEGORY_IDS.includes(opts.category) ? { category: opts.category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const mine = new Map<string, Set<string>>();
  if (opts.voter && page.length) {
    const reactions = await db.prayerReaction.findMany({
      where: { voterHash: opts.voter, kind: { in: ["PRAY", "REPORT"] }, requestId: { in: page.map((p) => p.id) } },
      select: { requestId: true, kind: true },
    });
    for (const r of reactions) {
      const set = mine.get(r.requestId) ?? new Set<string>();
      set.add(r.kind);
      mine.set(r.requestId, set);
    }
  }
  const items: PrayerItem[] = page.map((p) => ({
    id: p.id,
    body: p.body,
    authorName: p.authorName,
    category: p.category,
    color: p.color,
    prayCount: p.prayCount,
    createdAt: p.createdAt.toISOString(),
    prayed: mine.get(p.id)?.has("PRAY") ?? false,
    mine: opts.voter !== null && p.ownerHash === opts.voter,
    reported: mine.get(p.id)?.has("REPORT") ?? false,
  }));
  return { items, hasMore: rows.length > take };
}

/** Totals for the header strip. */
export async function prayerStats(db: Db) {
  const [requests, prayers] = await Promise.all([
    db.prayerRequest.count({ where: { hidden: false } }),
    db.prayerRequest.aggregate({ where: { hidden: false }, _sum: { prayCount: true } }),
  ]);
  return { requests, prayers: prayers._sum.prayCount ?? 0 };
}

/** "I prayed for this": toggles once per device. The unique key makes it safe against double taps. */
export async function togglePrayed(db: Db, id: string, voter: string): Promise<{ prayed: boolean; prayCount: number }> {
  return db.$transaction(async (tx) => {
    const req = await tx.prayerRequest.findFirst({ where: { id, hidden: false }, select: { id: true } });
    if (!req) throw new AppError("NOT_FOUND", "That prayer request is no longer available.");
    const created = await tx.prayerReaction.createMany({ data: [{ requestId: id, voterHash: voter, kind: "PRAY" }], skipDuplicates: true });
    let prayed = true;
    if (created.count === 1) {
      await tx.prayerRequest.update({ where: { id }, data: { prayCount: { increment: 1 } } });
    } else {
      const removed = await tx.prayerReaction.deleteMany({ where: { requestId: id, voterHash: voter, kind: "PRAY" } });
      prayed = false;
      if (removed.count === 1) await tx.prayerRequest.update({ where: { id }, data: { prayCount: { decrement: 1 } } });
    }
    const { prayCount } = await tx.prayerRequest.findUniqueOrThrow({ where: { id }, select: { prayCount: true } });
    return { prayed, prayCount };
  });
}

/** Flag a note. Once enough different devices report it, it is hidden until an admin reviews it. */
export async function reportPrayer(db: Db, id: string, voter: string): Promise<{ hidden: boolean }> {
  return db.$transaction(async (tx) => {
    const req = await tx.prayerRequest.findFirst({ where: { id, hidden: false }, select: { ownerHash: true } });
    if (!req) throw new AppError("NOT_FOUND", "That prayer request is no longer available.");
    if (req.ownerHash === voter) throw new AppError("VALIDATION", "You can delete your own request instead.");
    const created = await tx.prayerReaction.createMany({
      data: [{ requestId: id, voterHash: voter, kind: "REPORT" }],
      skipDuplicates: true,
    });
    if (created.count === 0) return { hidden: false };
    const updated = await tx.prayerRequest.update({
      where: { id },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true },
    });
    if (updated.reportCount >= PRAYER_REPORT_HIDE_AT) {
      await tx.prayerRequest.update({ where: { id }, data: { hidden: true } });
      return { hidden: true };
    }
    return { hidden: false };
  });
}

export async function deleteOwnPrayer(db: Db, id: string, owner: string) {
  const r = await db.prayerRequest.deleteMany({ where: { id, ownerHash: owner } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "You can only delete your own prayer requests.");
}

export async function setPrayerHidden(db: Db, actor: Actor, id: string, hidden: boolean) {
  assertAdmin(actor);
  await db.$transaction(async (tx) => {
    // Un-hiding is a review decision: wipe the reports so the note is not instantly hidden again.
    await tx.prayerRequest.update({ where: { id }, data: hidden ? { hidden } : { hidden, reportCount: 0 } });
    if (!hidden) await tx.prayerReaction.deleteMany({ where: { requestId: id, kind: "REPORT" } });
  });
  await audit(db, { actorId: actor.id, action: hidden ? "prayer.hide" : "prayer.unhide", entityType: "PrayerRequest", entityId: id });
}

export async function deletePrayer(db: Db, actor: Actor, id: string) {
  assertAdmin(actor);
  const p = await db.prayerRequest.delete({ where: { id } });
  await audit(db, { actorId: actor.id, action: "prayer.delete", entityType: "PrayerRequest", entityId: id, previous: { body: p.body } });
}
