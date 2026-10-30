import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getLeadConsole } from "@/lib/services/lead";
import { getLeaderboard } from "@/lib/services/leaderboard";
import { BoardTable } from "@/components/live";
import { PageTitle } from "@/components/ui";
import { LeadConsole } from "../console";

export const dynamic = "force-dynamic";

export default async function LeadRosterPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  if (!/^[0-9a-f-]{36}$/i.test(activityId)) notFound();
  let data;
  try {
    data = await getLeadConsole(db, actor, activityId);
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === "FORBIDDEN") redirect("/lead");
      if (e.code === "NOT_FOUND") notFound();
    }
    throw e;
  }
  // Staff view includes provisional (awaiting approval) rows, flagged as such.
  const board = await getLeaderboard(db, activityId, { includeProvisional: true });
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title={`${data.activity.name}: participants`}
        actions={
          <Link href={`/lead/${activityId}`} className="text-brand text-sm font-semibold underline">
            Back to booth scanner
          </Link>
        }
      />
      <LeadConsole data={data} mode="roster" />
      <h2 className="font-display mt-10 mb-2 text-2xl font-semibold">Leaderboard (incl. provisional)</h2>
      <BoardTable board={board} />
    </div>
  );
}
