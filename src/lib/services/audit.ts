import type { Db, Tx } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SECRET_KEYS = new Set(["password", "passwordHash", "token", "tokenHash", "secret"]);

/** Drop anything that looks like a credential before it can reach the audit trail. */
export function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value, (k, v) => (SECRET_KEYS.has(k) ? "[redacted]" : v))) as Prisma.InputJsonValue;
}

export async function audit(
  client: Db | Tx,
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    previous?: unknown;
    next?: unknown;
    correlationId?: string;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previous: scrub(entry.previous),
      next: scrub(entry.next),
      correlationId: entry.correlationId,
    },
  });
}
