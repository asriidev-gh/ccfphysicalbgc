import { db } from "@/lib/db";
import { deletePrayerAction, hidePrayerAction } from "@/app/actions/prayer";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { prayerCategory } from "@/lib/prayer/notes";
import { formatDateTime } from "@/lib/utils";
import { adminPage } from "../_lib";

export const metadata = { title: "Prayer wall" };

export default async function AdminPrayersPage() {
  await adminPage();
  // Reported / hidden notes first so moderators see what needs a decision.
  const rows = await db.prayerRequest.findMany({
    orderBy: [{ hidden: "desc" }, { reportCount: "desc" }, { createdAt: "desc" }],
    take: 150,
  });
  return (
    <>
      <PageTitle
        title="Prayer wall"
        sub="Notes reported by three different devices are hidden automatically. Unhide to clear the reports, or delete for good."
      />
      {rows.length === 0 ? (
        <EmptyState title="No prayer requests yet" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className={p.hidden ? "border-warn/60" : undefined}>
                <CardBody className="space-y-3">
                  <p className="text-sm break-words whitespace-pre-wrap">{p.body}</p>
                  <p className="text-muted text-xs">
                    {p.authorName ?? "Anonymous"} · {prayerCategory(p.category).label} · {formatDateTime(p.createdAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge>{p.prayCount} prayed</Badge>
                    {p.reportCount > 0 && <Badge tone="bad">{p.reportCount} reports</Badge>}
                    {p.hidden && <Badge tone="warn">Hidden</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton action={hidePrayerAction.bind(null, p.id, !p.hidden)}>{p.hidden ? "Unhide" : "Hide"}</ActionButton>
                    <ActionButton
                      variant="danger"
                      confirm="Delete this prayer request permanently?"
                      action={deletePrayerAction.bind(null, p.id)}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
