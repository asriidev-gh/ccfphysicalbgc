"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toResult } from "@/lib/errors";
import {
  createPrayer,
  deleteOwnPrayer,
  deletePrayer,
  PRAYER_COOKIE,
  prayerVoterHash,
  reportPrayer,
  setPrayerHidden,
  togglePrayed,
} from "@/lib/services/prayer";
import { rateLimit } from "@/lib/services/ratelimit";
import { clientIp } from "./auth";

/** Anonymous device identity. Created on first write; only its hash is ever stored. */
async function voter(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(PRAYER_COOKIE)?.value;
  if (!id || id.length < 16) {
    id = randomBytes(18).toString("base64url");
    jar.set(PRAYER_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return prayerVoterHash(id);
}

// Limits are generous per IP because a whole venue can share one Wi-Fi address.
export async function submitPrayerAction(input: { body: string; authorName: string | null; category: string; color: string }) {
  return toResult(async () => {
    await rateLimit(db, "prayer-post-ip", await clientIp(), { limit: 60, windowSeconds: 3600 });
    const me = await voter();
    await rateLimit(db, "prayer-post-device", me, { limit: 8, windowSeconds: 3600 });
    const p = await createPrayer(db, me, input);
    revalidatePath("/prayer");
    return { id: p.id };
  });
}

export async function togglePrayedAction(id: string) {
  return toResult(async () => {
    await rateLimit(db, "prayer-pray-ip", await clientIp(), { limit: 1000, windowSeconds: 3600 });
    return togglePrayed(db, id, await voter());
  });
}

export async function reportPrayerAction(id: string) {
  return toResult(async () => {
    await rateLimit(db, "prayer-report-ip", await clientIp(), { limit: 100, windowSeconds: 3600 });
    const r = await reportPrayer(db, id, await voter());
    revalidatePath("/admin/prayers");
    return r;
  });
}

export async function deleteMyPrayerAction(id: string) {
  return toResult(async () => {
    await deleteOwnPrayer(db, id, await voter());
    revalidatePath("/prayer");
  });
}

async function adminRun<T>(fn: (actor: Awaited<ReturnType<typeof requireActionRole>>) => Promise<T>) {
  return toResult(async () => {
    const actor = await requireActionRole("SUPER_ADMIN", "ADMIN");
    const r = await fn(actor);
    revalidatePath("/admin/prayers");
    revalidatePath("/prayer");
    return r;
  });
}

export const hidePrayerAction = async (id: string, hidden: boolean) => adminRun((a) => setPrayerHidden(db, a, id, hidden));
export const deletePrayerAction = async (id: string) => adminRun((a) => deletePrayer(db, a, id));
