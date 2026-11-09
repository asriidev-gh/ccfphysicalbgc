"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMyBoothPhotoAction } from "@/app/actions/booth";

/** Two-tap delete for a photo you posted: trash icon, then an inline "Delete? Yes / No". */
export function DeleteButton({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Delete your photo"
        title="Delete your photo"
        className="text-muted hover:bg-surface-2 hover:text-bad inline-flex size-11 items-center justify-center rounded-md"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <span role="alert" className="flex items-center gap-1 text-sm font-semibold">
      <span className="text-bad">{error ? "Failed" : "Delete?"}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(false);
          start(async () => {
            try {
              const r = await deleteMyBoothPhotoAction(photoId);
              if (r.ok) router.refresh();
              else setError(true);
            } catch {
              setError(true);
            }
          });
        }}
        className="bg-bad/15 text-bad hover:bg-bad/25 inline-flex min-h-11 items-center gap-1 rounded-md px-3"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Yes
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:bg-surface-2 min-h-11 rounded-md px-3">
        No
      </button>
    </span>
  );
}
