"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toResult } from "@/lib/errors";
import { deleteBoothPhoto, setBoothHidden, toggleBoothLike, VOTER_COOKIE, voterHash } from "@/lib/services/booth";
import { rateLimit } from "@/lib/services/ratelimit";
import { clientIp } from "./auth";

/** Like / unlike a gallery photo. Identity is an anonymous device cookie, plus a per-IP throttle. */
export async function toggleLikeAction(photoId: string) {
  return toResult(async () => {
    await rateLimit(db, "booth-like", await clientIp(), { limit: 300, windowSeconds: 3600 });
    const jar = await cookies();
    let id = jar.get(VOTER_COOKIE)?.value;
    if (!id || id.length < 16) {
      id = randomBytes(18).toString("base64url");
      jar.set(VOTER_COOKIE, id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return toggleBoothLike(db, photoId, voterHash(id));
  });
}

async function adminRun<T>(fn: (actor: Awaited<ReturnType<typeof requireActionRole>>) => Promise<T>) {
  return toResult(async () => {
    const actor = await requireActionRole("SUPER_ADMIN", "ADMIN");
    const r = await fn(actor);
    revalidatePath("/admin/booth");
    revalidatePath("/booth/gallery");
    return r;
  });
}

export const hideBoothPhotoAction = async (id: string, hidden: boolean) => adminRun((a) => setBoothHidden(db, a, id, hidden));
export const deleteBoothPhotoAction = async (id: string) => adminRun((a) => deleteBoothPhoto(db, a, id));
