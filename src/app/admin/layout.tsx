import { requirePageRole } from "@/lib/auth/session";
import { StaffShell } from "@/components/shell/staff-shell";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Overview", "overview"],
  ["/admin/events", "Events", "events"],
  ["/admin/sports", "Sports", "sports"],
  ["/admin/activities", "Event Activities", "eventActivities"],
  ["/admin/participants", "Participants", "participants"],
  ["/admin/registrations", "Registrations", "registrations"],
  ["/admin/leads", "Activity Leads", "leads"],
  ["/admin/monitor", "Challenge Monitor", "monitor"],
  ["/admin/results", "Results & Approvals", "results"],
  ["/admin/display", "Leaderboard Control", "leaderboard"],
  ["/admin/announcements", "Announcements", "announcements"],
  ["/admin/booth", "Photobooth", "booth"],
  ["/admin/prayers", "Prayer Wall", "prayers"],
  ["/admin/reports", "Reports & Exports", "reports"],
  ["/admin/audit", "Audit Logs", "audit"],
  ["/admin/settings", "System Settings", "settings"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageRole("ADMIN", "SUPER_ADMIN");
  return (
    <StaffShell
      actor={actor}
      title={actor.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
      nav={NAV.map(([href, label, icon]) => ({ href, label, icon }))}
    >
      {children}
    </StaffShell>
  );
}
