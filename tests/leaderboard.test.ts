import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { __dropConnectionForTests, subscribe, type BusMessage } from "@/lib/realtime/bus";
import { checkIn, finishAttempt, reviewResult, startAttempt, submitResult } from "@/lib/services/challenge";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { registerParticipant } from "@/lib/services/registration";
import { defaultScoringConfig } from "@/lib/scoring/templates";
import { makeWorld, person, type World } from "./factory";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterAll(async () => {
  await w.cleanup();
  await db.$disconnect();
});

let k = 0;
async function score(activityId: string, raw: Record<string, unknown>, status: "VALID" | "DISQUALIFIED" = "VALID", approve = true) {
  const r = await registerParticipant(db, w.event.slug, person({ activityIds: [activityId] }));
  const ar = await db.activityRegistration.findFirstOrThrow({
    where: { activityId, participant: { registrations: { some: { reference: r.reference } } } },
    include: { participant: true },
  });
  await checkIn(db, w.lead, ar.id);
  const s = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
  await finishAttempt(db, w.lead, s.attemptId);
  const res = await submitResult(db, w.lead, { attemptId: s.attemptId, raw, status, submitKey: `lb-key-${Date.now()}-${k++}` });
  if (approve) await reviewResult(db, w.admin, res.resultId, "APPROVED");
  return { name: ar.participant.fullName, resultId: res.resultId };
}

function waitFor<T>(fn: (resolve: (v: T) => void) => () => void, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out waiting for message")), ms);
    const off = fn((v) => {
      clearTimeout(t);
      resolve(v);
    });
    void off;
  });
}

describe("leaderboard", () => {
  it("excludes unapproved results from the public board and shows them as provisional for staff", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    const pub = await score(a.id, { points: 10 });
    const pending = await score(a.id, { points: 99 }, "VALID", false);
    const publicBoard = await getLeaderboard(db, a.id);
    expect(publicBoard!.rows.map((r) => r.name)).toEqual([pub.name]);
    const staff = await getLeaderboard(db, a.id, { includeProvisional: true });
    expect(staff!.rows.map((r) => [r.name, r.provisional])).toEqual([
      [pending.name, true],
      [pub.name, false],
    ]);
  });

  it("orders correctly, shares ties, and lists disqualified entries unranked", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    const s1 = await score(a.id, { points: 5 });
    const s2 = await score(a.id, { points: 9 });
    const s3 = await score(a.id, { points: 9 });
    const dq = await score(a.id, {}, "DISQUALIFIED");
    const b = await getLeaderboard(db, a.id);
    const rows = b!.rows;
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, null]);
    expect(new Set(rows.slice(0, 2).map((r) => r.name))).toEqual(new Set([s2.name, s3.name]));
    expect(rows[2].name).toBe(s1.name);
    expect(rows[3]).toMatchObject({ name: dq.name, display: "DQ" });
  });

  it("does not leak private participant data in the public payload", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    await score(a.id, { points: 3 });
    const json = JSON.stringify(await getLeaderboard(db, a.id));
    expect(json).not.toMatch(/@test\.local|mobile|email|participantId|"id":"[0-9a-f-]{36}".*reference/);
    const allowed = new Set(["rank", "name", "display", "detail", "status", "provisional"]);
    for (const key of Object.keys((await getLeaderboard(db, a.id))!.rows[0])) expect(allowed.has(key)).toBe(true);
  });

  it("hides the board when leaderboard publication is off", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    await score(a.id, { points: 3 });
    await db.eventActivity.update({ where: { id: a.id }, data: { leaderboardPublished: false } });
    expect((await getLeaderboard(db, a.id))!.rows).toEqual([]);
  });

  it("builds match standings from approved matches", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("MATCH") });
    const enrolIn = async () => {
      const r = await registerParticipant(db, w.event.slug, person({ activityIds: [a.id] }));
      const ar = await db.activityRegistration.findFirstOrThrow({
        where: { activityId: a.id, participant: { registrations: { some: { reference: r.reference } } } },
        include: { participant: true },
      });
      await checkIn(db, w.lead, ar.id);
      return ar;
    };
    const [p1, p2] = [await enrolIn(), await enrolIn()];
    const s = await startAttempt(db, w.lead, { activityRegistrationId: p1.id, opponentRegistrationId: p2.id });
    await finishAttempt(db, w.lead, s.attemptId);
    const res = await submitResult(db, w.lead, {
      attemptId: s.attemptId,
      raw: { scoreA: 21, scoreB: 15 },
      submitKey: `match-key-${Date.now()}`,
    });
    await reviewResult(db, w.admin, res.resultId, "APPROVED");
    const b = await getLeaderboard(db, a.id);
    expect(b!.rows.map((r) => [r.name, r.rank, r.display])).toEqual([
      [p1.participant.fullName, 1, "3 pts"],
      [p2.participant.fullName, 2, "0 pts"],
    ]);
  });
});

describe("real-time delivery", () => {
  it("pushes a message when a result is approved and the client can recover current state", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    const got = waitFor<BusMessage>((resolve) =>
      subscribe((m) => {
        if (m.kind === "results" && m.activityId === a.id) resolve(m);
      }),
    );
    // Give LISTEN time to attach before triggering.
    await new Promise((r) => setTimeout(r, 400));
    const s = await score(a.id, { points: 7 });
    const msg = await got;
    expect(msg).toMatchObject({ kind: "results", eventId: w.event.id, activityId: a.id });
    expect((await getLeaderboard(db, a.id))!.rows[0].name).toBe(s.name);
  });

  it("reconnects after the LISTEN connection drops and keeps delivering", async () => {
    const a = await w.makeActivity({ config: defaultScoringConfig("POINTS") });
    const seen: string[] = [];
    const off = subscribe((m) => {
      if (m.kind === "results" && m.activityId === a.id) seen.push("x");
    });
    await new Promise((r) => setTimeout(r, 400));
    await __dropConnectionForTests();
    await new Promise((r) => setTimeout(r, 1500)); // backoff reconnect
    await score(a.id, { points: 4 });
    await new Promise((r) => setTimeout(r, 500));
    off();
    expect(seen.length).toBeGreaterThan(0);
    // Whatever was missed during an outage is recovered by re-reading state:
    expect((await getLeaderboard(db, a.id))!.rows).toHaveLength(1);
  });
});
