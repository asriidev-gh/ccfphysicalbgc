"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { SCORING_TEMPLATES, scoringConfigSchema, type ScoringConfig, type ScoringField, type ScoringTemplate } from "@/lib/scoring/schema";
import { defaultScoringConfig, TEMPLATE_LABELS } from "@/lib/scoring/templates";

/**
 * Structured editor for a scoring configuration. It only ever produces JSON that validates
 * against `scoringConfigSchema`; there is no free-form code or formula field.
 * The server re-validates on save.
 */
export function ScoringEditor({ name, initial, locked }: { name: string; initial: ScoringConfig; locked?: boolean }) {
  const [cfg, setCfg] = useState<ScoringConfig>(initial);
  const parsed = useMemo(() => scoringConfigSchema.safeParse(cfg), [cfg]);
  const set = (patch: Partial<ScoringConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setParams = (patch: Partial<ScoringConfig["params"]>) => setCfg((c) => ({ ...c, params: { ...c.params, ...patch } }));
  const setField = (i: number, patch: Partial<ScoringField>) =>
    set({ fields: cfg.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const metrics = [
    "elapsedMs",
    "adjustedMs",
    "netPoints",
    "accuracyPct",
    "totalReps",
    "netDistance",
    "totalMs",
    "matchPoints",
    "diff",
    "pointsFor",
    "score",
    ...cfg.fields.map((f) => f.key),
  ];
  const dis = Boolean(locked);

  return (
    <div className="space-y-5">
      <input type="hidden" name={name} value={JSON.stringify(parsed.success ? parsed.data : cfg)} />
      {locked && (
        <p className="border-warn/40 bg-warn/10 text-warn rounded-md border p-3 text-sm">
          Scoring rules are locked because attempts already exist. Use result corrections to fix individual scores.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Template">
          <Select
            disabled={dis}
            value={cfg.template}
            onChange={(e) => {
              if (window.confirm("Switching template replaces the fields and rules below. Continue?"))
                setCfg(defaultScoringConfig(e.target.value as ScoringTemplate));
            }}
          >
            {/* Head-to-head matches (opponents) are not offered; only shown if an existing activity already uses it. */}
            {SCORING_TEMPLATES.filter((t) => t !== "MATCH" || cfg.template === "MATCH").map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Rank by primary metric">
          <Select
            disabled={dis}
            value={cfg.primary.direction}
            onChange={(e) => set({ primary: { direction: e.target.value as "asc" | "desc" } })}
          >
            <option value="asc">Lowest ranks first (e.g. time)</option>
            <option value="desc">Highest ranks first (e.g. points)</option>
          </Select>
        </Labeled>
      </div>

      <fieldset disabled={dis}>
        <legend className="mb-2 text-sm font-semibold">Input fields</legend>
        <div className="space-y-2">
          {cfg.fields.map((f, i) => (
            <div
              key={i}
              className="border-line grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1.4fr_1fr_5rem_5rem_auto_auto]"
            >
              <Input aria-label="Key" placeholder="key" value={f.key} onChange={(e) => setField(i, { key: e.target.value })} />
              <Input aria-label="Label" placeholder="Label" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} />
              <Select aria-label="Type" value={f.type} onChange={(e) => setField(i, { type: e.target.value as ScoringField["type"] })}>
                <option value="integer">Whole number</option>
                <option value="number">Number</option>
                <option value="duration_ms">Duration</option>
                <option value="boolean">Yes / No</option>
              </Select>
              <Input
                aria-label="Minimum"
                type="number"
                placeholder="min"
                value={f.min ?? ""}
                onChange={(e) => setField(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
              <Input
                aria-label="Maximum"
                type="number"
                placeholder="max"
                value={f.max ?? ""}
                onChange={(e) => setField(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => setField(i, { required: e.target.checked })}
                  className="size-4 accent-[var(--brand)]"
                />{" "}
                Req.
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${f.label}`}
                onClick={() => set({ fields: cfg.fields.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() =>
            set({ fields: [...cfg.fields, { key: `field${cfg.fields.length + 1}`, label: "New field", type: "integer", required: false }] })
          }
        >
          <Plus className="size-4" /> Add field
        </Button>
        <p className="text-muted mt-1 text-xs">Durations are entered in seconds by leads and stored as integer milliseconds.</p>
      </fieldset>

      <fieldset disabled={dis} className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Penalties &amp; template options</legend>
        <Labeled label="Penalty field">
          <Select value={cfg.params.penaltyField ?? ""} onChange={(e) => setParams({ penaltyField: e.target.value || undefined })}>
            <option value="">None</option>
            {cfg.fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </Labeled>
        {["TIME", "MULTI_STATION"].includes(cfg.template) ? (
          <Labeled label="Seconds added per penalty">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={(cfg.params.penaltyMs ?? 0) / 1000}
              onChange={(e) => setParams({ penaltyMs: Math.round(Number(e.target.value) * 1000) })}
            />
          </Labeled>
        ) : cfg.template !== "MATCH" ? (
          <Labeled label="Points removed per penalty">
            <Input
              type="number"
              min={0}
              step="any"
              value={cfg.params.penaltyPoints ?? 0}
              onChange={(e) => setParams({ penaltyPoints: Number(e.target.value) })}
            />
          </Labeled>
        ) : null}
        {cfg.template === "REPS" && (
          <Labeled label="Reps per full round">
            <Input
              type="number"
              min={0}
              value={cfg.params.repsPerRound ?? 0}
              onChange={(e) => setParams({ repsPerRound: Number(e.target.value) })}
            />
          </Labeled>
        )}
        {cfg.template === "TIME" && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(cfg.params.manualTime)}
              onChange={(e) => setParams({ manualTime: e.target.checked })}
              className="size-5 accent-[var(--brand)]"
            />{" "}
            Lead enters the time manually (field key <code>timeMs</code>)
          </label>
        )}
        {cfg.template === "MULTI_STATION" && (
          <Labeled label="Stations (field keys, comma separated, in order)">
            <Input
              value={(cfg.params.stations ?? []).map((s) => s.key).join(",")}
              onChange={(e) =>
                setParams({
                  stations: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .map((k) => ({ key: k, label: cfg.fields.find((f) => f.key === k)?.label ?? k })),
                })
              }
            />
          </Labeled>
        )}
        {cfg.template === "CUSTOM" &&
          cfg.fields
            .filter((f) => f.type !== "boolean")
            .map((f) => (
              <Labeled key={f.key} label={`Weight × ${f.label}`}>
                <Input
                  type="number"
                  step="any"
                  value={cfg.params.weights?.[f.key] ?? 0}
                  onChange={(e) => setParams({ weights: { ...cfg.params.weights, [f.key]: Number(e.target.value) } })}
                />
              </Labeled>
            ))}
        {cfg.template === "MATCH" && (
          <>
            <Labeled label="Points per win">
              <Input
                type="number"
                value={cfg.params.pointsPerWin ?? 3}
                onChange={(e) => setParams({ pointsPerWin: Number(e.target.value) })}
              />
            </Labeled>
            <Labeled label="Points per draw">
              <Input
                type="number"
                value={cfg.params.pointsPerDraw ?? 1}
                onChange={(e) => setParams({ pointsPerDraw: Number(e.target.value) })}
              />
            </Labeled>
            <Labeled label="Points per loss">
              <Input
                type="number"
                value={cfg.params.pointsPerLoss ?? 0}
                onChange={(e) => setParams({ pointsPerLoss: Number(e.target.value) })}
              />
            </Labeled>
          </>
        )}
        <Labeled label="Display unit (use “time” for durations)">
          <Input value={cfg.unit ?? ""} maxLength={16} onChange={(e) => set({ unit: e.target.value || undefined })} />
        </Labeled>
      </fieldset>

      <fieldset disabled={dis} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Tie-breakers (in order)</legend>
        {cfg.tieBreakers.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Select
              aria-label="Metric"
              value={t.metric}
              onChange={(e) => set({ tieBreakers: cfg.tieBreakers.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)) })}
            >
              {[...new Set([t.metric, ...metrics])].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <Select
              aria-label="Direction"
              value={t.direction}
              onChange={(e) =>
                set({ tieBreakers: cfg.tieBreakers.map((x, j) => (j === i ? { ...x, direction: e.target.value as "asc" | "desc" } : x)) })
              }
            >
              <option value="asc">Lower wins</option>
              <option value="desc">Higher wins</option>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove tie-breaker"
              onClick={() => set({ tieBreakers: cfg.tieBreakers.filter((_, j) => j !== i) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => set({ tieBreakers: [...cfg.tieBreakers, { metric: metrics[0], direction: "asc" }] })}
        >
          <Plus className="size-4" /> Add tie-breaker
        </Button>
      </fieldset>

      <fieldset disabled={dis} className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Attempts &amp; edge cases</legend>
        <Labeled label="Attempts per participant">
          <Input
            type="number"
            min={1}
            max={20}
            value={cfg.attemptPolicy.maxAttempts}
            onChange={(e) => set({ attemptPolicy: { ...cfg.attemptPolicy, maxAttempts: Number(e.target.value) } })}
          />
        </Labeled>
        <Labeled label="Which attempt counts">
          <Select
            value={cfg.attemptPolicy.select}
            onChange={(e) => set({ attemptPolicy: { ...cfg.attemptPolicy, select: e.target.value as "BEST" | "LATEST" | "FIRST" } })}
          >
            <option value="BEST">Best</option>
            <option value="LATEST">Latest</option>
            <option value="FIRST">First</option>
          </Select>
        </Labeled>
        <Labeled label="Incomplete attempts">
          <Select value={cfg.incomplete} onChange={(e) => set({ incomplete: e.target.value as "EXCLUDE" | "LIST_UNRANKED" })}>
            <option value="LIST_UNRANKED">Listed, unranked</option>
            <option value="EXCLUDE">Hidden</option>
          </Select>
        </Labeled>
        <Labeled label="Disqualified">
          <Select value={cfg.disqualified} onChange={(e) => set({ disqualified: e.target.value as "EXCLUDE" | "LIST_UNRANKED" })}>
            <option value="LIST_UNRANKED">Listed as DQ</option>
            <option value="EXCLUDE">Hidden</option>
          </Select>
        </Labeled>
        <Labeled label="Equal scores">
          <Select value={cfg.ties} onChange={(e) => set({ ties: e.target.value as "SHARE_RANK" | "EARLIEST_SUBMISSION" })}>
            <option value="SHARE_RANK">Share the rank</option>
            <option value="EARLIEST_SUBMISSION">Earlier submission ranks higher</option>
          </Select>
        </Labeled>
      </fieldset>

      {parsed.success ? (
        <p className="text-ok text-sm">Configuration is valid.</p>
      ) : (
        <ul role="alert" className="text-bad list-disc pl-5 text-sm">
          {parsed.error.issues.slice(0, 5).map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
