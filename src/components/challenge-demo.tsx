"use client";

import { useRef } from "react";
import { Play, X } from "lucide-react";

/** Button that opens a modal with a challenge demo video. The video only loads once opened. */
export function ChallengeDemo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => {
    const d = ref.current;
    if (!d) return;
    d.querySelector("video")?.pause();
    d.close();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const d = ref.current;
          if (!d) return;
          d.showModal();
          const v = d.querySelector("video");
          if (v) {
            v.currentTime = 0;
            v.play().catch(() => {});
          }
        }}
        className="border-brand/50 text-brand hover:bg-brand/15 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors"
      >
        <Play className="size-4" aria-hidden /> Challenge demo
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(e) => e.target === ref.current && close()}
        onClose={() => ref.current?.querySelector("video")?.pause()}
        className="border-line bg-surface text-foreground m-auto w-[min(92vw,420px)] rounded-md border p-0 backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button type="button" onClick={close} aria-label="Close" className="text-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <video src={src} controls playsInline preload="metadata" className="max-h-[75vh] w-full bg-black" />
      </dialog>
    </>
  );
}
