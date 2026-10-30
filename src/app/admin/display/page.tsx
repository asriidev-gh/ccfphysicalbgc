import Link from "next/link";
import { db } from "@/lib/db";
import { saveDisplayAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { buttonVariants, Card, CardBody, CardHeader, CardTitle, EmptyState, Field, Input, PageTitle, Select } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Leaderboard control" };

export default async function DisplayControl({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const [s, acts] = await Promise.all([
    db.leaderboardDisplaySettings.findUnique({ where: { eventId: event.id } }),
    db.eventActivity.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageTitle
        title="Leaderboard control"
        sub="Changes apply to the projector screen instantly."
        actions={
          <Link href="/display" target="_blank" className={buttonVariants()}>
            Open presentation screen ↗
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Display settings</CardTitle>
        </CardHeader>
        <CardBody>
          <ActionForm
            action={saveDisplayAction}
            submitLabel="Apply to screen"
            success="Applied. The projector screen is updating."
            className="space-y-4"
          >
            <input type="hidden" name="eventId" value={event.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mode">
                <Select name="mode" defaultValue={s?.mode ?? "ALL_SPORTS"}>
                  <option value="ALL_SPORTS">All sports at once</option>
                  <option value="SINGLE_ACTIVITY">Single activity</option>
                  <option value="ROTATE">Rotate through activities</option>
                </Select>
              </Field>
              <Field label="Activity (single-activity mode)">
                <Select name="activityId" defaultValue={s?.activityId ?? ""}>
                  <option value="">—</option>
                  {acts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rows shown">
                <Select name="topN" defaultValue={String(s?.topN ?? 10)}>
                  <option value="3">Top 3</option>
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                  <option value="0">All</option>
                </Select>
              </Field>
              <Field label="Rotation interval (seconds)">
                <Input type="number" name="rotateSeconds" min={5} max={300} defaultValue={s?.rotateSeconds ?? 15} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="rotate" defaultChecked={s?.rotate} className="size-5 accent-[var(--brand)]" /> Auto-rotate (in
                All-sports mode shows one at a time)
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="paused" defaultChecked={s?.paused} className="size-5 accent-[var(--brand)]" /> Pause rotation
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="showAnnouncements"
                  defaultChecked={s?.showAnnouncements ?? true}
                  className="size-5 accent-[var(--brand)]"
                />{" "}
                Show announcements
              </label>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <iframe src="/display" title="Presentation preview" className="bg-bg h-[28rem] w-full" />
      </Card>
    </>
  );
}
