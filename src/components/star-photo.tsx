import { photoThumb } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

/** A 12-point starburst as a clip-path polygon, so the photo keeps most of its area (a 5-point star would crop the face away). */
const BURST = (() => {
  const pts: string[] = [];
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 50 : 41;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(",")})`;
})();

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

/** Participant photo framed in a gold starburst. The ring only spins while the parent `group` is hovered or focused. */
export function StarPhoto({
  name,
  photoUrl,
  size = 224,
  leader,
  className,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
  leader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square w-full", className)} aria-hidden>
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: BURST }}>
        <div className={cn("burst-ring absolute inset-[-50%]", leader && "burst-ring-on")} />
      </div>
      <div className="bg-surface-2 absolute inset-[5%] overflow-hidden" style={{ clipPath: BURST }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail, face-cropped by the CDN
          <img src={photoThumb(photoUrl, size)} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="font-display text-muted flex size-full items-center justify-center bg-gradient-to-br from-[#2a2118] to-[#15151a] text-[clamp(1.25rem,28%,2.5rem)] font-bold">
            {initialsOf(name)}
          </span>
        )}
      </div>
    </div>
  );
}
