import { cookies } from "next/headers";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { AWARD_COOKIE, awardVoterHash, listNominees, listRevealed, myBallot } from "@/lib/services/awards";
import { AwardsBoard } from "./board";
import { AccessGate } from "./access-gate";
import { AWARDS_ACCESS_COOKIE, hasAwardsAccess } from "@/lib/services/awards-access";

// Unlisted: not in the menu and kept out of search engines. Share the link with voters directly.
export const metadata = { title: "Informal Awards", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const SPARKLES = [
  { l: "6%", t: "18%", s: 14, d: "0s" },
  { l: "16%", t: "62%", s: 10, d: "0.8s" },
  { l: "30%", t: "10%", s: 9, d: "1.4s" },
  { l: "70%", t: "14%", s: 12, d: "0.4s" },
  { l: "84%", t: "56%", s: 16, d: "1.1s" },
  { l: "93%", t: "20%", s: 9, d: "1.9s" },
];

export default async function AwardsPage() {
  const jar = await cookies();
  // Locked: render only the password prompt. No participant data is fetched or sent until the password is right.
  if (!hasAwardsAccess(jar.get(AWARDS_ACCESS_COOKIE)?.value)) return <AccessGate />;

  const event = await getCurrentEvent();
  const voterId = jar.get(AWARD_COOKIE)?.value;
  const [nominees, ballot, revealed] = event
    ? await Promise.all([
        listNominees(db, event.id),
        myBallot(db, event.id, voterId ? awardVoterHash(voterId) : null),
        listRevealed(db, event.id).then((s) => [...s]),
      ])
    : [[], {}, []];

  return (
    <>
      <div className="awards-hero relative overflow-hidden">
        {SPARKLES.map((p, i) => (
          <Star
            key={i}
            aria-hidden
            className="twinkle text-gold absolute fill-current"
            style={{ left: p.l, top: p.t, width: p.s, height: p.s, ["--d" as string]: p.d }}
          />
        ))}
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-8 text-center">
          <p className="text-gold text-xs font-bold tracking-[0.3em] uppercase">2nd Year Anniversary</p>
          <h1 className="font-display gold-text mt-2 text-5xl leading-none font-bold sm:text-6xl">Informal Awards</h1>
          <p className="text-muted mx-auto mt-3 max-w-xl text-sm sm:text-base">
            Spot a star? Find them below, tap <b className="text-fg">Nominate me</b> and give them your vote. You get one vote per award,
            and you can change it anytime.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-12">
        <AwardsBoard initialNominees={nominees} initialBallot={ballot} initialRevealed={revealed} />
      </div>
    </>
  );
}
