import Image from "next/image";
import { cn } from "@/lib/utils";

/** CCF BGC Sports mark (square artwork). */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/assets/images/ccfbgc.jpg"
      alt="CCF BGC Sports"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 rounded-md", className)}
    />
  );
}
