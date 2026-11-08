import Link from "next/link";
import { getCurrentEvent } from "@/lib/event";
import { formatDateTime } from "@/lib/utils";
import { buttonVariants, EmptyState, PageTitle } from "@/components/ui";
import { RegisterWizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const event = await getCurrentEvent();
  const now = new Date();
  const open = event && event.status !== "COMPLETED" && now >= event.registrationOpensAt && now <= event.registrationClosesAt;
  if (!event || !open)
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageTitle title="Registration" />
        <EmptyState
          title={
            !event
              ? "No event is open for registration"
              : now < event.registrationOpensAt
                ? "Registration has not opened yet"
                : "Registration is closed"
          }
          hint={
            event && now < event.registrationOpensAt
              ? `Opens ${formatDateTime(event.registrationOpensAt, event.timeZone)}`
              : "If you still want to join, please see an organizer for walk-in registration."
          }
        />
        <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-4" })}>
          Back to event
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageTitle
        title="Register"
        sub={`${event.name} · ${formatDateTime(event.startsAt, event.timeZone, { dateStyle: "long", timeStyle: undefined })}`}
      />
      <RegisterWizard eventSlug={event.slug} />
    </div>
  );
}
