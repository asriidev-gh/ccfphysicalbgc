import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin } from "@/lib/auth/policy";
import {
  cancelAttempt,
  checkIn,
  correctResult,
  deleteResult,
  dismissDispute,
  finishAttempt,
  finishRunner,
  flagDispute,
  reviewResult,
  startAttempt,
  startHeat,
  submitResult,
} from "@/lib/services/challenge";
import { exportResultsCsv } from "@/lib/services/admin";
import { createUser, saveActivity, saveSport, setActivityState, updateUser, listRegistrations } from "@/lib/services/admin";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { registerParticipant } from "@/lib/services/registration";
import { defaultScoringConfig, presetFor } from "@/lib/scoring/templates";
import { makeWorld, makeUser, person, type World } from "./factory";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterAll(async () => {
  await w.cleanup();
  await db.$disconnect();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : `ERR:${String(e)}`;
  }
};

async function enrol(activityId: string, checkedIn = true) {
  const r = await registerParticipant(db, w.event.slug, person({ activityIds: [activityId] }));
  const ar = await db.activityRegistration.findFirstOrThrow({
    where: { activityId, participant: { registrations: { some: { reference: r.reference } } } },
  });
  if (checkedIn) await checkIn(db, w.lead, ar.id);
  return ar;
}

describe("timing and attempt state machine", () => {
  it("start → finish → submit records server-side timestamps and integer elapsed ms", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const before = Date.now();
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    expect(new Date(s.startedAt).getTime()).toBeGreaterThanOrEqual(before - 5);
    await new Promise((r) => setTimeout(r, 40));
    const f = await finishAttempt(db, w.lead, s.attemptId);
    expect(Number.isInteger(f.elapsedMs)).toBe(true);
    expect(f.elapsedMs).toBeGreaterThanOrEqual(35);
    const att = await db.challengeAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(att.elapsedMs).toBe(f.elapsedMs);
    expect(att.finishedAt!.getTime() - att.startedAt.getTime()).toBe(f.elapsedMs);
  });

  it("prevents duplicate starts, including concurrent ones", async () => {
    const a = await w.makeActivity({ config: { ...defaultScoringConfig("TIME"), attemptPolicy: { maxAttempts: 5, select: "BEST" } } });
    const ar = await enrol(a.id);
    const rs = await Promise.allSettled([1, 2, 3, 4].map(() => startAttempt(db, w.lead, { activityRegistrationId: ar.id })));
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.challengeAttempt.count({ where: { activityRegistrationId: ar.id, status: "RUNNING" } })).toBe(1);
    expect(await code(startAttempt(db, w.lead, { activityRegistrationId: ar.id }))).toBe("CONFLICT");
  });

  it("requires check-in, an active activity, and respects the attempt limit", async () => {
    const a = await w.makeActivity();
    const notIn = await enrol(a.id, false);
    expect(await code(startAttempt(db, w.lead, { activityRegistrationId: notIn.id }))).toBe("CONFLICT");

    const draft = await w.makeActivity({ challengeStatus: "DRAFT" });
    const d = await enrol(draft.id);
    expect(await code(startAttempt(db, w.lead, { activityRegistrationId: d.id }))).toBe("CONFLICT");

    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    await submitResult(db, w.lead, { attemptId: s.attemptId, raw: { penalties: 0 }, submitKey: "key-limit-0001" });
    expect(await code(startAttempt(db, w.lead, { activityRegistrationId: ar.id }))).toBe("CONFLICT"); // maxAttempts = 1
  });

  it("prevents duplicate finishes", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    const rs = await Promise.allSettled([finishAttempt(db, w.lead, s.attemptId), finishAttempt(db, w.lead, s.attemptId)]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await code(finishAttempt(db, w.lead, s.attemptId))).toBe("CONFLICT");
  });
});

