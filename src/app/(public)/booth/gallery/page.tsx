import Link from "next/link";
import { cookies } from "next/headers";
import { Camera, Download } from "lucide-react";
import { buttonVariants, EmptyState, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { boothDownload, boothThumb } from "@/lib/photo-url";
import { BOOTH_PAGE_SIZE, listBoothPhotos, VOTER_COOKIE, voterHash, type BoothSort } from "@/lib/services/booth";
import { cn } from "@/lib/utils";
import { LikeButton } from "./like-button";

export const metadata = { title: "Photobooth gallery" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sort: BoothSort = one(sp.sort) === "new" ? "new" : "top";
  const take = Math.min(Math.max(Number(one(sp.n)) || BOOTH_PAGE_SIZE, BOOTH_PAGE_SIZE), 200);
  const voterId = (await cookies()).get(VOTER_COOKIE)?.value;
  const { items, hasMore } = await listBoothPhotos(db, { sort, take, voter: voterId ? voterHash(voterId) : null });

  const tab = (s: BoothSort) =>
    cn(
      "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold",
      sort === s ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-fg",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle
        title="Photobooth gallery"
        sub="Like your favourites. The most liked photos rise to the top."
        actions={
          <Link href="/booth" className={buttonVariants()}>
            <Camera className="size-4" aria-hidden /> Take a photo
          </Link>
        }
      />
      <div className="mb-4 flex gap-2">
        <Link href="/booth/gallery?sort=top" className={tab("top")} aria-current={sort === "top" ? "page" : undefined}>
          Most liked
        </Link>
        <Link href="/booth/gallery?sort=new" className={tab("new")} aria-current={sort === "new" ? "page" : undefined}>
          Newest
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No photos yet" hint="Be the first to strike a pose." />
      ) : (
        <ul className="columns-2 gap-3 md:columns-3 lg:columns-4">
          {items.map((p) => (
            <li key={p.id} className="border-line bg-surface mb-3 break-inside-avoid overflow-hidden rounded-md border">
              <a href={boothThumb(p.imageUrl, 1600)} target="_blank" rel="noreferrer" aria-label="Open this photo full size">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the optimised size */}
                <img src={boothThumb(p.imageUrl, 600)} alt="Photobooth photo" loading="lazy" className="block h-auto w-full" />
              </a>
              <div className="flex items-center justify-between px-1">
                <LikeButton photoId={p.id} initialLiked={p.liked} initialCount={p.likeCount} />
                <a
                  href={boothDownload(p.imageUrl)}
                  aria-label="Download this photo"
                  className="text-muted hover:bg-surface-2 hover:text-fg inline-flex size-11 items-center justify-center rounded-md"
                >
                  <Download className="size-5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            href={`/booth/gallery?sort=${sort}&n=${take + BOOTH_PAGE_SIZE}`}
            scroll={false}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
