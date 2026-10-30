import Link from "next/link";
import { db } from "@/lib/db";
import { overviewStats } from "@/lib/services/admin";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageTitle, Stat } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { adminPage, one, resolveEvent } from "./_lib";

export const metadata = { title: "Admin overview" };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event)
    return (
      <>
        <PageTitle title="Overview" />
        <EmptyState title="No events yet" hint="Create an event first." />
        <Link href="/admin/events" className="text-accent mt-4 inline-block underline">
          Go to Events
        </Link>
      </>
    );
  const [s, acts] = await Promise.all([
    overviewStats(db, actor, event.id),
    db.eventActivity.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        challengeStatus: true,
        registrationStatus: true,
        capacity: true,
        _count: { select: { registrations: { where: { status: "CONFIRMED" } }, assignments: true } },
      },
    }),
  ]);
  return (
    <>
      <PageTitle title="Overview" sub={event.name} actions={<AutoRefresh eventId={event.id} />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registrations" value={s.registrations} />
        <Stat label="Checked in" value={s.checkedIn} tone="accent" />
        <Stat label="Activity registrations" value={s.activityRegs} />
        <Stat label="Active challenges" value={s.running} tone="brand" />
        <Stat label="Completed challenges" value={s.completed} tone="ok" />
        <Stat label="Pending approvals" value={s.pending} tone="warn" />
        <Stat label="Activities active" value={s.activeActivities} tone="ok" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Activities</CardTitle>
          <Link href="/admin/activities" className="text-accent text-sm font-semibold">
            Manage →
          </Link>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-muted text-left text-xs uppercase">
              <tr>
                <th className="p-3">Activity</th>
                <th>Status</th>
                <th>Registration</th>
                <th>Enrolled</th>
                <th>Leads</th>
              </tr>
            </thead>
            <tbody>
              {acts.map((a) => (
                <tr key={a.id} className="border-line border-t">
                  <td className="p-3 font-semibold">{a.name}</td>
                  <td>
                    <Badge tone={a.challengeStatus === "ACTIVE" ? "ok" : a.challengeStatus === "PAUSED" ? "warn" : "neutral"}>
                      {a.challengeStatus}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={a.registrationStatus === "OPEN" ? "ok" : "neutral"}>{a.registrationStatus}</Badge>
                  </td>
                  <td className="tabular">
                    {a._count.registrations}
                    {a.capacity ? ` / ${a.capacity}` : ""}
                  </td>
                  <td>{a._count.assignments === 0 ? <Badge tone="warn">None</Badge> : a._count.assignments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
