import { db } from "@/lib/db";
import { buttonVariants, Card, CardBody, CardHeader, CardTitle, EmptyState, PageTitle } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Reports & exports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const [acts, byDay, walkIns] = await Promise.all([
    db.eventActivity.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { registrations: { where: { status: "CONFIRMED" } }, attempts: { where: { status: "SUBMITTED" } } } },
      },
    }),
    db.registration.groupBy({ by: ["status"], where: { eventId: event.id }, _count: true }),
    db.registration.count({ where: { eventId: event.id, walkIn: true } }),
  ]);
  const approved = await db.challengeResult.groupBy({
    by: ["approvalStatus"],
    where: { current: true, attempt: { activity: { eventId: event.id } } },
    _count: true,
  });
  return (
    <>
      <PageTitle
        title="Reports & exports"
        sub={event.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/export?eventId=${event.id}`} className={buttonVariants()}>
              Download registrations CSV
            </a>
            <a href={`/admin/export?eventId=${event.id}&kind=results`} className={buttonVariants()}>
              Download results CSV
            </a>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {byDay.map((g) => (
                <div key={g.status} className="contents">
                  <dt className="text-muted">{g.status}</dt>
                  <dd className="tabular text-right">{g._count}</dd>
                </div>
              ))}
              <dt className="text-muted">Walk-ins</dt>
              <dd className="tabular text-right">{walkIns}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {approved.length === 0 && <dd className="text-muted col-span-2">No results yet.</dd>}
              {approved.map((g) => (
                <div key={g.approvalStatus} className="contents">
                  <dt className="text-muted">{g.approvalStatus}</dt>
                  <dd className="tabular text-right">{g._count}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>By activity</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-muted text-left text-xs uppercase">
              <tr>
                <th className="p-3">Activity</th>
                <th>Enrolled</th>
                <th>Attempts submitted</th>
              </tr>
            </thead>
            <tbody>
              {acts.map((a) => (
                <tr key={a.id} className="border-line border-t">
                  <td className="p-3 font-semibold">{a.name}</td>
                  <td className="tabular">{a._count.registrations}</td>
                  <td className="tabular">{a._count.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <p className="text-muted mt-4 text-xs">
        CSV exports neutralise spreadsheet formulas and contain personal data. Handle and delete them according to your privacy policy.
      </p>
    </>
  );
}
