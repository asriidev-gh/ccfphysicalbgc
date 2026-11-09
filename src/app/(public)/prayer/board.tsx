"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HandHeart, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import type { PrayerItem } from "@/lib/prayer/notes";
import { Composer } from "./composer";
import { Note } from "./note";

export function PrayerBoard({
  items,
  moreHref,
  filtered,
}: {
  items: PrayerItem[];
  moreHref: string | null;
  /** True when a filter or sort could keep a brand-new note off the screen. */
  filtered: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; showAll: boolean } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const open = (
    <button type="button" onClick={() => setComposing(true)} className={buttonVariants({ size: "lg" })}>
      <Plus className="size-5" aria-hidden /> Add prayer request
    </button>
  );

  return (
    <>
      <div className="mb-6 hidden md:block">{open}</div>

      {items.length === 0 ? (
        <div className="border-line rounded-md border border-dashed p-10 text-center">
          <HandHeart className="text-muted mx-auto size-10" aria-hidden />
          <p className="font-display mt-3 text-lg">The wall is empty</p>
          <p className="text-muted mt-1 mb-5 text-sm">
            {filtered ? "Nothing here with these filters yet." : "Be the first to share something we can pray for."}
          </p>
          {open}
        </div>
      ) : (
        <ul className="grid grid-cols-1 items-stretch gap-x-6 gap-y-9 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Note key={item.id} item={item} fresh={fresh === item.id} />
          ))}
        </ul>
      )}

      {moreHref && (
        <div className="mt-10 text-center">
          <Link href={moreHref} scroll={false} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Load more
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => setComposing(true)}
        aria-label="Add prayer request"
        className="bg-brand hover:bg-brand-strong fixed right-4 bottom-4 z-20 inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-semibold text-white shadow-lg shadow-black/50 md:hidden"
      >
        <Plus className="size-5" aria-hidden /> Add prayer
      </button>

      <Composer
        open={composing}
        onClose={() => setComposing(false)}
        onPosted={({ id }) => {
          setComposing(false);
          setFresh(id);
          setToast({ text: "Your prayer request is on the wall. We're praying with you 🙏", showAll: filtered });
        }}
      />

      {toast && (
        <div
          role="status"
          className="border-line bg-surface fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-lg shadow-black/50 md:bottom-6"
        >
          <p className="flex-1">{toast.text}</p>
          {toast.showAll && (
            <Link href="/prayer" className="text-accent font-semibold whitespace-nowrap underline" onClick={() => setToast(null)}>
              Show all
            </Link>
          )}
        </div>
      )}
    </>
  );
}
