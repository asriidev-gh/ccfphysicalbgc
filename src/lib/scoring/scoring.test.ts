import { describe, expect, it } from "vitest";
import { calculate, elapsedBetween, formatDuration, ScoringError, validateRaw } from "./engine";
import { buildMatchStandings, rankEntries, type RankEntry } from "./ranking";
import { scoringConfigSchema, type ScoringConfig } from "./schema";
import { defaultScoringConfig, presetFor } from "./templates";

const at = (n: number) => new Date(Date.UTC(2026, 10, 25, 10, 0, n));

function entry(
  cfg: ScoringConfig,
  id: string,
  raw: Record<string, unknown>,
  o: { elapsedMs?: number | null; status?: RankEntry["status"]; attempt?: number; t?: number } = {},
): RankEntry {
  const status = o.status ?? "VALID";
  const calc = calculate(cfg, { raw, elapsedMs: o.elapsedMs ?? null, status });
  return {
    id,
    name: id.toUpperCase(),
    status,
    metrics: calc.metrics,
    primary: calc.primary,
    attemptNumber: o.attempt ?? 1,
    submittedAt: at(o.t ?? 0),
  };
}

describe("timing", () => {
  it("computes integer elapsed milliseconds", () => {
    expect(elapsedBetween(new Date("2026-11-25T10:00:00.000Z"), new Date("2026-11-25T10:01:23.456Z"))).toBe(83_456);
  });
  it("rejects finish before start and invalid dates", () => {
    expect(() => elapsedBetween(at(10), at(5))).toThrow(RangeError);
    expect(() => elapsedBetween(new Date("nope"), at(5))).toThrow(RangeError);
  });
  it("formats durations", () => {
    expect(formatDuration(83_456)).toBe("1:23.456");
    expect(formatDuration(3_723_004)).toBe("1:02:03.004");
    expect(formatDuration(0)).toBe("0:00.000");
  });
});

