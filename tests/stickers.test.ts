import { describe, expect, it } from "vitest";
import { SHAPE_IDS } from "@/lib/booth/shapes";
import { newSticker, STICKER_CATALOG, stickerBox } from "@/lib/booth/stickers";

describe("sticker catalog", () => {
  it("has no duplicate stickers within a pack", () => {
    const keys = STICKER_CATALOG.map((d) => `${d.group}|${d.kind}|${d.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only references shapes that exist", () => {
    for (const d of STICKER_CATALOG.filter((s) => s.kind === "shape")) expect(SHAPE_IDS).toContain(d.text);
  });

  it("gives every sticker a finite, positive box", () => {
    for (const d of STICKER_CATALOG) {
      const { w, h } = stickerBox(newSticker(d, 1200, 1800));
      expect(Number.isFinite(w) && w > 0, `${d.text} width`).toBe(true);
      expect(Number.isFinite(h) && h > 0, `${d.text} height`).toBe(true);
    }
  });

  it("offers every pack", () => {
    for (const g of ["faith", "sport", "fun"] as const) expect(STICKER_CATALOG.some((d) => d.group === g)).toBe(true);
  });
});