describe("cancel semantics", () => {
  it("cancel requires a reason, keeps the row, and allows a fresh attempt", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await expect(cancelAttempt(db, w.lead, s.attemptId, "")).rejects.toThrow();
    await cancelAttempt(db, w.lead, s.attemptId, "False start");
    const row = await db.challengeAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(row).toMatchObject({ status: "CANCELLED", cancellationReason: "False start" });
    expect(await code(finishAttempt(db, w.lead, s.attemptId))).toBe("CONFLICT");
    const again = await startAttempt(db, w.lead, { activityRegistrationId: ar.id }); // cancelled doesn't consume the limit
    expect(again.attemptNumber).toBe(2);
  });
});

describe("result submission", () => {
  it("is idempotent for a retried submit and rejects a second, different submit", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    const first = await submitResult(db, w.lead, { attemptId: s.attemptId, raw: { penalties: 1 }, submitKey: "retry-key-0001" });
    const retry = await submitResult(db, w.lead, { attemptId: s.attemptId, raw: { penalties: 1 }, submitKey: "retry-key-0001" });
    expect(retry.duplicate).toBe(true);
    expect(retry.resultId).toBe(first.resultId);
    expect(await code(submitResult(db, w.lead, { attemptId: s.attemptId, raw: { penalties: 0 }, submitKey: "another-key-0002" }))).toBe(
      "CONFLICT",
    );
    expect(await db.challengeResult.count({ where: { attemptId: s.attemptId } })).toBe(1);
  });

  it("validates client-submitted scores on the server and ignores client-supplied totals", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    await expect(
      submitResult(db, w.lead, { attemptId: s.attemptId, raw: { points: -4 }, submitKey: "bad-input-0001" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await submitResult(db, w.lead, {
      attemptId: s.attemptId,
      raw: { points: 12, attempts: 20, finalValue: 9999, score: 9999 },
      submitKey: "good-input-0001",
    });
    const row = await db.challengeResult.findUniqueOrThrow({ where: { id: r.resultId } });
    expect(row.finalValue!.toNumber()).toBe(12);
    expect(row.approvalStatus).toBe("PENDING");
    expect(row.published).toBe(false);
  });

  it("must stop the timer before submitting a valid result, but a running attempt can be DQ'd", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    expect(await code(submitResult(db, w.lead, { attemptId: s.attemptId, raw: {}, submitKey: "running-key-001" }))).toBe("CONFLICT");
    const r = await submitResult(db, w.lead, { attemptId: s.attemptId, raw: {}, status: "DISQUALIFIED", submitKey: "dq-key-0000001" });
    const row = await db.challengeResult.findUniqueOrThrow({ where: { id: r.resultId } });
    expect(row.resultStatus).toBe("DISQUALIFIED");
    expect(row.finalValue).toBeNull();
  });

  it("auto-publishes when approval is not required", async () => {
    const a = await w.makeActivity({ requireApproval: false });
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    const r = await submitResult(db, w.lead, { attemptId: s.attemptId, raw: {}, submitKey: "auto-pub-000001" });
    expect(r).toMatchObject({ approvalStatus: "APPROVED", published: true });
  });
});

