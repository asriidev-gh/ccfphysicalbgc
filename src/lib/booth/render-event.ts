import { hash, seeded, type SportHelpers } from "./render-sport";
import { fitFont, goldGradient } from "./text";
import type { BoothSlot, BoothTemplate } from "./templates";

type Values = Record<string, string>;

export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

const BALLOON = {
  gold: ["#fff3b8", "#e0b84f", "#7d5c14"],
  black: ["#8d8d95", "#1f1f23", "#000000"],
  silver: ["#ffffff", "#cbcbd2", "#6a6a73"],
} as const;

export function balloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: keyof typeof BALLOON, rot: number) {
  const c = BALLOON[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
  g.addColorStop(0, c[0]);
  g.addColorStop(0.55, c[1]);
  g.addColorStop(1, c[2]);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = r * 0.2;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.13, r * 0.28, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c[2];
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.98);
  ctx.lineTo(r * 0.1, r * 0.98);
  ctx.lineTo(0, r * 1.13);
  ctx.fill();
  ctx.strokeStyle = "rgba(235,205,120,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, r * 1.13);
  ctx.bezierCurveTo(r * 0.45, r * 1.6, -r * 0.45, r * 2, r * 0.1, r * 2.5);
  ctx.stroke();
  ctx.restore();
}

function goldFrame(ctx: CanvasRenderingContext2D, s: BoothSlot) {
  ctx.strokeStyle = goldGradient(ctx, s.x, s.y, s.x + s.w, s.y + s.h);
  ctx.lineWidth = 10;
  ctx.strokeRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16);
  ctx.strokeStyle = "rgba(255,240,180,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x - 20, s.y - 20, s.w + 40, s.h + 40);
}

/** Pull the typed value for a field, falling back to the template's placeholder. */
function line(t: BoothTemplate, v: Values, key: string): string {
  const field = t.fields?.find((f) => f.key === key);
  return (v[key]?.trim() || field?.placeholder || "").trim();
}

function bulb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, warm: boolean) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  glow.addColorStop(0, warm ? "rgba(255,200,110,0.55)" : "rgba(255,255,255,0.5)");
  glow.addColorStop(1, "rgba(255,200,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.6, warm ? "#ffd98a" : "#f4fbff");
  g.addColorStop(1, warm ? "#ff9f3a" : "#bfe6ff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function slotPhoto<S>(ctx: CanvasRenderingContext2D, slot: BoothSlot, shot: S | null | undefined, i: number, h: SportHelpers<S>) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
  else {
    ctx.fillStyle = "#2b2b2f";
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.fillStyle = "#6b6b72";
    ctx.font = `bold ${Math.round(Math.min(slot.w, slot.h) * 0.35)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2);
  }
  ctx.restore();
}

/** Dark strips with a lit header: hanging filament bulbs over a brick wall, or strings of fairy lights with bokeh. */
function drawLights<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
  rnd: () => number,
) {
  const ev = t.event!;
  const W = t.width;
  const H = t.height;
  const bulbs = ev.style === "bulbs";
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bulbs ? "#0d1330" : "#04080a");
  bg.addColorStop(1, bulbs ? "#171f48" : "#0b1c20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (bulbs) {
    ctx.fillStyle = "#1c1510";
    ctx.fillRect(0, 0, W, 190);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    for (let row = 0; row < 7; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * 28);
      ctx.lineTo(W, row * 28);
      ctx.stroke();
      for (let x = (row % 2) * 35; x < W; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, row * 28);
        ctx.lineTo(x, row * 28 + 28);
        ctx.stroke();
      }
    }
    const xs = Array.from({ length: 12 }, (_, i) => 30 + i * ((W - 60) / 11) + (rnd() - 0.5) * 24);
    for (const x of xs) {
      const y = 70 + rnd() * 260;
      ctx.strokeStyle = "#2a2a2c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "#3a3a3d";
      ctx.fillRect(x - 8, y, 16, 22);
      bulb(ctx, x, y + 50, 28 + rnd() * 8, true);
    }
  } else {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const y = rnd() * H * 0.7;
      const r = 40 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rnd() > 0.5 ? "120,220,230" : "255,255,255"},0.16)`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 3; k++) {
      const y0 = 50 + k * 110;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, y0);
      ctx.quadraticCurveTo(W / 2, y0 + 90, W + 10, y0);
      ctx.stroke();
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const x = -10 + u * (W + 20);
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (y0 + 90) + u * u * y0;
        bulb(ctx, x, y + 14, 11, false);
      }
    }
  }

  t.slots.forEach((slot, i) => {
    slotPhoto(ctx, slot, shots[i], i, h);
    ctx.strokeStyle = bulbs ? "#f1e3c2" : "#ffffff";
    ctx.lineWidth = 4;
    ctx.shadowColor = bulbs ? "rgba(255,230,170,0.5)" : "rgba(255,255,255,0.7)";
    ctx.shadowBlur = bulbs ? 6 : 14;
    ctx.strokeRect(slot.x - 6, slot.y - 6, slot.w + 12, slot.h + 12);
    ctx.shadowColor = "transparent";
  });

  const box = ev.textBox;
  const script = lineOf(t, values, "script");
  const date = lineOf(t, values, "date");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (script) {
    fitFont(ctx, script, box.w * 0.92, box.h * 0.6, "elegant");
    ctx.fillStyle = bulbs ? "#f4e8cc" : "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(script, box.x + box.w / 2, box.y + box.h / 2);
    ctx.shadowColor = "transparent";
  }
  if (date) {
    const last = t.slots[t.slots.length - 1];
    const dy = last.y + last.h + (H - last.y - last.h) / 2;
    fitFont(ctx, date.toUpperCase(), W * 0.8, 40, "serif");
    ctx.fillStyle = bulbs ? "#f4e8cc" : "#ffffff";
    ctx.fillText(date.toUpperCase(), W / 2, dy);
  }
}

