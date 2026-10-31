import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import type { Actor } from "@/lib/auth/policy";

export interface NavItem {
  href: string;
  label: string;
}

/** Layout for authenticated staff areas (lead and admin). Sidebar on desktop, scrollable tabs on phones. */
export function StaffShell({ actor, title, nav, children }: { actor: Actor; title: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-line bg-surface border-b lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block">
          <Link href="/" className="font-display flex items-center gap-3 text-xl font-bold">
            <Logo size={40} />
            <span>
              CCF <span className="text-brand">BGC</span> PHYSICAL
              <span className="text-muted block text-xs font-medium tracking-widest">{title}</span>
            </span>
          </Link>
          <form action={logoutAction} className="lg:mt-4">
            <button
              className="text-muted hover:bg-surface-2 hover:text-fg inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-xs"
              aria-label="Sign out"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">{actor.name} · Sign out</span>
            </button>
          </form>
        </div>
        <nav aria-label={title} className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-4">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-muted hover:bg-surface-2 hover:text-fg inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">{children}</main>
    </div>
  );
}
