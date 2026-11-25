import { Star } from "lucide-react";
import { PollRefresh } from "@/components/poll-refresh";
import { StarPhoto } from "@/components/star-photo";
import { AWARD_CATEGORIES, AWARD_GROUPS } from "@/lib/awards/categories";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { listAwardees, listRevealed } from "@/lib/services/awards";
import { ATHLETE_PREFIX } from "@/lib/awards/categories";
import { getEventBoards, type Leaderboard, type LeaderboardRow } from "@/lib/services/leaderboard";
import { SportIcon } from "@/components/sport-icon";

export const metadata = { title: "Awardees" };
export const dynamic = "force-dynamic";

export default async function AwardeesPage() {
  const event = await getCurrentEvent();
  const [awardees, maleBoards, femaleBoards, revealed] = event
    ? await Promise.all([
        listAwardees(db, event.id),
        getEventBoards(db, event.id, 1, "MALE"),
        getEventBoards(db, event.id, 1, "FEMALE"),
        listRevealed(db, event.id),
      ])
    : [[], [], [], new Set<string>()];
  const femaleById = new Map(femaleBoards.map((b) => [b.activity.id, b]));
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
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {AWARD_GROUPS.map((g) => {
            const cats = AWARD_CATEGORIES.filter((c) => c.group === g);
            return (
              <li key={g} className="border-line bg-surface rounded-2xl border p-4">
                <h2 className="font-display mb-3 text-center text-2xl font-bold">
                  <span aria-hidden>{cats[0].emoji}</span> {g}
                </h2>
                <div className={cats.length > 1 ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
                  {cats.map((c) => (
                    <AwardPanel key={c.id} label={c.gender === "MALE" ? "Male" : c.gender === "FEMALE" ? "Female" : "Winner"} a={byCategory.get(c.id)} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        {maleBoards.length > 0 && (
          <section aria-labelledby="top-athletes" className="mt-14">
            <div className="mb-6 text-center">
              <h2 id="top-athletes" className="font-display gold-text text-4xl leading-none font-bold">
                Top Athletes
              </h2>
              <p className="text-muted mt-2 text-sm">The #1 male and female in every sport, from the official leaderboard.</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {maleBoards.map((m) => {
                const open = revealed.has(ATHLETE_PREFIX + m.activity.id);
                return (
                  <li key={m.activity.id} className="border-line bg-surface rounded-2xl border p-4">
                    <h3 className="font-display mb-3 flex items-center justify-center gap-2 text-xl font-bold">
                      <SportIcon name={m.activity.icon} className="text-brand size-5" /> {m.activity.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Champion label="Male" board={m} hidden={!open} />
                      <Champion label="Female" board={femaleById.get(m.activity.id)} hidden={!open} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/** Everyone ranked #1 on a board (more than one only for an exact tie), or a placeholder if no official result yet. */
function Champion({ label, board, hidden }: { label: string; board: Leaderboard | undefined; hidden: boolean }) {
  // Unrevealed: no real name, photo or time is read, so nothing leaks to the browser.
  const tops: LeaderboardRow[] = hidden ? [] : (board?.rows ?? []).filter((r) => r.rank === 1);
  const hasResult = (board?.rows ?? []).some((r) => r.rank === 1);
  const lead = tops[0];
  return (
    <div className="bg-surface-2 flex flex-col items-center rounded-xl px-2 py-4 text-center">
      <p className="text-gold text-xs font-bold tracking-widest uppercase">{label}</p>
      {hidden && hasResult ? (
        <>
          <div className="mt-2 w-24 blur-md select-none" aria-hidden>
            <StarPhoto name="? ?" photoUrl={null} size={192} />
          </div>
          <p className="mt-2 text-sm leading-snug font-bold blur-sm select-none" aria-hidden>
            Mystery Athlete
          </p>
          <p className="text-gold mt-1 text-xs font-bold">Revealing soon…</p>
        </>
      ) : lead ? (
        <>
          <div className="mt-2 w-24">
            <StarPhoto name={lead.name} photoUrl={lead.photoUrl} size={192} leader />
          </div>
          <p className="mt-2 text-sm leading-snug font-bold break-words">{lead.name}</p>
          {tops.length > 1 && (
            <p className="text-muted text-xs">
              Tied with{" "}
              {tops
                .slice(1)
                .map((t) => t.name)
                .join(", ")}
            </p>
          )}
          <p className="text-gold tabular mt-1 text-sm font-bold">{lead.display}</p>
        </>
      ) : (
        <>
          <div className="text-muted mt-2 flex aspect-square w-24 items-center justify-center" aria-hidden>
            <Star className="size-10 opacity-40" />
          </div>
          <p className="text-muted mt-2 text-sm">No result yet</p>
        </>
      )}
    </div>
  );
}

type Awardee = Awaited<ReturnType<typeof listAwardees>>[number];

/** One category's winner inside an award card. Unrevealed names, photos and counts never reach the browser. */
function AwardPanel({ label, a }: { label: string; a: Awardee | undefined }) {
  const lead = a?.nominees[0];
  return (
    <div
      className={
        a && lead
          ? "award-card border-gold/40 bg-surface-2 flex flex-col items-center rounded-xl border px-2 py-4 text-center"
          : "bg-surface-2 flex flex-col items-center rounded-xl px-2 py-4 text-center"
      }
    >
      <p className="text-gold text-xs font-bold tracking-widest uppercase">{label}</p>
      {a && lead && !a.revealed ? (
        <>
          <div className="mt-2 w-28 blur-md select-none" aria-hidden>
            <StarPhoto name="? ?" photoUrl={null} size={224} />
          </div>
          <p className="font-display mt-2 text-lg leading-tight font-bold blur-sm select-none" aria-hidden>
            Mystery Awardee
          </p>
          <p className="text-gold mt-1 text-xs font-bold">Revealing soon…</p>
        </>
      ) : a && lead ? (
        <>
          <div className="mt-2 w-28">
            <div key={lead.id} className="star-pop">
              <StarPhoto name={lead.name} photoUrl={lead.photoUrl} size={224} leader />
            </div>
          </div>
          <p className="gold-text font-display mt-2 text-lg leading-tight font-bold break-words">{lead.name}</p>
          {a.nominees.length > 1 && (
            <p className="text-muted mt-1 text-xs">
              Tied with{" "}
              {a.nominees
                .slice(1)
                .map((n) => n.name)
                .join(", ")}
            </p>
          )}
          <p className="text-gold tabular mt-1 inline-flex items-center gap-1 text-xs font-bold">
            <Star className="size-3.5 fill-current" aria-hidden /> {a.votes} {a.votes === 1 ? "vote" : "votes"}
          </p>
        </>
      ) : (
        <>
          <div className="text-muted mt-2 flex aspect-square w-28 items-center justify-center" aria-hidden>
            <Star className="twinkle size-12 opacity-50" />
          </div>
          <p className="text-muted mt-2 text-sm">No votes yet</p>
        </>
      )}
    </div>
  );
}
