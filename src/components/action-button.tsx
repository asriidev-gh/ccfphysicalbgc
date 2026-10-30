"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

/** One-click Server Action button with pending state, optional confirmation, and inline error. */
export function ActionButton({
  action,
  children,
  confirm: confirmText,
  variant = "secondary",
  size = "sm",
  onDone,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  confirm?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            try {
              const r = await action();
              if (r.ok) {
                onDone?.();
                router.refresh();
              } else setError(r.error);
            } catch {
              setError("Network error. Please retry.");
            }
          });
        }}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </Button>
      {error && (
        <span role="alert" className="text-bad mt-1 max-w-64 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
