import Link from "next/link";
import { db } from "@/lib/db";
import { listRegistrations } from "@/lib/services/admin";
import { cancelRegistrationAction, editParticipantAction, walkInAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Badge, buttonVariants, Card, CardBody, CardHeader, CardTitle, EmptyState, Field, Input, PageTitle, Select } from "@/components/ui";
import { adminPage, one, resolveEvent } from "../_lib";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Participants" };

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await adminPage();
  const sp = await searchParams;
  const { event } = await resolveEvent(one(sp.event));
  if (!event) return <EmptyState title="Create an event first" />;
  const q = one(sp.q) ?? "";
  const status = (["CONFIRMED", "WAITLISTED", "CANCELLED"] as const).find((s) => s === one(sp.status));
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [list, acts] = await Promise.all([
    listRegistrations(db, actor, { eventId: event.id, q, status, page, pageSize: 20 }),
    db.eventActivity.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const href = (p: number) =>
    `/admin/participants?${new URLSearchParams({ event: event.id, q, ...(status ? { status } : {}), page: String(p) })}`;

  return (
    <>
      <PageTitle
        title="Participants"
        sub={`${event.name} · ${list.total} registrations`}
        actions={
          <a href={`/admin/export?eventId=${event.id}`} className={buttonVariants({ variant: "secondary" })}>
            Export CSV
          </a>
        }
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <input type="hidden" name="event" value={event.id} />
        <Input name="q" defaultValue={q} placeholder="Search name, email, mobile or reference" aria-label="Search participants" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="sm:w-44">
          <option value="">Any status</option>
          <option>CONFIRMED</option>
          <option>WAITLISTED</option>
          <option>CANCELLED</option>
        </Select>
        <button className={buttonVariants()}>Search</button>
      </form>

      <Card className="mb-6">
        <details>
          <summary className="font-display cursor-pointer p-4 text-lg font-semibold">Register a walk-in</summary>
          <CardBody className="border-line border-t">
            <ActionForm
              action={walkInAction.bind(null, event.slug)}
              submitLabel="Register walk-in"
              success="Walk-in registered."
              reset
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name">
                  <Input name="fullName" required />
                </Field>
                <Field label="Affiliation">
                  <Input name="affiliation" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" />
                </Field>
                <Field label="Mobile">
                  <Input name="mobile" type="tel" />
                </Field>
              </div>
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-1 text-sm font-medium">Activities</legend>
                {acts.map((a) => (
                  <label key={a.id} className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="activityIds" value={a.id} className="size-5 accent-[var(--brand)]" />
                    {a.name}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="consent" required className="size-5 accent-[var(--brand)]" /> Participant accepted the terms
                and results display
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="eligibilityConfirmed" required className="size-5 accent-[var(--brand)]" /> Participant
                confirmed they are fit to take part
              </label>
            </ActionForm>
          </CardBody>
        </details>
      </Card>

      {list.rows.length === 0 ? (
        <EmptyState title="No registrations match" />
      ) : (
        <div className="space-y-3">
          {list.rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.participant.fullName}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "CONFIRMED" ? "ok" : r.status === "CANCELLED" ? "bad" : "warn"}>{r.status}</Badge>
                  {r.checkedInAt && <Badge tone="accent">Checked in</Badge>}
                  {r.walkIn && <Badge>Walk-in</Badge>}
                  {r.participant.status !== "ACTIVE" && <Badge tone="bad">{r.participant.status}</Badge>}
                  <span className="tabular text-muted text-xs">{r.code}</span>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-muted mb-3 text-sm">
                  {r.participant.email ?? "—"} · {r.participant.mobile ?? "—"} · Registered {formatDateTime(r.createdAt)} · Activities:{" "}
                  {r.participant.activityRegistrations
                    .filter((a) => a.status !== "CANCELLED")
                    .map((a) => a.activity.name + (a.status === "WAITLISTED" ? " (waitlist)" : ""))
                    .join(", ") || "none"}
                </p>
                <details>
                  <summary className="text-accent cursor-pointer text-sm font-semibold">Edit / cancel</summary>
                  <div className="mt-3 space-y-3">
                    <ActionForm
                      action={editParticipantAction.bind(null, r.participantId)}
                      submitLabel="Save"
                      variant="secondary"
                      success="Saved."
                    >
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Full name">
                          <Input name="fullName" defaultValue={r.participant.fullName} required />
                        </Field>
                        <Field label="Email">
                          <Input name="email" defaultValue={r.participant.email ?? ""} />
                        </Field>
                        <Field label="Mobile">
                          <Input name="mobile" defaultValue={r.participant.mobile ?? ""} />
                        </Field>
                        <Field label="Affiliation">
                          <Input name="affiliation" defaultValue={r.participant.affiliation ?? ""} />
                        </Field>
                        <Field label="Participant status">
                          <Select name="status" defaultValue={r.participant.status}>
                            <option>ACTIVE</option>
                            <option>WITHDRAWN</option>
                            <option>DISQUALIFIED</option>
                          </Select>
                        </Field>
                      </div>
                    </ActionForm>
                    {r.status !== "CANCELLED" && (
                      <ActionButton
                        variant="danger"
                        confirm={`Cancel ${r.participant.fullName}'s registration? This frees their spots.`}
                        action={cancelRegistrationAction.bind(null, r.id)}
                      >
                        Cancel registration
                      </ActionButton>
                    )}
                  </div>
                </details>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
        {list.page > 1 ? (
          <Link className={buttonVariants({ variant: "secondary" })} href={href(list.page - 1)}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted text-sm">
          Page {list.page} of {list.pages}
        </span>
        {list.page < list.pages ? (
          <Link className={buttonVariants({ variant: "secondary" })} href={href(list.page + 1)}>
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
