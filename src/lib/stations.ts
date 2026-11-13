/** Pure helpers for multi-station runs (shared by the server and the lead console). */

export interface StationSeg {
  index: number;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number | null;
}

export type StationState =
  | { kind: "running"; index: number; startedAt: string; doneMs: number }
  /** Previous station stopped; waiting for the lead to start station `index`. */
  | { kind: "waiting"; index: number; doneMs: number }
  | { kind: "complete"; doneMs: number };

/** Where a multi-station attempt currently is, derived from its station logs. Station 0 starts at the attempt start. */
export function stationState(attemptStartedAt: string, logs: StationSeg[], count: number): StationState {
  const sorted = [...logs].sort((a, b) => a.index - b.index);
  const done = sorted.filter((l) => l.finishedAt !== null);
  const doneMs = done.reduce((s, l) => s + (l.elapsedMs ?? 0), 0);
  const n = done.length;
  if (n >= count) return { kind: "complete", doneMs };
  if (n === 0) return { kind: "running", index: 0, startedAt: attemptStartedAt, doneMs: 0 };
  const open = sorted.find((l) => l.index === n && l.finishedAt === null);
  return open ? { kind: "running", index: n, startedAt: open.startedAt, doneMs } : { kind: "waiting", index: n, doneMs };
}
