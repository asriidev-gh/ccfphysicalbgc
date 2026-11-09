"use client";

import { useEffect, useRef } from "react";
import { drawSticker, loadStickerFonts, stickerBox, type Sticker, type StickerDef } from "@/lib/booth/stickers";

const MAX_W = 220;
const MAX_H = 84;
const PAD = 12;

/** A sticker drawn exactly as it will appear on the photo, shrunk to a picker tile (2x for sharp phone screens). */
export function StickerThumb({ def }: { def: StickerDef }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    void loadStickerFonts().then(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!live || !canvas || !ctx) return;
      const { group: _group, ...rest } = def;
      void _group;
      const probe: Sticker = { ...rest, id: "thumb", x: 0, y: 0, size: 100, rot: 0 };
      const box = stickerBox(probe);
      const k = Math.min((MAX_W - PAD * 2) / box.w, (MAX_H - PAD * 2) / box.h);
      const sticker: Sticker = { ...probe, size: 100 * k };
      const b = stickerBox(sticker);
      canvas.width = Math.ceil(b.w + PAD * 2);
      canvas.height = Math.ceil(b.h + PAD * 2);
      canvas.style.width = `${canvas.width / 2}px`;
      canvas.style.height = `${canvas.height / 2}px`;
      drawSticker(ctx, { ...sticker, x: canvas.width / 2, y: canvas.height / 2 }, false, 1);
    });
    return () => {
      live = false;
    };
  }, [def]);

  return <canvas ref={ref} aria-hidden className="block" />;
}
