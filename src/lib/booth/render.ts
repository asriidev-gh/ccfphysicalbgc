import { drawSticker, loadStickerFonts, stickerUnit, type Sticker } from "./stickers";
import { drawCard } from "./render-card";
import { drawEvent } from "./render-event";
import { drawOverlay } from "./render-overlay";
import { drawProps } from "./render-props";
import { drawScene } from "./render-scene";
import { drawPoster } from "./render-poster";
import { drawSport } from "./render-sport";
import { drawTrading } from "./render-trading";
import type { BoothTemplate } from "./templates";

/** A captured frame: any canvas/image with intrinsic size. */
export type Shot = HTMLCanvasElement | HTMLImageElement;

const LOGO_SRC = "/assets/images/ccfbgc.jpg";
let logo: HTMLImageElement | null = null;
let logoLoad: Promise<void> | null = null;

/** Load the club logo and sticker fonts. Await this before drawing to be sure they are included. */
export function whenLogoReady(): Promise<void> {
  return Promise.all([loadLogo(), loadStickerFonts()]).then(() => undefined);
}

function loadLogo(): Promise<void> {
  logoLoad ??= new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      logo = img;
      resolve();
    };
    img.onerror = () => resolve(); // a missing logo must never block the booth
    img.src = LOGO_SRC;
  });
  return logoLoad;
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  if (!logo) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.16);
  ctx.clip();
  ctx.drawImage(logo, x, y, size, size);
  ctx.restore();
}

const FONT = `"Arial Narrow", Impact, "Helvetica Neue", Arial, sans-serif`;

function dims(s: Shot) {
  return s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };
}

/** Draw `s` into the box so it fills it completely (centre crop), like CSS object-fit: cover. */
function drawCover(ctx: CanvasRenderingContext2D, s: Shot, x: number, y: number, w: number, h: number) {
  const { w: sw, h: sh } = dims(s);
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  ctx.drawImage(s, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
}

/**
 * Paint the whole template. `shots[i]` fills slot i; a missing shot draws an empty placeholder,
 * which is also how the template picker shows a preview of each layout.
 */
export function renderTemplate(
  canvas: HTMLCanvasElement,
  t: BoothTemplate,
  shots: (Shot | null | undefined)[],
  opts: { stickers?: Sticker[]; selectedId?: string | null; text?: Record<string, string> } = {},
) {
  canvas.width = t.width;
  canvas.height = t.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (t.card) {
    drawTrading<Shot>(ctx, t, shots, { drawCover, drawLogo }, { name: opts.text?.name ?? "", title: opts.text?.title ?? "" });
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.event) {
    drawEvent<Shot>(ctx, t, shots, { drawCover, drawLogo }, opts.text ?? {});
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.scene) {
    drawScene<Shot>(ctx, t, shots, { drawCover, drawLogo }, opts.text ?? {});
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.prop) {
    drawProps<Shot>(ctx, t, shots, { drawCover, drawLogo }, opts.text ?? {});
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.overlay) {
    drawOverlay<Shot>(ctx, t, shots, { drawCover, drawLogo }, opts.text ?? {});
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.poster) {
    drawPoster<Shot>(ctx, t, shots, { drawCover, drawLogo }, opts.text ?? {});
    drawStickers(ctx, t.width, opts);
    return;
  }
  if (t.sport) {
    (t.sport.variant === "card" ? drawCard<Shot> : drawSport<Shot>)(ctx, t, shots, { drawCover, drawLogo });
    drawStickers(ctx, t.width, opts);
    return;
  }
  const { from, to, accent, ink } = t.theme;
  const W = t.width;
  const H = t.height;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, from);
  bg.addColorStop(1, to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Diagonal speed stripes, a nod to the event poster.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = accent;
  for (let i = -H; i < W + H; i += 120) {
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + 40, H);
    ctx.lineTo(i + 40 + H * 0.5, 0);
    ctx.lineTo(i + H * 0.5, 0);
    ctx.fill();
  }
  ctx.restore();

  // Accent bars top and bottom.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 14, W, 14);

  const first = t.slots[0];
  const last = t.slots[t.slots.length - 1];
  const headerCentre = Math.max(70, first.y / 2 + 6);
  const footerTop = last.y + last.h;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const title = Math.round(Math.min(W * 0.1, 84));
  const logoSize = Math.min(110, first.y - 50);
  const gap = 20;
  const left = "CCF ";
  const mid = "BGC";
  const right = " SPORTS";
  // Shrink the header title until logo + text fit inside the frame.
  let headFont = title;
  ctx.font = `bold ${headFont}px ${FONT}`;
  while (headFont > 30 && ctx.measureText(left + mid + right).width + logoSize + gap > W - 80) {
    headFont -= 2;
    ctx.font = `bold ${headFont}px ${FONT}`;
  }
  const textW = ctx.measureText(left + mid + right).width;
  const groupW = textW + logoSize + gap;
  drawLogo(ctx, (W - groupW) / 2, headerCentre - logoSize / 2, logoSize);
  let x = (W - groupW) / 2 + logoSize + gap;
  ctx.textAlign = "left";
  for (const [part, color] of [
    [left, ink],
    [mid, accent],
    [right, ink],
  ] as const) {
    ctx.fillStyle = color;
    ctx.fillText(part, x, headerCentre);
    x += ctx.measureText(part).width;
  }

  ctx.textAlign = "center";
  const footerCentre = footerTop + (H - footerTop) / 2;
  ctx.fillStyle = accent;
  ctx.font = `bold ${Math.round(title * 0.55)}px ${FONT}`;
  ctx.fillText("2ND YEAR ANNIVERSARY", W / 2, footerCentre - title * 0.3);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.7;
  ctx.font = `${Math.round(title * 0.4)}px ${FONT}`;
  ctx.fillText("PHYSICAL BGC 2026", W / 2, footerCentre + title * 0.35);
  ctx.globalAlpha = 1;

  t.slots.forEach((slot, i) => {
    const pad = 8;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(slot.x - pad, slot.y - pad, slot.w + pad * 2, slot.h + pad * 2);
    const shot = shots[i];
    if (shot) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(slot.x, slot.y, slot.w, slot.h);
      ctx.clip();
      drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#2b2b2f";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = "#6b6b72";
      ctx.font = `bold ${Math.round(Math.min(slot.w, slot.h) * 0.4)}px ${FONT}`;
      ctx.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2);
    }
  });

  drawStickers(ctx, W, opts);
}

function drawStickers(ctx: CanvasRenderingContext2D, width: number, opts: { stickers?: Sticker[]; selectedId?: string | null }) {
  const unit = stickerUnit(width);
  for (const s of opts.stickers ?? []) drawSticker(ctx, s, s.id === opts.selectedId, unit);
}

/** Export as JPEG, lowering quality until it fits the upload limit. */
export async function toJpeg(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob | null> {
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
}
