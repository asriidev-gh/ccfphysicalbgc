import type { Db } from "@/lib/db";
import { getEventBoards, getLeaderboard, type Leaderboard } from "./leaderboard";

export interface DisplayState {
  event: { id: string; name: string; organizer: string; occasion: string };
  settings: {
    mode: "SINGLE_ACTIVITY" | "ALL_SPORTS" | "ROTATE";
    activityId: string | null;
    topN: number;
    rotate: boolean;
    rotateSeconds: number;
    paused: boolean;
    showAnnouncements: boolean;
  };
  boards: Leaderboard[];
  announcements: { id: string; title: string; body: string }[];
  generatedAt: string;
}

/** Everything the projector page needs, restricted to published data. */
export async function getDisplayState(db: Db, eventId: string): Promise<DisplayState | null> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, organizer: true, occasion: true } });
  if (!event) return null;
  const s = await db.leaderboardDisplaySettings.findUnique({ where: { eventId } });
  const settings = {
    mode: s?.mode ?? "ALL_SPORTS",
    activityId: s?.activityId ?? null,
    topN: s?.topN ?? 10,
    rotate: s?.rotate ?? false,
    rotateSeconds: s?.rotateSeconds ?? 15,
    paused: s?.paused ?? false,
    showAnnouncements: s?.showAnnouncements ?? true,
  };
  const limit = settings.topN > 0 ? settings.topN : undefined;
  let boards: Leaderboard[];
  if (settings.mode === "SINGLE_ACTIVITY" && settings.activityId) {
    const b = await getLeaderboard(db, settings.activityId, { limit });
    boards = b ? [b] : [];
  } else boards = await getEventBoards(db, eventId, limit);
  const announcements = settings.showAnnouncements
    ? await db.announcement.findMany({
        where: { eventId, published: true, showOnDisplay: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { id: true, title: true, body: true },
      })
    : [];
  return { event, settings, boards, announcements, generatedAt: new Date().toISOString() };
}
