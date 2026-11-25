import { EmptyState, PageTitle } from "@/components/ui";
import { isAdmin } from "@/lib/auth/policy";
import { getActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { getRaffle } from "@/lib/services/raffle";
import { RaffleWheel } from "./wheel";

export const metadata = { title: "Raffle Draw" };
export const dynamic = "force-dynamic";

/** Public: no sign-in needed to spin or remove a winner. Only a signed-in admin can reset the whole draw. */
export default async function RafflePage() {
  const [event, actor] = await Promise.all([getCurrentEvent(), getActor()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-12">
      {event ? (
        <>
          <PageTitle title="Raffle Draw" sub="Spin to pick a winner. Each person can win only once." />
          <RaffleWheel {...await getRaffle(db, event.id)} canReset={!!actor && isAdmin(actor)} />
        </>
      ) : (
        <EmptyState title="No event yet" hint="The raffle draws from the current published event." />
      )}
    </div>
  );
}
