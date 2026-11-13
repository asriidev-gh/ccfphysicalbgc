import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listMyActivities } from "@/lib/services/lead";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { EmptyState, PageTitle } from "@/components/ui";
import { LiveBoard } from "@/components/live";
import { SportIcon } from "@/components/sport-icon";
import { listRecords } from "@/lib/services/dev-records";
import { DevRecords } from "./dev-records";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

/** Leaderboards for the activities the signed-in lead is assigned to (admins see every activity). */
export default async function LeadLeaderboard() {
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const acts = await listMyActivities(db, actor);
  const boards = (await Promise.all(acts.map(async (a) => ({ act: a, board: await getLeaderboard(db, a.id) })))).filter(
    (b) => b.board !== null,
  );
  // Local development only: per-activity record lists for the cleanup panel.
  const dev = process.env.NODE_ENV !== "production";
  const records = new Map(dev ? await Promise.all(boards.map(async ({ act }) => [act.id, await listRecords(db, actor, act.id)] as const)) : []);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Leaderboard" sub="Only the sports you are assigned to" />
      {boards.length === 0 ? (
        <EmptyState title="No activities assigned" hint="Ask an administrator to assign you to an activity." />
      ) : (
        <div className="space-y-8">
          {boards.map(({ act, board }) => (
            <section key={act.id} aria-label={act.name}>
              <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-semibold">
                <SportIcon name={act.sport.icon} className="text-brand size-5" />
                {act.name}
                <span className="text-muted text-xs font-medium">{act.event.name}</span>
              </h2>
              <LiveBoard eventId={act.eventId} initial={board!} />
              {dev && <DevRecords activityId={act.id} records={records.get(act.id) ?? []} />}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
