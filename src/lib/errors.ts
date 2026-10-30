export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED";

/** Expected, user-presentable failure. Anything else is treated as an internal error. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: ErrorCode };

/** Wrap a server action body: expected errors become results, unexpected ones are logged and masked. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors, code: e.code };
    if (isNextControlFlow(e)) throw e;
    console.error("[action] unexpected error", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function isNextControlFlow(e: unknown): boolean {
  const d = (e as { digest?: unknown } | null)?.digest;
  return (
    typeof d === "string" && (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_HTTP_ERROR_FALLBACK") || d === "DYNAMIC_SERVER_USAGE")
  );
}
