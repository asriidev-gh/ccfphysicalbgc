import { stickerFontCss, type StickerFont } from "./stickers";

/** Set `ctx.font` to the largest size (<= start) at which `text` fits in `maxW`, and return that size. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, font: StickerFont, min = 18): number {
  let size = start;
  ctx.font = stickerFontCss(font, size);
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = stickerFontCss(font, size);
  }
  return size;
}

/** Polished gold, for lettering and frames. */
export function goldGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#fff3b8");
  g.addColorStop(0.35, "#e3b94e");
  g.addColorStop(0.6, "#9a7420");
  g.addColorStop(1, "#f6dc7e");
  return g;
}

/** Draw `text` rotated to read bottom-to-top, with its start at (x, y). Callback draws at the origin. */
export function vertical(ctx: CanvasRenderingContext2D, x: number, y: number, draw: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  draw();
  ctx.restore();
}
