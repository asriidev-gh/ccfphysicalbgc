import { hash, seeded, type SportHelpers } from "./render-sport";
import { fitFont, vertical } from "./text";
import type { BoothTemplate } from "./templates";

type Values = Record<string, string>;

function val(t: BoothTemplate, v: Values, key: string): string {
  return (v[key]?.trim() || t.fields?.find((f) => f.key === key)?.placeholder || "").trim();
}

/** Draw the photo, then fade its left edge into the background so type can sit on that side. */
function photoWithFade<S>(
  ctx: CanvasRenderingContext2D,
  shot: S | null | undefined,
  h: SportHelpers<S>,
  W: number,
  H: number,
  x0: number,
  x1: number,
) {
  if (!shot) return;
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const o = off.getContext("2d");
  if (!o) return;
  h.drawCover(o, shot, 0, 0, W, H);
  o.globalCompositeOperation = "destination-in";
  const g = o.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  o.fillStyle = g;
  o.fillRect(0, 0, W, H);
  ctx.drawImage(off, 0, 0);
}

function placeholder(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "#2b2b2f";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#6b6b72";
  ctx.font = `bold ${Math.round(H * 0.3)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", W / 2, H / 2);
}

function smoke(ctx: CanvasRenderingContext2D, rnd: () => number, W: number, H: number, alpha: number) {
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W;
    const y = H * (0.45 + rnd() * 0.55);
    const r = 120 + rnd() * 200;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Vertical-name sports posters. The visitor's photo fills the poster; type and effects are layered around it. */
export function drawPoster<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
) {
  const p = t.poster;
  if (!p) return;
  const W = t.width;
  const H = t.height;
  const rnd = seeded(hash(t.id));
  const first = val(t, values, "first");
  const last = val(t, values, "last").toUpperCase();
  const team = val(t, values, "team");
  const num = val(t, values, "number");
  const label = val(t, values, "label").toUpperCase();
  const shot = shots[0];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, p.bg[0]);
  bg.addColorStop(1, p.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const accentGrad = (y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, p.accent);
    g.addColorStop(1, p.accent2);
    return g;
  };
  ctx.lineJoin = "round";

  if (p.style === "smoke") {
    if (shot) h.drawCover(ctx, shot, 0, 0, W, H);
    else placeholder(ctx, W, H);
    const left = ctx.createLinearGradient(0, 0, 460, 0);
    left.addColorStop(0, "rgba(0,0,0,0.85)");
    left.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, 460, H);
    smoke(ctx, rnd, W, H, 0.12);
    // Big vertical surname.
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    vertical(ctx, 150, H - 110, () => {
      const size = fitFont(ctx, last, H - 340, 300, "condensed");
      ctx.lineWidth = size * 0.03;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(last, 0, 0);
      ctx.fillStyle = accentGrad(-size / 2, size / 2);
      ctx.fillText(last, 0, 0);
    });
    ctx.textAlign = "right";
    fitFont(ctx, team, 560, 84, "elegant");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(team, W - 50, 120);
    ctx.textAlign = "left";
    fitFont(ctx, first, 420, 120, "elegant");
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 12;
    ctx.fillText(first, 60, H - 60);
    ctx.shadowColor = "transparent";
    ctx.textAlign = "right";
    fitFont(ctx, label, 300, 44, "condensed");
    ctx.fillStyle = p.accent;
    ctx.fillText(label, W - 60, 560);
    if (num) {
      fitFont(ctx, `#${num}`, 260, 110, "condensed");
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`#${num}`, W - 60, H - 70);
    }
  } else if (p.style === "ghost") {
    // Greyscale, enlarged copy of the photo fading into the background at top left.
    if (shot) {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d");
      if (o) {
        h.drawCover(o, shot, -120, -140, W * 1.25, H * 0.9);
        o.globalCompositeOperation = "saturation";
        o.fillStyle = "#808080";
        o.fillRect(0, 0, W, H);
        o.globalCompositeOperation = "destination-in";
        const g = o.createLinearGradient(0, 0, 0, H * 0.7);
        g.addColorStop(0, "rgba(0,0,0,0.5)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        o.fillStyle = g;
        o.fillRect(0, 0, W, H);
        ctx.drawImage(off, 0, 0);
      }
      photoWithFade(ctx, shot, h, W, H, 220, 520);
    } else placeholder(ctx, W, H);
    smoke(ctx, rnd, W, H, 0.1);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    vertical(ctx, 170, H - 70, () => {
      const full = `${first} ${val(t, values, "last")}`;
      fitFont(ctx, full, H - 160, 170, "elegant");
      ctx.fillStyle = "#ffffff";
      ctx.fillText(full, 0, 0);
    });
    vertical(ctx, 262, H - 70, () => {
      const sub = `${team} ${label}`.toUpperCase();
      fitFont(ctx, sub, H * 0.55, 40, "condensed");
      ctx.fillStyle = p.accent;
      ctx.fillText(sub, 0, 0);
    });
    if (num) {
      ctx.textAlign = "center";
      fitFont(ctx, num, 220, 280, "condensed");
      ctx.fillStyle = "#ffffff";
      ctx.fillText(num, W - 130, 150);
    }
    ctx.textAlign = "center";
    fitFont(ctx, label, 260, 44, "condensed");
    ctx.fillStyle = p.accent;
    ctx.fillText(label, W - 130, 290);
  } else if (p.style === "stripes") {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.9;
    for (const [x, w] of [
      [520, 130],
      [700, 70],
      [830, 150],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w - 380, H);
      ctx.lineTo(x - 380, H);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 120; i++) ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 40, 2);
    if (shot) photoWithFade(ctx, shot, h, W, H, 230, 480);
    else placeholder(ctx, W, H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    vertical(ctx, 190, H - 190, () => {
      const size = fitFont(ctx, last, H - 420, 300, "condensed");
      ctx.fillStyle = "#ebe6dc";
      ctx.fillText(last, 0, 0);
      void size;
    });
    fitFont(ctx, first.toUpperCase(), 360, 56, "condensed");
    ctx.fillStyle = p.accent;
    ctx.fillText(first.toUpperCase(), 80, 110);
    // Bottom row: team, label tag, number.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(380, H - 120);
    ctx.lineTo(W - 330, H - 120);
    ctx.lineTo(W - 360, H - 50);
    ctx.lineTo(350, H - 50);
    ctx.fill();
    ctx.textAlign = "center";
    fitFont(ctx, label, W - 800, 52, "condensed");
    ctx.fillStyle = "#141010";
    ctx.fillText(label, (380 + W - 360) / 2, H - 84);
    ctx.textAlign = "left";
    fitFont(ctx, team.toUpperCase(), 290, 34, "condensed");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(team.toUpperCase(), 60, H - 84);
    if (num) {
      ctx.textAlign = "right";
      fitFont(ctx, `#${num}`, 200, 56, "condensed");
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`#${num}`, W - 60, H - 84);
    }
  } else if (p.style === "midnight") {
    if (shot) h.drawCover(ctx, shot, 0, 0, W, H);
    else placeholder(ctx, W, H);
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.8);
    vig.addColorStop(0, "rgba(5,7,15,0)");
    vig.addColorStop(1, "rgba(5,7,15,0.8)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    smoke(ctx, rnd, W, H, 0.1);
    ctx.textBaseline = "middle";
    if (num) {
      ctx.textAlign = "right";
      const size = fitFont(ctx, num, 520, 520, "condensed");
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillText(num, W - 40, size * 0.42);
      ctx.lineWidth = 4;
      ctx.strokeStyle = p.accent;
      ctx.strokeText(num, W - 40, size * 0.42);
    }
    ctx.textAlign = "left";
    vertical(ctx, 130, H - 330, () => {
      const size = fitFont(ctx, last, H - 760, 230, "condensed");
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillText(last, 0, 0);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(225,232,245,0.9)";
      ctx.strokeText(last, 0, 0);
      void size;
    });
    ctx.textAlign = "right";
    fitFont(ctx, first, 420, 110, "elegant");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(first, W - 70, H - 260);
    ctx.textAlign = "center";
    const ts = fitFont(ctx, team.toUpperCase(), W - 120, 84, "condensed");
    const tg = ctx.createLinearGradient(0, H - 190 - ts / 2, 0, H - 190 + ts / 2);
    tg.addColorStop(0, "#ffffff");
    tg.addColorStop(1, "#7f97c9");
    ctx.fillStyle = tg;
    ctx.fillText(team.toUpperCase(), W / 2, H - 190);
    ctx.fillStyle = "#dfe6f5";
    ctx.font = `600 34px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(`${label}  •  PHYSICAL BGC 2026`, W / 2, H - 110);
  } else {
    // team
    if (shot) h.drawCover(ctx, shot, 0, 0, W, H);
    else placeholder(ctx, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, 260);
    top.addColorStop(0, "rgba(0,0,0,0.75)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 260);
    const bottom = ctx.createLinearGradient(0, H - 520, 0, H);
    bottom.addColorStop(0, "rgba(0,0,0,0)");
    bottom.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H - 520, W, 520);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    fitFont(ctx, team.toUpperCase(), 620, 62, "condensed");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(team.toUpperCase(), 60, 90);
    ctx.textAlign = "right";
    fitFont(ctx, "2026", 240, 84, "condensed");
    ctx.fillStyle = "#ffffff";
    ctx.fillText("2026", W - 60, 90);
    if (num) {
      fitFont(ctx, num, 240, 120, "condensed");
      ctx.fillStyle = p.accent;
      ctx.fillText(num, W - 60, 190);
    }
    ctx.textAlign = "left";
    const size = fitFont(ctx, last, W - 120, 250, "condensed");
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(last, 60, H - 150);
    ctx.fillStyle = p.accent;
    ctx.fillText(last, 60, H - 150);
    ctx.save();
    ctx.translate(60, H - 300);
    ctx.rotate(-0.08);
    fitFont(ctx, first, 520, 130, "elegant");
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 12;
    ctx.fillText(first, 0, 0);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    fitFont(ctx, label, 600, 44, "condensed");
    ctx.fillText(label, 64, H - 52);
  }
}
