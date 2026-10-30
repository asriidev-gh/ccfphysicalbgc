import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";

/** Every admin page re-checks the role itself (layouts do not protect against direct data access). */
export async function adminPage() {
  const actor = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return actor;
}

/** The event admin pages operate on: `?event=<id>` or the most recently starting event. */
export async function resolveEvent(eventParam?: string) {
  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, slug: true, timeZone: true, status: true },
  });
  const event = events.find((e) => e.id === eventParam) ?? events[0] ?? null;
  return { event, events };
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Format a Date as a datetime-local value in Manila time (UTC+8). */
export function toManilaInput(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}

/** A Date `hours` ago (kept out of components so render stays pure). */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600_000);
}
