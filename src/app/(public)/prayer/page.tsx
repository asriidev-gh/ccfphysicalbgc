import Link from "next/link";
import { cookies } from "next/headers";
import { HandHeart, ScrollText } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { PRAYER_CATEGORIES, PRAYER_CATEGORY_IDS, PRAYER_PAGE_SIZE } from "@/lib/prayer/notes";
import { listPrayers, PRAYER_COOKIE, prayerStats, prayerVoterHash } from "@/lib/services/prayer";
import { cn } from "@/lib/utils";
import { PrayerBoard } from "./board";

export const metadata = { title: "Prayer wall" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const href = (cat: string | null, n?: number) => {
  const q = new URLSearchParams();
  if (cat) q.set("cat", cat);
  if (n) q.set("n", String(n));
  const s = q.toString();
  return s ? `/prayer?${s}` : "/prayer";
};

export default async function PrayerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const catParam = one(sp.cat);
  const cat = catParam && PRAYER_CATEGORY_IDS.includes(catParam) ? catParam : null;
  const take = Math.min(Math.max(Number(one(sp.n)) || PRAYER_PAGE_SIZE, PRAYER_PAGE_SIZE), 200);
  const voterId = (await cookies()).get(PRAYER_COOKIE)?.value;

  const [{ items, hasMore }, stats] = await Promise.all([
    listPrayers(db, {
      category: cat,
      take,
      voter: voterId ? prayerVoterHash(voterId) : null,
    }),
    prayerStats(db),
  ]);

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
      active ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted hover:text-fg",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-12">
      <PageTitle title="Prayer wall" sub="Share what's on your heart. Others can pray with you, and you'll see how many have seen it." />

      <dl className="text-muted mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <ScrollText className="size-4" aria-hidden />
          <dt className="sr-only">Requests</dt>
          <dd>
            <b className="text-fg tabular">{stats.requests}</b> requests
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <HandHeart className="size-4" aria-hidden />
          <dt className="sr-only">Prayers lifted</dt>
          <dd>
            <b className="text-fg tabular">{stats.prayers}</b> prayers lifted
          </dd>
        </div>
      </dl>

      <nav aria-label="Filter by topic" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Link href={href(null)} className={chip(cat === null)} aria-current={cat === null ? "page" : undefined}>
          All topics
        </Link>
        {PRAYER_CATEGORIES.map((c) => (
          <Link key={c.id} href={href(c.id)} className={chip(cat === c.id)} aria-current={cat === c.id ? "page" : undefined}>
            <span aria-hidden>{c.emoji}</span> {c.label}
          </Link>
        ))}
      </nav>

      <PrayerBoard items={items} moreHref={hasMore ? href(cat, take + PRAYER_PAGE_SIZE) : null} filtered={cat !== null} />
    </div>
  );
}
