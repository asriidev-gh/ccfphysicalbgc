import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBoothPhoto, deleteOwnBoothPhoto, listBoothPhotos, toggleBoothLike, voterHash } from "@/lib/services/booth";
import { AppError } from "@/lib/errors";

const created: string[] = [];
afterAll(async () => {
  await db.boothPhoto.deleteMany({ where: { id: { in: created } } });
});

async function photo(templateId = "strip") {
  const p = await createBoothPhoto(db, { imageUrl: "https://res.cloudinary.com/x/image/upload/v1/test.jpg", templateId });
  created.push(p.id);
  return p;
}

describe("photobooth", () => {
  it("rejects unknown templates", async () => {
    await expect(createBoothPhoto(db, { imageUrl: "https://x/y.jpg", templateId: "nope" })).rejects.toBeInstanceOf(AppError);
  });

  it("toggles a like once per voter and keeps the count right", async () => {
    const p = await photo();
    const a = voterHash("voter-a-aaaaaaaaaaaa");
    const b = voterHash("voter-b-bbbbbbbbbbbb");
    expect(await toggleBoothLike(db, p.id, a)).toEqual({ liked: true, likeCount: 1 });
    expect(await toggleBoothLike(db, p.id, b)).toEqual({ liked: true, likeCount: 2 });
    expect(await toggleBoothLike(db, p.id, a)).toEqual({ liked: false, likeCount: 1 });
  });

  it("survives a double tap without double counting", async () => {
    const p = await photo();
    const v = voterHash("voter-c-cccccccccccc");
    await Promise.all([toggleBoothLike(db, p.id, v), toggleBoothLike(db, p.id, v)]);
    const row = await db.boothPhoto.findUniqueOrThrow({ where: { id: p.id } });
    const likes = await db.boothLike.count({ where: { photoId: p.id } });
    expect(row.likeCount).toBe(likes);
  });

  it("hides hidden photos and cannot like them", async () => {
    const p = await photo();
    await db.boothPhoto.update({ where: { id: p.id }, data: { hidden: true } });
    await expect(toggleBoothLike(db, p.id, voterHash("voter-d-dddddddddddd"))).rejects.toBeInstanceOf(AppError);
    const { items } = await listBoothPhotos(db, { sort: "new", take: 200, voter: null });
    expect(items.some((i) => i.id === p.id)).toBe(false);
  });

  it("reports which photos the viewer liked", async () => {
    const p = await photo();
    const v = voterHash("voter-e-eeeeeeeeeeee");
    await toggleBoothLike(db, p.id, v);
    const { items } = await listBoothPhotos(db, { sort: "new", take: 200, voter: v });
    expect(items.find((i) => i.id === p.id)?.liked).toBe(true);
  });

  it("lets only the posting device delete its photo", async () => {
    const owner = voterHash("owner-aaaaaaaaaaaaaaa");
    const p = await createBoothPhoto(db, {
      imageUrl: "https://res.cloudinary.com/x/image/upload/v1/own.jpg",
      templateId: "strip",
      ownerHash: owner,
    });
    created.push(p.id);
    const { items } = await listBoothPhotos(db, { sort: "new", take: 200, voter: owner });
    expect(items.find((i) => i.id === p.id)?.mine).toBe(true);
    const other = await listBoothPhotos(db, { sort: "new", take: 200, voter: voterHash("other-bbbbbbbbbbbbbbb") });
    expect(other.items.find((i) => i.id === p.id)?.mine).toBe(false);
    await expect(deleteOwnBoothPhoto(db, p.id, voterHash("other-bbbbbbbbbbbbbbb"))).rejects.toBeInstanceOf(AppError);
    await deleteOwnBoothPhoto(db, p.id, owner);
    expect(await db.boothPhoto.count({ where: { id: p.id } })).toBe(0);
  });
});
