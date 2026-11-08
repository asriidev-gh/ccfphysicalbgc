import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import type { Actor } from "@/lib/auth/policy";
import { StaffNav, type NavItem } from "./staff-nav";

export type { NavItem };

/**
 * Layout for authenticated staff areas (lead and admin). Sidebar with sign out pinned to the bottom on desktop;
 * on phones a top bar with sign out in the corner and an icon menu fixed to the bottom.
 */
export function StaffShell({ actor, title, nav, children }: { actor: Actor; title: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-line bg-surface grid grid-cols-[minmax(0,1fr)_auto] items-center border-b lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:items-stretch lg:border-r lg:border-b-0">
        <div className="px-4 py-3">
          <Link href="/" className="font-display flex items-center gap-3 text-xl font-bold">
            <Logo size={40} />
            <span>
              CCF <span className="text-brand">BGC</span> SPORTS
              <span className="text-muted block text-xs font-medium tracking-widest">{title}</span>
            </span>
          </Link>
        </div>
        <StaffNav nav={nav} title={title} />
        <form action={logoutAction} className="border-line col-start-2 row-start-1 pr-4 lg:border-t lg:p-2">
          <button
            className="text-muted hover:bg-surface-2 hover:text-fg inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-left text-xs lg:w-full"
            aria-label="Sign out"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{actor.name} · Sign out</span>
          </button>
        </form>
      </aside>
      <main className="min-w-0 p-4 pb-24 sm:p-6 lg:pb-6">{children}</main>
    </div>
  );
}
