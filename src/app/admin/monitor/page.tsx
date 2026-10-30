import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
import { RunningTimer } from "@/components/timer";
import { Badge, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { formatTime } from "@/lib/utils";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Challenge monitor" };

export default async function MonitorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const [running, finished, recent] = await Promise.all([
    db.challengeAttempt.findMany({
      where: { activity: { eventId: event.id }, status: "RUNNING" },
      orderBy: { startedAt: "asc" },
      include: { activity: { select: { name: true } }, activityRegistration: { select: { participant: { select: { fullName: true } } } } },
    }),
    db.challengeAttempt.findMany({
      where: { activity: { eventId: event.id }, status: "FINISHED" },
      orderBy: { finishedAt: "asc" },
      include: { activity: { select: { name: true } }, activityRegistration: { select: { participant: { select: { fullName: true } } } } },
    }),
    db.challengeAttempt.findMany({
      where: { activity: { eventId: event.id }, status: { in: ["SUBMITTED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { activity: { select: { name: true } }, activityRegistration: { select: { participant: { select: { fullName: true } } } } },
    }),
  ]);
  const serverNow = new Date().toISOString();
  return (
    <>
      <PageTitle title="Challenge monitor" sub={`${event.name} · updates live`} actions={<AutoRefresh eventId={event.id} />} />
      <h2 className="font-display mb-2 text-xl font-semibold">Running now ({running.length})</h2>
      {running.length === 0 ? (
        <EmptyState title="No challenges running" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {running.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{a.activityRegistration.participant.fullName}</p>
                  <p className="text-muted text-xs">
                    {a.activity.name} · attempt {a.attemptNumber} · started {formatTime(a.startedAt)}
                  </p>
                </div>
                <RunningTimer
                  startedAt={a.startedAt.toISOString()}
                  serverNow={serverNow}
                  className="tabular font-display text-brand text-3xl font-bold"
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <h2 className="font-display mt-8 mb-2 text-xl font-semibold">Stopped, awaiting score ({finished.length})</h2>
      {finished.length === 0 ? (
        <p className="text-muted text-sm">None.</p>
      ) : (
        <ul className="space-y-2">
          {finished.map((a) => (
            <li key={a.id} className="border-line bg-surface flex justify-between rounded-md border p-3 text-sm">
              <span>
                {a.activityRegistration.participant.fullName} · {a.activity.name}
              </span>
              <Badge tone="warn">Needs score</Badge>
            </li>
          ))}
        </ul>
      )}
      <h2 className="font-display mt-8 mb-2 text-xl font-semibold">Recently completed</h2>
      <ul className="space-y-2">
        {recent.map((a) => (
          <li key={a.id} className="border-line bg-surface flex justify-between rounded-md border p-3 text-sm">
            <span>
              {a.activityRegistration.participant.fullName} · {a.activity.name}
            </span>
            <Badge tone={a.status === "SUBMITTED" ? "ok" : "bad"}>
              {a.status}
              {a.cancellationReason ? `: ${a.cancellationReason}` : ""}
            </Badge>
          </li>
        ))}
      </ul>
    </>
  );
}
