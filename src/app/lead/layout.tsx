import { requirePageRole } from "@/lib/auth/session";
import { StaffShell } from "@/components/shell/staff-shell";

export const dynamic = "force-dynamic";

export default async function LeadLayout({ children }: { children: React.ReactNode }) {
  // Admins may also open the lead console; leads only see their assignments (enforced per query).
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const nav = [
    { href: "/lead", label: "Check-In", icon: "activities" as const },
    { href: "/lead/leaderboard", label: "Leaderboard", icon: "leaderboard" as const },
    ...(process.env.NODE_ENV !== "production"
      ? [{ href: "/lead/participants", label: "All Participants", icon: "participants" as const }]
      : []),
    { href: "/lead/settings", label: "Settings", icon: "settings" as const },
    ...(actor.role !== "ACTIVITY_LEAD" ? [{ href: "/admin", label: "Admin", icon: "overview" as const }] : []),
  ];
  return (
    <StaffShell actor={actor} title="ACTIVITY LEAD" nav={nav}>
      {children}
    </StaffShell>
  );
}
