"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Medal, Radio } from "lucide-react";
import type { Leaderboard } from "@/lib/services/leaderboard";
import { cn, formatTime } from "@/lib/utils";
import { photoThumb } from "@/lib/photo-url";

function initialsOf(name: string) {
  const parts = name.trim().split(/s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

function ParticipantPhoto({ name, photoUrl, big }: { name: string; photoUrl: string | null; big?: boolean }) {
  const box = big ? "size-24" : "size-16";
  if (!photoUrl) {
    return (
      <span
        aria-hidden
        className={cn("bg-surface-2 text-muted flex shrink-0 items-center justify-center rounded-full text-sm font-bold", box)}
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail
    <img
      src={photoThumb(photoUrl, big ? 192 : 128)}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-full object-cover", box)}
    />
  );
}

export type Connection = "connecting" | "live" | "reconnecting";

/**
 * Subscribe to the server's SSE change stream. On every (re)connect the callback runs
 * once, so a client always recovers the latest state after an outage or sleeping tab.
 */
export function useLiveSignal(eventId: string, activityId: string | null, onSignal: () => void): Connection {
  const [conn, setConn] = useState<Connection>("connecting");
  const cb = useRef(onSignal);
  useEffect(() => {
    cb.current = onSignal;
  });
  useEffect(() => {
    const qs = new URLSearchParams({ eventId });
    if (activityId) qs.set("activityId", activityId);
    const es = new EventSource(`/api/stream?${qs}`);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => cb.current(), 150); // coalesce bursts / duplicate notifications
    };
    es.addEventListener("hello", () => {
      setConn("live");
      cb.current(); // recovery: always reload state after (re)connecting
    });
    es.addEventListener("change", fire);
    es.onerror = () => setConn("reconnecting"); // EventSource retries automatically
    const onVisible = () => document.visibilityState === "visible" && cb.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      es.close();
    };
  }, [eventId, activityId]);
  return conn;
}

export function ConnectionBadge({ conn }: { conn: Connection }) {
  const live = conn === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-bold tracking-wider uppercase",
        live ? "bg-brand/20 text-brand" : "bg-warn/15 text-warn",
      )}
    >
      <Radio className={cn("size-3", live && "live-dot")} aria-hidden />
      {live ? "Live" : conn === "connecting" ? "Connecting" : "Reconnecting"}
    </span>
  );
}

export type GenderFilter = "ALL" | "MALE" | "FEMALE";

export function GenderTabs({ value, onChange }: { value: GenderFilter; onChange: (g: GenderFilter) => void }) {
  const opts: { v: GenderFilter; label: string }[] = [
    { v: "ALL", label: "Overall" },
    { v: "MALE", label: "Male" },
    { v: "FEMALE", label: "Female" },
  ];
  return (
    <div className="flex gap-1" role="group" aria-label="Gender">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "min-h-10 rounded-md border px-3 text-sm font-semibold",
            value === o.v ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useBoard(eventId: string, activityId: string, initial: Leaderboard | null, limit?: number, gender: GenderFilter = "ALL") {
  const [board, setBoard] = useState<Leaderboard | null>(initial);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (limit) p.set("limit", String(limit));
      if (gender !== "ALL") p.set("gender", gender);
      const qs = p.size ? `?${p}` : "";
      const res = await fetch(`/api/leaderboard/${activityId}${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setBoard((await res.json()) as Leaderboard);
      setError(false);
    } catch {
      setError(true);
    }
  }, [activityId, limit, gender]);
  // Reload when the gender filter changes (the initial server render is the unfiltered board).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load();
  }, [load]);
  const conn = useLiveSignal(eventId, activityId, load);
  return { board, conn, error, reload: load };
}

export function BoardTable({ board, limit, big, query }: { board: Leaderboard | null; limit?: number; big?: boolean; query?: string }) {
  if (!board) return null;
  let rows = board.rows;
  if (query) rows = rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  if (limit) rows = rows.filter((r) => r.rank === null || r.rank <= limit);
  if (!rows.length)
    return (
      <p className={cn("border-line text-muted rounded-md border border-dashed p-6 text-center", big && "p-12 text-2xl")}>
        {query ? "No participants match your search." : "No results published yet. Check back soon."}
      </p>
    );
  return (
    <ol className="divide-line border-line bg-surface divide-y overflow-hidden rounded-md border">
      {rows.map((r, i) => (
        <li
          key={`${r.name}-${i}`}
          className={cn("flex items-center gap-3 px-4", big ? "py-4 text-3xl" : "py-3 text-base", r.rank === 1 && "bg-brand/10")}
        >
          <span
            className={cn(
              "tabular font-display w-10 shrink-0 text-center font-bold",
              big ? "w-20 text-5xl" : "text-2xl",
              r.rank === 1 ? "text-accent" : r.rank && r.rank <= 3 ? "text-fg" : "text-muted",
            )}
          >
            {r.rank ?? "–"}
          </span>
          {r.rank !== null && r.rank <= 3 && (
            <Medal aria-hidden className={cn(big ? "size-8" : "size-5", r.rank === 1 ? "text-accent" : "text-muted")} />
          )}
          <ParticipantPhoto name={r.name} photoUrl={r.photoUrl} big={big} />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {r.name}
            {r.provisional && (
              <span className="bg-warn/15 text-warn ml-2 rounded-sm px-1.5 py-0.5 align-middle text-xs font-semibold">Provisional</span>
            )}
          </span>
          {r.detail && <span className={cn("text-muted hidden sm:inline", big ? "text-xl" : "text-sm")}>{r.detail}</span>}
          <span
            className={cn("tabular font-display text-right font-bold", big ? "text-5xl" : "text-xl", r.status !== "VALID" && "text-muted")}
          >
            {r.display}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Public live leaderboard for one activity (search, Top N filter, connection state). */
export function LiveBoard({ eventId, initial }: { eventId: string; initial: Leaderboard }) {
  const [top, setTop] = useState<number | undefined>(undefined);
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<GenderFilter>("ALL");
  const { board, conn, error } = useBoard(eventId, initial.activity.id, initial, undefined, gender);
  return (
    <section aria-label={`${initial.activity.name} leaderboard`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ConnectionBadge conn={conn} />
        <GenderTabs value={gender} onChange={setGender} />
        <input
          aria-label="Search participants"
          placeholder="Search name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-line bg-surface-2 min-h-10 flex-1 rounded-md border px-3 text-sm sm:max-w-56"
        />
        <div className="flex gap-1" role="group" aria-label="Show top">
          {[3, 5, 10, undefined].map((n) => (
            <button
              key={n ?? "all"}
              onClick={() => setTop(n)}
              aria-pressed={top === n}
              className={cn(
                "min-h-10 rounded-md border px-3 text-sm font-semibold",
                top === n ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted",
              )}
            >
              {n ? `Top ${n}` : "All"}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-warn mb-2 text-sm">
          Connection problem. Showing the last known results; retrying…
        </p>
      )}
      <BoardTable board={board} limit={top} query={q} />
      {board?.updatedAt && <p className="text-muted mt-2 text-xs">Last result {formatTime(board.updatedAt)} (Manila)</p>}
    </section>
  );
}
