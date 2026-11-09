"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleLikeAction } from "@/app/actions/booth";
import { cn } from "@/lib/utils";

/** Optimistic like toggle; the server's answer replaces the guess. */
export function LikeButton({ photoId, initialLiked, initialCount }: { photoId: string; initialLiked: boolean; initialCount: number }) {
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Unlike this photo" : "Like this photo"}
      onClick={() => {
        const before = state;
        setError(false);
        setState({ liked: !before.liked, count: before.count + (before.liked ? -1 : 1) });
        start(async () => {
          try {
            const r = await toggleLikeAction(photoId);
            if (r.ok) setState({ liked: r.data.liked, count: r.data.likeCount });
            else {
              setState(before);
              setError(true);
            }
          } catch {
            setState(before);
            setError(true);
          }
        });
      }}
      className={cn(
        "hover:bg-surface-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold",
        state.liked ? "text-brand" : "text-muted",
      )}
    >
      <Heart className={cn("size-5", state.liked && "fill-current")} aria-hidden />
      <span>{state.count}</span>
      {error && <span className="text-bad text-xs font-normal">Try again</span>}
    </button>
  );
}
