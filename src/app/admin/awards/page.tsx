import { setAwardeeAction } from "@/app/actions/awards";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { awardsAdminView } from "@/lib/services/awards";
import { adminPage } from "../_lib";
import { AwardeePicker } from "./picker";

export const metadata = { title: "Informal Awards" };

export default async function AdminAwardsPage() {
  await adminPage();
  const event = await getCurrentEvent();
  if (!event) return <EmptyState title="No event yet" hint="Awards attach to the current published event." />;
  const view = await awardsAdminView(db, event.id);

  return (
    <>
      <PageTitle
        title="Informal Awards"
        sub="The public Awardees page follows the leading vote automatically. Declare someone below to lock them in as the awardee instead (Clear to go back to the vote)."
      />
      <ul className="grid gap-4 lg:grid-cols-2">
        {view.map(({ category: c, awardee, top, eligible }) => (
          <li key={c.id}>
            <Card>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </h2>
                  {awardee ? <Badge tone="ok">Declared</Badge> : <Badge tone="warn">Not declared</Badge>}
                </div>

                {awardee && (
                  <div className="border-gold/50 bg-gold/10 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <p className="text-sm">
                      Awardee: <b>{awardee.name}</b>
                    </p>
                    <ActionButton
                      variant="danger"
                      confirm={`Remove ${awardee.name} as ${c.label}?`}
                      action={setAwardeeAction.bind(null, event.id, c.id, null)}
                    >
                      Clear
                    </ActionButton>
                  </div>
                )}

                <div>
                  <p className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">Top voted</p>
                  {top.length === 0 ? (
                    <p className="text-muted text-sm">No votes yet.</p>
                  ) : (
                    <ol className="grid gap-1.5">
                      {top.map((t, i) => (
                        <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="text-muted tabular mr-2">{i + 1}.</span>
                            {t.name}
                            <span className="text-gold tabular ml-2 font-bold">★ {t.votes}</span>
                          </span>
                          {awardee?.id === t.id ? (
                            <Badge tone="ok">Awardee</Badge>
                          ) : (
                            <ActionButton action={setAwardeeAction.bind(null, event.id, c.id, t.id)}>Declare</ActionButton>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <AwardeePicker eventId={event.id} category={c.id} eligible={eligible} />
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
