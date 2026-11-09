"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Flag, HandHeart, Loader2, Trash2 } from "lucide-react";
import { deleteMyPrayerAction, reportPrayerAction, togglePrayedAction } from "@/app/actions/prayer";
import { noteTilt, prayerCategory, prayerColor, type PrayerItem } from "@/lib/prayer/notes";
import { cn } from "@/lib/utils";
import { noteFont } from "./fonts";

const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

const iconBtn =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:opacity-50";

/** One sticky note: pray toggle and author / reader actions. */
export function Note({ item, fresh }: { item: PrayerItem; fresh: boolean }) {
  const paper = prayerColor(item.color);
  const cat = prayerCategory(item.category);
  const ref = useRef<HTMLLIElement>(null);

  const [prayer, setPrayer] = useState({ prayed: item.prayed, count: item.prayCount });
  const [reported, setReported] = useState(item.reported);
  const [gone, setGone] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "report" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (fresh) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [fresh]);

  if (gone) return null;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
      } catch {
        setError("Network error. Please retry.");
      }
    });
  };

  const togglePray = () => {
    const before = prayer;
    setPrayer({ prayed: !before.prayed, count: before.count + (before.prayed ? -1 : 1) });
    run(async () => {
      const r = await togglePrayedAction(item.id);
      if (r.ok) setPrayer({ prayed: r.data.prayed, count: r.data.prayCount });
      else {
        setPrayer(before);
        setError(r.error);
      }
    });
  };

  const remove = () =>
    run(async () => {
      const r = await deleteMyPrayerAction(item.id);
      if (r.ok) setGone(true);
      else setError(r.error);
    });

  const report = () =>
    run(async () => {
      const r = await reportPrayerAction(item.id);
      setConfirm(null);
      if (!r.ok) setError(r.error);
      else if (r.data.hidden) setGone(true);
      else setReported(true);
    });

  return (
    <li
      ref={ref}
      data-note-id={item.id}
      className={cn("sticky-note note-in flex min-h-60 flex-col px-5 pt-7 pb-2", fresh && "note-fresh")}
      style={
        {
          "--tilt": `${noteTilt(item.id)}deg`,
          "--paper": paper.paper,
          "--edge": paper.edge,
          color: paper.ink,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1">
          <span aria-hidden>{cat.emoji}</span> {cat.label}
        </span>
      </div>

      <p className={cn(noteFont.className, "mt-3 flex-1 text-[1.35rem] leading-snug break-words whitespace-pre-wrap")}>{item.body}</p>

      <p className="mt-3 text-xs font-semibold opacity-75">
        {item.authorName ?? "Anonymous"}
        {item.mine && " (you)"} · {day.format(new Date(item.createdAt))}
      </p>

      {confirm ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-black/15 py-2 text-sm font-semibold" role="alert">
          <span className="mr-auto">{confirm === "delete" ? "Delete this request?" : "Report this note?"}</span>
          <button
            type="button"
            disabled={pending}
            onClick={confirm === "delete" ? remove : report}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-black/80 px-4 text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirm === "delete" ? "Delete" : "Report"}
          </button>
          <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-md px-3 hover:bg-black/10">
            Cancel
          </button>
        </div>
      ) : (
        <div className="-mx-2 mt-1 flex items-center gap-0.5 border-t border-black/15 pt-1.5">
          <button
            type="button"
            onClick={togglePray}
            disabled={pending}
            aria-pressed={prayer.prayed}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap transition active:scale-95",
              prayer.prayed ? "bg-black/80 text-white" : "bg-white/50 hover:bg-white/80",
            )}
          >
            <HandHeart className={cn("size-5", prayer.prayed && "fill-white/25")} aria-hidden />
            <span>{prayer.prayed ? "Prayed" : "I prayed"}</span>
            <span className="tabular opacity-80">{prayer.count}</span>
          </button>

          {item.mine ? (
            <button type="button" onClick={() => setConfirm("delete")} className={iconBtn} aria-label="Delete my request" title="Delete">
              <Trash2 className="size-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("report")}
              disabled={reported}
              className={iconBtn}
              aria-label={reported ? "Reported" : "Report this note"}
              title={reported ? "Reported" : "Report"}
            >
              <Flag className={cn("size-5", reported && "fill-current")} aria-hidden />
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="pb-1 text-xs font-bold">
          {error}
        </p>
      )}
    </li>
  );
}
