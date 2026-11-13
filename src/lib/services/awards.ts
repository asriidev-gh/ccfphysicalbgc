import { createHash } from "node:crypto";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import { AWARD_CATEGORIES, awardCategory, canBeNominated, type MyBallot, type Nominee } from "@/lib/awards/categories";
import { audit } from "./audit";

export const AWARD_COOKIE = "awards_voter";

/** Voters are anonymous: a random cookie id, hashed with the app secret before it touches the database. */
export function awardVoterHash(voterId: string): string {
  return createHash("sha256")
    .update(`${process.env.APP_SECRET ?? ""}:awards:${voterId}`)
    .digest("hex");
}

/** Everyone who can be nominated: active participants with a confirmed registration for the event. */
export async function listNominees(db: Db, eventId: string): Promise<Nominee[]> {
  const [people, tallies] = await Promise.all([
    db.participant.findMany({
      where: { status: "ACTIVE", registrations: { some: { eventId, status: "CONFIRMED" } } },
      select: { id: true, fullName: true, photoUrl: true, gender: true },
      orderBy: { fullName: "asc" },
    }),
    db.awardVote.groupBy({ by: ["category", "nomineeId"], where: { eventId }, _count: { _all: true } }),
  ]);
  const votes = new Map<string, Record<string, number>>();
  for (const t of tallies) {
    const m = votes.get(t.nomineeId) ?? {};
    m[t.category] = t._count._all;
    votes.set(t.nomineeId, m);
  }
  return people.map((p) => ({
    id: p.id,
    name: p.fullName,
    photoUrl: p.photoUrl,
    gender: p.gender,
    votes: votes.get(p.id) ?? {},
  }));
}

export async function myBallot(db: Db, eventId: string, voter: string | null): Promise<MyBallot> {
  if (!voter) return {};
  const rows = await db.awardVote.findMany({ where: { eventId, voterHash: voter }, select: { category: true, nomineeId: true } });
  return Object.fromEntries(rows.map((r) => [r.category, r.nomineeId]));
}

export interface VoteOutcome {
  category: string;
  /** The nominee now holding this device's vote in the category, or null if the vote was withdrawn. */
  nomineeId: string | null;
  /** Fresh totals for the nominees whose count changed. */
  counts: Record<string, number>;
}

/**
 * One vote per device per category. Tapping the nominee you already chose withdraws it; choosing someone
 * else moves it. The composite primary key makes a double tap harmless.
 */
