import { hash, seeded, type SportHelpers } from "./render-sport";
import type { BoothTemplate } from "./templates";

const SLAB = `"Rockwell", "Roboto Slab", "Arial Black", Impact, sans-serif`;

type Art = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, accent: string) => void;

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c1: string, c2: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const basketball: Art = (ctx, cx, cy, s, accent) => {
  const r = s * 0.3;
  const by = cy - s * 0.14;
  ctx.save();
  ball(ctx, cx, by, r, "#ffa04a", "#c4560e");
  ctx.beginPath();
  ctx.arc(cx, by, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#1c0d05";
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, by - r);
  ctx.lineTo(cx, by + r);
  ctx.moveTo(cx - r, by);
  ctx.lineTo(cx + r, by);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 1.45, by, r * 1.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 1.45, by, r * 1.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Hoop with a net.
  const hy = cy + s * 0.3;
  const rx = r * 1.3;
  const ry = r * 0.26;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + (i / 4) * rx, hy);
    ctx.lineTo(cx + (i / 4) * rx * 0.55, hy + r * 0.85);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(cx, hy + r * 0.45, rx * 0.8, ry * 0.7, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(cx, hy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
};

const shuttlecock: Art = (ctx, cx, cy, s, accent) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.55);
  const w1 = s * 0.08;
  const w2 = s * 0.25;
  const h = s * 0.5;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.moveTo(-w1, 0);
  ctx.lineTo(w1, 0);
  ctx.lineTo(w2, -h);
  ctx.lineTo(-w2, -h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 3) * w1, 0);
    ctx.lineTo((i / 3) * w2, -h);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-w2, -h);
  ctx.lineTo(w2, -h);
  ctx.stroke();
  ball(ctx, 0, s * 0.02, s * 0.1, "#ffffff", "#c9c9c9");
  ctx.restore();
};

const pickleball: Art = (ctx, cx, cy, s, accent) => {
  ctx.save();
  ctx.translate(cx - s * 0.08, cy);
  ctx.rotate(-0.45);
  ctx.fillStyle = "#6b3f1d";
  ctx.beginPath();
  ctx.roundRect(-s * 0.04, s * 0.12, s * 0.08, s * 0.2, s * 0.02);
  ctx.fill();
  ctx.fillStyle = "#0e7a92";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.roundRect(-s * 0.22, -s * 0.3, s * 0.44, s * 0.46, s * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const r = s * 0.14;
  const bx = cx + s * 0.2;
  const by = cy + s * 0.18;
  ball(ctx, bx, by, r, "#f4ff7a", accent);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (const [dx, dy] of [
    [-0.4, -0.3],
    [0.1, -0.5],
    [0.5, -0.1],
    [-0.1, 0.1],
    [0.3, 0.4],
    [-0.5, 0.35],
  ]) {
    ctx.beginPath();
    ctx.arc(bx + dx * r, by + dy * r, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
};

const stopwatch: Art = (ctx, cx, cy, s, accent) => {
  const r = s * 0.3;
  const y = cy + s * 0.04;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - r - s * 0.32 + i * 14, y - r * 0.4 + i * r * 0.4);
    ctx.lineTo(cx - r - s * 0.08, y - r * 0.4 + i * r * 0.4);
    ctx.stroke();
  }
  ctx.fillStyle = "#cfcfd4";
  ctx.fillRect(cx - s * 0.05, y - r - s * 0.1, s * 0.1, s * 0.1);
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(0.7);
  ctx.fillRect(-s * 0.04, -r - s * 0.09, s * 0.08, s * 0.07);
  ctx.restore();
  ctx.fillStyle = "#16161a";
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = s * 0.03;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx + Math.cos(-0.9) * r * 0.65, y + Math.sin(-0.9) * r * 0.65);
  ctx.stroke();
};

