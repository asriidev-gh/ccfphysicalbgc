import { Star } from "lucide-react";
import { PollRefresh } from "@/components/poll-refresh";
import { StarPhoto } from "@/components/star-photo";
import { AWARD_CATEGORIES } from "@/lib/awards/categories";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { listAwardees } from "@/lib/services/awards";

export const metadata = { title: "Awardees" };
export const dynamic = "force-dynamic";

export default async function AwardeesPage() {
  const event = await getCurrentEvent();
  const awardees = event ? await listAwardees(db, event.id) : [];
  const byCategory = new Map(awardees.map((a) => [a.category, a]));

  return (
    <>
      <PollRefresh seconds={5} />
      <div className="awards-hero relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-8 text-center">
          <p className="text-gold text-xs font-bold tracking-[0.3em] uppercase">2nd Year Anniversary</p>
          <h1 className="font-display gold-text mt-2 text-5xl leading-none font-bold sm:text-6xl">Awardees</h1>
          <p className="text-muted mx-auto mt-3 max-w-xl text-sm sm:text-base">
            Our Informal Awards honorees, updating live as the votes come in.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-12">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AWARD_CATEGORIES.map((c) => {
            const a = byCategory.get(c.id);
            const lead = a?.nominees[0];
            return (
              <li
                key={c.id}
                className={
                  a
                    ? "group award-card border-gold/40 bg-surface flex flex-col items-center rounded-2xl border px-4 py-6 text-center"
                    : "border-line bg-surface/60 flex flex-col items-center rounded-2xl border border-dashed px-4 py-6 text-center"
                }
              >
                <p className="font-display text-xl font-bold">
                  <span aria-hidden>{c.emoji}</span> {c.label}
                </p>
                {a && lead && !a.revealed ? (
                  <>
                    {/* Placeholder only: the real name, photo and count never reach the browser until revealed. */}
                    <div className="mt-4 w-44 blur-md select-none" aria-hidden>
                      <StarPhoto name="? ?" photoUrl={null} size={352} />
                    </div>
                    <h2 className="font-display mt-3 text-2xl leading-tight font-bold blur-sm select-none" aria-hidden>
                      Mystery Awardee
                    </h2>
                    <p className="text-gold mt-2 text-sm font-bold">Revealing soon…</p>
                  </>
                ) : a && lead ? (
                  <>
                    <div className="mt-4 w-44">
                      {/* Keyed by person so a change of leader replays the pop-in. */}
                      <div key={lead.id} className="star-pop">
                        <StarPhoto name={lead.name} photoUrl={lead.photoUrl} size={352} leader />
                      </div>
                    </div>
                    <h2 className="gold-text font-display mt-3 text-2xl leading-tight font-bold break-words">{lead.name}</h2>
                    {a.nominees.length > 1 && (
                      <p className="text-muted mt-1 text-sm">
                        Tied with{" "}
                        {a.nominees
                          .slice(1)
                          .map((n) => n.name)
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-gold tabular mt-2 inline-flex items-center gap-1 text-sm font-bold">
                      <Star className="size-4 fill-current" aria-hidden /> {a.votes} {a.votes === 1 ? "vote" : "votes"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-muted mt-4 flex aspect-square w-44 items-center justify-center" aria-hidden>
                      <Star className="twinkle size-20 opacity-50" />
                    </div>
                    <p className="text-muted mt-3 text-lg font-semibold">No votes yet</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
