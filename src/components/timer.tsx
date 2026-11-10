"use client";

import { useEffect, useState } from "react";
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
}: {
  startedAt: string;
  serverNow: string;
  className?: string;
  /** Hold the current value (e.g. while a stop request is in flight). */
  frozen?: boolean;
}) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const start = new Date(startedAt).getTime();
    const now = () => Math.max(0, Date.now() + offset - start);
    if (frozen) return; // keep the last displayed value
    let raf = 0;
    const tick = () => {
      setMs(now());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [startedAt, serverNow, frozen]);

  return (
    <span className={className} aria-live="off">
      {formatDuration(ms)}
    </span>
  );
}
