import { hash, seeded, type SportHelpers } from "./render-sport";
import type { BoothTemplate, CardStyle } from "./templates";

export interface CardText {
  name: string;
  title: string;
}

const FONT = `"Arial Narrow", Impact, "Helvetica Neue", Arial, sans-serif`;
const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const GOLD = "#e8c15a";

type Rnd = () => number;

/** A rectangle with its four corners cut off, the signature shape of trading-card frames. */
function chamfer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** Metallic and holographic card surfaces, painted procedurally. */
function foil(ctx: CanvasRenderingContext2D, st: CardStyle, W: number, H: number, rnd: Rnd) {
  const base = ctx.createLinearGradient(0, 0, W, H);
  if (st.foil === "rainbow") {
    const cell = 64;
    for (let y = -cell; y < H + cell; y += cell) {
      for (let x = -cell; x < W + cell; x += cell) {
        const hue = (x * 0.25 + y * 0.2 + rnd() * 70) % 360;
        ctx.fillStyle = `hsl(${hue},90%,${55 + rnd() * 15}%)`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell, y);
        ctx.lineTo(x, y + cell);
        ctx.fill();
        ctx.fillStyle = `hsl(${hue + 40 * rnd()},90%,${55 + rnd() * 15}%)`;
        ctx.beginPath();
        ctx.moveTo(x + cell, y);
        ctx.lineTo(x + cell, y + cell);
        ctx.lineTo(x, y + cell);
        ctx.fill();
      }
    }
    base.addColorStop(0, "rgba(255,255,255,0.35)");
    base.addColorStop(0.5, "rgba(255,255,255,0)");
    base.addColorStop(1, "rgba(255,255,255,0.25)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
  } else if (st.foil === "pink") {
    base.addColorStop(0, st.dark);
    base.addColorStop(1, st.main);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 20 + rnd() * 14;
      ctx.fillStyle = "rgba(255,210,235,0.28)";
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (st.foil === "prism") {
    base.addColorStop(0, st.main);
    base.addColorStop(1, st.dark);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const len = 40 + rnd() * 70;
      ctx.strokeStyle = `hsla(${rnd() * 360},95%,65%,0.55)`;
      ctx.lineWidth = 2 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.5, y + len * 0.87);
      ctx.stroke();
    }
  } else if (st.foil === "silver") {
    base.addColorStop(0, st.main);
    base.addColorStop(1, st.dark);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    for (let x = 0; x < W; x += 7) ctx.fillRect(x, 0, 2, H);
  } else {
    base.addColorStop(0, st.dark);
    base.addColorStop(1, st.main);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const w = 20 + rnd() * 120;
      ctx.fillStyle = rnd() > 0.35 ? `rgba(255,255,255,${0.04 + rnd() * 0.1})` : `rgba(0,0,0,${0.08 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y - w * 0.5);
      ctx.lineTo(x + w + 14, y - w * 0.5 + 10);
      ctx.lineTo(x + 14, y + 10);
      ctx.fill();
    }
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, style = "italic bold", min = 24) {
  let size = start;
  ctx.font = `${style} ${size}px ${FONT}`;
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 3;
    ctx.font = `${style} ${size}px ${FONT}`;
  }
  return size;
}

function photoOrPlaceholder<S>(
  ctx: CanvasRenderingContext2D,
  shot: S | null | undefined,
  slot: BoothTemplate["slots"][number],
  h: SportHelpers<S>,
) {
  if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
  else {
    ctx.fillStyle = "#2b2b2f";
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.fillStyle = "#6b6b72";
    ctx.font = `bold ${Math.round(slot.h * 0.3)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", slot.x + slot.w / 2, slot.y + slot.h / 2);
  }
}

function emojiAt(ctx: CanvasRenderingContext2D, e: string, x: number, y: number, size: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.fillText(e, 0, 0);
  ctx.restore();
}

