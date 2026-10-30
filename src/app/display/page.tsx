import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";
import { getDisplayState } from "@/lib/services/display";
import { DisplayScreen } from "./screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Display" };

/** Public, read-only presentation screen for projectors/TVs. Contains no admin controls. */
export default async function DisplayPage() {
  const event = await getCurrentEvent();
  if (!event) return <main className="font-display text-muted grid min-h-screen place-items-center text-4xl">PHYSICAL BGC 2026</main>;
  const initial = await getDisplayState(db, event.id);
  return <DisplayScreen eventId={event.id} initial={initial!} />;
}
