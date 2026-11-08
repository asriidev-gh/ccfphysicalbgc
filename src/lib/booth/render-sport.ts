import type { BoothSlot, BoothTemplate } from "./templates";

/** Helpers owned by render.ts, passed in so the two files do not import each other. */
export interface SportHelpers<S> {
  drawCover: (ctx: CanvasRenderingContext2D, shot: S, x: number, y: number, w: number, h: number) => void;
  drawLogo: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void;
}

const FONT = `Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A hand-torn rectangle: a path whose edges wobble a little, like the brush-stroke frames on printed photo strips. */
function roughRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jitter: number, seed: number) {
  const rnd = seeded(seed);
  const j = () => (rnd() - 0.5) * 2 * jitter;
  const step = 34;
  const pts: [number, number][] = [];
  for (let px = x; px < x + w; px += step) pts.push([px, y + j()]);
  for (let py = y; py < y + h; py += step) pts.push([x + w + j(), py]);
  for (let px = x + w; px > x; px -= step) pts.push([px, y + h + j()]);
  for (let py = y + h; py > y; py -= step) pts.push([x + j(), py]);
  ctx.beginPath();
  pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.closePath();
}

function emojiAt(ctx: CanvasRenderingContext2D, e: string, x: number, y: number, size: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fillText(e, 0, 0);
  ctx.restore();
}

function pattern(ctx: CanvasRenderingContext2D, kind: string, W: number, H: number, accent: string) {
  ctx.save();
  if (kind === "turf") {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let x = 0; x < W; x += 200) ctx.fillRect(x, 0, 100, H);
  } else if (kind === "lanes") {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 6;
    for (let y = 70; y < H; y += 120) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else if (kind === "court") {
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 330, 0, Math.PI * 2);
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
  } else if (kind === "net") {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 3;
    for (let p = 0; p < Math.max(W, H); p += 56) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, H);
      ctx.moveTo(0, p);
      ctx.lineTo(W, p);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = accent;
    for (let i = -H; i < W + H; i += 130) {
      ctx.beginPath();
      ctx.moveTo(i, H);
      ctx.lineTo(i + 46, H);
      ctx.lineTo(i + 46 + H * 0.6, 0);
      ctx.lineTo(i + H * 0.6, 0);
      ctx.fill();
    }
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

/** Sport-themed "printed strip" layout: three photos in rough frames plus a title panel. */
export function drawSport<S>(ctx: CanvasRenderingContext2D, t: BoothTemplate, shots: (S | null | undefined)[], h: SportHelpers<S>) {
  const sp = t.sport;
  const panel = t.panel;
  if (!sp || !panel) return;
  const W = t.width;
  const H = t.height;
  const seed = hash(t.id);

  // Background: gradient, pattern, vignette.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, sp.bg[0]);
  bg.addColorStop(1, sp.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  pattern(ctx, sp.pattern, W, H, sp.accent);
  const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Photos in torn frames.
  t.slots.forEach((slot: BoothSlot, i) => {
    ctx.fillStyle = sp.frame;
    roughRect(ctx, slot.x - 22, slot.y - 22, slot.w + 44, slot.h + 44, 9, seed + i * 7);
    ctx.fill();
    const shot = shots[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
    else {
      ctx.fillStyle = "#2b2b2f";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = "#6b6b72";
      ctx.font = `bold ${Math.round(slot.h * 0.4)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2);
    }
    ctx.restore();
  });

  // Title panel.
  const px = panel.x;
  const py = panel.y;
  const cx = px + panel.w / 2;
  ctx.fillStyle = sp.panel;
  roughRect(ctx, px - 14, py - 14, panel.w + 28, panel.h + 28, 8, seed + 99);
  ctx.fill();

  star(ctx, cx, py + panel.h * 0.5, panel.w * 0.47, panel.w * 0.2);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();

  h.drawLogo(ctx, cx - 55, py + 28, 110);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `italic bold 38px ${FONT}`;
  ctx.fillText("CELEBRATING", cx, py + 180);

  // Sport name on a brush band, shrunk to fit the panel.
  let size = 130;
  ctx.font = `italic bold ${size}px ${FONT}`;
  while (size > 40 && ctx.measureText(sp.name).width > panel.w - 90) {
    size -= 4;
    ctx.font = `italic bold ${size}px ${FONT}`;
  }
  const titleY = py + 300;
  ctx.fillStyle = sp.accent;
  roughRect(ctx, px + 14, titleY - size * 0.62, panel.w - 28, size * 1.24, 7, seed + 5);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, size * 0.07);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(sp.name, cx, titleY + size * 0.03);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(sp.name, cx, titleY + size * 0.03);

  ctx.fillStyle = sp.accent;
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText("2ND YEAR ANNIVERSARY", cx, py + 440);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `30px ${FONT}`;
  ctx.fillText("PHYSICAL BGC 2026", cx, py + 490);
  ctx.fillText("CCF BGC SPORTS", cx, py + 535);

  // Decor emoji: panel corners, and one where the four cells meet.
  const e = sp.emoji;
  const at = (i: number) => e[i % e.length];
  emojiAt(ctx, at(0), px + 70, py + 85, 140, -0.3);
  emojiAt(ctx, at(1), px + panel.w - 70, py + 90, 150, 0.3);
  emojiAt(ctx, at(2), px + 80, py + panel.h - 60, 140, 0.25);
  emojiAt(ctx, at(3), px + panel.w - 80, py + panel.h - 65, 150, -0.25);
  emojiAt(ctx, at(0), W / 2, H / 2, 190, -0.2);
}
