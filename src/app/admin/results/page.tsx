import { db } from "@/lib/db";
import { loadConfig } from "@/lib/services/challenge";
import { formatValue } from "@/lib/services/leaderboard";
import { formatDateTime } from "@/lib/utils";
import { dismissDisputeAction, reviewAction } from "@/app/actions/lead";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { adminPage, hoursAgo, one, resolveEvent } from "../_lib";
import { CorrectForm } from "./correct-form";

export const metadata = { title: "Results & approvals" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const results = await db.challengeResult.findMany({
    where: {
      current: true,
      attempt: { activity: { eventId: event.id } },
      OR: [{ approvalStatus: "PENDING" }, { disputed: true }, { submittedAt: { gte: hoursAgo(6) } }],
    },
    orderBy: { submittedAt: "desc" },
    take: 60,
    include: {
      attempt: {
        select: {
          attemptNumber: true,
          heat: true,
          activity: { select: { name: true, scoringConfig: true, independentApproval: true } },
          activityRegistration: { select: { participant: { select: { fullName: true } } } },
        },
      },
    },
  });
  const pending = results.filter((r) => r.approvalStatus === "PENDING" && !r.disputed);
  const disputed = results.filter((r) => r.disputed);
  const rest = results.filter((r) => !pending.includes(r) && !disputed.includes(r));

  const line = (r: (typeof results)[number]) => {
    const cfg = loadConfig(r.attempt.activity.scoringConfig);
    return {
      who: r.attempt.activityRegistration.participant.fullName,
      act: r.attempt.activity.name,
      value: r.resultStatus === "VALID" ? formatValue(cfg, r.finalValue ? r.finalValue.toNumber() : null) : r.resultStatus,
      cfg,
    };
  };

  return (
    <>
      <PageTitle title="Results & approvals" sub={event.name} />
      <h2 className="font-display mb-2 text-xl font-semibold">Awaiting approval ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState title="Nothing waiting for approval" />
      ) : (
        <div className="space-y-3">
          {pending.map((r) => {
            const l = line(r);
            const own = r.attempt.activity.independentApproval && r.submittedById === actor.id;
            return (
              <Card key={r.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {l.who}{" "}
                      <span className="text-muted">
                        · {l.act} · attempt {r.attempt.attemptNumber}
                      </span>
                    </p>
                    <p className="tabular font-display text-2xl font-bold">{l.value}</p>
                    <p className="text-muted text-xs">Submitted {formatDateTime(r.submittedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    {own ? (
                      <Badge tone="warn">You submitted this; another reviewer must approve</Badge>
                    ) : (
                      <>
                        <ActionButton variant="primary" action={reviewAction.bind(null, r.id, "APPROVED", undefined)}>
                          Approve &amp; publish
                        </ActionButton>
                        <ActionButton variant="danger" action={reviewAction.bind(null, r.id, "REJECTED", undefined)}>
                          Reject
                        </ActionButton>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="font-display mt-8 mb-2 text-xl font-semibold">Disputed ({disputed.length})</h2>
      {disputed.length === 0 ? (
        <p className="text-muted text-sm">No open disputes.</p>
      ) : (
        <div className="space-y-3">
          {disputed.map((r) => {
            const l = line(r);
            return (
              <Card key={r.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {l.who} <span className="text-muted">· {l.act}</span>
                      </p>
                      <p className="tabular font-display text-2xl font-bold">{l.value}</p>
                      <p className="text-bad text-sm">“{r.disputeNote}”</p>
                    </div>
                    <ActionButton action={dismissDisputeAction.bind(null, r.id)}>Dismiss dispute</ActionButton>
                  </div>
                  <CorrectForm resultId={r.id} config={l.cfg} initialRaw={r.rawData as Record<string, unknown>} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="font-display mt-8 mb-2 text-xl font-semibold">Recent (last 6 hours)</h2>
      <ul className="space-y-2">
        {rest.map((r) => {
          const l = line(r);
          return (
            <li
              key={r.id}
              className="border-line bg-surface flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span>
                {l.who} · {l.act}
                {r.attempt.heat !== null && ` · Heat ${r.attempt.heat}`} · <span className="tabular font-semibold">{l.value}</span>
                {r.version > 1 && <span className="text-muted"> (v{r.version})</span>}
              </span>
              <Badge tone={r.approvalStatus === "APPROVED" ? "ok" : "bad"}>
                {r.approvalStatus === "APPROVED" ? (r.published ? "Published" : "Approved") : r.approvalStatus}
              </Badge>
            </li>
          );
        })}
      </ul>
    </>
  );
}
