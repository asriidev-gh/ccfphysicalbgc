"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Search, Sparkles, Star, Trophy } from "lucide-react";
import { castVoteAction, setRevealedAction } from "@/app/actions/awards";
import { AWARD_CATEGORIES, canBeNominated, type MyBallot, type Nominee } from "@/lib/awards/categories";
import { cn } from "@/lib/utils";
import { StarPhoto } from "@/components/star-photo";
import { VoteSheet } from "./vote-sheet";

const PAGE = 48;
const total = (n: Nominee) => Object.values(n.votes).reduce((a, b) => a + b, 0);

export function AwardsBoard({
  initialNominees,
  initialBallot,
  initialRevealed,
}: {
  initialNominees: Nominee[];
  initialBallot: MyBallot;
  initialRevealed: string[];
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set(initialRevealed));
  const [revealing, setRevealing] = useState<ReadonlySet<string>>(new Set());
  const [revealError, setRevealError] = useState<string | null>(null);

  /** Flip one award's reveal state for the public Awardees page (optimistic, rolled back on failure). */
  async function toggleReveal(category: string) {
    const next = !revealed.has(category);
    const apply = (on: boolean) =>
      setRevealed((r) => {
        const s = new Set(r);
        if (on) s.add(category);
        else s.delete(category);
        return s;
      });
    setRevealError(null);
    setRevealing((p) => new Set(p).add(category));
    apply(next);
    try {
      const r = await setRevealedAction(category, next);
      if (!r.ok) {
        apply(!next);
        setRevealError(r.error);
      }
    } catch {
      apply(!next);
      setRevealError("Couldn't reach the server. Try again.");
    } finally {
      setRevealing((p) => {
        const s = new Set(p);
        s.delete(category);
        return s;
      });
    }
  }

  const [nominees, setNominees] = useState(initialNominees);
  const [ballot, setBallot] = useState(initialBallot);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const byId = useMemo(() => new Map(nominees.map((n) => [n.id, n])), [nominees]);
  const nameOf = useCallback((id: string) => byId.get(id)?.name ?? "someone else", [byId]);

  /** Current leader(s) per award. */
  const leaders = useMemo(
    () =>
      AWARD_CATEGORIES.map((c) => {
        let best = 0;
        let top: Nominee[] = [];
        for (const n of nominees) {
          const v = n.votes[c.id] ?? 0;
          if (v === 0 || !canBeNominated(c.id, n.gender)) continue;
          if (v > best) {
            best = v;
            top = [n];
          } else if (v === best) top.push(n);
        }
        return { c, best, top };
      }),
    [nominees],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = nominees.filter((n) => (!q || n.name.toLowerCase().includes(q)) && (!filter || canBeNominated(filter, n.gender)));
    if (filter) rows = [...rows].sort((a, b) => (b.votes[filter] ?? 0) - (a.votes[filter] ?? 0) || a.name.localeCompare(b.name));
    return rows;
  }, [nominees, query, filter]);

  /** Optimistic vote/unvote. Resolves to an error message, or null on success. Only the touched fields are rolled back on failure. */
  const cast = useCallback(
    async (nomineeId: string, category: string): Promise<string | null> => {
      const before = ballot[category] ?? null;
      const next = before === nomineeId ? null : nomineeId;
      const bump = (id: string, by: number) =>
        setNominees((all) =>
          all.map((n) => (n.id === id ? { ...n, votes: { ...n.votes, [category]: Math.max(0, (n.votes[category] ?? 0) + by) } } : n)),
        );
      const setMine = (id: string | null) =>
        setBallot((b) => {
          const { [category]: _drop, ...rest } = b;
          void _drop;
          return id ? { ...rest, [category]: id } : rest;
        });

      setPending((p) => new Set(p).add(category));
      setMine(next);
      if (before) bump(before, -1);
      if (next) bump(next, 1);

      const done = () =>
        setPending((p) => {
          const s = new Set(p);
          s.delete(category);
          return s;
        });
      const rollback = () => {
        setMine(before);
        if (next) bump(next, -1);
        if (before) bump(before, 1);
      };

      try {
        const r = await castVoteAction({ nomineeId, category });
        if (!r.ok) {
          rollback();
          return r.error;
        }
        setMine(r.data.nomineeId);
        setNominees((all) =>
          all.map((n) => (n.id in r.data.counts ? { ...n, votes: { ...n.votes, [category]: r.data.counts[n.id] } } : n)),
        );
        const label = AWARD_CATEGORIES.find((c) => c.id === category)?.label ?? "this award";
        setToast(r.data.nomineeId ? `Vote locked in: ${nameOf(nomineeId)} for ${label}` : `Vote withdrawn from ${label}`);
        return null;
      } catch {
        rollback();
        return "Couldn't reach the server. Check your connection and try again.";
      } finally {
        done();
      }
    },
    [ballot, nameOf],
  );

  const active = activeId ? (byId.get(activeId) ?? null) : null;
  const voted = Object.keys(ballot).length;
  const filterLabel = filter ? AWARD_CATEGORIES.find((c) => c.id === filter) : null;

  return (
    <>
      <section aria-labelledby="leading-title" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="leading-title" className="font-display flex items-center gap-2 text-lg font-bold">
            <Trophy className="text-gold size-5" aria-hidden /> Leading right now
          </h2>
          <p className="text-muted text-sm" aria-live="polite">
            You&apos;ve voted in <b className="text-gold tabular">{voted}</b> of {AWARD_CATEGORIES.length} awards
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {leaders.map(({ c, best, top }) => {
            const on = filter === c.id;
            const lead = top[0];
            return (
              <li key={c.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setFilter(on ? null : c.id);
                    setShown(PAGE);
                  }}
                  className={cn(
                    "group flex w-full flex-1 flex-col items-center rounded-xl border p-3 text-center transition-colors",
                    on ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-gold/50",
                  )}
                >
                  <span className="text-sm font-bold">
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </span>
                  <span className="mt-2 w-16">
                    {lead ? (
                      <StarPhoto name={lead.name} photoUrl={lead.photoUrl} size={128} leader />
                    ) : (
                      <span className="text-muted flex aspect-square items-center justify-center" aria-hidden>
                        <Star className="size-8 opacity-40" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 line-clamp-2 min-h-[2lh] text-xs leading-snug font-semibold">
                    {lead ? (top.length > 1 ? `${lead.name} +${top.length - 1} tied` : lead.name) : "No votes yet"}
                  </span>
                  <span className="text-gold tabular mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
                    <Star className="size-3 fill-current" aria-hidden /> {best}
                  </span>
                </button>
                {(() => {
                  const open = revealed.has(c.id);
                  return (
                    <button
                      type="button"
                      disabled={revealing.has(c.id)}
                      aria-pressed={open}
                      onClick={() => toggleReveal(c.id)}
                      className={cn(
                        "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition-[filter,background-color] disabled:opacity-60",
                        open
                          ? "border-gold text-gold hover:bg-gold/10 border"
                          : "from-gold to-gold-deep bg-gradient-to-b text-black hover:brightness-110",
                      )}
                    >
                      {open ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                      {open ? "Revealed · Hide" : "Reveal"}
                      <span className="sr-only"> {c.label} on the Awardees page</span>
                    </button>
                  );
                })()}
              </li>
            );
          })}
        </ul>
        {revealError && (
          <p role="alert" className="text-bad mt-2 text-sm">
            {revealError}
          </p>
        )}
      </section>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search participants</span>
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search for a name…"
            className="border-line bg-surface-2 placeholder:text-muted/70 focus:border-gold min-h-11 w-full rounded-md border pr-3 pl-9 text-base"
          />
        </label>
        <p className="text-muted text-sm" aria-live="polite">
          {filterLabel ? (
            <>
              Showing eligible for <b className="text-fg">{filterLabel.label}</b> ·{" "}
              <button type="button" className="text-gold underline underline-offset-2" onClick={() => setFilter(null)}>
                show everyone
              </button>
            </>
          ) : (
            <>
              <b className="text-fg tabular">{list.length}</b> participants
            </>
          )}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="border-line rounded-md border border-dashed p-10 text-center">
          <Sparkles className="text-muted mx-auto size-10" aria-hidden />
          <p className="font-display mt-3 text-lg">{nominees.length === 0 ? "No participants yet" : "Nobody matches that"}</p>
          <p className="text-muted mt-1 text-sm">
            {nominees.length === 0 ? "Check back once registration fills up." : "Try a different name or clear the filter."}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {list.slice(0, shown).map((n) => {
              const mine = AWARD_CATEGORIES.filter((c) => ballot[c.id] === n.id);
              const shownVotes = filter ? (n.votes[filter] ?? 0) : total(n);
              return (
                <li
                  key={n.id}
                  className="group award-card border-line bg-surface relative flex flex-col items-center rounded-2xl border px-3 pt-4 pb-3 text-center"
                >
                  <span
                    className="bg-bg/80 text-gold tabular absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                    title={filter ? "Votes in this award" : "Total votes"}
                  >
                    <Star className="size-3 fill-current" aria-hidden /> {shownVotes}
                    <span className="sr-only"> votes</span>
                  </span>
                  <div className="w-full max-w-36">
                    <StarPhoto name={n.name} photoUrl={n.photoUrl} />
                  </div>
                  <h3 className="mt-2 line-clamp-2 min-h-[2lh] text-sm leading-snug font-bold break-words">{n.name}</h3>
                  <p
                    className="mt-1 min-h-6 text-sm"
                    aria-label={mine.length ? `You voted for them in ${mine.map((c) => c.label).join(", ")}` : undefined}
                  >
                    {mine.map((c) => (
                      <span key={c.id} aria-hidden title={c.label} className="mx-0.5">
                        {c.emoji}
                      </span>
                    ))}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveId(n.id)}
                    className={cn(
                      "mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition-[filter,background-color]",
                      mine.length
                        ? "border-gold text-gold hover:bg-gold/10 border"
                        : "from-gold to-gold-deep bg-gradient-to-b text-black hover:brightness-110",
                    )}
                  >
                    <Star className={cn("size-4", !mine.length && "fill-current")} aria-hidden />
                    {mine.length ? `Nominated (${mine.length})` : "Nominate me"}
                    <span className="sr-only"> — {n.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {list.length > shown && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShown((s) => s + PAGE)}
            className="border-line bg-surface-2 hover:bg-line min-h-14 rounded-md border px-6 text-base font-semibold"
          >
            Show more ({list.length - shown} left)
          </button>
        </div>
      )}

      <VoteSheet
        nominee={active}
        ballot={ballot}
        nameOf={nameOf}
        pendingCategories={pending}
        onVote={cast}
        onClose={() => setActiveId(null)}
      />

      {toast && (
        <div
          role="status"
          className="bg-surface border-gold text-fg fixed inset-x-4 bottom-6 z-[60] mx-auto flex max-w-sm items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-xl"
        >
          <Star className="text-gold size-4 shrink-0 fill-current" aria-hidden /> {toast}
        </div>
      )}
    </>
  );
}
