"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toResult } from "@/lib/errors";
import { ensureVoterId } from "@/lib/booth/voter";
import { deleteBoothPhoto, deleteOwnBoothPhoto, setBoothHidden, toggleBoothLike, voterHash } from "@/lib/services/booth";
import { rateLimit } from "@/lib/services/ratelimit";
import { clientIp } from "./auth";

/** Like / unlike a gallery photo. Identity is an anonymous device cookie, plus a per-IP throttle. */
export async function toggleLikeAction(photoId: string) {
  return toResult(async () => {
    await rateLimit(db, "booth-like", await clientIp(), { limit: 300, windowSeconds: 3600 });
    return toggleBoothLike(db, photoId, voterHash(await ensureVoterId()));
  });
}

/** Delete a photo this device posted. */
export async function deleteMyBoothPhotoAction(photoId: string) {
  return toResult(async () => {
    await deleteOwnBoothPhoto(db, photoId, voterHash(await ensureVoterId()));
    revalidatePath("/booth");
  });
}

async function adminRun<T>(fn: (actor: Awaited<ReturnType<typeof requireActionRole>>) => Promise<T>) {
  return toResult(async () => {
    const actor = await requireActionRole("SUPER_ADMIN", "ADMIN");
    const r = await fn(actor);
    revalidatePath("/admin/booth");
    revalidatePath("/booth");
    return r;
  });
}

export const hideBoothPhotoAction = async (id: string, hidden: boolean) => adminRun((a) => setBoothHidden(db, a, id, hidden));
export const deleteBoothPhotoAction = async (id: string) => adminRun((a) => deleteBoothPhoto(db, a, id));
