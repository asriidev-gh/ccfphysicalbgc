import { db } from "@/lib/db";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageTitle } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Registrations" };

/** Enrolment by activity: capacity usage, waitlists and check-in progress. */
export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const acts = await db.eventActivity.findMany({
    where: { eventId: event.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, capacity: true, waitlistEnabled: true },
  });
  const groups = await db.activityRegistration.groupBy({
    by: ["activityId", "status", "queueStatus"],
    where: { activity: { eventId: event.id } },
    _count: true,
  });
  const n = (id: string, f: (g: (typeof groups)[number]) => boolean) =>
    groups.filter((g) => g.activityId === id && f(g)).reduce((s, g) => s + g._count, 0);
  return (
    <>
      <PageTitle title="Registrations" sub={`${event.name} · enrolment by activity`} />
      <div className="grid gap-4 md:grid-cols-2">
        {acts.map((a) => {
          const confirmed = n(a.id, (g) => g.status === "CONFIRMED");
          const wait = n(a.id, (g) => g.status === "WAITLISTED");
          const cancelled = n(a.id, (g) => g.status === "CANCELLED");
          const arrived = n(a.id, (g) => g.status === "CONFIRMED" && g.queueStatus !== "NOT_ARRIVED");
          const pct = a.capacity ? Math.min(100, Math.round((confirmed / a.capacity) * 100)) : 0;
          return (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.name}</CardTitle>
                {a.capacity && confirmed >= a.capacity && <Badge tone="warn">Full</Badge>}
              </CardHeader>
              <CardBody>
                {a.capacity && (
                  <div className="bg-surface-2 mb-3 h-2 overflow-hidden rounded-full" role="img" aria-label={`${pct}% of capacity`}>
                    <div className="bg-brand h-full" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted">Confirmed</dt>
                  <dd className="tabular text-right">
                    {confirmed}
                    {a.capacity ? ` / ${a.capacity}` : ""}
                  </dd>
                  <dt className="text-muted">Waitlisted{a.waitlistEnabled ? "" : " (off)"}</dt>
                  <dd className="tabular text-right">{wait}</dd>
                  <dt className="text-muted">Checked in</dt>
                  <dd className="tabular text-right">{arrived}</dd>
                  <dt className="text-muted">Cancelled</dt>
                  <dd className="tabular text-right">{cancelled}</dd>
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
