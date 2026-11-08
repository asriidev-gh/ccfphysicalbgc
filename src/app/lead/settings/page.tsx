import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { requirePageRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listMyActivities } from "@/lib/services/lead";
import { Card, CardBody, CardHeader, CardTitle, PageTitle } from "@/components/ui";

export const metadata = { title: "Settings" };

const ROLE_LABEL: Record<string, string> = {
  ACTIVITY_LEAD: "Activity lead",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export default async function LeadSettings() {
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const acts = await listMyActivities(db, actor);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Settings" sub="Your account" />
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p>
            <span className="text-muted block text-xs tracking-wider uppercase">Name</span>
            {actor.name}
          </p>
          <p>
            <span className="text-muted block text-xs tracking-wider uppercase">Role</span>
            {ROLE_LABEL[actor.role] ?? actor.role}
          </p>
          <p>
            <span className="text-muted block text-xs tracking-wider uppercase">Assigned activities</span>
            {acts.length === 0 ? "None" : acts.map((a) => a.name).join(", ")}
          </p>
          <form action={logoutAction} className="pt-2">
            <button className="border-line bg-surface-2 inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-semibold">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