describe("permissions", () => {
  it("an unassigned lead cannot operate or submit for another activity", async () => {
    const a = await w.makeActivity({ assign: [w.lead] });
    const ar = await enrol(a.id);
    expect(await code(checkIn(db, w.otherLead, ar.id))).toBe("FORBIDDEN");
    expect(await code(startAttempt(db, w.otherLead, { activityRegistrationId: ar.id }))).toBe("FORBIDDEN");
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    expect(await code(finishAttempt(db, w.otherLead, s.attemptId))).toBe("FORBIDDEN");
    expect(await code(cancelAttempt(db, w.otherLead, s.attemptId, "sabotage"))).toBe("FORBIDDEN");
    await finishAttempt(db, w.lead, s.attemptId);
    expect(await code(submitResult(db, w.otherLead, { attemptId: s.attemptId, raw: {}, submitKey: "forbidden-key-1" }))).toBe("FORBIDDEN");
  });

  it("participants (and any non-staff role) cannot submit scores", async () => {
    const a = await w.makeActivity();
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    const participantUser = await makeUser("PARTICIPANT");
    try {
      expect(await code(submitResult(db, participantUser, { attemptId: s.attemptId, raw: {}, submitKey: "participant-key1" }))).toBe(
        "FORBIDDEN",
      );
      expect(await code(startAttempt(db, participantUser, { activityRegistrationId: ar.id }))).toBe("FORBIDDEN");
    } finally {
      await db.user.delete({ where: { id: participantUser.id } });
    }
  });

  it("public (no actor) and leads cannot use admin functions", async () => {
    expect(() => assertAdmin(null)).toThrow(AppError);
    expect(await code(saveSport(db, w.lead, { name: "Hack", defaultScoring: defaultScoringConfig("TIME") }))).toBe("FORBIDDEN");
    expect(await code(setActivityState(db, w.lead, (await w.makeActivity()).id, { challengeStatus: "COMPLETED" }))).toBe("FORBIDDEN");
    expect(await code(listRegistrations(db, w.lead, { eventId: w.event.id }))).toBe("FORBIDDEN");
    expect(await code(createUser(db, w.lead, { name: "x y", email: "x@y.zz", role: "ACTIVITY_LEAD", password: "longenough-pass" }))).toBe(
      "FORBIDDEN",
    );
  });

  it("only a super admin can create or modify administrator accounts", async () => {
    const input = { name: "New Admin", email: `na.${Date.now()}@test.local`, role: "ADMIN", password: "longenough-pass" };
    expect(await code(createUser(db, w.admin, input))).toBe("FORBIDDEN");
    const { id } = await createUser(db, w.superAdmin, input);
    expect(await code(updateUser(db, w.admin, id, { active: false }))).toBe("FORBIDDEN");
    await db.user.delete({ where: { id } });
  });

  it("admins can activate only activities with valid scoring and cannot change locked scoring", async () => {
    const a = await w.makeActivity({ challengeStatus: "DRAFT" });
    await db.eventActivity.update({ where: { id: a.id }, data: { scoringConfig: { template: "POINTS", fields: [] } } });
    expect(await code(setActivityState(db, w.admin, a.id, { challengeStatus: "ACTIVE" }))).toBe("VALIDATION");

    const b = await w.makeActivity();
    const ar = await enrol(b.id);
    await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    const changed = defaultScoringConfig("POINTS");
    expect(
      await code(saveActivity(db, w.admin, { id: b.id, eventId: w.event.id, sportId: w.sport.id, name: b.name, scoringConfig: changed })),
    ).toBe("CONFLICT");
  });
});

