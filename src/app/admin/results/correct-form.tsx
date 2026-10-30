"use client";

import { useState } from "react";
import { correctAction } from "@/app/actions/lead";
import { ActionForm } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import type { ScoringConfig } from "@/lib/scoring/schema";

/** Administrator-issued correction: creates a new result version; the original is kept in history. */
export function CorrectForm({
  resultId,
  config,
  initialRaw,
}: {
  resultId: string;
  config: ScoringConfig;
  initialRaw: Record<string, unknown>;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((f) => [
        f.key,
        initialRaw[f.key] === undefined ? "" : String(f.type === "duration_ms" ? Number(initialRaw[f.key]) / 1000 : initialRaw[f.key]),
      ]),
    ),
  );
  const [status, setStatus] = useState("VALID");
  const [reason, setReason] = useState("");

  const payload = () => {
    const raw: Record<string, unknown> = {};
    for (const f of config.fields) {
      const v = vals[f.key];
      if (v === "" || v === undefined) continue;
      raw[f.key] = f.type === "boolean" ? v === "true" : f.type === "duration_ms" ? Math.round(Number(v) * 1000) : Number(v);
    }
    return { raw, status: status as "VALID", reason };
  };

  return (
    <details className="border-line rounded-md border p-3">
      <summary className="text-accent cursor-pointer text-sm font-semibold">Issue corrected result</summary>
      <ActionForm
        action={async () => correctAction(resultId, payload())}
        submitLabel="Publish correction"
        success="Correction issued."
        className="mt-3 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {config.fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block font-medium">
                {f.label}
                {f.type === "duration_ms" ? " (s)" : ""}
              </span>
              <Input value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Outcome</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="VALID">Completed</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="DISQUALIFIED">Disqualified</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </Select>
          </label>
        </div>
        <Input
          placeholder="Reason for correction (recorded in the audit log)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
        />
      </ActionForm>
    </details>
  );
}
