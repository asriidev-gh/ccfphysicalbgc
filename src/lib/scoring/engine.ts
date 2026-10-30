import { PRIMARY_METRIC, type ScoringConfig, type ScoringField } from "./schema";

export type ResultStatusValue = "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "WITHDRAWN";

export interface CalcInput {
  raw: Record<string, unknown>;
  /** Server-measured elapsed time in whole milliseconds, when the activity is timed. */
  elapsedMs: number | null;
  status: ResultStatusValue;
}

export interface CalcOutput {
  /** All numeric inputs and derived metrics, keyed by metric name. */
  metrics: Record<string, number>;
  /** Value used for primary ranking (null for DQ/withdrawn or when not computable). */
  primary: number | null;
  penalty: { units: number; ms: number; points: number };
}

export type ValidationResult = { ok: true; values: Record<string, number> } | { ok: false; errors: Record<string, string> };

export class ScoringError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

function coerce(field: ScoringField, v: unknown): number | undefined | "invalid" {
  if (v === undefined || v === null || v === "") return undefined;
  if (field.type === "boolean") {
    if (v === true || v === "true" || v === 1) return 1;
    if (v === false || v === "false" || v === 0) return 0;
    return "invalid";
  }
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "invalid";
  if ((field.type === "integer" || field.type === "duration_ms") && !Number.isInteger(n)) return "invalid";
  return n;
}

/** Validate raw metric input against the configured fields. DQ/withdrawn skip required-field checks. */
export function validateRaw(config: ScoringConfig, raw: Record<string, unknown>, status: ResultStatusValue = "VALID"): ValidationResult {
  const errors: Record<string, string> = {};
  const values: Record<string, number> = {};
  const strict = status === "VALID";
  for (const field of config.fields) {
    const c = coerce(field, raw[field.key]);
    if (c === "invalid") {
      errors[field.key] = `${field.label} is not a valid ${field.type === "number" ? "number" : "whole number"}`;
      continue;
    }
    if (c === undefined) {
      if (strict && field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (field.min !== undefined && c < field.min) errors[field.key] = `${field.label} must be at least ${field.min}`;
    else if (field.max !== undefined && c > field.max) errors[field.key] = `${field.label} must be at most ${field.max}`;
    else values[field.key] = c;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

type Calc = (
  cfg: ScoringConfig,
  v: Record<string, number>,
  elapsedMs: number | null,
) => { metrics: Record<string, number>; penalty: CalcOutput["penalty"] };

function penaltyUnits(config: ScoringConfig, values: Record<string, number>): number {
  const k = config.params.penaltyField;
  return k ? (values[k] ?? 0) : 0;
}

/**
 * Registry of supported calculation functions. Deterministic, integer arithmetic for time,
 * and never evaluates admin-supplied code: configuration only selects among these.
 */
const calculators: Record<ScoringConfig["template"], Calc> = {
  TIME: (cfg, v, elapsedMs) => {
    const base = cfg.params.manualTime ? v.timeMs : elapsedMs;
    const units = penaltyUnits(cfg, v);
    const ms = units * (cfg.params.penaltyMs ?? 0);
    const metrics: Record<string, number> = {};
    if (base !== undefined && base !== null) {
      metrics.elapsedMs = base;
      metrics.adjustedMs = base + ms;
    }
    return { metrics, penalty: { units, ms, points: 0 } };
  },
  POINTS: (cfg, v) => {
    const units = penaltyUnits(cfg, v);
    const points = units * (cfg.params.penaltyPoints ?? 0);
    const metrics: Record<string, number> = { netPoints: (v.points ?? 0) - points };
    if (v.attempts !== undefined && v.attempts > 0 && v.points !== undefined)
      metrics.accuracyPct = Math.round((v.points / v.attempts) * 10000) / 100;
    return { metrics, penalty: { units, ms: 0, points } };
  },
  REPS: (cfg, v, elapsedMs) => {
    const units = penaltyUnits(cfg, v);
    const points = units * (cfg.params.penaltyPoints ?? 0);
    const total = (v.rounds ?? 0) * (cfg.params.repsPerRound ?? 0) + (v.reps ?? 0);
    const metrics: Record<string, number> = { totalReps: total - points };
    if (elapsedMs !== null) metrics.elapsedMs = elapsedMs;
    return { metrics, penalty: { units, ms: 0, points } };
  },
  DISTANCE: (cfg, v) => {
    const units = penaltyUnits(cfg, v);
    const points = units * (cfg.params.penaltyPoints ?? 0);
    return { metrics: { netDistance: (v.distance ?? 0) - points }, penalty: { units, ms: 0, points } };
  },
  MATCH: (_cfg, v) => ({
    metrics: { scoreA: v.scoreA ?? 0, scoreB: v.scoreB ?? 0, margin: (v.scoreA ?? 0) - (v.scoreB ?? 0) },
    penalty: { units: 0, ms: 0, points: 0 },
  }),
  MULTI_STATION: (cfg, v, elapsedMs) => {
    const units = penaltyUnits(cfg, v);
    const ms = units * (cfg.params.penaltyMs ?? 0);
    let sum = 0;
    let done = 0;
    for (const s of cfg.params.stations ?? []) {
      const t = v[s.key];
      if (t !== undefined) {
        sum += t;
        done += 1;
      }
    }
    const metrics: Record<string, number> = { stationsCompleted: done, stationMs: sum, totalMs: sum + ms };
    if (elapsedMs !== null) metrics.elapsedMs = elapsedMs;
    return { metrics, penalty: { units, ms, points: 0 } };
  },
  CUSTOM: (cfg, v, elapsedMs) => {
    const units = penaltyUnits(cfg, v);
    const points = units * (cfg.params.penaltyPoints ?? 0);
    let score = 0;
    for (const [k, w] of Object.entries(cfg.params.weights ?? {})) score += (v[k] ?? 0) * w;
    const metrics: Record<string, number> = { score: score - points };
    if (elapsedMs !== null) metrics.elapsedMs = elapsedMs;
    return { metrics, penalty: { units, ms: 0, points } };
  },
};

export function calculate(config: ScoringConfig, input: CalcInput): CalcOutput {
  const v = validateRaw(config, input.raw, input.status);
  if (!v.ok) throw new ScoringError("Invalid scoring input", v.errors);
  const { metrics: derived, penalty } = calculators[config.template](config, v.values, input.elapsedMs);
  const metrics: Record<string, number> = { ...v.values, ...derived };
  if (input.elapsedMs !== null && metrics.elapsedMs === undefined) metrics.elapsedMs = input.elapsedMs;
  const noScore = input.status === "DISQUALIFIED" || input.status === "WITHDRAWN";
  const primary = noScore ? null : (metrics[PRIMARY_METRIC[config.template]] ?? null);
  return { metrics, primary, penalty };
}

/** Authoritative elapsed time: pure integer-ms difference of two instants. */
export function elapsedBetween(start: Date, finish: Date): number {
  const ms = finish.getTime() - start.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("Invalid timestamp");
  if (ms < 0) throw new RangeError("Finish time precedes start time");
  return ms;
}

/** m:ss.mmm, or h:mm:ss.mmm for an hour or more. */
export function formatDuration(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const a = Math.abs(Math.trunc(ms));
  const h = Math.floor(a / 3_600_000);
  const m = Math.floor((a % 3_600_000) / 60_000);
  const s = Math.floor((a % 60_000) / 1000);
  const mmm = String(a % 1000).padStart(3, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${String(m).padStart(2, "0")}:${ss}.${mmm}` : `${sign}${m}:${ss}.${mmm}`;
}
