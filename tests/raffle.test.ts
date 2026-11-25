import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { registerParticipant } from "@/lib/services/registration";
import { drawRaffle, getRaffle, removeRaffleWinner, resetRaffle } from "@/lib/services/raffle";
import { makeWorld, person, type World } from "./factory";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterAll(async () => {
  await w.cleanup();
  await db.$disconnect();
});

describe("raffle draw", () => {
  it("draws each participant once, honours the check-in filter, and can be reset", async () => {
    const a = await w.makeActivity();
    for (let i = 0; i < 3; i++) await registerParticipant(db, w.event.slug, person({ activityIds: [a.id] }));
    const start = await getRaffle(db, w.event.id);
    expect(start.pool).toHaveLength(3);

    await expect(drawRaffle(db, w.admin, w.event.id, { checkedInOnly: true })).rejects.toMatchObject({ code: "CONFLICT" });
    await db.registration.updateMany({ where: { eventId: w.event.id, participantId: start.pool[0].id }, data: { checkedInAt: new Date() } });
    const first = await drawRaffle(db, w.admin, w.event.id, { checkedInOnly: true, prize: " Water bottle " });
    expect(first.winner.id).toBe(start.pool[0].id);

    // two draws at once still pick two different people
    const rest = await Promise.all([1, 2].map(() => drawRaffle(db, w.admin, w.event.id, { checkedInOnly: false })));
    expect(new Set([first, ...rest].map((d) => d.winner.id)).size).toBe(3);
    await expect(drawRaffle(db, w.admin, w.event.id, { checkedInOnly: false })).rejects.toMatchObject({ code: "CONFLICT" });

    const done = await getRaffle(db, w.event.id);
    expect(done.pool).toHaveLength(0);
    expect(done.winners).toHaveLength(3);
    expect(done.winners.at(-1)).toMatchObject({ participantId: first.winner.id, prize: "Water bottle" });

    // a removed winner goes back into the draw and can be drawn again
    const back = first.winner.id;
    await removeRaffleWinner(db, null, w.event.id, back); // no sign-in needed
    const removed = await getRaffle(db, w.event.id);
    expect(removed.pool.map((p) => p.id)).toEqual([back]);
    expect(removed.winners).toHaveLength(2);
    await expect(removeRaffleWinner(db, w.admin, w.event.id, back)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await drawRaffle(db, w.admin, w.event.id, { checkedInOnly: false })).winner.id).toBe(back);

    await resetRaffle(db, w.admin, w.event.id);
    const fresh = await getRaffle(db, w.event.id);
    expect([fresh.pool.length, fresh.winners.length]).toEqual([3, 0]);
  });

  it("can be spun without signing in, but only an admin can reset the whole draw", async () => {
    const drawn = await drawRaffle(db, null, w.event.id, { checkedInOnly: false });
    expect((await getRaffle(db, w.event.id)).winners.map((x) => x.participantId)).toEqual([drawn.winner.id]);
    await expect(resetRaffle(db, w.lead, w.event.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
