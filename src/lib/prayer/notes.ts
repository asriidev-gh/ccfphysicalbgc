/** Shared (client + server) definitions for the prayer wall. No server-only imports here. */

export const PRAYER_MAX_LENGTH = 280;
export const PRAYER_MIN_LENGTH = 3;
export const PRAYER_NAME_MAX = 30;
/** Distinct reports that automatically hide a note until an admin reviews it. */
export const PRAYER_REPORT_HIDE_AT = 3;
export const PRAYER_PAGE_SIZE = 24;

export const PRAYER_CATEGORIES = [
  { id: "healing", label: "Healing", emoji: "🩹" },
  { id: "family", label: "Family", emoji: "🏠" },
  { id: "guidance", label: "Guidance", emoji: "🧭" },
  { id: "thanks", label: "Thanksgiving", emoji: "🙌" },
  { id: "sports", label: "Games & Team", emoji: "🏆" },
  { id: "other", label: "Other", emoji: "💬" },
] as const;
export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number]["id"];
export const PRAYER_CATEGORY_IDS: string[] = PRAYER_CATEGORIES.map((c) => c.id);

/** Sticky note paper colours. `ink` is always dark: every paper is light enough for AA contrast. */
export const PRAYER_COLORS = [
  { id: "yellow", label: "Yellow", paper: "#fde68a", edge: "#f6cf4f", ink: "#3b2f05" },
  { id: "pink", label: "Pink", paper: "#fbcfe8", edge: "#f29cc9", ink: "#4a1230" },
  { id: "blue", label: "Blue", paper: "#bfdbfe", edge: "#8ebcf5", ink: "#0f2a52" },
  { id: "green", label: "Green", paper: "#bbf7d0", edge: "#86e2a6", ink: "#0e3a1f" },
  { id: "orange", label: "Orange", paper: "#fed7aa", edge: "#f9b074", ink: "#4a2305" },
  { id: "purple", label: "Purple", paper: "#e9d5ff", edge: "#cfa8f7", ink: "#33145a" },
] as const;
export type PrayerColor = (typeof PRAYER_COLORS)[number]["id"];
export const PRAYER_COLOR_IDS: string[] = PRAYER_COLORS.map((c) => c.id);

export const prayerColor = (id: string) => PRAYER_COLORS.find((c) => c.id === id) ?? PRAYER_COLORS[0];
export const prayerCategory = (id: string) => PRAYER_CATEGORIES.find((c) => c.id === id) ?? PRAYER_CATEGORIES[PRAYER_CATEGORIES.length - 1];

/** Gentle, stable tilt per note (same on server and client, so no hydration mismatch). */
export function noteTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return [-1.6, 0.9, -0.7, 1.5, -1.1, 0.5][Math.abs(h) % 6];
}

export interface PrayerItem {
  id: string;
  body: string;
  authorName: string | null;
  category: string;
  color: string;
  prayCount: number;
  createdAt: string;
  prayed: boolean;
  mine: boolean;
  reported: boolean;
}
