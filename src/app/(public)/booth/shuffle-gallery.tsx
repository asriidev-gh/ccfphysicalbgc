"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui";
import { boothDownload, boothThumb } from "@/lib/photo-url";
import type { BoothItem } from "@/lib/services/booth";
import { DeleteButton } from "./delete-button";
import { LikeButton } from "./like-button";

const BATCH = 10;
const EVERY_MS = 10000;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shows BATCH random photos and swaps to a fresh batch every EVERY_MS. Photos are dealt from a shuffled deck so
 * everyone gets airtime before any repeats (fair with hundreds of entries); the deck reshuffles when used up.
 */
export function ShuffleGallery({ items }: { items: BoothItem[] }) {
  const [shown, setShown] = useState<BoothItem[]>(() => items.slice(0, BATCH));
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0); // bumps on every new batch; restarts the countdown bar and timer
  const deck = useRef<BoothItem[]>([]);

  const next = useCallback(() => {
    setTick((t) => t + 1);
    if (items.length <= BATCH) {
      setShown(shuffled(items));
      return;
    }
    if (deck.current.length < BATCH) deck.current = [...deck.current, ...shuffled(items)];
    const batch = deck.current.splice(0, BATCH);
    // A reshuffled deck can repeat a photo inside one batch; drop duplicates.
    setShown(batch.filter((p, i) => batch.findIndex((q) => q.id === p.id) === i));
  }, [items]);

  // Random first batch after hydration (kept out of the initial render to avoid a server/client mismatch).
  useEffect(() => {
    next();
  }, [next]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => { next(); }}>
          <Shuffle className="size-5" aria-hidden /> Shuffle
        </Button>
        <Button variant="secondary" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />} {paused ? "Resume" : "Pause"}
        </Button>
        <p className="text-muted text-sm">
          {items.length} photos · showing {shown.length}, new ones every {EVERY_MS / 1000}s
        </p>
      </div>

      <style>{`@keyframes booth-countdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      <div className="bg-surface-2 mb-4 h-1.5 overflow-hidden rounded-full" role="presentation">
        <div
          key={tick}
          onAnimationEnd={next} // the bar is the clock, so pause/resume can never drift out of sync with it
          className="bg-brand h-full origin-left"
          style={{
            animationName: "booth-countdown",
            animationDuration: `${EVERY_MS}ms`,
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </div>

      <ul className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {shown.map((p) => (
          <li key={p.id} className="border-line bg-surface mb-3 break-inside-avoid overflow-hidden rounded-md border">
            <a href={boothThumb(p.imageUrl, 1600)} target="_blank" rel="noreferrer" aria-label="Open this photo full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the optimised size */}
              <img src={boothThumb(p.imageUrl, 600)} alt="Photobooth photo" loading="lazy" className="block h-auto w-full" />
            </a>
            {p.ownerName && <p className="truncate px-3 pt-2 text-sm font-semibold">{p.ownerName}</p>}
            <div className="flex items-center justify-between px-1">
              <LikeButton photoId={p.id} initialLiked={p.liked} initialCount={p.likeCount} />
              <div className="flex items-center">
                {p.mine && <DeleteButton photoId={p.id} />}
                <a
                  href={boothDownload(p.imageUrl)}
                  aria-label="Download this photo"
                  className="text-muted hover:bg-surface-2 hover:text-fg inline-flex size-11 items-center justify-center rounded-md"
                >
                  <Download className="size-5" aria-hidden />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
