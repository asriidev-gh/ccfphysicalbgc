import { randomInt } from "node:crypto";
import type { Db, Tx } from "@/lib/db";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import { AppError } from "@/lib/errors";
import { audit } from "./audit";

/**
 * Raffle draw over an event's participants. Draws are kept as audit entries (so no table of their own):
 * the current winners are every `raffle.draw` since the last `raffle.reset`, less any later `raffle.remove`d.
 */
const ENTITY = "Raffle";

export interface RaffleEntrant {
  id: string;
  name: string;
  photoUrl: string | null;
  checkedIn: boolean;
}

export interface RaffleWinner {
  participantId: string;
  name: string;
  photoUrl: string | null;
  prize: string;
}

async function currentDraws(client: Db | Tx, eventId: string) {
  const log = await client.auditLog.findMany({
    where: { entityType: ENTITY, entityId: eventId },
    orderBy: { createdAt: "asc" },
    select: { action: true, next: true },
  });
  let draws: { participantId: string; prize: string }[] = [];
  for (const entry of log) {
    if (entry.action === "raffle.reset") draws = [];
    else if (entry.action === "raffle.remove") {
      const { participantId } = entry.next as { participantId: string };
      draws = draws.filter((d) => d.participantId !== participantId);
    } else if (entry.action === "raffle.draw") draws.push(entry.next as { participantId: string; prize: string });
  }
  return draws;
}

async function entrants(client: Db | Tx, eventId: string): Promise<RaffleEntrant[]> {
  const regs = await client.registration.findMany({
    where: { eventId, status: "CONFIRMED", participant: { status: "ACTIVE" } },
    orderBy: { participant: { fullName: "asc" } },
    select: { checkedInAt: true, participant: { select: { id: true, fullName: true, photoUrl: true } } },
  });
  return regs.map((r) => ({
    id: r.participant.id,
    name: r.participant.fullName,
    photoUrl: r.participant.photoUrl,
    checkedIn: r.checkedInAt !== null,
  }));
}

/** Everyone still able to win, and the winners so far (newest first). Public: names and photos only. */
export async function getRaffle(db: Db, eventId: string) {
  const [all, draws] = await Promise.all([entrants(db, eventId), currentDraws(db, eventId)]);
  // Looked up apart from `all`, so a winner stays listed even if their registration is cancelled later.
  const people = await db.participant.findMany({
    where: { id: { in: draws.map((d) => d.participantId) } },
    select: { id: true, fullName: true, photoUrl: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const won = new Set(draws.map((d) => d.participantId));
  const winners: RaffleWinner[] = draws
    .flatMap((d) => {
      const p = byId.get(d.participantId);
      return p ? [{ participantId: p.id, name: p.fullName, photoUrl: p.photoUrl, prize: d.prize }] : [];
    })
    .reverse();
  return { pool: all.filter((e) => !won.has(e.id)), winners };
}

/** One draw at a time per event, so two screens can never pick the same person. */
const lock = (tx: Tx, eventId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`raffle:${eventId}`}))`;

/** Pick a winner at random among those who haven't won yet. Open to the public, so there may be no actor. */
export async function drawRaffle(db: Db, actor: Actor | null, eventId: string, opts: { checkedInOnly: boolean; prize?: string }) {
  const prize = (opts.prize ?? "").trim().slice(0, 100);
  return db.$transaction(
    async (tx) => {
      await lock(tx, eventId);
      const won = new Set((await currentDraws(tx, eventId)).map((d) => d.participantId));
      const pool = (await entrants(tx, eventId)).filter((e) => !won.has(e.id) && (!opts.checkedInOnly || e.checkedIn));
      if (pool.length === 0)
        throw new AppError("CONFLICT", opts.checkedInOnly ? "No checked-in participants left to draw." : "No participants left to draw.");
      const winner = pool[randomInt(pool.length)];
      await audit(tx, {
        actorId: actor?.id,
        action: "raffle.draw",
        entityType: ENTITY,
        entityId: eventId,
        next: { participantId: winner.id, prize, poolSize: pool.length, checkedInOnly: opts.checkedInOnly },
      });
      return { winner, prize };
    },
    { timeout: 15_000 },
  );
}

/** Take one person off the winners list and put them back in the draw. */
export async function removeRaffleWinner(db: Db, actor: Actor, eventId: string, participantId: string) {
  assertAdmin(actor);
  await db.$transaction(
    async (tx) => {
      await lock(tx, eventId);
      const draw = (await currentDraws(tx, eventId)).find((d) => d.participantId === participantId);
      if (!draw) throw new AppError("NOT_FOUND", "They are no longer on the winners list.");
      await audit(tx, {
        actorId: actor.id,
        action: "raffle.remove",
        entityType: ENTITY,
        entityId: eventId,
        previous: draw,
        next: { participantId },
      });
    },
    { timeout: 15_000 },
  );
}

/** Start over: everyone can win again. Earlier draws stay in the audit log. */
export async function resetRaffle(db: Db, actor: Actor, eventId: string) {
  assertAdmin(actor);
  await db.$transaction(async (tx) => {
    await lock(tx, eventId);
    await audit(tx, { actorId: actor.id, action: "raffle.reset", entityType: ENTITY, entityId: eventId });
  });
}
