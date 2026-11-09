import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createPrayer, deleteOwnPrayer, listPrayers, prayerVoterHash, reportPrayer, togglePrayed } from "@/lib/services/prayer";

const created: string[] = [];
afterAll(async () => {
  await db.prayerRequest.deleteMany({ where: { id: { in: created } } });
});

const me = prayerVoterHash("owner-aaaaaaaaaaaaaaaa");
const v = (n: string) => prayerVoterHash(`voter-${n}-${"x".repeat(16)}`);

async function prayer(body = "Please pray for my exam", owner = me) {
  const p = await createPrayer(db, owner, { body, authorName: "", category: "guidance", color: "pink" });
  created.push(p.id);
  return p;
}

describe("prayer wall", () => {
  it("validates and normalises input", async () => {
    await expect(createPrayer(db, me, { body: "hi", authorName: null, category: "other", color: "yellow" })).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(
      createPrayer(db, me, { body: "x".repeat(281), authorName: null, category: "other", color: "yellow" }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(createPrayer(db, me, { body: "valid body", authorName: null, category: "nope", color: "yellow" })).rejects.toBeInstanceOf(
      AppError,
    );
    const p = await createPrayer(db, me, { body: "  trim me \n\n\n\n ok  ", authorName: "   ", category: "other", color: "blue" });
    created.push(p.id);
    expect(p.body).toBe("trim me \n\n ok");
    expect(p.authorName).toBeNull();
  });

  it("toggles 'I prayed' once per device", async () => {
    const p = await prayer();
    expect(await togglePrayed(db, p.id, v("d"))).toEqual({ prayed: true, prayCount: 1 });
    expect(await togglePrayed(db, p.id, v("e"))).toEqual({ prayed: true, prayCount: 2 });
    expect(await togglePrayed(db, p.id, v("d"))).toEqual({ prayed: false, prayCount: 1 });
    const { items } = await listPrayers(db, { category: null, take: 200, voter: v("e") });
    expect(items.find((i) => i.id === p.id)).toMatchObject({ prayed: true, mine: false });
  });

  it("lets only the author delete", async () => {
    const p = await prayer();
    await expect(deleteOwnPrayer(db, p.id, v("f"))).rejects.toBeInstanceOf(AppError);
    expect(await db.prayerRequest.count({ where: { id: p.id } })).toBe(1);
    await deleteOwnPrayer(db, p.id, me);
    expect(await db.prayerRequest.count({ where: { id: p.id } })).toBe(0);
  });

  it("hides a note after three different devices report it", async () => {
    const p = await prayer();
    await expect(reportPrayer(db, p.id, me)).rejects.toBeInstanceOf(AppError); // own note
    expect(await reportPrayer(db, p.id, v("g"))).toEqual({ hidden: false });
    expect(await reportPrayer(db, p.id, v("g"))).toEqual({ hidden: false }); // same device again: no effect
    expect(await reportPrayer(db, p.id, v("h"))).toEqual({ hidden: false });
    expect(await reportPrayer(db, p.id, v("i"))).toEqual({ hidden: true });
    const { items } = await listPrayers(db, { category: null, take: 200, voter: null });
    expect(items.some((i) => i.id === p.id)).toBe(false);
    await expect(togglePrayed(db, p.id, v("j"))).rejects.toBeInstanceOf(AppError);
  });
});
