"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/scoring/engine";

/**
 * Running timer driven by the server's authoritative start instant.
 * Elapsed = (client clock + offset) − startedAt, where offset = serverNow − clientNow when the
 * page data arrived. It recomputes from timestamps on every frame, so suspended or throttled
 * tabs never drift (unlike a once-per-second counter) and a wrong device clock is corrected.
 */
export function RunningTimer({ startedAt, serverNow, className }: { startedAt: string; serverNow: string; className?: string }) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const start = new Date(startedAt).getTime();
    let raf = 0;
    const tick = () => {
      setMs(Math.max(0, Date.now() + offset - start));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [startedAt, serverNow]);

  return (
    <span className={className} aria-live="off">
      {formatDuration(ms)}
    </span>
  );
}
