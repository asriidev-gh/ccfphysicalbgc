import type { Db } from "@/lib/db";
import { assertActivityAccess, type Actor } from "@/lib/auth/policy";
import { AppError } from "@/lib/errors";
import { publish } from "@/lib/realtime/bus";
import { audit } from "./audit";
import { loadConfig } from "./challenge";
import { formatValue } from "./leaderboard";

/** Local-development record cleanup. Every entry point refuses to run in production. */
export function assertDev() {
  if (process.env.NODE_ENV === "production") throw new AppError("FORBIDDEN", "Record cleanup is only available in local development.");
}

export interface DevRecord {
  id: string;
  name: string;
  attempt: number;
  display: string;
  status: string;
}

export async function listRecords(db: Db, actor: Actor, activityId: string): Promise<DevRecord[]> {
  assertDev();
  await assertActivityAccess(db, actor, activityId);
  const a = await db.eventActivity.findUniqueOrThrow({ where: { id: activityId }, select: { scoringConfig: true } });
  const cfg = loadConfig(a.scoringConfig);
  const rows = await db.challengeResult.findMany({
    where: { current: true, attempt: { activityId } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      resultStatus: true,
      finalValue: true,
      attempt: { select: { attemptNumber: true, activityRegistration: { select: { participant: { select: { fullName: true } } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.attempt.activityRegistration.participant.fullName,
    attempt: r.attempt.attemptNumber,
    display: r.resultStatus === "VALID" ? formatValue(cfg, r.finalValue ? r.finalValue.toNumber() : null) : r.resultStatus,
    status: r.resultStatus,
  }));
}

/** Permanently remove every attempt (and its results, station and checkpoint logs) for the activity; participants go back to waiting. */
export async function deleteAllRecords(db: Db, actor: Actor, activityId: string) {
  assertDev();
  await assertActivityAccess(db, actor, activityId);
  const a = await db.eventActivity.findUniqueOrThrow({ where: { id: activityId }, select: { eventId: true } });
  const [del, reset] = await db.$transaction([
    db.challengeAttempt.deleteMany({ where: { activityId } }),
    db.activityRegistration.updateMany({
      where: { activityId, queueStatus: { in: ["IN_PROGRESS", "DONE"] } },
      data: { queueStatus: "WAITING" },
    }),
  ]);
  await audit(db, { actorId: actor.id, action: "dev.records.deleteAll", entityType: "EventActivity", entityId: activityId, next: { attempts: del.count } });
  await publish(db, { kind: "results", eventId: a.eventId, activityId });
  return { attempts: del.count, reset: reset.count };
}

// ───────── Participants (local development only) ─────────

async function publishAllResults(db: Db) {
  const acts = await db.eventActivity.findMany({ select: { id: true, eventId: true } });
  await Promise.all(acts.map((a) => publish(db, { kind: "results", eventId: a.eventId, activityId: a.id })));
}

/** Permanently delete one participant with their registrations, activity enrolments, attempts and results. */
export async function deleteParticipant(db: Db, actor: Actor, participantId: string) {
  assertDev();
  const p = await db.participant.findUnique({ where: { id: participantId }, select: { id: true, fullName: true } });
  if (!p) throw new AppError("NOT_FOUND", "Participant not found.");
  await db.participant.delete({ where: { id: p.id } });
  await audit(db, { actorId: actor.id, action: "dev.participant.delete", entityType: "Participant", entityId: p.id, previous: { fullName: p.fullName } });
  await publishAllResults(db);
  return { deleted: true };
}

/** Local-development: check everyone who is waiting (and has not started) back out to "not arrived". */
export async function checkOutAll(db: Db, actor: Actor, activityId: string) {
  assertDev();
  await assertActivityAccess(db, actor, activityId);
  const res = await db.activityRegistration.updateMany({
    where: { activityId, queueStatus: "WAITING", attempts: { none: { status: { not: "CANCELLED" } } } },
    data: { queueStatus: "NOT_ARRIVED", checkedInAt: null },
  });
  await audit(db, { actorId: actor.id, action: "dev.checkoutAll", entityType: "EventActivity", entityId: activityId, next: { count: res.count } });
  return { count: res.count };
}

/** Set (or change) a participant's gender; gender leaderboards update immediately. */
export async function setParticipantGender(db: Db, actor: Actor, participantId: string, gender: "MALE" | "FEMALE") {
  const p = await db.participant.findUnique({ where: { id: participantId }, select: { id: true, gender: true } });
  if (!p) throw new AppError("NOT_FOUND", "Participant not found.");
  await db.participant.update({ where: { id: p.id }, data: { gender } });
  await audit(db, { actorId: actor.id, action: "participant.gender", entityType: "Participant", entityId: p.id, previous: { gender: p.gender }, next: { gender } });
  await publishAllResults(db);
  return { gender };
}

/** Permanently delete every participant and everything attached to them. */
export async function deleteAllParticipants(db: Db, actor: Actor) {
  assertDev();
  const res = await db.participant.deleteMany({});
  await audit(db, { actorId: actor.id, action: "dev.participant.deleteAll", entityType: "Participant", entityId: actor.id, next: { count: res.count } });
  await publishAllResults(db);
  return { count: res.count };
}