/** Foil card: prismatic border, black bevelled frame, name plates and an info box. */
function plateCard<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  text: CardText,
  st: CardStyle,
) {
  const W = t.width;
  const H = t.height;
  const slot = t.slots[0];
  const cx = W / 2;

  ctx.fillStyle = "#0c0c0e";
  chamfer(ctx, 46, 46, W - 92, H - 92, 62);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  chamfer(ctx, 62, 62, W - 124, H - 124, 52);
  ctx.stroke();

  ctx.save();
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 40);
  ctx.clip();
  photoOrPlaceholder(ctx, shots[0], slot, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 5;
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 40);
  ctx.stroke();

  // Label banner.
  if (st.label) {
    const bw = 440;
    const bx = st.labelPos === "top-right" ? W - 62 - bw - 20 : cx - bw / 2;
    ctx.fillStyle = "#101014";
    chamfer(ctx, bx, 78, bw, 74, 22);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    chamfer(ctx, bx + 6, 84, bw - 12, 62, 18);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, st.label, bw - 60, 40, "bold", 22);
    ctx.fillText(st.label, bx + bw / 2, 117);
  }

  // Shield badge.
  if (st.shield) {
    const sx = slot.x + slot.w - 150;
    const sy = slot.y + 28;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 120, sy);
    ctx.lineTo(sx + 120, sy + 110);
    ctx.lineTo(sx + 60, sy + 160);
    ctx.lineTo(sx, sy + 110);
    ctx.closePath();
    ctx.fillStyle = "#0c0c0e";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 50px ${FONT}`;
    ctx.fillText(st.shield, sx + 60, sy + 55);
    ctx.fillStyle = GOLD;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText("★", sx + 60, sy + 112);
  }

  // Name and title plates overlap the bottom of the photo.
  const py = slot.y + slot.h - 60;
  const pw = slot.w - 70;
  const px = cx - pw / 2;
  ctx.fillStyle = st.plate;
  chamfer(ctx, px, py, pw, 104, 26);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  chamfer(ctx, px + 7, py + 7, pw - 14, 90, 20);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, text.name, pw - 80, 80);
  ctx.fillText(text.name, cx, py + 54);

  const ty = py + 114;
  ctx.fillStyle = "#101014";
  chamfer(ctx, px + 40, ty, pw - 80, 58, 18);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  chamfer(ctx, px + 46, ty + 5, pw - 92, 48, 14);
  ctx.stroke();
  ctx.fillStyle = "#e9e9ee";
  fitText(ctx, text.title, pw - 160, 34, "bold", 18);
  ctx.fillText(text.title, cx, ty + 30);

  if (st.info) {
    const iy = ty + 78;
    ctx.fillStyle = "#101014";
    chamfer(ctx, px + 10, iy, pw - 20, 128, 24);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    chamfer(ctx, px + 18, iy + 8, pw - 36, 112, 18);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText("2ND YEAR ANNIVERSARY", cx, iy + 46);
    ctx.fillStyle = "#c9c9d1";
    ctx.font = `28px ${FONT}`;
    ctx.fillText("PHYSICAL BGC 2026 • CCF BGC SPORTS", cx, iy + 88);
  }
}

/** Silver "classic" card: white border, navy ribbon, round club badge, name over the photo. */
function classicCard<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  text: CardText,
  st: CardStyle,
) {
  const W = t.width;
  const H = t.height;
  const slot = t.slots[0];

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 6;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(58, 58, W - 116, H - 116);
  ctx.setLineDash([]);

  ctx.save();
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 30);
  ctx.clip();
  photoOrPlaceholder(ctx, shots[0], slot, h);
  const scrim = ctx.createLinearGradient(0, slot.y + slot.h - 360, 0, slot.y + slot.h);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = scrim;
  ctx.fillRect(slot.x, slot.y + slot.h - 360, slot.w, 360);
  ctx.restore();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 30);
  ctx.stroke();

  // Ribbon.
  const rw = 360;
  const rx = W / 2 - rw / 2;
  ctx.fillStyle = st.plate;
  ctx.fillRect(rx, 40, rw, 120);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(rx + 14, 54, rw - 28, 92);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 62px ${FONT}`;
  ctx.fillText(st.label ?? "CCF BGC", W / 2, 102);

  // Name over the photo, bottom right.
  ctx.textAlign = "right";
  const nx = slot.x + slot.w - 30;
  const size = fitText(ctx, text.name, 540, 96);
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(text.name, nx, slot.y + slot.h - 60);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text.name, nx, slot.y + slot.h - 60);

  // Title bar.
  const by = slot.y + slot.h + 40;
  ctx.fillStyle = st.plate;
  ctx.beginPath();
  ctx.moveTo(340, by);
  ctx.lineTo(W - 90, by);
  ctx.lineTo(W - 90, by + 66);
  ctx.lineTo(300, by + 66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e9eefc";
  ctx.textAlign = "right";
  fitText(ctx, text.title, 500, 36, "italic bold", 18);
  ctx.fillText(text.title, W - 130, by + 35);

  // Round club badge.
  const bx = 220;
  const bcy = by + 20;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bx, bcy, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = st.plate;
  ctx.beginPath();
  ctx.arc(bx, bcy, 116, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, bcy, 96, 0, Math.PI * 2);
  ctx.clip();
  h.drawLogo(ctx, bx - 96, bcy - 96, 192);
  ctx.restore();
  void H;
}

