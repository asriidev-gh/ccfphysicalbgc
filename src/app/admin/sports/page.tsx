import { db } from "@/lib/db";
import { SPORT_ICON_NAMES } from "@/lib/event";
import { parseScoringConfig } from "@/lib/scoring/schema";
import { defaultScoringConfig } from "@/lib/scoring/templates";
import { saveSportAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { ScoringEditor } from "@/components/scoring-editor";
import { SportIcon } from "@/components/sport-icon";
import { Badge, Card, CardBody, CardHeader, CardTitle, Field, Input, PageTitle, Select } from "@/components/ui";
import { adminPage } from "../_lib";

export const metadata = { title: "Sports" };

type SportRow = Awaited<ReturnType<typeof listSports>>[number];
const listSports = () =>
  db.sport.findMany({
    orderBy: { name: "asc" },
    include: { activities: { select: { id: true, name: true, event: { select: { name: true } } } } },
  });

function SportForm({ s }: { s?: SportRow }) {
  const parsed = s ? parseScoringConfig(s.defaultScoring) : null;
  return (
    <ActionForm action={saveSportAction} submitLabel={s ? "Save sport" : "Create sport"} success="Saved." reset={!s} className="space-y-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <Input name="name" required defaultValue={s?.name} />
        </Field>
        <Field label="Icon">
          <Select name="icon" defaultValue={s?.icon ?? "trophy"}>
            {SPORT_ICON_NAMES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-11 items-end gap-3 pb-2">
          <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-5 accent-[var(--brand)]" /> Active
        </label>
      </div>
      <Field label="Description">
        <Input name="description" defaultValue={s?.description} />
      </Field>
      <details className="border-line rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Default scoring template</summary>
        <div className="mt-4">
          <ScoringEditor name="defaultScoring" initial={parsed?.success ? parsed.data : defaultScoringConfig("POINTS")} />
        </div>
      </details>
    </ActionForm>
  );
}

export default async function SportsPage() {
  await adminPage();
  const sports = await listSports();
  return (
    <>
      <PageTitle title="Sports" sub="Reusable sport definitions. Event activities copy the default scoring template and can override it." />
      <div className="space-y-4">
        {sports.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SportIcon name={s.icon} className="text-brand size-5" />
                {s.name}
              </CardTitle>
              <div className="flex gap-2">
                {!s.active && <Badge tone="warn">Inactive</Badge>}
                <Badge>{s.activities.length} event activities</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <SportForm s={s} />
              {s.activities.length > 0 && (
                <p className="text-muted mt-3 text-xs">Used in: {s.activities.map((a) => `${a.name} (${a.event.name})`).join(", ")}</p>
              )}
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>New sport</CardTitle>
          </CardHeader>
          <CardBody>
            <SportForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
