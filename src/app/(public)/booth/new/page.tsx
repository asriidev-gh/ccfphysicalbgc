import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { photosConfigured } from "@/lib/services/photo";
import { STICKER_FONT_FAMILIES } from "../fonts";
import { BoothStudio } from "../studio";

export const metadata = { title: "New photo · Photobooth" };

export default function NewBoothPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/booth" className="text-muted hover:text-fg mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> Gallery
      </Link>
      {photosConfigured() ? null : (
        <p className="border-warn/40 bg-warn/10 text-warn mb-4 rounded-md border p-3 text-sm">
          Publishing to the gallery is not set up yet, but you can still take a photo and save it to your phone.
        </p>
      )}
      <BoothStudio fonts={STICKER_FONT_FAMILIES} />
    </div>
  );
}