export async function castVote(
  db: Db,
  eventId: string,
  voter: string,
  input: { nomineeId: string; category: string },
): Promise<VoteOutcome> {
  const cat = awardCategory(input.category);
  if (!cat) throw new AppError("VALIDATION", "That award doesn't exist.");

  return db.$transaction(async (tx) => {
    const nominee = await tx.participant.findFirst({
      where: { id: input.nomineeId, status: "ACTIVE", registrations: { some: { eventId, status: "CONFIRMED" } } },
      select: { id: true, gender: true },
    });
    if (!nominee) throw new AppError("NOT_FOUND", "That participant isn't on the list.");
    if (!canBeNominated(cat.id, nominee.gender)) throw new AppError("VALIDATION", `They can't be nominated for ${cat.label}.`);

    const key = { eventId, category: cat.id, voterHash: voter };
    const existing = await tx.awardVote.findUnique({ where: { eventId_category_voterHash: key }, select: { nomineeId: true } });

    let nomineeId: string | null = nominee.id;
    if (existing?.nomineeId === nominee.id) {
      await tx.awardVote.deleteMany({ where: key });
      nomineeId = null;
    } else {
      await tx.awardVote.upsert({
        where: { eventId_category_voterHash: key },
        create: { ...key, nomineeId: nominee.id },
        update: { nomineeId: nominee.id },
      });
    }

    const changed = [nominee.id, existing?.nomineeId].filter((x): x is string => !!x);
    const rows = await tx.awardVote.groupBy({
      by: ["nomineeId"],
      where: { eventId, category: cat.id, nomineeId: { in: changed } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(changed.map((id) => [id, 0]));
    for (const r of rows) counts[r.nomineeId] = r._count._all;

    return { category: cat.id, nomineeId, counts };
  });
}

export interface Awardee {
  category: string;
  /** More than one person only when they are tied for the lead. */
  nominees: { id: string; name: string; photoUrl: string | null }[];
  votes: number;
  /** True when an admin locked this awardee in, instead of it following the vote. */
  declared: boolean;
  /** False until the award is revealed. Unrevealed awards carry no real name, photo or count, so nothing can leak to the public page. */
  revealed: boolean;
}

type Person = { id: string; name: string; photoUrl: string | null };

/** Awards whose awardee has been revealed on the public page. */
export async function listRevealed(db: Db, eventId: string): Promise<Set<string>> {
  const rows = await db.awardReveal.findMany({ where: { eventId }, select: { category: true } });
  return new Set(rows.map((r) => r.category));
}

/** Reveal (or hide again) one award's awardee. */
export async function setRevealed(db: Db, eventId: string, category: string, revealed: boolean) {
  const cat = awardCategory(category);
  if (!cat) throw new AppError("VALIDATION", "That award doesn't exist.");
  const key = { eventId, category: cat.id };
  if (revealed) await db.awardReveal.upsert({ where: { eventId_category: key }, create: key, update: {} });
  else await db.awardReveal.deleteMany({ where: key });
}

function mask(revealed: boolean, a: Omit<Awardee, "revealed">): Awardee {
  if (revealed) return { ...a, revealed };
  return { category: a.category, nominees: [{ id: "hidden", name: "", photoUrl: null }], votes: 0, declared: a.declared, revealed };
}

/** Awardees an admin has explicitly locked in (these override the vote). */
async function declaredAwardees(db: Db, eventId: string): Promise<Map<string, Person>> {
  const rows = await db.awardWinner.findMany({
    where: { eventId, nominee: { status: "ACTIVE" } },
    select: { category: true, nominee: { select: { id: true, fullName: true, photoUrl: true } } },
  });
  return new Map(rows.map((r) => [r.category, { id: r.nominee.id, name: r.nominee.fullName, photoUrl: r.nominee.photoUrl }]));
}

/**
 * Public awardees: for each award, the person with the most votes right now (everyone tied for the lead),
 * unless an admin has locked someone in. Awards with no votes and no declared awardee are omitted.
 */
export async function listAwardees(db: Db, eventId: string): Promise<Awardee[]> {
  const [declared, revealed, tallies] = await Promise.all([
    declaredAwardees(db, eventId),
    listRevealed(db, eventId),
    db.awardVote.groupBy({ by: ["category", "nomineeId"], where: { eventId }, _count: { _all: true } }),
  ]);
  const people = await db.participant.findMany({
    where: { id: { in: [...new Set(tallies.map((t) => t.nomineeId))] }, status: "ACTIVE" },
    select: { id: true, fullName: true, photoUrl: true },
  });
  const byId = new Map(people.map((x) => [x.id, { id: x.id, name: x.fullName, photoUrl: x.photoUrl } satisfies Person]));

  const out: Awardee[] = [];
  for (const c of AWARD_CATEGORIES) {
    const lock = declared.get(c.id);
    const rows = tallies.filter((t) => t.category === c.id && byId.has(t.nomineeId));
    const best = rows.reduce((m, t) => Math.max(m, t._count._all), 0);
    const open = revealed.has(c.id);
    if (lock) {
      out.push(
        mask(open, {
          category: c.id,
          nominees: [lock],
          votes: rows.find((t) => t.nomineeId === lock.id)?._count._all ?? 0,
          declared: true,
        }),
      );
    } else if (best > 0) {
      const top = rows
        .filter((t) => t._count._all === best)
        .map((t) => byId.get(t.nomineeId)!)
        .sort((a, b) => a.name.localeCompare(b.name));
      out.push(mask(open, { category: c.id, nominees: top, votes: best, declared: false }));
    }
  }
  return out;
}

/** Admin view: per award, the declared awardee, the top-voted candidates and everyone eligible. */
export async function awardsAdminView(db: Db, eventId: string) {
  const [nominees, awardees] = await Promise.all([listNominees(db, eventId), declaredAwardees(db, eventId)]);
  return AWARD_CATEGORIES.map((c) => {
    const eligible = nominees.filter((n) => canBeNominated(c.id, n.gender));
    const ranked = eligible
      .filter((n) => (n.votes[c.id] ?? 0) > 0)
      .sort((a, b) => (b.votes[c.id] ?? 0) - (a.votes[c.id] ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((n) => ({ id: n.id, name: n.name, votes: n.votes[c.id] ?? 0 }));
    const awardee = awardees.get(c.id) ?? null;
    return { category: c, awardee, top: ranked, eligible: eligible.map((n) => ({ id: n.id, name: n.name })) };
  });
}

/** Declare (or, with null, clear) the awardee for one award. The nominee must be eligible for it. */
export async function setAwardee(db: Db, actor: Actor, eventId: string, category: string, nomineeId: string | null) {
  assertAdmin(actor);
  const cat = awardCategory(category);
  if (!cat) throw new AppError("VALIDATION", "That award doesn't exist.");
  const key = { eventId, category: cat.id };
  const previous = await db.awardWinner.findUnique({ where: { eventId_category: key }, select: { nomineeId: true } });

  if (nomineeId === null) {
    await db.awardWinner.deleteMany({ where: key });
  } else {
    const nominee = await db.participant.findFirst({
      where: { id: nomineeId, status: "ACTIVE", registrations: { some: { eventId, status: "CONFIRMED" } } },
      select: { id: true, gender: true },
    });
    if (!nominee) throw new AppError("NOT_FOUND", "That participant isn't on the list.");
    if (!canBeNominated(cat.id, nominee.gender)) throw new AppError("VALIDATION", `They can't receive ${cat.label}.`);
    await db.awardWinner.upsert({ where: { eventId_category: key }, create: { ...key, nomineeId }, update: { nomineeId } });
  }
  await audit(db, {
    actorId: actor.id,
    action: nomineeId ? "award.declare" : "award.clear",
    entityType: "AwardWinner",
    entityId: `${eventId}:${cat.id}`,
    previous: previous ?? undefined,
    next: nomineeId ? { nomineeId } : undefined,
  });
}
