import { requirePageRole } from "@/lib/auth/session";
import { StaffShell } from "@/components/shell/staff-shell";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/events", "Events"],
  ["/admin/sports", "Sports"],
  ["/admin/activities", "Event Activities"],
  ["/admin/participants", "Participants"],
  ["/admin/registrations", "Registrations"],
  ["/admin/leads", "Activity Leads"],
  ["/admin/monitor", "Challenge Monitor"],
  ["/admin/results", "Results & Approvals"],
  ["/admin/display", "Leaderboard Control"],
  ["/admin/announcements", "Announcements"],
  ["/admin/reports", "Reports & Exports"],
  ["/admin/audit", "Audit Logs"],
  ["/admin/settings", "System Settings"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return (
    <StaffShell
      actor={actor}
      title={actor.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
      nav={NAV.map(([href, label]) => ({ href, label }))}
    >
      {children}
    </StaffShell>
  );
}
