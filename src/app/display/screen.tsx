"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize } from "lucide-react";
import type { DisplayState } from "@/lib/services/display";
import { BoardTable, ConnectionBadge, useLiveSignal } from "@/components/live";
import { SportIcon } from "@/components/sport-icon";
import { formatTime } from "@/lib/utils";

export function DisplayScreen({ eventId, initial }: { eventId: string; initial: DisplayState }) {
  const [state, setState] = useState(initial);
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${eventId}`, { cache: "no-store" });
      if (res.ok) setState((await res.json()) as DisplayState);
    } catch {
      /* keep showing the last good state while reconnecting */
    }
  }, [eventId]);
  // Any result, display-setting or announcement change reloads the screen state.
  const conn = useLiveSignal(eventId, null, load);

  const { settings, boards } = state;
  const rotating = settings.mode === "ROTATE" || (settings.mode === "ALL_SPORTS" && settings.rotate);
  const list = boards;

  useEffect(() => {
    if (!rotating || settings.paused || list.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % list.length), settings.rotateSeconds * 1000);
    return () => clearInterval(t);
  }, [rotating, settings.paused, settings.rotateSeconds, list.length]);

  const current = list.length ? list[index % list.length] : null;
  const limit = settings.topN > 0 ? settings.topN : undefined;
  const allView = settings.mode === "ALL_SPORTS" && !settings.rotate;

  return (
    <main className="hero-glow text-fg flex min-h-screen flex-col px-8 py-6">
      <header className="border-line flex items-center justify-between gap-6 border-b pb-4">
        <div>
          <p className="font-display text-brand text-sm tracking-[0.3em]">{state.event.organizer}</p>
          <h1 className="font-display text-5xl leading-none font-bold">
            PHYSICAL <span className="text-brand">BGC</span> <span className="text-accent">2026</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge conn={conn} />
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Enter full screen"
            className="border-line text-muted rounded-md border p-2 opacity-40 hover:opacity-100"
          >
            <Maximize className="size-5" />
          </button>
        </div>
      </header>

      <section className="flex-1 py-6" aria-live="polite">
        {!current ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-muted text-5xl">Results will appear here soon</p>
          </div>
        ) : allView ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {list.map((b) => (
              <div key={b.activity.id}>
                <h2 className="font-display mb-2 flex items-center gap-3 text-3xl font-semibold">
                  <SportIcon name={b.activity.icon} className="text-brand size-7" />
                  {b.activity.name}
                </h2>
                <BoardTable board={b} limit={Math.min(limit ?? 3, 5)} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h2 className="font-display mb-4 flex items-center gap-4 text-6xl font-bold">
              <SportIcon name={current.activity.icon} className="text-brand size-12" />
              {current.activity.name}
            </h2>
            <BoardTable board={current} limit={limit} big />
            {current.updatedAt && <p className="text-muted mt-3 text-xl">Last updated {formatTime(current.updatedAt)}</p>}
          </div>
        )}
      </section>

      {state.announcements.length > 0 && (
        <footer className="border-line border-t pt-4">
          {state.announcements.slice(0, 2).map((a) => (
            <p key={a.id} className="text-2xl">
              <span className="font-display text-accent font-bold">{a.title}:</span> {a.body}
            </p>
          ))}
        </footer>
      )}
    </main>
  );
}
