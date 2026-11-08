import Link from "next/link";
import { Images } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { photosConfigured } from "@/lib/services/photo";
import { STICKER_FONT_FAMILIES } from "./fonts";
import { BoothStudio } from "./studio";

export const metadata = { title: "Photobooth" };

export default function BoothPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageTitle
        title="Photobooth"
        sub="Strike a pose, post it, and get your friends to like it."
        actions={
          <Link href="/booth/gallery" className="text-brand inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <Images className="size-4" aria-hidden /> Gallery
          </Link>
        }
      />
      {photosConfigured() ? null : (
        <p className="border-warn/40 bg-warn/10 text-warn mb-4 rounded-md border p-3 text-sm">
          Posting to the gallery is not set up yet, but you can still take a photo and save it to your phone.
        </p>
      )}
      <BoothStudio fonts={STICKER_FONT_FAMILIES} />
    </div>
  );
}
