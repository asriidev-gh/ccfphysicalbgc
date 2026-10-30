import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Timer, Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getLeadConsole } from "@/lib/services/lead";
import { PageTitle } from "@/components/ui";
import { LeadConsole } from "./console";

export const dynamic = "force-dynamic";

/**
 * Booth view. Timed sports first ask how runners will start: one at a time (Single) or together
 * (Multiple, a heat). Other sports go straight to the single-participant view.
 */
export default async function LeadActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activityId } = await params;
  const raw = (await searchParams).mode;
  const mode = Array.isArray(raw) ? raw[0] : raw;
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

  const timed = ["TIME", "MULTI_STATION"].includes(data.activity.config.template);
  const chosen = mode === "single" || mode === "multiple" ? mode : null;

  if (timed && !chosen) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title={data.activity.name} sub="How will participants start?" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/lead/${activityId}?mode=single`}
            className="border-line bg-surface hover:border-brand flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
          >
            <Timer className="text-brand size-10" aria-hidden />
            <span className="font-display text-2xl font-bold uppercase">Single</span>
            <span className="text-muted text-sm">One participant at a time. Scan, start, stop and score.</span>
          </Link>
          <Link
            href={`/lead/${activityId}?mode=multiple`}
            className="border-line bg-surface hover:border-brand flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
          >
            <Users className="text-brand size-10" aria-hidden />
            <span className="font-display text-2xl font-bold uppercase">Multiple</span>
            <span className="text-muted text-sm">A group starts together. Check runners in, start the heat, tap each finish.</span>
          </Link>
        </div>
        <p className="mt-6 text-center">
          <Link href={`/lead/${activityId}/roster`} className="text-brand text-sm font-semibold underline">
            All participants &amp; leaderboard
          </Link>
        </p>
      </div>
    );
  }

  const multi = timed && chosen === "multiple";
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title={data.activity.name}
        sub={data.activity.instructions || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            {timed && (
              <Link href={`/lead/${activityId}`} className="text-muted underline">
                {multi ? "Multiple" : "Single"} · change
              </Link>
            )}
            <Link href={`/lead/${activityId}/roster`} className="text-brand underline">
              All participants &amp; leaderboard
            </Link>
          </div>
        }
      />
      <LeadConsole data={data} mode="booth" multi={multi} />
    </div>
  );
}
