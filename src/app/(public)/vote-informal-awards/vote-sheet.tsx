"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Star, X } from "lucide-react";
import { eligibleCategories, type MyBallot, type Nominee } from "@/lib/awards/categories";
import { cn } from "@/lib/utils";
import { StarPhoto } from "@/components/star-photo";

/** Bottom sheet (centred dialog on wide screens) where one person's categories are voted on. Native <dialog> gives focus trapping and Esc for free. */
export function VoteSheet({
  nominee,
  ballot,
  nameOf,
  pendingCategories,
  onVote,
  onClose,
}: {
  nominee: Nominee | null;
  ballot: MyBallot;
  nameOf: (id: string) => string;
  pendingCategories: ReadonlySet<string>;
  onVote: (nomineeId: string, category: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<{ category: string; text: string } | null>(null);
  const [popped, setPopped] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (nominee && !d.open) d.showModal();
    if (!nominee && d.open) d.close();
    setError(null);
    setPopped(null);
  }, [nominee]);

  const first = nominee?.name.trim().split(/\s+/)[0] ?? "";
  const cats = nominee ? eligibleCategories(nominee.gender) : [];

  return (
    <dialog
      ref={ref}
      aria-labelledby="award-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="award-sheet border-line bg-surface text-fg m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-b-0 p-0 backdrop:bg-black/75 sm:m-auto sm:max-w-lg sm:rounded-2xl sm:border-b"
    >
      {nominee && (
        <div className="p-5 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-24 shrink-0">
              <StarPhoto name={nominee.name} photoUrl={nominee.photoUrl} size={192} leader />
            </div>
            <div className="min-w-0 flex-1 pt-2">
              <p className="text-gold text-xs font-bold tracking-widest uppercase">Nominate</p>
              <h2 id="award-sheet-title" className="font-display text-2xl leading-tight font-bold break-words">
                {nominee.name}
              </h2>
              <p className="text-muted mt-1 text-sm">One vote per award. Tap again to take it back.</p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="text-muted hover:bg-surface-2 hover:text-fg -mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <ul className="mt-5 grid gap-2.5">
            {cats.map((c) => {
              const mine = ballot[c.id] === nominee.id;
              const elsewhere = ballot[c.id] && !mine ? ballot[c.id] : null;
              const pending = pendingCategories.has(c.id);
              const count = nominee.votes[c.id] ?? 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={mine}
                    onClick={async () => {
                      setError(null);
                      const err = await onVote(nominee.id, c.id);
                      if (err) setError({ category: c.id, text: err });
                      else if (!mine) setPopped(`${c.id}:${Date.now()}`);
                    }}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      mine ? "border-gold bg-gold/10" : "border-line bg-surface-2 hover:border-gold/50",
                    )}
                  >
                    <span aria-hidden className="text-2xl">
                      {c.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.label}</span>
                      <span className="text-muted block text-xs">
                        {elsewhere ? `Your vote is with ${nameOf(elsewhere)}. Tap to switch to ${first}.` : c.blurb}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-xs font-bold",
                          mine ? "bg-gold text-black" : "bg-surface text-fg border-line border",
                        )}
                      >
                        {mine ? (
                          <>
                            <Check className="size-3.5" aria-hidden /> Voted
                          </>
                        ) : (
                          "Vote"
                        )}
                      </span>
                      <span className="text-muted tabular flex items-center gap-1 text-xs">
                        <Star
                          key={popped?.startsWith(c.id) ? popped : "idle"}
                          className={cn("size-3.5 fill-current", popped?.startsWith(c.id) && "star-pop text-gold")}
                          aria-hidden
                        />
                        {count}
                        <span className="sr-only"> votes</span>
                      </span>
                    </span>
                  </button>
                  {error?.category === c.id && (
                    <p role="alert" className="text-bad mt-1 px-1 text-xs">
                      {error.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}
