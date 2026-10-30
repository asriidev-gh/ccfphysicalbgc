import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { subscribe, type BusMessage } from "@/lib/realtime/bus";
import { assignLead, saveActivity, setActivityState } from "@/lib/services/admin";
import { checkIn, finishAttempt, reviewResult, startAttempt, submitResult } from "@/lib/services/challenge";
import { getDisplayState } from "@/lib/services/display";
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

/** The complete event-night workflow, driven through the same service layer the UI uses. */
describe("end-to-end event workflow", () => {
  it("admin configures → participant registers → lead runs → reviewer approves → leaderboard + display update live", async () => {
    // 1. Admin creates an activity (validated scoring config) and 2. assigns a lead.
    const created = await saveActivity(db, w.admin, {
      eventId: w.event.id,
      sportId: w.sport.id,
      name: "E2E Sprint",
      scoringConfig: defaultScoringConfig("TIME"),
      requireApproval: true,
      independentApproval: true,
    });
    await assignLead(db, w.admin, w.lead.id, created.id);
    await setActivityState(db, w.admin, created.id, { challengeStatus: "ACTIVE" });

    // Subscribe like a connected browser would.
    const seen: BusMessage[] = [];
    const off = subscribe((m) => seen.push(m));
    await new Promise((r) => setTimeout(r, 400));

    // 3. Participant registers.
    const reg = await registerParticipant(db, w.event.slug, person({ activityIds: [created.id] }));
    const ar = await db.activityRegistration.findFirstOrThrow({ where: { activityId: created.id }, include: { participant: true } });

    // 4. Lead checks in, 5. starts, 6. finishes, 7. submits.
    await checkIn(db, w.lead, ar.id);
    const started = await startAttempt(db, w.lead, { activityRegistrationId: ar.id });
    await finishAttempt(db, w.lead, started.attemptId);
    const submitted = await submitResult(db, w.lead, {
      attemptId: started.attemptId,
      raw: { penalties: 0 },
      submitKey: `e2e-${Date.now()}-key`,
    });
    expect(submitted).toMatchObject({ approvalStatus: "PENDING", published: false });

    // Not official yet: absent from the public board and projector.
    expect((await getLeaderboard(db, created.id))!.rows).toHaveLength(0);
    expect((await getDisplayState(db, w.event.id))!.boards.find((b) => b.activity.id === created.id)?.rows ?? []).toHaveLength(0);

    // 8. A different, authorised reviewer approves.
    await reviewResult(db, w.admin, submitted.resultId, "APPROVED");

    // 9. Leaderboard shows the official result, and a live notification was pushed.
    const board = await getLeaderboard(db, created.id);
    expect(board!.rows).toHaveLength(1);
    expect(board!.rows[0]).toMatchObject({ name: ar.participant.fullName, rank: 1, provisional: false });
    expect(board!.rows[0].display).toMatch(/^\d+:\d{2}\.\d{3}$/);
    await new Promise((r) => setTimeout(r, 400));
    off();
    expect(seen.some((m) => m.kind === "results" && m.activityId === created.id)).toBe(true);

    // 10. The presentation screen state contains the published result.
    const display = await getDisplayState(db, w.event.id);
    const shown = display!.boards.find((b) => b.activity.id === created.id);
    expect(shown?.rows[0].name).toBe(ar.participant.fullName);
    expect(reg.reference).toBeTruthy();
  });
});
