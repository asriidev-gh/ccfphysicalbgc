import { db } from "@/lib/db";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Field, Input, PageTitle, Textarea } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await adminPage();
  const { event } = await resolveEvent(one((await searchParams).event));
  if (!event) return <EmptyState title="Create an event first" />;
  const items = await db.announcement.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageTitle title="Announcements" sub={event.name} />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
        </CardHeader>
        <CardBody>
          <ActionForm action={saveAnnouncementAction} submitLabel="Save" success="Saved." reset className="space-y-3">
            <input type="hidden" name="eventId" value={event.id} />
            <Field label="Title">
              <Input name="title" required maxLength={120} />
            </Field>
            <Field label="Message">
              <Textarea name="body" required maxLength={1000} />
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="published" className="size-5 accent-[var(--brand)]" /> Publish on the event website
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="showOnDisplay" className="size-5 accent-[var(--brand)]" /> Show on the projector screen
            </label>
          </ActionForm>
        </CardBody>
      </Card>
      <div className="space-y-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardBody>
              <ActionForm action={saveAnnouncementAction} submitLabel="Update" variant="secondary" success="Updated." className="space-y-3">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="eventId" value={event.id} />
                <div className="flex flex-wrap gap-2">
                  {a.published ? <Badge tone="ok">Published</Badge> : <Badge>Draft</Badge>}
                  {a.showOnDisplay && <Badge tone="accent">On display</Badge>}
                </div>
                <Input name="title" defaultValue={a.title} required aria-label="Title" />
                <Textarea name="body" defaultValue={a.body} required aria-label="Message" />
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="published" defaultChecked={a.published} className="size-5 accent-[var(--brand)]" />{" "}
                    Published
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="showOnDisplay" defaultChecked={a.showOnDisplay} className="size-5 accent-[var(--brand)]" />{" "}
                    On projector
                  </label>
                </div>
              </ActionForm>
              <div className="mt-2">
                <ActionButton variant="danger" confirm="Delete this announcement?" action={deleteAnnouncementAction.bind(null, a.id)}>
                  Delete
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
