"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { devDeleteAllRecordsAction, devDeleteRecordAction } from "@/app/actions/lead";
import type { DevRecord } from "@/lib/services/dev-records";
import { Button } from "@/components/ui";

/** Local development only: delete one result, or every record for the activity. */
export function DevRecords({ activityId, records }: { activityId: string; records: DevRecord[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) setError(r.error ?? "Failed.");
        router.refresh();
      } catch {
        setError("Network error. Nothing was changed.");
      }
    });
  };

  return (
    <details className="border-line mt-4 rounded-md border border-dashed p-3">
      <summary className="text-muted cursor-pointer text-sm font-semibold">Manage records (local only) · {records.length}</summary>
      <div className="mt-3 space-y-2">
        {records.length === 0 && <p className="text-muted text-sm">No records.</p>}
        {records.map((r) => (
          <div key={r.id} className="bg-surface-2 flex items-center justify-between gap-3 rounded-md px-3 py-2">
            <span className="min-w-0 truncate">
              {r.name} <span className="text-muted text-xs">· attempt {r.attempt}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular font-display text-lg font-bold">{r.display}</span>
              <Button
                variant="danger"
                disabled={pending}
                aria-label={`Delete record for ${r.name}`}
                onClick={() => run(() => devDeleteRecordAction(r.id), `Delete the record for ${r.name} (${r.display})?`)}
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            </span>
          </div>
        ))}
        {records.length > 0 && (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              run(
                () => devDeleteAllRecordsAction(activityId),
                "Delete ALL records for this activity, including running attempts? This cannot be undone.",
              )
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Delete all records
          </Button>
        )}
        {error && (
          <p role="alert" className="text-bad text-sm">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