/** Landscape gold billboard: giant balloons down the left edge, lettering top left, three framed photos. */
function drawBillboard<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
  rnd: () => number,
) {
  const ev = t.event!;
  const W = t.width;
  const H = t.height;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#060606");
  bg.addColorStop(1, "#2a1d0a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 14 + rnd() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,200,100,0.3)");
    g.addColorStop(1, "rgba(255,200,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  t.slots.forEach((slot, i) => {
    slotPhoto(ctx, slot, shots[i], i, h);
    ctx.strokeStyle = goldGradient(ctx, slot.x, slot.y, slot.x + slot.w, slot.y + slot.h);
    ctx.lineWidth = 6;
    ctx.strokeRect(slot.x - 4, slot.y - 4, slot.w + 8, slot.h + 8);
  });

  const kinds = ["gold", "gold", "black", "gold", "gold", "silver", "gold"] as const;
  for (let i = 0; i < 7; i++) balloon(ctx, 40 + (i % 2) * 70, 60 + i * 170, 95 + rnd() * 30, kinds[i], (rnd() - 0.5) * 0.4);
  for (let i = 0; i < 5; i++) balloon(ctx, W - 30 + (i % 2) * 20, 80 + i * 250, 85 + rnd() * 25, kinds[(i + 2) % 7], (rnd() - 0.5) * 0.4);

  const box = ev.textBox;
  const cx = box.x + box.w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Crown.
  const cy = box.y + box.h * 0.1;
  ctx.fillStyle = goldGradient(ctx, cx - 40, cy - 20, cx + 40, cy + 20);
  ctx.beginPath();
  ctx.moveTo(cx - 44, cy + 20);
  ctx.lineTo(cx - 52, cy - 18);
  ctx.lineTo(cx - 22, cy);
  ctx.lineTo(cx, cy - 26);
  ctx.lineTo(cx + 22, cy);
  ctx.lineTo(cx + 52, cy - 18);
  ctx.lineTo(cx + 44, cy + 20);
  ctx.closePath();
  ctx.fill();
  const sub = lineOf(t, values, "sub").toUpperCase();
  const script = lineOf(t, values, "script");
  const date = lineOf(t, values, "date").toUpperCase();
  if (sub) {
    fitFont(ctx, sub, box.w * 0.9, 46, "serif");
    ctx.fillStyle = "#e3b94e";
    ctx.fillText(sub, cx, box.y + box.h * 0.25);
  }
  if (script) {
    const size = fitFont(ctx, script, box.w * 0.98, 190, "elegant");
    ctx.fillStyle = goldGradient(ctx, 0, box.y + box.h * 0.5 - size / 2, 0, box.y + box.h * 0.5 + size / 2);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.fillText(script, cx, box.y + box.h * 0.5);
    ctx.shadowColor = "transparent";
  }
  if (date) {
    fitFont(ctx, date, box.w * 0.7, 38, "serif");
    ctx.fillStyle = "#f6dc7e";
    ctx.fillText(date, cx, box.y + box.h * 0.75);
  }
  ctx.fillStyle = "#fff6cf";
  for (let i = 0; i < 14; i++) sparkle(ctx, rnd() * W, rnd() * H, 6 + rnd() * 12);
}

