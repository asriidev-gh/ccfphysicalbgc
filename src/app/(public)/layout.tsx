import Link from "next/link";
import { Logo } from "@/components/logo";
import { PublicNav } from "@/components/shell/public-nav";
import { getActor } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/session";

const nav = [
  { href: "/register", label: "Register" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/find", label: "My registration" },
];

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const links = [...nav, actor ? { href: homeFor(actor.role), label: "Dashboard" } : { href: "/login", label: "Staff login" }];
  return (
    <>
      <header className="border-line bg-bg/95 md:bg-bg/90 sticky top-0 z-30 border-b md:backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-display flex items-center gap-3 text-xl font-bold tracking-wide whitespace-nowrap">
            <Logo size={40} />
            <span>
              CCF <span className="text-brand">BGC</span> SPORTS
            </span>
          </Link>
          <PublicNav links={links} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-line text-muted border-t py-6 text-center text-xs">
        CCF BGC Sports Ministry · 2nd Year Anniversary Celebration
      </footer>
    </>
  );
}
