import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { getEventBoards } from "@/lib/services/leaderboard";
import { EmptyState, PageTitle } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { AllBoards } from "./all-boards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

export default async function LeaderboardIndex() {
  const event = await getCurrentEvent();
  if (!event)
    return (
      <div className="mx-auto max-w-3xl p-8">
        <EmptyState title="No event yet" />
      </div>
    );
  const boards = await getEventBoards(db, event.id, 3);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle title="Leaderboard" sub="All sports · official, approved results only" />
      <nav aria-label="Sports" className="mb-6 flex flex-wrap gap-2">
        {boards.map((b) => (
          <Link
            key={b.activity.id}
            href={`/leaderboard/${b.activity.slug}`}
            className="border-line bg-surface hover:bg-surface-2 inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold"
          >
            <SportIcon name={b.activity.icon} className="text-brand size-4" />
            {b.activity.name}
          </Link>
        ))}
      </nav>
      {boards.length === 0 ? <EmptyState title="No leaderboards are published yet" /> : <AllBoards eventId={event.id} initial={boards} />}
    </div>
  );
}
