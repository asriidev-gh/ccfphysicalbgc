import { createHash } from "node:crypto";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertAdmin, type Actor } from "@/lib/auth/policy";
import { BOOTH_TEMPLATE_IDS } from "@/lib/booth/templates";
import { audit } from "./audit";

export type BoothSort = "top" | "new";
export const BOOTH_PAGE_SIZE = 24;
export const BOOTH_MAX_BYTES = 3_000_000;
export const VOTER_COOKIE = "booth_voter";

/** Voters are anonymous: a random cookie id, hashed with the app secret before it touches the database. */
export function voterHash(voterId: string): string {
  return createHash("sha256")
    .update(`${process.env.APP_SECRET ?? ""}:booth:${voterId}`)
    .digest("hex");
}

export async function createBoothPhoto(db: Db, input: { imageUrl: string; templateId: string; ownerHash?: string }) {
  if (!BOOTH_TEMPLATE_IDS.includes(input.templateId)) throw new AppError("VALIDATION", "Unknown template.");
  return db.boothPhoto.create({ data: { imageUrl: input.imageUrl, templateId: input.templateId, ownerHash: input.ownerHash } });
}

export interface BoothItem {
  id: string;
  imageUrl: string;
  templateId: string;
  likeCount: number;
  liked: boolean;
  /** Posted from this device, so the viewer may delete it. */
  mine: boolean;
  createdAt: Date;
}

export async function listBoothPhotos(db: Db, opts: { sort: BoothSort; take: number; voter: string | null }) {
  const take = Math.min(Math.max(opts.take, 1), 200);
  const rows = await db.boothPhoto.findMany({
    where: { hidden: false },
    orderBy: opts.sort === "top" ? [{ likeCount: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const liked = opts.voter
    ? new Set(
        (
          await db.boothLike.findMany({
            where: { voterHash: opts.voter, photoId: { in: page.map((p) => p.id) } },
            select: { photoId: true },
          })
        ).map((l) => l.photoId),
      )
    : new Set<string>();
  const items: BoothItem[] = page.map((p) => ({
    id: p.id,
    imageUrl: p.imageUrl,
    templateId: p.templateId,
    likeCount: p.likeCount,
    liked: liked.has(p.id),
    mine: opts.voter !== null && p.ownerHash === opts.voter,
    createdAt: p.createdAt,
  }));
  return { items, hasMore: rows.length > take };
}

/** Like if not liked yet, otherwise unlike. The unique key makes this safe against double taps. */
export async function toggleBoothLike(db: Db, photoId: string, voter: string): Promise<{ liked: boolean; likeCount: number }> {
  return db.$transaction(async (tx) => {
    const photo = await tx.boothPhoto.findFirst({ where: { id: photoId, hidden: false }, select: { id: true } });
    if (!photo) throw new AppError("NOT_FOUND", "That photo is no longer available.");
    const created = await tx.boothLike.createMany({ data: [{ photoId, voterHash: voter }], skipDuplicates: true });
    let liked = true;
    if (created.count === 1) {
      await tx.boothPhoto.update({ where: { id: photoId }, data: { likeCount: { increment: 1 } } });
    } else {
      const removed = await tx.boothLike.deleteMany({ where: { photoId, voterHash: voter } });
      liked = false;
      if (removed.count === 1) await tx.boothPhoto.update({ where: { id: photoId }, data: { likeCount: { decrement: 1 } } });
    }
    const { likeCount } = await tx.boothPhoto.findUniqueOrThrow({ where: { id: photoId }, select: { likeCount: true } });
    return { liked, likeCount };
  });
}

export async function setBoothHidden(db: Db, actor: Actor, id: string, hidden: boolean) {
  assertAdmin(actor);
  await db.boothPhoto.update({ where: { id }, data: { hidden } });
  await audit(db, { actorId: actor.id, action: hidden ? "booth.hide" : "booth.unhide", entityType: "BoothPhoto", entityId: id });
}

export async function deleteBoothPhoto(db: Db, actor: Actor, id: string) {
  assertAdmin(actor);
  const p = await db.boothPhoto.delete({ where: { id } });
  await audit(db, {
    actorId: actor.id,
    action: "booth.delete",
    entityType: "BoothPhoto",
    entityId: id,
    previous: { imageUrl: p.imageUrl },
  });
}

/** A visitor deleting a photo they posted from this device. */
export async function deleteOwnBoothPhoto(db: Db, id: string, voter: string) {
  const r = await db.boothPhoto.deleteMany({ where: { id, ownerHash: voter } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "You can only delete photos you posted from this device.");
}
