import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { saveEventAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, CardTitle, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";
import { adminPage, toManilaInput } from "../_lib";

export const metadata = { title: "Events" };

type EventRow = Awaited<ReturnType<typeof db.event.findMany>>[number];

function EventForm({ e }: { e?: EventRow }) {
  const d = (v: Date | undefined, fallback: string) => (v ? toManilaInput(v) : fallback);
  return (
    <ActionForm action={saveEventAction} submitLabel={e ? "Save event" : "Create event"} success="Saved." className="space-y-4" reset={!e}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name">
          <Input name="name" required defaultValue={e?.name} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={e?.status ?? "DRAFT"}>
            {["DRAFT", "PUBLISHED", "LIVE", "COMPLETED", "ARCHIVED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Organizer">
          <Input name="organizer" defaultValue={e?.organizer} />
        </Field>
        <Field label="Occasion">
          <Input name="occasion" defaultValue={e?.occasion} />
        </Field>
        <Field label="Venue">
          <Input name="venue" required defaultValue={e?.venue} />
        </Field>
        <Field label="Time zone">
          <Input name="timeZone" defaultValue={e?.timeZone ?? "Asia/Manila"} />
        </Field>
        <Field label="Starts (Manila time)">
          <Input type="datetime-local" name="startsAt" required defaultValue={d(e?.startsAt, "")} />
        </Field>
        <Field label="Ends (Manila time)">
          <Input type="datetime-local" name="endsAt" required defaultValue={d(e?.endsAt, "")} />
        </Field>
        <Field label="Registration opens">
          <Input type="datetime-local" name="registrationOpensAt" required defaultValue={d(e?.registrationOpensAt, "")} />
        </Field>
        <Field label="Registration closes">
          <Input type="datetime-local" name="registrationClosesAt" required defaultValue={d(e?.registrationClosesAt, "")} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" defaultValue={e?.description} />
      </Field>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="allowMultipleActivities"
          defaultChecked={e?.allowMultipleActivities ?? true}
          className="size-5 accent-[var(--brand)]"
        />{" "}
        Participants may join multiple activities
      </label>
    </ActionForm>
  );
}

export default async function EventsPage() {
  await adminPage();
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" } });
  return (
    <>
      <PageTitle title="Events" sub="Times are entered and shown in Manila time; stored in UTC." />
      <div className="space-y-4">
        {events.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle>{e.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone={e.status === "LIVE" ? "brand" : "neutral"}>{e.status}</Badge>
                <span className="text-muted text-xs">{formatDateTime(e.startsAt, e.timeZone)}</span>
              </div>
            </CardHeader>
            <CardBody>
              <EventForm e={e} />
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>New event</CardTitle>
          </CardHeader>
          <CardBody>
            <EventForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
