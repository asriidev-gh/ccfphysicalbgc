import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ResultStatus } from "@/generated/prisma/enums";
import type { Db, Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertActivityAccess, assertAdmin, isAdmin, type Actor } from "@/lib/auth/policy";
import { calculate, elapsedBetween, ScoringError } from "@/lib/scoring/engine";
import { parseScoringConfig, type ScoringConfig } from "@/lib/scoring/schema";
import { publish } from "@/lib/realtime/bus";
import { audit } from "./audit";

export function loadConfig(json: unknown): ScoringConfig {
  const p = parseScoringConfig(json);
  if (!p.success) throw new AppError("CONFLICT", "This activity's scoring configuration is invalid. Contact an administrator.");
  return p.data;
}

async function lockEnrolment(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "ActivityRegistration" WHERE id = ${id}::uuid FOR UPDATE`;
}

async function loadAttemptForActor(db: Db, actor: Actor, attemptId: string) {
  const attempt = await db.challengeAttempt.findUnique({
    where: { id: attemptId },
    include: { activity: true, activityRegistration: true },
  });
  if (!attempt) throw new AppError("NOT_FOUND", "Attempt not found.");
  // Authorisation is derived from the attempt's own activity, never from client-supplied ids.
  await assertActivityAccess(db, actor, attempt.activityId);
  return attempt;
}

// ───────── Check-in ─────────

export async function checkIn(db: Db, actor: Actor, activityRegistrationId: string) {
  const ar = await db.activityRegistration.findUnique({ where: { id: activityRegistrationId } });
  if (!ar) throw new AppError("NOT_FOUND", "Participant not found.");
  await assertActivityAccess(db, actor, ar.activityId);
  if (ar.status !== "CONFIRMED") throw new AppError("CONFLICT", "Only confirmed registrations can be checked in.");
  if (ar.queueStatus !== "NOT_ARRIVED") return { alreadyCheckedIn: true };
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.activityRegistration.update({ where: { id: ar.id }, data: { queueStatus: "WAITING", checkedInAt: now } });
    await tx.registration.updateMany({
      where: { participantId: ar.participantId, checkedInAt: null, event: { activities: { some: { id: ar.activityId } } } },
      data: { checkedInAt: now },
    });
    await audit(tx, { actorId: actor.id, action: "checkin", entityType: "ActivityRegistration", entityId: ar.id });
  });
  return { alreadyCheckedIn: false };
}

// ───────── Start / finish / cancel ─────────

export async function startAttempt(db: Db, actor: Actor, input: { activityRegistrationId: string; opponentRegistrationId?: string }) {
  const first = await db.activityRegistration.findUnique({ where: { id: input.activityRegistrationId }, select: { activityId: true } });
  if (!first) throw new AppError("NOT_FOUND", "Participant not found.");
  await assertActivityAccess(db, actor, first.activityId);

  try {
    return await db.$transaction(async (tx) => {
      const ids = [input.activityRegistrationId, input.opponentRegistrationId].filter((x): x is string => Boolean(x)).sort();
      for (const id of ids) await lockEnrolment(tx, id);

      const ar = await tx.activityRegistration.findUniqueOrThrow({
        where: { id: input.activityRegistrationId },
        include: { activity: true, participant: { select: { status: true } } },
      });
      const cfg = loadConfig(ar.activity.scoringConfig);
      if (ar.activity.challengeStatus !== "ACTIVE") throw new AppError("CONFLICT", "This activity is not active.");
      if (ar.status !== "CONFIRMED") throw new AppError("CONFLICT", "Participant is not confirmed for this activity.");
      if (ar.participant.status !== "ACTIVE") throw new AppError("CONFLICT", "Participant is not eligible to compete.");
      if (ar.queueStatus === "NOT_ARRIVED") throw new AppError("CONFLICT", "Check the participant in first.");
      if (ar.queueStatus === "IN_PROGRESS") throw new AppError("CONFLICT", "A challenge is already running for this participant.");

      let opponentId: string | undefined;
      if (cfg.template === "MATCH") {
        if (!input.opponentRegistrationId) throw new AppError("VALIDATION", "Choose an opponent for this match.");
        if (input.opponentRegistrationId === ar.id) throw new AppError("VALIDATION", "A participant cannot play themselves.");
        const opp = await tx.activityRegistration.findUnique({
          where: { id: input.opponentRegistrationId },
          include: { participant: { select: { status: true } } },
        });
        if (!opp || opp.activityId !== ar.activityId) throw new AppError("VALIDATION", "Opponent is not in this activity.");
        if (opp.status !== "CONFIRMED" || opp.participant.status !== "ACTIVE") throw new AppError("CONFLICT", "Opponent is not eligible.");
        if (opp.queueStatus === "NOT_ARRIVED") throw new AppError("CONFLICT", "Check the opponent in first.");
        if (opp.queueStatus === "IN_PROGRESS") throw new AppError("CONFLICT", "The opponent is already in a match.");
        opponentId = opp.id;
      }

      const prior = await tx.challengeAttempt.findMany({
        where: { activityRegistrationId: ar.id },
        select: { attemptNumber: true, status: true },
      });
      const used = prior.filter((p) => p.status !== "CANCELLED").length;
      if (used >= cfg.attemptPolicy.maxAttempts) throw new AppError("CONFLICT", "No attempts remaining for this participant.");
      const attemptNumber = prior.reduce((m, p) => Math.max(m, p.attemptNumber), 0) + 1;

      // Authoritative start instant is taken here, on the server.
      const startedAt = new Date();
      const attempt = await tx.challengeAttempt.create({
        data: {
          activityId: ar.activityId,
          activityRegistrationId: ar.id,
          opponentRegistrationId: opponentId,
          attemptNumber,
          status: "RUNNING",
          startedAt,
          startedById: actor.id,
        },
      });
      await tx.activityRegistration.updateMany({
        where: { id: { in: [ar.id, ...(opponentId ? [opponentId] : [])] } },
        data: { queueStatus: "IN_PROGRESS" },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "attempt.start",
        entityType: "ChallengeAttempt",
        entityId: attempt.id,
        next: { attemptNumber },
      });
      return { attemptId: attempt.id, startedAt: startedAt.toISOString(), serverNow: new Date().toISOString(), attemptNumber };
    });
  } catch (e) {
    // Partial unique index backstop: only one RUNNING attempt per enrolment.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new AppError("CONFLICT", "A challenge is already running for this participant.");
    throw e;
  }
}

/**
 * Start several participants together (a heat). Everyone gets the same server-side start instant,
 * and the start is all-or-nothing: if anyone is not eligible, nobody starts.
 */
export async function startHeat(db: Db, actor: Actor, activityRegistrationIds: string[]) {
  if (!Array.isArray(activityRegistrationIds) || activityRegistrationIds.length === 0)
    throw new AppError("VALIDATION", "Select at least one runner.");
  const ids = [...new Set(z.array(z.string().uuid()).max(100).parse(activityRegistrationIds))].sort();
  const found = await db.activityRegistration.findMany({ where: { id: { in: ids } }, select: { activityId: true } });
  if (found.length !== ids.length) throw new AppError("NOT_FOUND", "A selected participant was not found.");
  const activityId = found[0].activityId;
  if (found.some((f) => f.activityId !== activityId)) throw new AppError("VALIDATION", "A heat can only include one activity.");
  await assertActivityAccess(db, actor, activityId);

  try {
    return await db.$transaction(async (tx) => {
      for (const id of ids) await lockEnrolment(tx, id);
      const ars = await tx.activityRegistration.findMany({
        where: { id: { in: ids } },
        include: {
          activity: true,
          participant: { select: { fullName: true, status: true } },
          attempts: { select: { attemptNumber: true, status: true } },
        },
      });
      const cfg = loadConfig(ars[0].activity.scoringConfig);
      if (cfg.template === "MATCH") throw new AppError("VALIDATION", "Heats are not available for head-to-head matches.");
      if (ars[0].activity.challengeStatus !== "ACTIVE") throw new AppError("CONFLICT", "This activity is not active.");

      for (const ar of ars) {
        const who = ar.participant.fullName;
        if (ar.status !== "CONFIRMED") throw new AppError("CONFLICT", `${who} is not confirmed for this activity.`);
        if (ar.participant.status !== "ACTIVE") throw new AppError("CONFLICT", `${who} is not eligible to compete.`);
        if (ar.queueStatus === "NOT_ARRIVED") throw new AppError("CONFLICT", `Check ${who} in first.`);
        if (ar.queueStatus === "IN_PROGRESS") throw new AppError("CONFLICT", `${who} already has a challenge running.`);
        if (ar.attempts.filter((p) => p.status !== "CANCELLED").length >= cfg.attemptPolicy.maxAttempts)
          throw new AppError("CONFLICT", `${who} has no attempts remaining.`);
      }

      // Serialise heat numbering per activity so two concurrent heats never share a number.
      await tx.$queryRaw`SELECT id FROM "EventActivity" WHERE id = ${activityId}::uuid FOR UPDATE`;
      const heat = ((await tx.challengeAttempt.aggregate({ where: { activityId }, _max: { heat: true } }))._max.heat ?? 0) + 1;
      const startedAt = new Date(); // one authoritative instant for the whole heat
      const attemptIds: string[] = [];
      for (const ar of ars) {
        const attemptNumber = ar.attempts.reduce((m, p) => Math.max(m, p.attemptNumber), 0) + 1;
        const attempt = await tx.challengeAttempt.create({
          data: {
            activityId,
            activityRegistrationId: ar.id,
            attemptNumber,
            heat,
            status: "RUNNING",
            startedAt,
            startedById: actor.id,
          },
        });
        attemptIds.push(attempt.id);
        await audit(tx, {
          actorId: actor.id,
          action: "attempt.start",
          entityType: "ChallengeAttempt",
          entityId: attempt.id,
          next: { attemptNumber, heat, runners: ids.length },
        });
      }
      await tx.activityRegistration.updateMany({ where: { id: { in: ids } }, data: { queueStatus: "IN_PROGRESS" } });
      return { heat, attemptIds, startedAt: startedAt.toISOString(), serverNow: new Date().toISOString() };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new AppError("CONFLICT", "Someone in this heat already has a challenge running.");
    throw e;
  }
}

/**
 * Record a runner crossing the line. When the activity has no result fields to enter (a pure
 * stopwatch result), the result is submitted automatically; otherwise staff enter the fields next.
 */
export async function finishRunner(db: Db, actor: Actor, attemptId: string) {
  const attempt = await loadAttemptForActor(db, actor, attemptId);
  if (attempt.status === "RUNNING") await finishAttempt(db, actor, attemptId);
  else if (attempt.status !== "FINISHED") throw new AppError("CONFLICT", "This attempt is not running (it may already be finished).");
  const cfg = loadConfig(attempt.activity.scoringConfig);
  if (cfg.fields.length > 0) return { submitted: false };
  // Idempotent: a retry after a failed submit reuses the same key.
  await submitResult(db, actor, { attemptId, raw: {}, status: "VALID", submitKey: `auto-${attemptId}` });
  return { submitted: true };
}

export async function finishAttempt(db: Db, actor: Actor, attemptId: string) {
  const attempt = await loadAttemptForActor(db, actor, attemptId);
  const finishedAt = new Date();
  let elapsedMs: number;
  try {
    elapsedMs = elapsedBetween(attempt.startedAt, finishedAt);
  } catch {
    throw new AppError("CONFLICT", "Invalid timing data for this attempt.");
  }
  // Conditional update: only one concurrent finish can win.
  const res = await db.challengeAttempt.updateMany({
    where: { id: attempt.id, status: "RUNNING" },
    data: { status: "FINISHED", finishedAt, elapsedMs },
  });
  if (res.count === 0) throw new AppError("CONFLICT", "This attempt is not running (it may already be finished).");
  await audit(db, {
    actorId: actor.id,
    action: "attempt.finish",
    entityType: "ChallengeAttempt",
    entityId: attempt.id,
    next: { elapsedMs },
  });
  return { attemptId, finishedAt: finishedAt.toISOString(), elapsedMs };
}

export async function cancelAttempt(db: Db, actor: Actor, attemptId: string, reason: string) {
  const why = z.string().trim().min(3, "Give a reason for cancelling").max(300).parse(reason);
  const attempt = await loadAttemptForActor(db, actor, attemptId);
  await db.$transaction(async (tx) => {
    const res = await tx.challengeAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["RUNNING", "FINISHED"] } },
      data: { status: "CANCELLED", cancellationReason: why },
    });
    if (res.count === 0) throw new AppError("CONFLICT", "This attempt can no longer be cancelled.");
    const ids = [attempt.activityRegistrationId, ...(attempt.opponentRegistrationId ? [attempt.opponentRegistrationId] : [])];
    await tx.activityRegistration.updateMany({ where: { id: { in: ids }, queueStatus: "IN_PROGRESS" }, data: { queueStatus: "WAITING" } });
    await audit(tx, {
      actorId: actor.id,
      action: "attempt.cancel",
      entityType: "ChallengeAttempt",
      entityId: attempt.id,
      next: { reason: why },
    });
  });
  return { cancelled: true };
}

// ───────── Result submission ─────────

export const submitInput = z.object({
  attemptId: z.string().uuid(),
  raw: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["VALID", "INCOMPLETE", "DISQUALIFIED", "WITHDRAWN"]).default("VALID"),
  /** Client-generated idempotency key; a retry with the same key returns the original result. */
  submitKey: z.string().min(8).max(100),
});

function publishedFlags(activity: { requireApproval: boolean; leaderboardPublished: boolean }) {
  return activity.requireApproval
    ? { approvalStatus: "PENDING" as const, published: false }
    : { approvalStatus: "APPROVED" as const, published: activity.leaderboardPublished };
}

export async function submitResult(db: Db, actor: Actor, rawInput: unknown) {
  const input = submitInput.parse(rawInput);
  const attempt = await loadAttemptForActor(db, actor, input.attemptId);
  const activity = attempt.activity;

  // Idempotent retry: the same key for the same attempt returns the stored result.
  if (attempt.submitKey === input.submitKey) {
    const existing = await db.challengeResult.findFirst({ where: { attemptId: attempt.id, version: 1 } });
    if (existing) return { resultId: existing.id, approvalStatus: existing.approvalStatus, published: existing.published, duplicate: true };
  }
  if (attempt.status === "SUBMITTED") throw new AppError("CONFLICT", "A result was already submitted for this attempt.");
  if (attempt.status === "CANCELLED") throw new AppError("CONFLICT", "This attempt was cancelled.");

  const cfg = loadConfig(activity.scoringConfig);
  const status = input.status as ResultStatus;

  // Timer-driven attempts must be stopped first, except when abandoning the attempt.
  if (attempt.status === "RUNNING" && status === "VALID") throw new AppError("CONFLICT", "Stop the timer before submitting a result.");

  const scoringVersion = await db.scoringConfigVersion.findUnique({
    where: { activityId_version: { activityId: activity.id, version: activity.scoringVersion } },
  });
  if (!scoringVersion) throw new AppError("CONFLICT", "Scoring configuration is missing a version snapshot.");

  const out = await db.$transaction(async (tx) => {
    await lockEnrolment(tx, attempt.activityRegistrationId);

    let elapsedMs = attempt.elapsedMs;
    let finishedAt = attempt.finishedAt;
    if (attempt.status === "RUNNING") {
      finishedAt = new Date();
      elapsedMs = elapsedBetween(attempt.startedAt, finishedAt);
    }

    let calc;
    try {
      calc = calculate(cfg, { raw: input.raw, elapsedMs, status });
    } catch (e) {
      if (e instanceof ScoringError) throw new AppError("VALIDATION", "Please correct the highlighted values.", e.fieldErrors);
      throw e;
    }

    // Guard concurrent submits: only a RUNNING/FINISHED attempt flips to SUBMITTED.
    const flip = await tx.challengeAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["RUNNING", "FINISHED"] } },
      data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: actor.id, submitKey: input.submitKey, finishedAt, elapsedMs },
    });
    if (flip.count === 0) throw new AppError("CONFLICT", "A result was already submitted for this attempt.");

    const flags = publishedFlags(activity);
    const result = await tx.challengeResult.create({
      data: {
        attemptId: attempt.id,
        rawData: input.raw as Prisma.InputJsonValue,
        calculatedData: calc.metrics as Prisma.InputJsonValue,
        penaltyData: calc.penalty as Prisma.InputJsonValue,
        finalValue: calc.primary === null ? null : new Prisma.Decimal(calc.primary),
        resultStatus: status,
        scoringVersionId: scoringVersion.id,
        submittedById: actor.id,
        approvedAt: flags.approvalStatus === "APPROVED" ? new Date() : null,
        ...flags,
      },
    });

    const ids = [attempt.activityRegistrationId, ...(attempt.opponentRegistrationId ? [attempt.opponentRegistrationId] : [])];
    const used = await tx.challengeAttempt.count({
      where: { activityRegistrationId: attempt.activityRegistrationId, status: { not: "CANCELLED" } },
    });
    const done = status === "WITHDRAWN" || status === "DISQUALIFIED" || used >= cfg.attemptPolicy.maxAttempts;
    await tx.activityRegistration.updateMany({ where: { id: { in: ids } }, data: { queueStatus: done ? "DONE" : "WAITING" } });
    await audit(tx, {
      actorId: actor.id,
      action: "result.submit",
      entityType: "ChallengeResult",
      entityId: result.id,
      next: { status, finalValue: calc.primary, approval: flags.approvalStatus },
    });
    return { resultId: result.id, approvalStatus: result.approvalStatus, published: result.published, duplicate: false };
  });

  if (out.published) await publish(db, { kind: "results", eventId: activity.eventId, activityId: activity.id });
  return out;
}

// ───────── Approval, disputes, corrections ─────────

export async function reviewResult(db: Db, actor: Actor, resultId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const result = await db.challengeResult.findUnique({ where: { id: resultId }, include: { attempt: { include: { activity: true } } } });
  if (!result || !result.current) throw new AppError("NOT_FOUND", "Result not found.");
  const activity = result.attempt.activity;
  await assertActivityAccess(db, actor, activity.id);
  if (activity.independentApproval && result.submittedById === actor.id)
    throw new AppError("FORBIDDEN", "A different reviewer must approve this result.");
  if (result.disputed && !isAdmin(actor)) throw new AppError("FORBIDDEN", "Only an administrator can resolve a disputed result.");

  const published = decision === "APPROVED" && activity.leaderboardPublished && !result.disputed;
  const res = await db.$transaction(async (tx) => {
    const upd = await tx.challengeResult.updateMany({
      where: { id: result.id, approvalStatus: "PENDING", current: true },
      data: { approvalStatus: decision, approvedById: actor.id, approvedAt: new Date(), published },
    });
    if (upd.count === 0) throw new AppError("CONFLICT", "This result has already been reviewed.");
    await tx.resultApproval.create({ data: { resultId: result.id, reviewerId: actor.id, decision, note: note?.slice(0, 500) } });
    await audit(tx, {
      actorId: actor.id,
      action: `result.${decision.toLowerCase()}`,
      entityType: "ChallengeResult",
      entityId: result.id,
      previous: { approvalStatus: "PENDING" },
      next: { approvalStatus: decision, published },
    });
    return { published };
  });
  await publish(db, { kind: "results", eventId: activity.eventId, activityId: activity.id });
  return res;
}

/** Lead flags a result: hides it from the public board until an administrator resolves it. */
export async function flagDispute(db: Db, actor: Actor, resultId: string, note: string) {
  const text = z.string().trim().min(3, "Describe the problem").max(500).parse(note);
  const result = await db.challengeResult.findUnique({ where: { id: resultId }, include: { attempt: { include: { activity: true } } } });
  if (!result || !result.current) throw new AppError("NOT_FOUND", "Result not found.");
  await assertActivityAccess(db, actor, result.attempt.activityId);
  await db.$transaction(async (tx) => {
    await tx.challengeResult.update({ where: { id: result.id }, data: { disputed: true, disputeNote: text, published: false } });
    await audit(tx, {
      actorId: actor.id,
      action: "result.dispute",
      entityType: "ChallengeResult",
      entityId: result.id,
      next: { note: text },
    });
  });
  await publish(db, { kind: "results", eventId: result.attempt.activity.eventId, activityId: result.attempt.activityId });
  return { flagged: true };
}

/**
 * Staff assigned to the activity (and admins) can update a score at any time. The update is stored
 * as a new result version, so history and the audit log are preserved.
 */
export async function correctResult(
  db: Db,
  actor: Actor,
  resultId: string,
  input: { raw: Record<string, unknown>; status: ResultStatus; reason?: string },
) {
  const reason =
    z
      .string()
      .trim()
      .max(500)
      .parse(input.reason ?? "") || "Score updated";
  const old = await db.challengeResult.findUnique({
    where: { id: resultId },
    include: { attempt: { include: { activity: true } }, scoringVersion: true },
  });
  if (!old || !old.current) throw new AppError("NOT_FOUND", "Result not found.");
  await assertActivityAccess(db, actor, old.attempt.activityId);
  // Re-use the ORIGINAL scoring version so a later rule change cannot alter this result.
  const cfg = loadConfig(old.scoringVersion.config);
  let calc;
  try {
    calc = calculate(cfg, { raw: input.raw, elapsedMs: old.attempt.elapsedMs, status: input.status });
  } catch (e) {
    if (e instanceof ScoringError) throw new AppError("VALIDATION", "Please correct the highlighted values.", e.fieldErrors);
    throw e;
  }
  const activity = old.attempt.activity;
  const flags = publishedFlags(activity);
  const created = await db.$transaction(async (tx) => {
    const flip = await tx.challengeResult.updateMany({ where: { id: old.id, current: true }, data: { current: false, published: false } });
    if (flip.count === 0) throw new AppError("CONFLICT", "This result was changed by someone else. Reload and retry.");
    const n = await tx.challengeResult.create({
      data: {
        attemptId: old.attemptId,
        version: old.version + 1,
        rawData: input.raw as Prisma.InputJsonValue,
        calculatedData: calc.metrics as Prisma.InputJsonValue,
        penaltyData: calc.penalty as Prisma.InputJsonValue,
        finalValue: calc.primary === null ? null : new Prisma.Decimal(calc.primary),
        resultStatus: input.status,
        scoringVersionId: old.scoringVersionId,
        submittedById: actor.id,
        correctionOfId: old.id,
        correctionReason: reason,
        approvedAt: flags.approvalStatus === "APPROVED" ? new Date() : null,
        ...flags,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "result.correct",
      entityType: "ChallengeResult",
      entityId: n.id,
      previous: { id: old.id, finalValue: old.finalValue?.toString(), status: old.resultStatus },
      next: { finalValue: calc.primary, status: input.status, reason },
    });
    return n;
  });
  await publish(db, { kind: "results", eventId: activity.eventId, activityId: activity.id });
  return { resultId: created.id, version: created.version };
}

/**
 * Staff delete a submitted score. The result and its attempt are kept for the audit trail but removed from
 * every board, and the participant goes back to the queue (an attempt is freed up) so they can run again.
 */
export async function deleteResult(db: Db, actor: Actor, resultId: string, reason?: string) {
  const why =
    z
      .string()
      .trim()
      .max(300)
      .parse(reason ?? "") || "Score deleted";
  const result = await db.challengeResult.findUnique({ where: { id: resultId }, include: { attempt: { include: { activity: true } } } });
  if (!result || !result.current) throw new AppError("NOT_FOUND", "Result not found.");
  const { attempt } = result;
  await assertActivityAccess(db, actor, attempt.activityId);
  const cfg = loadConfig(attempt.activity.scoringConfig);
  await db.$transaction(async (tx) => {
    await lockEnrolment(tx, attempt.activityRegistrationId);
    const gone = await tx.challengeResult.updateMany({
      where: { id: result.id, current: true },
      data: { current: false, published: false },
    });
    if (gone.count === 0) throw new AppError("CONFLICT", "This result was already changed. Reload and retry.");
    await tx.challengeAttempt.update({ where: { id: attempt.id }, data: { status: "CANCELLED", cancellationReason: why } });
    const used = await tx.challengeAttempt.count({
      where: { activityRegistrationId: attempt.activityRegistrationId, status: { not: "CANCELLED" } },
    });
    const ids = [attempt.activityRegistrationId, ...(attempt.opponentRegistrationId ? [attempt.opponentRegistrationId] : [])];
    await tx.activityRegistration.updateMany({
      where: { id: { in: ids }, queueStatus: { not: "IN_PROGRESS" } },
      data: { queueStatus: used >= cfg.attemptPolicy.maxAttempts ? "DONE" : "WAITING" },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "result.delete",
      entityType: "ChallengeResult",
      entityId: result.id,
      previous: { finalValue: result.finalValue?.toString(), status: result.resultStatus },
      next: { reason: why },
    });
  });
  await publish(db, { kind: "results", eventId: attempt.activity.eventId, activityId: attempt.activityId });
  return { deleted: true };
}

/** Administrator dismisses a dispute and restores the result as it was reviewed. */
export async function dismissDispute(db: Db, actor: Actor, resultId: string) {
  assertAdmin(actor);
  const r = await db.challengeResult.findUnique({ where: { id: resultId }, include: { attempt: { include: { activity: true } } } });
  if (!r || !r.current || !r.disputed) throw new AppError("NOT_FOUND", "No open dispute on this result.");
  const activity = r.attempt.activity;
  await db.$transaction(async (tx) => {
    await tx.challengeResult.update({
      where: { id: r.id },
      data: { disputed: false, disputeNote: null, published: r.approvalStatus === "APPROVED" && activity.leaderboardPublished },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "result.dispute_dismissed",
      entityType: "ChallengeResult",
      entityId: r.id,
      previous: { note: r.disputeNote },
    });
  });
  await publish(db, { kind: "results", eventId: activity.eventId, activityId: activity.id });
  return { dismissed: true };
}