const kettlebell: Art = (ctx, cx, cy, s, accent) => {
  const r = s * 0.27;
  const by = cy + s * 0.1;
  ctx.strokeStyle = "#3a3a3d";
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.17, by - r * 0.6);
  ctx.arc(cx, by - r * 0.95, s * 0.17, Math.PI, 0);
  ctx.lineTo(cx + s * 0.17, by - r * 0.6);
  ctx.stroke();
  ball(ctx, cx, by, r, "#4a4a4e", "#1b1b1d");
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, by + r * 0.05, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = `bold ${r * 0.5}px ${SLAB}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KG", cx, by + r * 0.08);
};

const barbell: Art = (ctx, cx, cy, s, accent) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.strokeStyle = "#b9b9bf";
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, 0);
  ctx.lineTo(s * 0.5, 0);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(side * s * 0.2 - s * 0.035, -s * 0.26, s * 0.07, s * 0.52, s * 0.015);
    ctx.fill();
    ctx.fillStyle = "#2b2b2f";
    ctx.beginPath();
    ctx.roundRect(side * s * 0.29 - s * 0.03, -s * 0.19, s * 0.06, s * 0.38, s * 0.015);
    ctx.fill();
    ctx.fillStyle = "#cfcfd4";
    ctx.fillRect(side * s * 0.14 - s * 0.015, -s * 0.05, s * 0.03, s * 0.1);
  }
  ctx.restore();
};

const ART: Record<string, Art> = { basketball, shuttlecock, pickleball, stopwatch, kettlebell, barbell };

/** Hand-drawn style outline doodles scattered around, like the pen sketches on printed photo cards. */
function doodle(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  if (kind === 0) {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.42;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else if (kind === 1) {
    ctx.moveTo(r * 0.2, -r);
    ctx.lineTo(-r * 0.5, r * 0.1);
    ctx.lineTo(0, r * 0.1);
    ctx.lineTo(-r * 0.2, r);
    ctx.lineTo(r * 0.5, -r * 0.2);
    ctx.lineTo(0, -r * 0.2);
    ctx.closePath();
  } else if (kind === 2) {
    ctx.moveTo(-r * 0.6, -r * 0.6);
    ctx.lineTo(r * 0.6, r * 0.6);
    ctx.moveTo(r * 0.6, -r * 0.6);
    ctx.lineTo(-r * 0.6, r * 0.6);
  } else if (kind === 3) {
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(0, -r, r, 0);
    ctx.moveTo(r * 0.55, -r * 0.35);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.5, r * 0.4);
  }
  ctx.stroke();
  ctx.restore();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, min = 30) {
  let size = start;
  ctx.font = `bold ${size}px ${SLAB}`;
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 3;
    ctx.font = `bold ${size}px ${SLAB}`;
  }
  return size;
}

/** Landscape "printed card": dark paper, two photos on the left, big title and sport artwork on the right. */
export function drawCard<S>(ctx: CanvasRenderingContext2D, t: BoothTemplate, shots: (S | null | undefined)[], h: SportHelpers<S>) {
  const sp = t.sport;
  const panel = t.panel;
  if (!sp || !panel) return;
  const W = t.width;
  const H = t.height;
  const rnd = seeded(hash(t.id));

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, sp.bg[0]);
  bg.addColorStop(1, sp.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Paper grain.
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 2600; i++) ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 2, 1 + rnd() * 2);

  // Doodles over the title side.
  ctx.strokeStyle = sp.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 18; i++) {
    doodle(ctx, i % 5, panel.x + rnd() * panel.w, panel.y + rnd() * panel.h, 22 + rnd() * 20, (rnd() - 0.5) * 1.2);
  }
  ctx.globalAlpha = 1;

  // Photos with an accent border.
  t.slots.forEach((slot, i) => {
    ctx.strokeStyle = sp.accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(slot.x - 5, slot.y - 5, slot.w + 10, slot.h + 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    const shot = shots[i];
    if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
    else {
      ctx.fillStyle = "#2b2b2f";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = "#6b6b72";
      ctx.font = `bold ${Math.round(slot.h * 0.4)}px ${SLAB}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2);
    }
    ctx.restore();
  });

  // Title block.
  const x0 = panel.x;
  const cx = x0 + panel.w / 2;
  h.drawLogo(ctx, x0 + 8, panel.y + 10, 96);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 34px ${SLAB}`;
  ctx.fillText("CCF BGC SPORTS", x0 + 120, panel.y + 58);

  ctx.textAlign = "center";
  const line = (text: string, y: number, max: number, start: number) => {
    const size = fit(ctx, text, max, start);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(text, cx + 5, y + 6);
    ctx.fillStyle = sp.accent;
    ctx.fillText(text, cx, y);
    return size;
  };
  line(sp.name, panel.y + 215, panel.w - 20, 150);
  line("2ND ANNIVERSARY", panel.y + 335, panel.w - 40, 84);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 38px ${SLAB}`;
  ctx.fillText("PHYSICAL BGC 2026", cx, panel.y + 415);

  ART[sp.art ?? "basketball"](ctx, cx, panel.y + 750, 430, sp.accent);
}
