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
/** Keep each station's saved label in step with its field's label. */
function withStationLabels(c: ScoringConfig): ScoringConfig {
  if (!c.params.stations) return c;
  return {
    ...c,
    params: { ...c.params, stations: c.params.stations.map((st) => ({ key: st.key, label: c.fields.find((f) => f.key === st.key)?.label || st.label })) },
  };
}

export function ScoringEditor({ name, initial, locked }: { name: string; initial: ScoringConfig; locked?: boolean }) {
  const [cfg, setCfg] = useState<ScoringConfig>(initial);
  const parsed = useMemo(() => scoringConfigSchema.safeParse(cfg), [cfg]);
  const set = (patch: Partial<ScoringConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setParams = (patch: Partial<ScoringConfig["params"]>) => setCfg((c) => ({ ...c, params: { ...c.params, ...patch } }));
  const setField = (i: number, patch: Partial<ScoringField>) =>
    set({ fields: cfg.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const dis = Boolean(locked);

  return (
    <div className="space-y-5">
      <input type="hidden" name={name} value={JSON.stringify(withStationLabels(parsed.success ? parsed.data : cfg))} />
      {locked && (
        <p className="border-warn/40 bg-warn/10 text-warn rounded-md border p-3 text-sm">
          Scoring rules are locked because results are already recorded. Use result corrections to fix individual scores.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Template">
          <Select
            disabled={dis}
            value={cfg.template}
            onChange={(e) => {
              const next = e.target.value as ScoringTemplate;
              if (window.confirm("Switching template replaces the fields and rules below. Continue?")) setCfg(defaultScoringConfig(next));
              else e.target.value = cfg.template; // keep the dropdown in step with the real template when cancelled
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
                aria-label={`Remove ${f.label}`}
                onClick={() =>
                  setCfg((c) => {
                    const gone = c.fields[i]?.key;
                    const params = { ...c.params };
                    // Deleting a field also drops any setting that pointed at it (e.g. the penalty rule),
                    // otherwise validation fails on a reference the editor gives no way to clear.
                    if (params.penaltyField === gone) {
                      delete params.penaltyField;
                      delete params.penaltyMs;
                      delete params.penaltyPoints;
                    }
                    if (params.stations) params.stations = params.stations.filter((s) => s.key !== gone);
                    return { ...c, fields: c.fields.filter((_, j) => j !== i), params };
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
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
        <legend className="mb-2 text-sm font-semibold">Template options</legend>
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
        {cfg.template !== "TIME" && cfg.template !== "MULTI_STATION" && (
          <Labeled label="Timer length (minutes)">
            <Input
              type="number"
              min={0}
              step="0.5"
              placeholder="No countdown"
              value={cfg.params.durationMinutes ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCfg((c) => {
                  const params = { ...c.params };
                  if (v === "" || Number(v) <= 0) delete params.durationMinutes;
                  else params.durationMinutes = Number(v);
                  return { ...c, params };
                });
              }}
            />
            <span className="text-muted mt-1 block text-xs">
              The timer counts down from this. When it reaches zero the run ends and the lead enters the score. Leave empty for no timer.
            </span>
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