describe("approval workflow", () => {
  async function submitted(requireIndependent = true, assign = [w.lead]) {
    const a = await w.makeActivity({ independentApproval: requireIndependent, assign });
    const ar = await enrol(a.id);
    const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, s.attemptId);
    const r = await submitResult(db, w.lead, {
      attemptId: s.attemptId,
      raw: { penalties: 0 },
      submitKey: `appr-${Math.random().toString(36).slice(2)}-0000`,
    });
    return { a, r };
  }

  it("blocks self-approval when independent approval is required; allows another reviewer", async () => {
    const { r } = await submitted(true);
    expect(await code(reviewResult(db, w.lead, r.resultId, "APPROVED"))).toBe("FORBIDDEN");
    const res = await reviewResult(db, w.admin, r.resultId, "APPROVED");
    expect(res.published).toBe(true);
    expect(await code(reviewResult(db, w.admin, r.resultId, "APPROVED"))).toBe("CONFLICT"); // already reviewed
    expect(await db.resultApproval.count({ where: { resultId: r.resultId } })).toBe(1);
  });

  it("lets the submitting lead approve when independence is not required", async () => {
    const { r } = await submitted(false);
    expect((await reviewResult(db, w.lead, r.resultId, "APPROVED")).published).toBe(true);
  });

  it("an unassigned lead cannot approve", async () => {
    const { r } = await submitted(true);
    expect(await code(reviewResult(db, w.otherLead, r.resultId, "APPROVED"))).toBe("FORBIDDEN");
  });

  it("disputes hide results; corrections create a new version and keep history", async () => {
    const { r } = await submitted(true);
    await reviewResult(db, w.admin, r.resultId, "APPROVED");
    await flagDispute(db, w.lead, r.resultId, "Timer started late");
    expect((await db.challengeResult.findUniqueOrThrow({ where: { id: r.resultId } })).published).toBe(false);
    const c = await correctResult(db, w.admin, r.resultId, { raw: { penalties: 2 }, status: "VALID", reason: "Added missed penalties" });
    expect(c.version).toBe(2);
    const rows = await db.challengeResult.findMany({
      where: { attempt: { results: { some: { id: r.resultId } } } },
      orderBy: { version: "asc" },
    });
    expect(rows.map((x) => [x.version, x.current])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(rows[1].correctionOfId).toBe(r.resultId);
    // the assigned lead may update the score without a reason; a lead of another activity may not
    expect(await code(correctResult(db, w.otherLead, c.resultId, { raw: {}, status: "VALID" }))).toBe("FORBIDDEN");
    const c2 = await correctResult(db, w.lead, c.resultId, { raw: { penalties: 1 }, status: "VALID" });
    expect(c2.version).toBe(3);
    expect((await db.challengeResult.findUniqueOrThrow({ where: { id: c2.resultId } })).correctionReason).toBe("Score updated");
    c.resultId = c2.resultId;
    // a dispute on the new version can be dismissed by an admin
    await flagDispute(db, w.lead, c.resultId, "Double-check");
    expect(await code(dismissDispute(db, w.lead, c.resultId))).toBe("FORBIDDEN");
    await dismissDispute(db, w.admin, c.resultId);
    expect(await db.auditLog.count({ where: { entityId: c.resultId } })).toBeGreaterThanOrEqual(2);
  });
});

describe("heat start (group start)", () => {
  it("starts everyone on the same instant and auto-submits stopwatch results on finish", async () => {
    const a = await w.makeActivity({ config: presetFor("running"), requireApproval: false });
    const runners = await Promise.all([enrol(a.id), enrol(a.id), enrol(a.id)]);
    const h = await startHeat(
      db,
      w.lead,
      runners.map((r) => r.id),
    );
    expect(h.attemptIds).toHaveLength(3);
    const attempts = await db.challengeAttempt.findMany({ where: { id: { in: h.attemptIds } } });
    expect(new Set(attempts.map((x) => x.startedAt.getTime())).size).toBe(1);
    expect(attempts.every((x) => x.status === "RUNNING")).toBe(true);

    await new Promise((r) => setTimeout(r, 30));
    expect(await finishRunner(db, w.lead, h.attemptIds[0])).toEqual({ submitted: true });
    const done = await db.challengeAttempt.findUniqueOrThrow({ where: { id: h.attemptIds[0] }, include: { results: true } });
    expect(done.status).toBe("SUBMITTED");
    expect(done.results).toHaveLength(1);
    expect(done.results[0]).toMatchObject({ published: true, resultStatus: "VALID" });
    // the others keep running
    expect(await db.challengeAttempt.count({ where: { id: { in: h.attemptIds }, status: "RUNNING" } })).toBe(2);
    // finishing twice does not create a second result
    expect(await code(finishRunner(db, w.lead, h.attemptIds[0]))).toBe("CONFLICT");
  });

  it("is all-or-nothing and enforces access", async () => {
    const a = await w.makeActivity({ config: presetFor("running") });
    const ok = await enrol(a.id);
    const notIn = await enrol(a.id, false);
    expect(await code(startHeat(db, w.lead, [ok.id, notIn.id]))).toBe("CONFLICT");
    expect(await db.challengeAttempt.count({ where: { activityId: a.id } })).toBe(0);
    expect((await db.activityRegistration.findUniqueOrThrow({ where: { id: ok.id } })).queueStatus).toBe("WAITING");
    expect(await code(startHeat(db, w.otherLead, [ok.id]))).toBe("FORBIDDEN");
    expect(await code(startHeat(db, w.lead, []))).toBe("VALIDATION");
    const b = await w.makeActivity({ config: presetFor("running") });
    const other = await enrol(b.id);
    expect(await code(startHeat(db, w.lead, [ok.id, other.id]))).toBe("VALIDATION");
  });

  it("leaves a finished attempt for manual entry when the activity has result fields", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("TIME") });
    const ar = await enrol(a.id);
    const h = await startHeat(db, w.lead, [ar.id]);
    expect(await finishRunner(db, w.lead, h.attemptIds[0])).toEqual({ submitted: false });
    expect((await db.challengeAttempt.findUniqueOrThrow({ where: { id: h.attemptIds[0] } })).status).toBe("FINISHED");
  });
});

