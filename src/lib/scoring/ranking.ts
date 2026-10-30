import { PRIMARY_METRIC, type ScoringConfig } from "./schema";
import type { ResultStatusValue } from "./engine";

export interface RankEntry {
  /** Participant (or team) identifier. Several entries may share one id (multiple attempts). */
  id: string;
  name: string;
  status: ResultStatusValue;
  metrics: Record<string, number>;
  primary: number | null;
  attemptNumber: number;
  submittedAt: Date;
}

export interface RankedRow extends RankEntry {
  /** null when listed but not ranked (incomplete / disqualified). */
  rank: number | null;
}

type Direction = "asc" | "desc";

function cmpNum(a: number | undefined, b: number | undefined, dir: Direction): number {
  // Missing values always sort last, whatever the direction.
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a === b) return 0;
  return dir === "asc" ? a - b : b - a;
}

/** Compare by primary metric then configured tie-breakers. 0 means a genuine tie. */
export function compareScores(config: ScoringConfig, a: RankEntry, b: RankEntry): number {
  const c = cmpNum(a.primary ?? undefined, b.primary ?? undefined, config.primary.direction);
  if (c !== 0) return c;
  for (const t of config.tieBreakers) {
    const d = cmpNum(a.metrics[t.metric], b.metrics[t.metric], t.direction);
    if (d !== 0) return d;
  }
  return 0;
}

function stableCompare(config: ScoringConfig, a: RankEntry, b: RankEntry): number {
  const c = compareScores(config, a, b);
  if (c !== 0) return c;
  if (config.ties === "EARLIEST_SUBMISSION") {
    const t = a.submittedAt.getTime() - b.submittedAt.getTime();
    if (t !== 0) return t;
  }
  // Final deterministic fallback so output order never depends on input order.
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** Pick one attempt per participant according to the activity's attempt policy. */
export function selectAttempts(config: ScoringConfig, entries: RankEntry[]): RankEntry[] {
  const byId = new Map<string, RankEntry[]>();
  for (const e of entries) {
    const list = byId.get(e.id);
    if (list) list.push(e);
    else byId.set(e.id, [e]);
  }
  const chosen: RankEntry[] = [];
  for (const list of byId.values()) {
    const sorted = [...list].sort((a, b) => a.attemptNumber - b.attemptNumber);
    const policy = config.attemptPolicy.select;
    if (policy === "FIRST") chosen.push(sorted[0]);
    else if (policy === "LATEST") chosen.push(sorted[sorted.length - 1]);
    else {
      const valid = sorted.filter((e) => e.status === "VALID");
      const pool = valid.length ? valid : sorted;
      chosen.push([...pool].sort((a, b) => stableCompare(config, a, b))[0]);
    }
  }
  return chosen;
}

/** Deterministic ranking. Withdrawn entries are dropped; DQ/incomplete follow the config. */
export function rankEntries(config: ScoringConfig, entries: RankEntry[]): RankedRow[] {
  const selected = selectAttempts(config, entries);
  const valid = selected.filter((e) => e.status === "VALID" && e.primary !== null);
  const unranked: RankEntry[] = [];
  for (const e of selected) {
    if (e.status === "INCOMPLETE" && config.incomplete === "LIST_UNRANKED") unranked.push(e);
    else if (e.status === "DISQUALIFIED" && config.disqualified === "LIST_UNRANKED") unranked.push(e);
    else if (e.status === "VALID" && e.primary === null) unranked.push(e);
  }

  valid.sort((a, b) => stableCompare(config, a, b));
  const rows: RankedRow[] = [];
  valid.forEach((e, i) => {
    let rank = i + 1;
    if (config.ties === "SHARE_RANK" && i > 0 && compareScores(config, valid[i - 1], e) === 0) {
      rank = rows[i - 1].rank as number;
    }
    rows.push({ ...e, rank });
  });
  unranked.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const e of unranked) rows.push({ ...e, rank: null });
  return rows;
}

// ───────────── Match-based standings ─────────────

export interface MatchRecord {
  id: string;
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  scoreA: number;
  scoreB: number;
  status: ResultStatusValue;
  submittedAt: Date;
}

/** Fold approved matches into per-participant standings entries, ready for rankEntries. */
export function buildMatchStandings(config: ScoringConfig, matches: MatchRecord[]): RankEntry[] {
  const win = config.params.pointsPerWin ?? 3;
  const draw = config.params.pointsPerDraw ?? 1;
  const loss = config.params.pointsPerLoss ?? 0;
  const table = new Map<string, RankEntry & { metrics: Record<string, number> }>();
  const row = (id: string, name: string, at: Date) => {
    let r = table.get(id);
    if (!r) {
      r = {
        id,
        name,
        status: "VALID",
        metrics: { played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, matchPoints: 0 },
        primary: 0,
        attemptNumber: 1,
        submittedAt: at,
      };
      table.set(id, r);
    }
    if (at > r.submittedAt) r.submittedAt = at;
    return r;
  };
  for (const m of matches) {
    const a = row(m.aId, m.aName, m.submittedAt);
    const b = row(m.bId, m.bName, m.submittedAt);
    if (m.status !== "VALID") continue;
    for (const [me, f, ag] of [
      [a, m.scoreA, m.scoreB],
      [b, m.scoreB, m.scoreA],
    ] as const) {
      me.metrics.played += 1;
      me.metrics.pointsFor += f;
      me.metrics.pointsAgainst += ag;
      me.metrics.diff += f - ag;
      if (f > ag) {
        me.metrics.wins += 1;
        me.metrics.matchPoints += win;
      } else if (f === ag) {
        me.metrics.draws += 1;
        me.metrics.matchPoints += draw;
      } else {
        me.metrics.losses += 1;
        me.metrics.matchPoints += loss;
      }
    }
  }
  const key = PRIMARY_METRIC.MATCH;
  return [...table.values()].map((r) => ({ ...r, primary: r.metrics[key] }));
}