describe("config validation", () => {
  it("accepts every default template", () => {
    for (const t of ["TIME", "POINTS", "REPS", "DISTANCE", "MATCH", "MULTI_STATION", "CUSTOM"] as const) {
      expect(scoringConfigSchema.safeParse(defaultScoringConfig(t)).success).toBe(true);
    }
  });
  it("rejects incomplete configuration", () => {
    const bad = { ...defaultScoringConfig("POINTS"), fields: [] };
    expect(scoringConfigSchema.safeParse(bad).success).toBe(false);
    const noStations = { ...defaultScoringConfig("MULTI_STATION"), params: {} };
    expect(scoringConfigSchema.safeParse(noStations).success).toBe(false);
  });
  it("rejects bad field keys (no code injection through keys)", () => {
    const cfg = defaultScoringConfig("POINTS");
    const bad = { ...cfg, fields: [{ ...cfg.fields[0], key: "a;process.exit()" }] };
    expect(scoringConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe("time-based scoring", () => {
  const cfg = defaultScoringConfig("TIME"); // 5s per penalty
  it("adds penalties to elapsed time", () => {
    const r = calculate(cfg, { raw: { penalties: 2 }, elapsedMs: 60_000, status: "VALID" });
    expect(r.primary).toBe(70_000);
    expect(r.penalty.ms).toBe(10_000);
  });
  it("ranks lower adjusted time first", () => {
    const rows = rankEntries(cfg, [
      entry(cfg, "slow", { penalties: 0 }, { elapsedMs: 70_000 }),
      entry(cfg, "pen", { penalties: 3 }, { elapsedMs: 58_000 }), // 73_000
      entry(cfg, "fast", { penalties: 0 }, { elapsedMs: 61_000 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["fast", "slow", "pen"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("supports manual time entry", () => {
    const manual = scoringConfigSchema.parse({
      ...cfg,
      fields: [{ key: "timeMs", label: "Time", type: "duration_ms", min: 1 }],
      params: { manualTime: true },
    });
    expect(calculate(manual, { raw: { timeMs: 45_000 }, elapsedMs: null, status: "VALID" }).primary).toBe(45_000);
  });
});

describe("points-based scoring", () => {
  const cfg = defaultScoringConfig("POINTS");
  it("ranks higher points first and breaks ties by accuracy", () => {
    const rows = rankEntries(cfg, [
      entry(cfg, "a", { points: 20, attempts: 30 }),
      entry(cfg, "b", { points: 20, attempts: 25 }),
      entry(cfg, "c", { points: 25, attempts: 40 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("applies point penalties", () => {
    const c = scoringConfigSchema.parse({
      ...cfg,
      fields: [...cfg.fields, { key: "fouls", label: "Fouls", type: "integer", required: false }],
      params: { penaltyField: "fouls", penaltyPoints: 2 },
    });
    expect(calculate(c, { raw: { points: 10, fouls: 3 }, elapsedMs: null, status: "VALID" }).primary).toBe(4);
  });
  it("computes accuracy", () => {
    expect(calculate(cfg, { raw: { points: 7, attempts: 10 }, elapsedMs: null, status: "VALID" }).metrics.accuracyPct).toBe(70);
  });
  it("validates ranges and required fields", () => {
    const r = validateRaw(cfg, { points: -1 });
    expect(r.ok).toBe(false);
    expect(() => calculate(cfg, { raw: {}, elapsedMs: null, status: "VALID" })).toThrow(ScoringError);
    expect(validateRaw(cfg, { points: 1.5 }).ok).toBe(false);
  });
});

describe("repetitions / CrossFit", () => {
  const cfg = presetFor("crossfit"); // 15 reps per round, time tie-break
  it("totals rounds and reps and tie-breaks on time", () => {
    const rows = rankEntries(cfg, [
      entry(cfg, "a", { rounds: 3, reps: 5 }, { elapsedMs: 600_000 }),
      entry(cfg, "b", { rounds: 3, reps: 5 }, { elapsedMs: 540_000 }),
      entry(cfg, "c", { rounds: 2, reps: 10 }, { elapsedMs: 100_000 }),
    ]);
    expect(rows[0].metrics.totalReps).toBe(50);
    expect(rows.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("multi-station (HYROX)", () => {
  const cfg = presetFor("hyrox");
  const stations = Object.fromEntries(cfg.params.stations!.map((s) => [s.key, 60_000]));
  it("sums station times plus penalties", () => {
    const r = calculate(cfg, { raw: { ...stations, penalties: 2 }, elapsedMs: null, status: "VALID" });
    expect(r.primary).toBe(8 * 60_000 + 20_000);
    expect(r.metrics.stationsCompleted).toBe(8);
  });
  it("requires every station for a valid result but not for incomplete", () => {
    expect(() => calculate(cfg, { raw: { run1: 1000 }, elapsedMs: null, status: "VALID" })).toThrow(ScoringError);
    const r = calculate(cfg, { raw: { run1: 1000 }, elapsedMs: null, status: "INCOMPLETE" });
    expect(r.metrics.stationsCompleted).toBe(1);
  });
});

describe("distance and custom", () => {
  it("ranks distance descending", () => {
    const cfg = defaultScoringConfig("DISTANCE");
    const rows = rankEntries(cfg, [entry(cfg, "a", { distance: 10.5 }), entry(cfg, "b", { distance: 12 })]);
    expect(rows[0].id).toBe("b");
  });
  it("computes a weighted custom score", () => {
    const cfg = scoringConfigSchema.parse({ ...defaultScoringConfig("CUSTOM"), params: { weights: { a: 2, b: -1 } } });
    expect(calculate(cfg, { raw: { a: 5, b: 3 }, elapsedMs: null, status: "VALID" }).primary).toBe(7);
  });
});

describe("ranking rules", () => {
  const cfg = defaultScoringConfig("POINTS");
  it("shares rank on genuine ties (competition ranking)", () => {
    const rows = rankEntries(cfg, [entry(cfg, "a", { points: 10 }), entry(cfg, "b", { points: 10 }), entry(cfg, "c", { points: 5 })]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
  it("breaks ties by earliest submission when configured", () => {
    const c = scoringConfigSchema.parse({ ...cfg, ties: "EARLIEST_SUBMISSION" });
    const rows = rankEntries(c, [entry(c, "late", { points: 10 }, { t: 30 }), entry(c, "early", { points: 10 }, { t: 5 })]);
    expect(rows.map((r) => [r.id, r.rank])).toEqual([
      ["early", 1],
      ["late", 2],
    ]);
  });
  it("is independent of input order", () => {
    const list = [entry(cfg, "a", { points: 10 }), entry(cfg, "b", { points: 10 }), entry(cfg, "c", { points: 12 })];
    const a = rankEntries(cfg, list).map((r) => r.id);
    const b = rankEntries(cfg, [...list].reverse()).map((r) => r.id);
    expect(a).toEqual(b);
  });
  it("lists incomplete and disqualified entries unranked, after ranked ones", () => {
    const rows = rankEntries(cfg, [
      entry(cfg, "dq", { points: 99 }, { status: "DISQUALIFIED" }),
      entry(cfg, "inc", { points: 3 }, { status: "INCOMPLETE" }),
      entry(cfg, "ok", { points: 1 }),
    ]);
    expect(rows.map((r) => [r.id, r.rank])).toEqual([
      ["ok", 1],
      ["dq", null],
      ["inc", null],
    ]);
  });
  it("can exclude incomplete / DQ entirely, and always drops withdrawn", () => {
    const c = scoringConfigSchema.parse({ ...cfg, incomplete: "EXCLUDE", disqualified: "EXCLUDE" });
    const rows = rankEntries(c, [
      entry(c, "dq", { points: 99 }, { status: "DISQUALIFIED" }),
      entry(c, "inc", { points: 3 }, { status: "INCOMPLETE" }),
      entry(c, "wd", { points: 3 }, { status: "WITHDRAWN" }),
      entry(c, "ok", { points: 1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ok"]);
  });
  it("applies multiple-attempt policies", () => {
    const attempts = (p: ScoringConfig) => [
      entry(p, "a", { points: 5 }, { attempt: 1 }),
      entry(p, "a", { points: 9 }, { attempt: 2 }),
      entry(p, "a", { points: 2 }, { attempt: 3 }),
    ];
    const mk = (select: "BEST" | "LATEST" | "FIRST") => scoringConfigSchema.parse({ ...cfg, attemptPolicy: { maxAttempts: 3, select } });
    expect(rankEntries(mk("BEST"), attempts(mk("BEST")))[0].primary).toBe(9);
    expect(rankEntries(mk("LATEST"), attempts(mk("LATEST")))[0].primary).toBe(2);
    expect(rankEntries(mk("FIRST"), attempts(mk("FIRST")))[0].primary).toBe(5);
  });
  it("BEST prefers a valid attempt over a better-looking invalid one", () => {
    const rows = rankEntries(cfg, [
      entry(cfg, "a", { points: 50 }, { attempt: 1, status: "DISQUALIFIED" }),
      entry(cfg, "a", { points: 4 }, { attempt: 2 }),
    ]);
    expect(rows[0]).toMatchObject({ status: "VALID", rank: 1, primary: 4 });
  });
});

describe("match standings", () => {
  const cfg = defaultScoringConfig("MATCH");
  const m = (id: string, a: string, b: string, sa: number, sb: number, status: RankEntry["status"] = "VALID") => ({
    id,
    aId: a,
    aName: a,
    bId: b,
    bName: b,
    scoreA: sa,
    scoreB: sb,
    status,
    submittedAt: at(1),
  });
  it("awards win/draw/loss points and breaks ties by point difference", () => {
    const standings = buildMatchStandings(cfg, [
      m("1", "x", "y", 21, 10),
      m("2", "y", "z", 21, 19),
      m("3", "z", "x", 21, 12),
      m("4", "x", "y", 15, 15),
    ]);
    const rows = rankEntries(cfg, standings);
    const x = rows.find((r) => r.id === "x")!;
    expect(x.metrics).toMatchObject({ played: 3, wins: 1, draws: 1, losses: 1, matchPoints: 4, diff: 11 - 9 });
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("ignores non-valid matches for points but still lists participants", () => {
    const rows = rankEntries(cfg, buildMatchStandings(cfg, [m("1", "x", "y", 21, 0, "DISQUALIFIED")]));
    expect(rows.every((r) => r.metrics.matchPoints === 0)).toBe(true);
  });
});
