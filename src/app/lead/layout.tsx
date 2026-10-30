import { requirePageRole } from "@/lib/auth/session";
import { StaffShell } from "@/components/shell/staff-shell";

export const dynamic = "force-dynamic";

export default async function LeadLayout({ children }: { children: React.ReactNode }) {
  // Admins may also open the lead console; leads only see their assignments (enforced per query).
  const actor = await requirePageRole("ACTIVITY_LEAD", "ADMIN", "SUPER_ADMIN");
  const nav = [{ href: "/lead", label: "My activities" }, ...(actor.role !== "ACTIVITY_LEAD" ? [{ href: "/admin", label: "Admin" }] : [])];
  return (
    <StaffShell actor={actor} title="ACTIVITY LEAD" nav={nav}>
      {children}
    </StaffShell>
  );
}
