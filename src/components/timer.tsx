"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/scoring/engine";

/**
 * Running timer driven by the server's authoritative start instant.
 * Elapsed = (client clock + offset) − startedAt, where offset = serverNow − clientNow when the
 * page data arrived. It recomputes from timestamps on every frame, so suspended or throttled
 * tabs never drift (unlike a once-per-second counter) and a wrong device clock is corrected.
 */
export function RunningTimer({
  startedAt,
  serverNow,
  className,
  frozen = false,
  durationMs,
  onTimeUp,
}: {
  startedAt: string;
  serverNow: string;
  className?: string;
  /** Hold the current value (e.g. while a stop request is in flight). */
  frozen?: boolean;
  /** Count DOWN from this many ms instead of up. */
  durationMs?: number;
  /** Fired once when a countdown reaches zero. */
  onTimeUp?: () => void;
}) {
  const [ms, setMs] = useState(durationMs ?? 0);
  const cb = useRef(onTimeUp);
  useEffect(() => {
    cb.current = onTimeUp;
  });

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const start = new Date(startedAt).getTime();
    const now = () => Math.max(0, Date.now() + offset - start);
    if (frozen) return; // keep the last displayed value
    let raf = 0;
    let fired = false;
    const tick = () => {
      const elapsed = now();
      if (durationMs !== undefined) {
        const left = Math.max(0, durationMs - elapsed);
        setMs(left);
        if (left === 0) {
          if (!fired) {
            fired = true;
            cb.current?.();
          }
          return; // countdown finished: stop animating
        }
      } else setMs(elapsed);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [startedAt, serverNow, frozen, durationMs]);

  return (
    <span className={className} aria-live="off">
      {formatDuration(ms)}
    </span>
  );
}
