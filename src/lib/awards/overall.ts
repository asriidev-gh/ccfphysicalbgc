/**
 * Overall champions across sports. Times and scores can't be compared between sports (and some sports rank highest
 * first), so each person's place in every sport they played is averaged; the lowest average wins.
 */

/** Playing at least this many sports is needed, so a single good result can't take the overall title. */
export const OVERALL_MIN_SPORTS = 3;

export interface SportRank {
  participantId: string;
  name: string;
  photoUrl: string | null;
  activityId: string;
  rank: number;
  /** The result behind the place, already formatted, and how many people were ranked in that sport. */
  result?: string;
  players?: number;
}

export interface SportPlace {
  activityId: string;
  rank: number;
  result?: string;
  players?: number;
}

export interface OverallEntry {
  rank: number;
  participantId: string;
  name: string;
  photoUrl: string | null;
  /** Mean place over the sports played (1 = first everywhere). */
  average: number;
  sports: number;
  /** The best place in each sport: what the average is made of. */
  places: SportPlace[];
}

/**
 * Standings from per-sport places (pass one gender at a time). Equal averages are split by more sports played, then by
 * more 1st places; people still equal share the rank.
 */
export function overallStandings(ranks: SportRank[], minSports = OVERALL_MIN_SPORTS): OverallEntry[] {
  const people = new Map<string, { name: string; photoUrl: string | null; best: Map<string, SportPlace> }>();
  for (const r of ranks) {
    let p = people.get(r.participantId);
    if (!p) people.set(r.participantId, (p = { name: r.name, photoUrl: r.photoUrl, best: new Map() }));
    // A board can list someone once per attempt; only their best place in that sport counts.
    const seen = p.best.get(r.activityId);
    if (!seen || r.rank < seen.rank)
      p.best.set(r.activityId, { activityId: r.activityId, rank: r.rank, result: r.result, players: r.players });
  }

  const totals = [...people]
    .map(([participantId, p]) => {
      const places = [...p.best.values()];
      return {
        places,
        participantId,
        name: p.name,
        photoUrl: p.photoUrl,
        sports: places.length,
        sum: places.reduce((s, x) => s + x.rank, 0),
        firsts: places.filter((x) => x.rank === 1).length,
      };
    })
    .filter((t) => t.sports >= minSports);

  // Averages are compared by cross-multiplying, so rounding never breaks a tie.
  const compare = (a: (typeof totals)[number], b: (typeof totals)[number]) =>
    a.sum * b.sports - b.sum * a.sports || b.sports - a.sports || b.firsts - a.firsts;
  totals.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));

  let rank = 0;
  return totals.map((t, i) => {
    if (i === 0 || compare(totals[i - 1], t) !== 0) rank = i + 1;
    const { participantId, name, photoUrl, sports, places } = t;
    return { rank, participantId, name, photoUrl, average: t.sum / sports, sports, places };
  });
}
