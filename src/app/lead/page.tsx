import Link from "next/link";
import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listMyActivities } from "@/lib/services/lead";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";

export const metadata = { title: "My activities" };

export default async function LeadHome() {
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const acts = await listMyActivities(db, actor);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="My activities" sub={`Signed in as ${actor.name}`} />
      {acts.length === 0 ? (
        <EmptyState title="No activities assigned" hint="Ask an administrator to assign you to an activity." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {acts.map((a) => (
            <Link key={a.id} href={`/lead/${a.id}`}>
              <Card className="hover:bg-surface-2 flex min-h-24 items-center gap-4 p-4">
                <span className="bg-brand/15 text-brand grid size-12 place-items-center rounded-md">
                  <SportIcon name={a.sport.icon} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{a.name}</p>
                  <p className="text-muted truncate text-xs">{a.event.name}</p>
                </div>
                <Badge tone={a.challengeStatus === "ACTIVE" ? "ok" : a.challengeStatus === "PAUSED" ? "warn" : "neutral"}>
                  {a.challengeStatus}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