/** Grunge "player" card: bright textured border, big photo, number badge, sport shield, huge name. */
function grungeCard<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  text: CardText,
  st: CardStyle,
) {
  const W = t.width;
  const H = t.height;
  const slot = t.slots[0];

  ctx.save();
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 36);
  ctx.clip();
  photoOrPlaceholder(ctx, shots[0], slot, h);
  const scrim = ctx.createLinearGradient(0, slot.y + slot.h - 420, 0, slot.y + slot.h);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = scrim;
  ctx.fillRect(slot.x, slot.y + slot.h - 420, slot.w, 420);
  ctx.restore();
  ctx.strokeStyle = "rgba(235,240,250,0.95)";
  ctx.lineWidth = 8;
  chamfer(ctx, slot.x, slot.y, slot.w, slot.h, 36);
  ctx.stroke();

  // Number badge (top left).
  ctx.beginPath();
  ctx.moveTo(40, 40);
  ctx.lineTo(210, 40);
  ctx.lineTo(240, 80);
  ctx.lineTo(240, 230);
  ctx.lineTo(40, 230);
  ctx.closePath();
  ctx.fillStyle = "#0c0c10";
  ctx.fill();
  ctx.strokeStyle = "#d9dde6";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 108px ${FONT}`;
  ctx.fillText("26", 140, 118);
  ctx.fillStyle = st.accent;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText("PBGC", 140, 194);

  // Title tag.
  ctx.fillStyle = "rgba(10,10,14,0.85)";
  chamfer(ctx, 270, 70, 440, 60, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  fitText(ctx, text.title, 400, 32, "bold", 16);
  ctx.fillText(text.title, 490, 101);

  // Name: first word small, the rest big.
  const parts = text.name.split(" ");
  const first = parts.length > 1 ? parts[0] : "";
  const rest = parts.length > 1 ? parts.slice(1).join(" ") : text.name;
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const left = 290;
  const maxW = W - left - 60;
  if (first) {
    fitText(ctx, first, maxW, 66);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(first, left, slot.y + slot.h - 150);
  }
  const size = fitText(ctx, rest, maxW, 150);
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(rest, left, slot.y + slot.h - 70);
  const g = ctx.createLinearGradient(0, slot.y + slot.h - 70 - size / 2, 0, slot.y + slot.h - 70 + size / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, st.accent);
  ctx.fillStyle = g;
  ctx.fillText(rest, left, slot.y + slot.h - 70);

  // Sport shield (bottom left).
  const sx = 40;
  const sy = H - 300;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + 220, sy);
  ctx.lineTo(sx + 220, sy + 190);
  ctx.lineTo(sx + 110, sy + 270);
  ctx.lineTo(sx, sy + 190);
  ctx.closePath();
  const sg = ctx.createLinearGradient(sx, sy, sx, sy + 270);
  sg.addColorStop(0, st.main);
  sg.addColorStop(1, st.dark);
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = "#e6ebf5";
  ctx.lineWidth = 7;
  ctx.stroke();
  if (st.emoji) emojiAt(ctx, st.emoji, sx + 110, sy + 105, 110, 0);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitText(ctx, st.sport ?? "", 170, 34, "bold", 16);
  ctx.fillText(st.sport ?? "", sx + 110, sy + 190);

  // Equipment overlapping the frame, like the baseballs in the reference.
  if (st.emoji) {
    emojiAt(ctx, st.emoji, W - 70, 80, 150, 0.4);
    emojiAt(ctx, st.emoji, W - 100, H - 110, 190, -0.3);
  }
}

/** Trading-card templates: a portrait card with one photo, plus editable name and title. */
export function drawTrading<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  text: CardText,
) {
  const st = t.card;
  if (!st) return;
  const rnd = seeded(hash(t.id));
  foil(ctx, st, t.width, t.height, rnd);
  const clean: CardText = {
    name: (text.name.trim() || "YOUR NAME").toUpperCase(),
    title: (text.title.trim() || "PHYSICAL BGC 2026").toUpperCase(),
  };
  if (st.kind === "classic") classicCard(ctx, t, shots, h, clean, st);
  else if (st.kind === "grunge") grungeCard(ctx, t, shots, h, clean, st);
  else plateCard(ctx, t, shots, h, clean, st);
}
