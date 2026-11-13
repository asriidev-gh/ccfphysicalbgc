"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { unlockAwardsAction } from "@/app/actions/awards";

/**
 * Full-screen password prompt. The page behind it isn't rendered at all until the password is right
 * (the server checks the cookie), so there is nothing to peek at by inspecting the page.
 */
export function AccessGate() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
    >
      <form
        className="border-line bg-surface w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.current?.value ?? "";
          setError(null);
          start(async () => {
            const r = await unlockAwardsAction(value);
            if (r.ok) router.refresh();
            else {
              setError(r.error);
              input.current?.select();
            }
          });
        }}
      >
        <span className="bg-gold/15 text-gold mx-auto flex size-14 items-center justify-center rounded-full">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 id="gate-title" className="font-display gold-text mt-4 text-3xl leading-none font-bold">
          Informal Awards
        </h1>
        <p className="text-muted mt-2 text-sm">Enter the password to continue.</p>

        <div className="relative mt-5">
          <label htmlFor="gate-password" className="sr-only">
            Password
          </label>
          <input
            id="gate-password"
            ref={input}
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="off"
            required
            placeholder="Password"
            aria-invalid={!!error}
            aria-describedby={error ? "gate-error" : undefined}
            className="border-line bg-surface-2 placeholder:text-muted/70 focus:border-gold min-h-12 w-full rounded-md border pr-12 pl-3 text-base"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="text-muted hover:text-fg absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center"
          >
            {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
        {error && (
          <p id="gate-error" role="alert" className="text-bad mt-2 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="from-gold to-gold-deep mt-4 min-h-12 w-full rounded-full bg-gradient-to-b px-4 text-base font-bold text-black hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
