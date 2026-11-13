"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { devDeleteAllParticipantsAction, devDeleteParticipantAction } from "@/app/actions/lead";
import { Button } from "@/components/ui";

function useDelete() {
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
  return { run, pending, error };
}

/** Local development only. */
export function DeleteParticipantButton({ participantId, name, code }: { participantId: string; name: string; code: string }) {
  const { run, pending, error } = useDelete();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="danger"
        disabled={pending}
        aria-label={`Delete ${name}`}
        onClick={() =>
          run(
            () => devDeleteParticipantAction(participantId),
            `Delete ${name} (${code}) and all of their registrations, attempts and results? This cannot be undone.`,
          )
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Delete
      </Button>
      {error && (
        <span role="alert" className="text-bad text-xs">
          {error}
        </span>
      )}
    </span>
  );
}

/** Local development only. */
export function DeleteAllParticipantsButton({ count }: { count: number }) {
  const { run, pending, error } = useDelete();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="danger"
        disabled={pending || count === 0}
        onClick={() =>
          run(
            () => devDeleteAllParticipantsAction(),
            `Delete ALL participants in the database (every event), with all of their registrations, attempts and results? This cannot be undone.`,
          )
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Delete all participants
      </Button>
      {error && (
        <span role="alert" className="text-bad text-sm">
          {error}
        </span>
      )}
    </div>
  );
}
