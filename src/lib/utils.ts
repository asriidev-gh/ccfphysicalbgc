import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EVENT_TZ = "Asia/Manila";

export function formatDateTime(d: Date | string, tz: string = EVENT_TZ, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(new Date(d));
}

export function formatTime(d: Date | string, tz: string = EVENT_TZ) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(d));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
