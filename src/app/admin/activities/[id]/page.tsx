import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseScoringConfig } from "@/lib/scoring/schema";
import { defaultScoringConfig } from "@/lib/scoring/templates";
import { assignLeadAction, saveActivityAction, unassignLeadAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { ScoringEditor } from "@/components/scoring-editor";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { adminPage, one, toManilaInput } from "../../_lib";

export const metadata = { title: "Configure activity" };

export default async function ActivityEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await adminPage();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const act = isNew
    ? null
    : await db.eventActivity.findUnique({
        where: { id },
        include: {
          assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
  // Rules lock once a result is recorded (matches saveActivity); unscored or cancelled attempts don't lock them.
  const scoredCount = act ? await db.challengeResult.count({ where: { attempt: { activityId: act.id } } }) : 0;
  if (!isNew && !act) notFound();

  const eventId = act?.eventId ?? one(sp.event);
  if (!eventId) return <EmptyState title="Choose an event first" hint="Open this page from Event Activities." />;
  const sports = await db.sport.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const sportId = act?.sportId ?? one(sp.sport);
  const sport = sports.find((s) => s.id === sportId);

  // Step 1 (new only): pick the sport template to start from.
  if (isNew && !sport)
    return (
      <>
        <PageTitle title="New activity" sub="Step 1 of 2 · Choose a sport" />
        <div className="grid gap-3 sm:grid-cols-2">
          {sports.map((s) => (
            <Link key={s.id} href={`/admin/activities/new?event=${eventId}&sport=${s.id}`}>
              <Card className="hover:bg-surface-2 p-4">
                <p className="font-display text-xl font-semibold">{s.name}</p>
                <p className="text-muted text-sm">{s.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </>
    );

  const cfgSource = act?.scoringConfig ?? sport?.defaultScoring;
  const parsed = parseScoringConfig(cfgSource);
  const initialCfg = parsed.success ? parsed.data : defaultScoringConfig("POINTS");
  const leads = await db.user.findMany({
    where: { role: "ACTIVITY_LEAD", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const locked = scoredCount > 0;

  return (
    <>
      <PageTitle
        title={act ? act.name : `New ${sport!.name} activity`}
        sub={isNew ? "Step 2 of 2 · Configure" : `Scoring version ${act!.scoringVersion}`}
      />
      <ActionForm action={saveActivityAction} submitLabel={act ? "Save changes" : "Create activity"} success="Saved." className="space-y-6">
        {act && <input type="hidden" name="id" value={act.id} />}
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="sportId" value={act?.sportId ?? sport!.id} />

        <Card>
          <CardHeader>
            <CardTitle>1 · Basics</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Activity name">
              <Input name="name" required defaultValue={act?.name ?? sport?.name} />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={act?.location} placeholder="e.g. Court A" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description (public)">
                <Input name="description" defaultValue={act?.description ?? sport?.description} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Instructions for participants and leads">
                <Textarea name="instructions" defaultValue={act?.instructions} />
              </Field>
            </div>
            <Field label="Starts (optional, Manila)">
              <Input type="datetime-local" name="startsAt" defaultValue={act?.startsAt ? toManilaInput(act.startsAt) : ""} />
            </Field>
            <Field label="Ends (optional, Manila)">
              <Input type="datetime-local" name="endsAt" defaultValue={act?.endsAt ? toManilaInput(act.endsAt) : ""} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2 · Registration</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacity" hint="Leave empty for unlimited.">
              <Input type="number" min={1} name="capacity" defaultValue={act?.capacity ?? ""} />
            </Field>
            <Field label="Participation">
              <Select name="participation" defaultValue={act?.participation ?? "INDIVIDUAL"}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="TEAM">Team (names entered per participant)</option>
              </Select>
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="waitlistEnabled"
                defaultChecked={act?.waitlistEnabled}
                className="size-5 accent-[var(--brand)]"
              />{" "}
              Enable waitlist when full
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Results &amp; leaderboard</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="requireApproval"
                defaultChecked={act?.requireApproval ?? false}
                className="size-5 accent-[var(--brand)]"
              />{" "}
              Results need approval before they are published
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="independentApproval"
                defaultChecked={act?.independentApproval ?? true}
                className="size-5 accent-[var(--brand)]"
              />{" "}
              The person who submitted a result cannot approve it
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="leaderboardPublished"
                defaultChecked={act?.leaderboardPublished ?? true}
                className="size-5 accent-[var(--brand)]"
              />{" "}
              Show on the public leaderboard
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4 · Scoring</CardTitle>
            {act && <Badge>Version {act.scoringVersion}</Badge>}
          </CardHeader>
          <CardBody>
            <ScoringEditor name="scoringConfig" initial={initialCfg} locked={locked} />
          </CardBody>
        </Card>
      </ActionForm>

      {act && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity leads</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {act.assignments.length === 0 ? (
              <p className="text-warn text-sm">No lead assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {act.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span>
                      {a.user.name} <span className="text-muted text-xs">{a.user.email}</span>
                    </span>
                    <ActionButton
                      variant="danger"
                      confirm={`Remove ${a.user.name} from ${act.name}?`}
                      action={unassignLeadAction.bind(null, a.user.id, act.id)}
                    >
                      Remove
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={assignLeadAction} hideSubmit className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="activityId" value={act.id} />
              <Field label="Assign a lead">
                <Select name="userId" required>
                  <option value="">Select an account…</option>
                  {leads
                    .filter((l) => !act.assignments.some((a) => a.userId === l.id))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.email})
                      </option>
                    ))}
                </Select>
              </Field>
              <Button type="submit">Assign</Button>
            </ActionForm>
            <p className="text-muted text-xs">
              Need a new account? Create it under{" "}
              <Link href="/admin/leads" className="text-accent underline">
                Activity Leads
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      )}
    </>
  );
}
