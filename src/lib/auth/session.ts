import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPasswordSync, verifyPassword } from "./hash";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { assertRole, type Actor } from "./policy";

export const SESSION_COOKIE = "pbgc_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Precomputed hash so unknown-email logins spend the same time as wrong-password ones.
const DUMMY_HASH = hashPasswordSync("not-a-real-password");

export async function authenticate(email: string, password: string): Promise<Actor | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) return null;
  return { id: user.id, name: user.name, role: user.role };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  // Opportunistic cleanup of expired sessions keeps the table small without a cron job.
  void db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the opaque session cookie, validated against the database. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, role: true, active: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return { id: s.user.id, name: s.user.name, role: s.user.role };
});

/** For pages: redirect anonymous users to login, and users without the role to their home. */
export async function requirePageRole(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!roles.includes(actor.role)) redirect(homeFor(actor.role));
  return actor;
}

/** For server actions / route handlers: throws AppError rather than redirecting. */
export async function requireActionRole(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  assertRole(actor, ...roles);
  return actor;
}

export function homeFor(role: Role): string {
  if (role === "ACTIVITY_LEAD") return "/lead";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  return "/";
}