describe("deleting a score", () => {
  it("removes it from the board, frees the attempt, and keeps an audit trail", async () => {
    const a = await w.makeActivity({ config: presetFor("running"), requireApproval: false });
    const ar = await enrol(a.id);
    const h = await startHeat(db, w.lead, [ar.id]);
    await finishRunner(db, w.lead, h.attemptIds[0]);
    const res = await db.challengeResult.findFirstOrThrow({ where: { attemptId: h.attemptIds[0], current: true } });
    expect((await getLeaderboard(db, a.id))!.rows).toHaveLength(1);
    expect((await db.activityRegistration.findUniqueOrThrow({ where: { id: ar.id } })).queueStatus).toBe("DONE");

    expect(await code(deleteResult(db, w.otherLead, res.id))).toBe("FORBIDDEN");
    expect(await code(deleteResult(db, w.lead, res.id))).toBe("OK");
    expect((await getLeaderboard(db, a.id))!.rows).toHaveLength(0);
    expect((await db.activityRegistration.findUniqueOrThrow({ where: { id: ar.id } })).queueStatus).toBe("WAITING");
    expect((await db.challengeAttempt.findUniqueOrThrow({ where: { id: h.attemptIds[0] } })).status).toBe("CANCELLED");
    expect(await db.auditLog.count({ where: { action: "result.delete", entityId: res.id } })).toBe(1);
    expect(await code(deleteResult(db, w.lead, res.id))).toBe("NOT_FOUND");
    // the participant can run again
    expect(await code(startAttempt(db, w.lead, { activityRegistrationId: ar.id }))).toBe("OK");
  });
});

describe("heat numbers", () => {
  it("numbers heats per activity and includes them in the results export", async () => {
    const a = await w.makeActivity({ config: presetFor("running"), requireApproval: false });
    const [r1, r2, r3] = await Promise.all([enrol(a.id), enrol(a.id), enrol(a.id)]);
    const h1 = await startHeat(db, w.lead, [r1.id, r2.id]);
    const h2 = await startHeat(db, w.lead, [r3.id]);
    expect([h1.heat, h2.heat]).toEqual([1, 2]);
    expect((await db.challengeAttempt.findMany({ where: { id: { in: h1.attemptIds } } })).every((x) => x.heat === 1)).toBe(true);
    await finishRunner(db, w.lead, h1.attemptIds[0]);
    const other = await w.makeActivity({ config: presetFor("running") });
    expect((await startHeat(db, w.lead, [(await enrol(other.id)).id])).heat).toBe(1); // numbering is per activity
    const csv = await exportResultsCsv(db, w.admin, w.event.id);
    expect(csv.split("\r\n")[0]).toContain("Heat");
    expect(csv).toContain(`"${a.name}","1"`);
    expect(await code(exportResultsCsv(db, w.lead, w.event.id))).toBe("FORBIDDEN");
  });
});
