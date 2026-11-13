"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AppError, toResult } from "@/lib/errors";
import { getCurrentEvent } from "@/lib/event";
import { requireActionRole } from "@/lib/auth/session";
import { AWARD_COOKIE, awardVoterHash, castVote, setAwardee, setRevealed } from "@/lib/services/awards";
import { AWARDS_ACCESS_COOKIE, awardsAccessToken, checkAwardsPassword, hasAwardsAccess } from "@/lib/services/awards-access";
import { rateLimit } from "@/lib/services/ratelimit";
import { clientIp } from "./auth";

/** Every voting-page action re-checks the password cookie, so the gate can't be skipped by calling an action directly. */
async function requireAccess() {
  if (!hasAwardsAccess((await cookies()).get(AWARDS_ACCESS_COOKIE)?.value)) throw new AppError("FORBIDDEN", "Enter the password first.");
}

/** Check the password and, if right, remember it on this device. */
export async function unlockAwardsAction(password: string) {
  return toResult(async () => {
    await rateLimit(db, "awards-unlock-ip", await clientIp(), { limit: 15, windowSeconds: 900 });
    if (typeof password !== "string" || !checkAwardsPassword(password)) throw new AppError("FORBIDDEN", "That password isn't right.");
    (await cookies()).set(AWARDS_ACCESS_COOKIE, awardsAccessToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });
}

/** Anonymous device identity. Created on first vote; only its hash is ever stored. */
async function voter(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(AWARD_COOKIE)?.value;
  if (!id || id.length < 16) {
    id = randomBytes(18).toString("base64url");
    jar.set(AWARD_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return awardVoterHash(id);
}

// Generous per IP because a whole venue can share one Wi-Fi address; the per-device cap stops scripted stuffing.
export async function castVoteAction(input: { nomineeId: string; category: string }) {
  return toResult(async () => {
    await requireAccess();
    await rateLimit(db, "awards-vote-ip", await clientIp(), { limit: 1500, windowSeconds: 3600 });
    const me = await voter();
    await rateLimit(db, "awards-vote-device", me, { limit: 120, windowSeconds: 3600 });
    const event = await getCurrentEvent();
    if (!event) throw new AppError("NOT_FOUND", "Voting isn't open yet.");
    return castVote(db, event.id, me, input);
  });
}

export async function setAwardeeAction(eventId: string, category: string, nomineeId: string | null) {
  return toResult(async () => {
    const actor = await requireActionRole("SUPER_ADMIN", "ADMIN");
    await setAwardee(db, actor, eventId, category, nomineeId);
    revalidatePath("/admin/awards");
    revalidatePath("/awardees");
  });
}

/** Reveal (or hide again) an award on the public Awardees page. */
export async function setRevealedAction(category: string, revealed: boolean) {
  return toResult(async () => {
    await requireAccess();
    await rateLimit(db, "awards-reveal-ip", await clientIp(), { limit: 300, windowSeconds: 3600 });
    const event = await getCurrentEvent();
    if (!event) throw new AppError("NOT_FOUND", "No event yet.");
    await setRevealed(db, event.id, category, revealed);
    revalidatePath("/awardees");
    return { category, revealed };
  });
}
