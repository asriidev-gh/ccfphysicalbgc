"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Action = (fd: FormData) => Promise<ActionResult<unknown>>;

interface Props {
  action: Action;
  children?: React.ReactNode;
  submitLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Clear inputs after a successful submit. */
  reset?: boolean;
  success?: string;
  /** Ask for confirmation first (destructive actions). */
  confirm?: string;
  hideSubmit?: boolean;
  onDone?: (data: unknown) => void;
  buttonClassName?: string;
}

/** Progressive form: calls a Server Action, shows inline errors/success, refreshes server data. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  variant,
  size,
  className,
  reset,
  success,
  confirm: confirmText,
  hideSubmit,
  onDone,
  buttonClassName,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; fields?: Record<string, string> } | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          let r: ActionResult<unknown>;
          try {
            r = await action(fd);
          } catch {
            setMsg({ ok: false, text: "Network error. Check your connection and try again." });
            return;
          }
          if (r.ok) {
            setMsg(success ? { ok: true, text: success } : null);
            if (reset) ref.current?.reset();
            onDone?.(r.data);
            const to = (r.data as { redirectTo?: unknown } | null)?.redirectTo;
            if (typeof to === "string") router.push(to);
            else router.refresh();
          } else setMsg({ ok: false, text: r.error, fields: r.fieldErrors });
        });
      }}
    >
      {children}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("mt-2 text-sm", msg.ok ? "text-ok" : "text-bad")}>
          {msg.text}
        </p>
      )}
      {!hideSubmit && (
        <Button type="submit" variant={variant} size={size} disabled={pending} className={cn("mt-3", buttonClassName)}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      )}
    </form>
  );
}
