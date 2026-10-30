import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { LiveBoard } from "@/components/live";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SportLeaderboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getCurrentEvent();
  if (!event) notFound();
  const act = await db.eventActivity.findUnique({
    where: { eventId_slug: { eventId: event.id, slug } },
    select: { id: true, challengeStatus: true },
  });
  if (!act || act.challengeStatus === "DRAFT") notFound();
  const board = await getLeaderboard(db, act.id);
  if (!board) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/leaderboard" className="text-muted hover:text-fg text-sm">
        ← All sports
      </Link>
      <PageTitle title={board.activity.name} sub="Official results" />
      <LiveBoard eventId={event.id} initial={board} />
    </div>
  );
}