function lineOf(t: BoothTemplate, v: Values, key: string): string {
  return (v[key]?.trim() || t.fields?.find((f) => f.key === key)?.placeholder || "").trim();
}

/** Elegant photo-strip templates: a black and gold party look, or a clean white wedding look. */
export function drawEvent<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
) {
  const ev = t.event;
  if (!ev) return;
  const W = t.width;
  const H = t.height;
  const rnd = seeded(hash(t.id));
  if (ev.style === "bulbs" || ev.style === "lights") return drawLights(ctx, t, shots, h, values, rnd);
  if (ev.style === "billboard") return drawBillboard(ctx, t, shots, h, values, rnd);
  const gold = ev.style === "gold";

  if (gold) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#050505");
    bg.addColorStop(1, "#1a1710");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(240,200,100,${0.1 + rnd() * 0.5})`;
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }

  t.slots.forEach((slot, i) => {
    const shot = shots[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
    else {
      ctx.fillStyle = gold ? "#2b2b2f" : "#e7e7ea";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = gold ? "#6b6b72" : "#b5b5bb";
      ctx.font = `bold ${Math.round(Math.min(slot.w, slot.h) * 0.35)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2);
    }
    ctx.restore();
    if (gold) goldFrame(ctx, slot);
  });

  const box = ev.textBox;
  const cx = box.x + box.w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const script = line(t, values, "script");
  const big = line(t, values, "big");
  const sub = line(t, values, "sub");
  const date = line(t, values, "date");

  if (gold) {
    const fillGold = (text: string, y: number, maxW: number, start: number, font: "elegant" | "serif" | "condensed") => {
      if (!text) return;
      const size = fitFont(ctx, text, maxW, start, font);
      ctx.fillStyle = goldGradient(ctx, 0, y - size / 2, 0, y + size / 2);
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8;
      ctx.fillText(text, cx, y);
      ctx.shadowColor = "transparent";
    };
    const bh = box.h;
    fillGold(script, box.y + bh * 0.14, box.w * 0.92, bh * 0.28, "elegant");
    fillGold(big, box.y + bh * 0.42, box.w * 0.92, bh * 0.4, "serif");
    fillGold(sub.toUpperCase(), box.y + bh * 0.68, box.w * 0.92, bh * 0.2, "serif");
    fillGold(date.toUpperCase(), box.y + bh * 0.88, box.w * 0.8, bh * 0.1, "condensed");

    // Balloons along the right edge, then sparkles on top.
    const kinds = ["gold", "black", "silver", "gold", "black", "gold", "silver", "black"] as const;
    for (let i = 0; i < 8; i++) {
      const r = ev.balloons === "edge" ? 78 + rnd() * 40 : 60;
      balloon(ctx, W - 100 + (rnd() - 0.5) * 70, H * (0.07 + i * 0.125) + (rnd() - 0.5) * 50, r, kinds[i], (rnd() - 0.5) * 0.5);
    }
    ctx.fillStyle = "#fff6cf";
    for (let i = 0; i < 22; i++) sparkle(ctx, rnd() * W, rnd() * H, 8 + rnd() * 16);
  } else {
    const bh = box.h;
    if (script) {
      fitFont(ctx, script, box.w * 0.9, bh * 0.34, "elegant");
      ctx.fillStyle = "#1b1b1d";
      ctx.fillText(script, cx, box.y + bh * 0.32);
    }
    if (sub) {
      const size = Math.min(bh * 0.11, 54);
      ctx.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = "#222226";
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(size * 0.18)}px`;
      ctx.fillText(sub.toUpperCase(), cx, box.y + bh * 0.62);
      ctx.fillText(date.toUpperCase(), cx, box.y + bh * 0.62 + size * 1.6);
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
    }
  }
}
