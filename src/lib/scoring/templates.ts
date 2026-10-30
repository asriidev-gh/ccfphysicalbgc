import { scoringConfigSchema, type ScoringConfig, type ScoringTemplate } from "./schema";

/** Reusable starting points shown in the admin UI. Admins may adjust any value before activating. */
export const TEMPLATE_LABELS: Record<ScoringTemplate, string> = {
  TIME: "Time (fastest wins)",
  POINTS: "Points (highest wins)",
  REPS: "Repetitions / rounds",
  DISTANCE: "Distance",
  MATCH: "Match standings",
  MULTI_STATION: "Multi-station (total time)",
  CUSTOM: "Custom weighted score",
};

const base = {
  tieBreakers: [],
  attemptPolicy: { maxAttempts: 1, select: "BEST" as const },
  incomplete: "LIST_UNRANKED" as const,
  disqualified: "LIST_UNRANKED" as const,
  ties: "SHARE_RANK" as const,
};

export function defaultScoringConfig(template: ScoringTemplate): ScoringConfig {
  const raw = (() => {
    switch (template) {
      case "TIME":
        return {
          ...base,
          template,
          unit: "time",
          fields: [{ key: "penalties", label: "Penalties", type: "integer", min: 0, max: 100, required: false }],
          params: { penaltyField: "penalties", penaltyMs: 5000 },
          primary: { direction: "asc" },
        };
      case "POINTS":
        return {
          ...base,
          template,
          unit: "pts",
          fields: [
            { key: "points", label: "Points scored", type: "integer", min: 0, max: 1000 },
            { key: "attempts", label: "Attempts taken", type: "integer", min: 0, max: 1000, required: false },
          ],
          params: {},
          primary: { direction: "desc" },
          tieBreakers: [{ metric: "accuracyPct", direction: "desc" }],
        };
      case "REPS":
        return {
          ...base,
          template,
          unit: "reps",
          fields: [
            { key: "rounds", label: "Rounds completed", type: "integer", min: 0, max: 500, required: false },
            { key: "reps", label: "Additional reps", type: "integer", min: 0, max: 10000 },
            { key: "penalties", label: "Penalties", type: "integer", min: 0, max: 100, required: false },
          ],
          params: { repsPerRound: 0, penaltyField: "penalties", penaltyPoints: 1 },
          primary: { direction: "desc" },
          tieBreakers: [{ metric: "elapsedMs", direction: "asc" }],
        };
      case "DISTANCE":
        return {
          ...base,
          template,
          unit: "m",
          fields: [{ key: "distance", label: "Distance", type: "number", unit: "m", min: 0, max: 100000 }],
          params: {},
          primary: { direction: "desc" },
        };
      case "MATCH":
        return {
          ...base,
          template,
          unit: "pts",
          attemptPolicy: { maxAttempts: 20, select: "BEST" as const },
          fields: [
            { key: "scoreA", label: "Score (side A)", type: "integer", min: 0, max: 1000 },
            { key: "scoreB", label: "Score (side B)", type: "integer", min: 0, max: 1000 },
          ],
          params: { pointsPerWin: 3, pointsPerDraw: 1, pointsPerLoss: 0 },
          primary: { direction: "desc" },
          tieBreakers: [
            { metric: "diff", direction: "desc" },
            { metric: "pointsFor", direction: "desc" },
          ],
        };
      case "MULTI_STATION":
        return {
          ...base,
          template,
          unit: "time",
          fields: [
            { key: "station1", label: "Station 1", type: "duration_ms", min: 0 },
            { key: "station2", label: "Station 2", type: "duration_ms", min: 0 },
            { key: "penalties", label: "Penalties", type: "integer", min: 0, max: 100, required: false },
          ],
          params: {
            stations: [
              { key: "station1", label: "Station 1" },
              { key: "station2", label: "Station 2" },
            ],
            penaltyField: "penalties",
            penaltyMs: 10000,
          },
          primary: { direction: "asc" },
        };
      case "CUSTOM":
        return {
          ...base,
          template,
          fields: [
            { key: "a", label: "Metric A", type: "number" },
            { key: "b", label: "Metric B", type: "number", required: false },
          ],
          params: { weights: { a: 1, b: 1 } },
          primary: { direction: "desc" },
        };
    }
  })();
  return scoringConfigSchema.parse(raw);
}

function hyroxStations(): { key: string; label: string }[] {
  return [
    ["run1", "Run 1"],
    ["skiErg", "SkiErg"],
    ["run2", "Run 2"],
    ["sledPush", "Sled Push"],
    ["run3", "Run 3"],
    ["sledPull", "Sled Pull"],
    ["run4", "Run 4"],
    ["burpee", "Burpee Broad Jumps"],
  ].map(([key, label]) => ({ key, label }));
}

/** Suggested configs for the six launch sports (development seed + admin "apply template"). */
export function presetFor(slug: string): ScoringConfig {
  switch (slug) {
    case "running": {
      // Pure stopwatch result: no penalty field.
      const cfg = defaultScoringConfig("TIME");
      return scoringConfigSchema.parse({ ...cfg, fields: [], params: {} });
    }
    // Every sport is an individual challenge: each participant gets a score and staff record it.
    case "basketball":
    case "badminton":
    case "pickleball": {
      // Just the score staff record: no "attempts taken" field, so no meaningless accuracy % on the board.
      const cfg = defaultScoringConfig("POINTS");
      return scoringConfigSchema.parse({ ...cfg, fields: cfg.fields.filter((f) => f.key === "points"), tieBreakers: [] });
    }
    case "hyrox": {
      const stations = hyroxStations();
      return scoringConfigSchema.parse({
        ...base,
        template: "MULTI_STATION",
        unit: "time",
        fields: [
          ...stations.map((s) => ({ key: s.key, label: s.label, type: "duration_ms", min: 0 })),
          { key: "penalties", label: "Penalties", type: "integer", min: 0, max: 100, required: false },
        ],
        params: { stations, penaltyField: "penalties", penaltyMs: 10000 },
        primary: { direction: "asc" },
      });
    }
    case "crossfit": {
      const cfg = defaultScoringConfig("REPS");
      return scoringConfigSchema.parse({ ...cfg, params: { ...cfg.params, repsPerRound: 15 } });
    }
    default:
      return defaultScoringConfig("POINTS");
  }
}
