"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Camera,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  HandHeart,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MonitorPlay,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

/** Icons are chosen by name because server layouts cannot pass components to a client component. */
const ICONS = {
  home: Home,
  activities: Activity,
  overview: LayoutDashboard,
  events: CalendarDays,
  sports: Dumbbell,
  eventActivities: ClipboardList,
  participants: Users,
  registrations: FileText,
  leads: UserCog,
  monitor: MonitorPlay,
  results: ShieldCheck,
  leaderboard: Trophy,
  announcements: Megaphone,
  booth: Camera,
  prayers: HandHeart,
  reports: BarChart3,
  audit: ScrollText,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIcon;
}

function isActive(pathname: string, href: string, all: NavItem[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Don't light up a parent (e.g. /admin) when a more specific item matches.
  return !all.some((n) => n.href !== href && n.href.length > href.length && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
}

/** Plain sidebar links on desktop; a fixed bottom icon bar on phones only. */
export function StaffNav({ nav, title }: { nav: NavItem[]; title: string }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label={title} className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:px-2 lg:pb-4">
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

      <nav
        aria-label={title}
        className="border-line bg-surface fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {nav.map((n) => {
          const Icon = ICONS[n.icon ?? "home"];
          const active = isActive(pathname, n.href, nav);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-20 flex-1 shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-semibold whitespace-nowrap",
                active ? "text-brand" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {n.label}
            </Link>
          );
        })}
        <form action={logoutAction} className="flex flex-1 shrink-0">
          <button className="text-muted flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-semibold whitespace-nowrap">
            <LogOut className="size-5" aria-hidden />
            Logout
          </button>
        </form>
      </nav>
    </>
  );
}
