import Link from "next/link";
import { db } from "@/lib/db";
import { activityStateAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/action-button";
import { SportIcon } from "@/components/sport-icon";
import { Badge, buttonVariants, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Event activities" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const acts = await db.eventActivity.findMany({
    where: { eventId: event.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      sport: { select: { name: true, icon: true } },
      assignments: { include: { user: { select: { name: true } } } },
      _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
    },
  });
  return (
    <>
      <PageTitle
        title="Event activities"
        sub={event.name}
        actions={
          <Link href={`/admin/activities/new?event=${event.id}`} className={buttonVariants()}>
            New activity
          </Link>
        }
      />
      {acts.length === 0 ? (
        <EmptyState title="No activities yet" hint="Create one from a sport template." />
      ) : (
        <div className="space-y-3">
          {acts.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-brand/15 text-brand grid size-11 place-items-center rounded-md">
                    <SportIcon name={a.sport.icon} className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <Link href={`/admin/activities/${a.id}`} className="font-display hover:text-accent text-xl font-semibold">
                      {a.name}
                    </Link>
                    <p className="text-muted text-xs">
                      {a.sport.name} · {a._count.registrations}
                      {a.capacity ? `/${a.capacity}` : ""} enrolled · Leads:{" "}
                      {a.assignments.length ? a.assignments.map((x) => x.user.name).join(", ") : "none assigned"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.challengeStatus === "ACTIVE" ? "ok" : a.challengeStatus === "PAUSED" ? "warn" : "neutral"}>
                    {a.challengeStatus}
                  </Badge>
                  <Badge tone={a.registrationStatus === "OPEN" ? "ok" : "neutral"}>Reg {a.registrationStatus}</Badge>
                  {a.challengeStatus !== "ACTIVE" && (
                    <ActionButton variant="primary" action={activityStateAction.bind(null, a.id, { challengeStatus: "ACTIVE" })}>
                      Activate
                    </ActionButton>
                  )}
                  {a.challengeStatus === "ACTIVE" && (
                    <ActionButton action={activityStateAction.bind(null, a.id, { challengeStatus: "PAUSED" })}>Pause</ActionButton>
                  )}
                  {a.challengeStatus !== "COMPLETED" && a.challengeStatus !== "DRAFT" && (
                    <ActionButton
                      variant="danger"
                      confirm={`Mark ${a.name} as completed? No more challenges can be started.`}
                      action={activityStateAction.bind(null, a.id, { challengeStatus: "COMPLETED" })}
                    >
                      Complete
                    </ActionButton>
                  )}
                  <ActionButton
                    action={activityStateAction.bind(null, a.id, {
                      registrationStatus: a.registrationStatus === "OPEN" ? "CLOSED" : "OPEN",
                    })}
                  >
                    {a.registrationStatus === "OPEN" ? "Close registration" : "Open registration"}
                  </ActionButton>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
