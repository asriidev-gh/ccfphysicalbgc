"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export interface PublicNavLink {
  href: string;
  label: string;
}

/** Public header nav: inline links on md+, a toggled dropdown panel on phones. */
export function PublicNav({ links }: { links: PublicNavLink[] }) {
  const [open, setOpen] = useState(false);
  const linkClass = "text-muted hover:bg-surface-2 hover:text-fg inline-flex min-h-11 items-center rounded-md px-3 whitespace-nowrap";

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-semibold md:flex">
        {links.map((n) => (
          <Link key={n.href} href={n.href} className={linkClass}>
            {n.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="text-muted hover:bg-surface-2 hover:text-fg inline-flex size-11 items-center justify-center rounded-md md:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-line bg-bg absolute inset-x-0 top-full border-b px-4 py-2 text-base font-semibold md:hidden"
        >
          {links.map((n) => (
            <Link key={n.href} href={n.href} className={`${linkClass} w-full`} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
