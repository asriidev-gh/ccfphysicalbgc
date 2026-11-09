"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, X } from "lucide-react";
import { submitPrayerAction } from "@/app/actions/prayer";
import { PRAYER_CATEGORIES, PRAYER_COLORS, PRAYER_MAX_LENGTH, PRAYER_MIN_LENGTH, PRAYER_NAME_MAX, prayerColor } from "@/lib/prayer/notes";
import { cn } from "@/lib/utils";
import { noteFont } from "./fonts";

const NAME_KEY = "prayer_name";
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Modal composer. The textarea *is* the sticky note, so what you write is what gets posted. */
export function Composer({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: (r: { id: string; category: string }) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [color, setColor] = useState("yellow");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const paper = prayerColor(color);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setName((n) => n || readName());
      area.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const left = PRAYER_MAX_LENGTH - body.length;
  const tooShort = body.trim().length < PRAYER_MIN_LENGTH;

  const submit = () => {
    if (pending) return;
    if (tooShort) {
      setError("Write a little more so we know how to pray.");
      area.current?.focus();
      return;
    }
    setError(null);
    start(async () => {
      try {
        const r = await submitPrayerAction({ body, authorName: name.trim() || null, category, color });
        if (!r.ok) return setError(r.error);
        try {
          if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
        } catch {
          /* private mode: just don't remember it */
        }
        setBody("");
        onPosted({ id: r.data.id, category });
        router.refresh();
      } catch {
        setError("Network error. Your words are still here, so try again.");
      }
    });
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="composer-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg bg-transparent p-0 text-inherit backdrop:bg-black/75"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-line bg-surface max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-md border p-4 sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="composer-title" className="font-display text-xl font-bold">
            New prayer request
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:bg-surface-2 hover:text-fg inline-flex size-11 items-center justify-center rounded-md"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <div
          className="rounded-sm px-4 pt-3 pb-3 shadow-[0_8px_14px_-6px_rgba(0,0,0,.6)] transition-colors"
          style={{ background: paper.paper, color: paper.ink }}
        >
          <label htmlFor="prayer-body" className="sr-only">
            Your prayer request
          </label>
          <textarea
            id="prayer-body"
            ref={area}
            value={body}
            maxLength={PRAYER_MAX_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
            }}
            rows={5}
            placeholder="What can we pray with you about?"
            className={cn(
              noteFont.className,
              "block w-full resize-none bg-transparent text-2xl leading-snug placeholder:text-current/50 focus:outline-none",
            )}
            style={{ outline: "none" }}
          />
          <div className="mt-1 flex items-center gap-2 border-t border-black/15 pt-2">
            <label htmlFor="prayer-name" className="text-sm font-bold">
              From:
            </label>
            <input
              id="prayer-name"
              value={name}
              maxLength={PRAYER_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonymous"
              autoComplete="given-name"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-semibold placeholder:text-current/50 focus:outline-none"
            />
            <span className={cn("tabular text-xs font-bold", left <= 20 && "underline")} aria-live="polite">
              {left}
            </span>
          </div>
        </div>
        <p className="text-muted mt-1.5 text-xs">Leave the name blank to post anonymously. Anyone can read this.</p>

        <fieldset className="mt-4">
          <legend className="text-fg mb-1.5 text-sm font-medium">Topic</legend>
          <div className="flex flex-wrap gap-2">
            {PRAYER_CATEGORIES.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={c.id}
                  checked={category === c.id}
                  onChange={() => setCategory(c.id)}
                  className="peer sr-only"
                />
                <span className="border-line bg-surface-2 text-muted peer-checked:border-accent peer-checked:text-fg peer-focus-visible:outline-accent inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold peer-checked:bg-black/40 peer-focus-visible:outline-2">
                  <span aria-hidden>{c.emoji}</span> {c.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-fg mb-1.5 text-sm font-medium">Paper colour</legend>
          <div className="flex flex-wrap gap-2">
            {PRAYER_COLORS.map((c) => (
              <label key={c.id} className="cursor-pointer" title={c.label}>
                <input
                  type="radio"
                  name="color"
                  value={c.id}
                  checked={color === c.id}
                  onChange={() => setColor(c.id)}
                  className="peer sr-only"
                />
                <span
                  className="peer-focus-visible:outline-accent peer-checked:ring-fg inline-flex size-11 items-center justify-center rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-[var(--surface)] peer-focus-visible:outline-2"
                  style={{ background: c.paper }}
                >
                  {color === c.id && <Check className="size-5" style={{ color: c.ink }} aria-hidden />}
                  <span className="sr-only">{c.label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-bad mt-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-brand hover:bg-brand-strong mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
          Post to the wall
        </button>
      </form>
    </dialog>
  );
}
