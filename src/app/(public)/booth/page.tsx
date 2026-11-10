import Link from "next/link";
import { cookies } from "next/headers";
import { Camera, Download } from "lucide-react";
import { buttonVariants, EmptyState, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { boothDownload, boothThumb } from "@/lib/photo-url";
import { BOOTH_PAGE_SIZE, listBoothPhotos, VOTER_COOKIE, voterHash, type BoothSort } from "@/lib/services/booth";
import { cn } from "@/lib/utils";
import { DeleteButton } from "./delete-button";
import { LikeButton } from "./like-button";
import { ShuffleGallery } from "./shuffle-gallery";

export const metadata = { title: "Photobooth" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const view = one(sp.sort) === "new" ? "new" : one(sp.sort) === "top" ? "top" : "shuffle";
  const shuffle = view === "shuffle";
  const sort: BoothSort = view === "top" ? "top" : "new";
  const take = shuffle ? 500 : Math.min(Math.max(Number(one(sp.n)) || BOOTH_PAGE_SIZE, BOOTH_PAGE_SIZE), 200);
  const voterId = (await cookies()).get(VOTER_COOKIE)?.value;
  const { items, hasMore } = await listBoothPhotos(db, { sort, take, voter: voterId ? voterHash(voterId) : null });

  const tab = (s: "shuffle" | BoothSort) =>
    cn(
      "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold",
      view === s ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-fg",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-8">
      <PageTitle
        title="Photobooth"
        sub="Like your favourites. Photos shuffle every few seconds, or sort by most liked."
        actions={
          <Link href="/booth/new" className={cn(buttonVariants({ size: "lg" }), "max-md:hidden")}>
            <Camera className="size-5" aria-hidden /> Start photobooth
          </Link>
        }
      />
      {one(sp.posted) === "1" && (
        <p role="status" className="border-ok/40 bg-ok/10 text-ok mb-4 rounded-md border p-3 text-sm font-semibold">
          Your photo is published! Find it under Newest, and share the page so friends can like it.
        </p>
      )}
      <div className="mb-4 flex gap-2">
        <Link href="/booth" className={tab("shuffle")} aria-current={shuffle ? "page" : undefined}>
          Shuffle
        </Link>
        <Link href="/booth?sort=top" className={tab("top")} aria-current={view === "top" ? "page" : undefined}>
          Most liked
        </Link>
        <Link href="/booth?sort=new" className={tab("new")} aria-current={view === "new" ? "page" : undefined}>
          Newest
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No photos yet" hint="Be the first to strike a pose." />
      ) : shuffle ? (
        <ShuffleGallery items={items} />
      ) : (
        <ul className="columns-2 gap-3 md:columns-3 lg:columns-4">
          {items.map((p) => (
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
      )}

      {hasMore && !shuffle && (
        <div className="mt-6 text-center">
          <Link
            href={`/booth?sort=${sort}&n=${take + BOOTH_PAGE_SIZE}`}
            scroll={false}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Load more
          </Link>
        </div>
      )}

      <Link
        href="/booth/new"
        className="bg-brand hover:bg-brand-strong fixed right-4 bottom-4 z-20 inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-semibold text-white shadow-lg shadow-black/50 md:hidden"
      >
        <Camera className="size-5" aria-hidden /> Start photobooth
      </Link>
    </div>
  );
}
