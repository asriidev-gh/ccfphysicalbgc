"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticate, createSession, destroySession, homeFor } from "@/lib/auth/session";
import { AppError, toResult } from "@/lib/errors";
import { rateLimit } from "@/lib/services/ratelimit";
import { audit } from "@/lib/services/audit";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export async function loginAction(fd: FormData) {
  const r = await toResult(async () => {
    const input = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!input.success) throw new AppError("VALIDATION", "Enter your email and password.");
    const ip = await clientIp();
    // Throttle per IP and per account to slow credential stuffing / brute force.
    await rateLimit(db, "login-ip", ip, { limit: 20, windowSeconds: 600 });
    await rateLimit(db, "login-email", input.data.email, { limit: 8, windowSeconds: 600 });
    const actor = await authenticate(input.data.email, input.data.password);
    if (!actor) throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
    await createSession(actor.id);
    await audit(db, { actorId: actor.id, action: "auth.login", entityType: "User", entityId: actor.id });
    return homeFor(actor.role);
  });
  if (r.ok) redirect(r.data);
  return r;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
