import type { Db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

export function isAdmin(actor: Pick<Actor, "role">): boolean {
  return ADMIN_ROLES.includes(actor.role);
}

export function assertRole(actor: Actor | null | undefined, ...roles: Role[]): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (!roles.includes(actor.role)) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
}

export function assertAdmin(actor: Actor | null | undefined): asserts actor is Actor {
  assertRole(actor, ...ADMIN_ROLES);
}

/**
 * Activity-scoped access: admins can reach every activity; activity leads only the
 * ones they are assigned to. Always resolved from the database, never from client input.
 */
export async function canAccessActivity(db: Db, actor: Actor, activityId: string): Promise<boolean> {
  if (isAdmin(actor)) return true;
  if (actor.role !== "ACTIVITY_LEAD") return false;
  const a = await db.activityAssignment.findUnique({
    where: { userId_activityId: { userId: actor.id, activityId } },
    select: { id: true },
  });
  return a !== null;
}

export async function assertActivityAccess(db: Db, actor: Actor | null | undefined, activityId: string): Promise<Actor> {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (!(await canAccessActivity(db, actor, activityId))) throw new AppError("FORBIDDEN", "You are not assigned to this activity.");
  return actor;
}

/** Ids of activities a user may operate. Admins get null (= all). */
export async function assignedActivityIds(db: Db, actor: Actor): Promise<string[] | null> {
  if (isAdmin(actor)) return null;
  const rows = await db.activityAssignment.findMany({ where: { userId: actor.id }, select: { activityId: true } });
  return rows.map((r) => r.activityId);
}
