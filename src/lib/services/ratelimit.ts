import { createHash } from "node:crypto";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter backed by PostgreSQL (no Redis). A single atomic upsert
 * either starts a new window or increments the current one, so concurrent requests
 * cannot slip past the limit.
 */
export async function rateLimit(db: Db, bucket: string, identity: string, opts: { limit: number; windowSeconds: number }): Promise<void> {
  // Hash the identity so raw IPs/emails are not stored.
  const key = `${bucket}:${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - (${opts.windowSeconds} * interval '1 second')
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - (${opts.windowSeconds} * interval '1 second')
                           THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  if (rows[0].count > opts.limit) throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
}
