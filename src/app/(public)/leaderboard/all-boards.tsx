"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Leaderboard } from "@/lib/services/leaderboard";
import { BoardTable, ConnectionBadge, GenderTabs, useLiveSignal, type GenderFilter } from "@/components/live";
import { SportIcon } from "@/components/sport-icon";

/** Top-3 of every sport; refreshes whenever any activity in the event publishes. */
export function AllBoards({ eventId, initial }: { eventId: string; initial: Leaderboard[] }) {
  const [boards, setBoards] = useState(initial);
  const [gender, setGender] = useState<GenderFilter>("ALL");
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${eventId}?limit=3${gender === "ALL" ? "" : `&gender=${gender}`}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { boards: Leaderboard[] };
        setBoards(d.boards);
      }
    } catch {
      /* keep last known state; EventSource reconnect will trigger another load */
    }
  }, [eventId, gender]);
  const conn = useLiveSignal(eventId, null, load);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load();
  }, [load]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ConnectionBadge conn={conn} />
        <GenderTabs value={gender} onChange={setGender} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {boards.map((b) => (
          <section key={b.activity.id} aria-label={b.activity.name}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-xl font-semibold">
                <SportIcon name={b.activity.icon} className="text-brand size-5" />
                {b.activity.name}
              </h2>
              <Link href={`/leaderboard/${b.activity.slug}`} className="text-accent text-sm font-semibold hover:underline">
                Full results →
              </Link>
            </div>
            <BoardTable board={b} limit={3} />
          </section>
        ))}
      </div>
    </div>
  );
}
