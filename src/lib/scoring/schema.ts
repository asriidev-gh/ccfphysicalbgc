import { z } from "zod";

export const SCORING_TEMPLATES = ["TIME", "POINTS", "REPS", "DISTANCE", "MATCH", "MULTI_STATION", "CUSTOM"] as const;
export type ScoringTemplate = (typeof SCORING_TEMPLATES)[number];

const key = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/, "Use letters/digits only, starting with a letter");

export const fieldSchema = z.object({
  key,
  label: z.string().min(1).max(60),
  type: z.enum(["integer", "number", "boolean", "duration_ms"]),
  unit: z.string().max(16).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  required: z.boolean().default(true),
});
export type ScoringField = z.infer<typeof fieldSchema>;

const direction = z.enum(["asc", "desc"]);

export const scoringConfigSchema = z
  .object({
    template: z.enum(SCORING_TEMPLATES),
    fields: z.array(fieldSchema).max(40),
    params: z
      .object({
        /** Field key counting penalty units (integer). */
        penaltyField: key.optional(),
        /** Milliseconds added per penalty unit (TIME, MULTI_STATION). */
        penaltyMs: z.number().int().min(0).optional(),
        /** Points removed per penalty unit (POINTS, REPS, DISTANCE, CUSTOM). */
        penaltyPoints: z.number().min(0).optional(),
        /** REPS: reps represented by one full round. */
        repsPerRound: z.number().int().min(0).optional(),
        /** MULTI_STATION: ordered stations, each backed by a duration_ms field of the same key. */
        stations: z
          .array(z.object({ key, label: z.string().min(1).max(60) }))
          .max(30)
          .optional(),
        /** CUSTOM: weight applied to each numeric field; score is the weighted sum. */
        weights: z.record(key, z.number()).optional(),
        /** MATCH: standings points. */
        pointsPerWin: z.number().optional(),
        pointsPerDraw: z.number().optional(),
        pointsPerLoss: z.number().optional(),
        /** TIME: when true the lead enters the time (field `timeMs`) instead of using the server timer. */
        manualTime: z.boolean().optional(),
      })
      .default({}),
    primary: z.object({ direction }),
    tieBreakers: z
      .array(z.object({ metric: key, direction }))
      .max(5)
      .default([]),
    attemptPolicy: z
      .object({
        maxAttempts: z.number().int().min(1).max(20).default(1),
        select: z.enum(["BEST", "LATEST", "FIRST"]).default("BEST"),
      })
      .default({ maxAttempts: 1, select: "BEST" }),
    incomplete: z.enum(["EXCLUDE", "LIST_UNRANKED"]).default("LIST_UNRANKED"),
    disqualified: z.enum(["EXCLUDE", "LIST_UNRANKED"]).default("LIST_UNRANKED"),
    ties: z.enum(["SHARE_RANK", "EARLIEST_SUBMISSION"]).default("SHARE_RANK"),
    unit: z.string().max(16).optional(),
  })
  .superRefine((cfg, ctx) => {
    const keys = new Set<string>();
    for (const f of cfg.fields) {
      if (keys.has(f.key)) ctx.addIssue({ code: "custom", message: `Duplicate field key "${f.key}"`, path: ["fields"] });
      keys.add(f.key);
      if (f.min !== undefined && f.max !== undefined && f.min > f.max)
        ctx.addIssue({ code: "custom", message: `Field "${f.key}": min exceeds max`, path: ["fields"] });
    }
    const need = (k: string, why: string) => {
      if (!keys.has(k)) ctx.addIssue({ code: "custom", message: `${why} requires field "${k}"`, path: ["fields"] });
    };
    const { params } = cfg;
    if (params.penaltyField) need(params.penaltyField, "penaltyField");
    switch (cfg.template) {
      case "TIME":
        if (params.manualTime) need("timeMs", "Manual time");
        break;
      case "POINTS":
        need("points", "POINTS template");
        break;
      case "REPS":
        need("reps", "REPS template");
        if (params.repsPerRound) need("rounds", "repsPerRound");
        break;
      case "DISTANCE":
        need("distance", "DISTANCE template");
        break;
      case "MATCH":
        need("scoreA", "MATCH template");
        need("scoreB", "MATCH template");
        break;
      case "MULTI_STATION":
        if (!params.stations?.length)
          ctx.addIssue({ code: "custom", message: "MULTI_STATION needs at least one station", path: ["params", "stations"] });
        for (const s of params.stations ?? []) need(s.key, "Station");
        break;
      case "CUSTOM":
        if (!params.weights || Object.keys(params.weights).length === 0)
          ctx.addIssue({ code: "custom", message: "CUSTOM needs at least one weighted field", path: ["params", "weights"] });
        for (const k of Object.keys(params.weights ?? {})) need(k, "Weight");
        break;
    }
  });

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

/** Name of the metric that the primary ranking uses, per template. */
export const PRIMARY_METRIC: Record<ScoringTemplate, string> = {
  TIME: "adjustedMs",
  POINTS: "netPoints",
  REPS: "totalReps",
  DISTANCE: "netDistance",
  MATCH: "matchPoints",
  MULTI_STATION: "totalMs",
  CUSTOM: "score",
};

export function parseScoringConfig(input: unknown) {
  return scoringConfigSchema.safeParse(input);
}

/** True when a template's activity is driven by the server-side stopwatch. */
export function usesTimer(cfg: ScoringConfig): boolean {
  if (cfg.template === "TIME") return !cfg.params.manualTime;
  if (cfg.template === "MULTI_STATION" || cfg.template === "REPS") return true;
  return false;
}
