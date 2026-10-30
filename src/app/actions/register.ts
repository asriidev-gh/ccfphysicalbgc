"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AppError, toResult } from "@/lib/errors";
import { registerParticipant, verifyOwnership } from "@/lib/services/registration";
import { rateLimit } from "@/lib/services/ratelimit";
import { clientIp } from "./auth";

/** Public registration. Rate limited per IP; a hidden honeypot field silently drops naive bots. */
export async function registerAction(eventSlug: string, payload: Record<string, unknown>) {
  return toResult(async () => {
    if (typeof payload.website === "string" && payload.website.length > 0) throw new AppError("VALIDATION", "Could not submit the form.");
    const ip = await clientIp();
    await rateLimit(db, "register-ip", ip, { limit: 12, windowSeconds: 3600 });
    const { website: _hp, ...rest } = payload;
    void _hp;
    const r = await registerParticipant(db, eventSlug, rest);
    revalidatePath("/");
    return { reference: r.reference, activities: r.activities };
  });
}

export async function lookupAction(fd: FormData) {
  return toResult(async () => {
    await rateLimit(db, "lookup-ip", await clientIp(), { limit: 15, windowSeconds: 900 });
    const reg = await verifyOwnership(db, String(fd.get("reference") ?? ""), String(fd.get("contact") ?? ""));
    return { reference: reg.reference };
  });
}
