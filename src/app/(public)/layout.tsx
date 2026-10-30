import Link from "next/link";
import { Logo } from "@/components/logo";
import { getActor } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/session";

const nav = [
  { href: "/register", label: "Register" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/find", label: "My registration" },
];

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  return (
    <>
      <header className="border-line bg-bg/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-display flex items-center gap-3 text-xl font-bold tracking-wide">
            <Logo size={40} />
            PHYSICAL <span className="text-brand">BGC</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-semibold">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-muted hover:bg-surface-2 hover:text-fg inline-flex min-h-11 items-center rounded-md px-3"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href={actor ? homeFor(actor.role) : "/login"}
              className="text-muted hover:bg-surface-2 hover:text-fg hidden min-h-11 items-center rounded-md px-3 sm:inline-flex"
            >
              {actor ? "Dashboard" : "Staff login"}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-line text-muted border-t py-6 text-center text-xs">
        CCF BGC Sports Ministry · 2nd Year Anniversary Celebration
      </footer>
    </>
  );
}
