import { basketball, football, helmet, soccerBall, star5, trophy, volleyball } from "./art";
import { hash, seeded, type SportHelpers } from "./render-sport";
import { fitFont } from "./text";
import type { BoothTemplate } from "./templates";

type Values = Record<string, string>;

function val(t: BoothTemplate, v: Values, key: string): string {
  return (v[key]?.trim() || t.fields?.find((f) => f.key === key)?.placeholder || "").trim();
}

function label(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  maxW: number,
  start: number,
  font: Parameters<typeof fitFont>[4],
  fill: string,
  stroke?: string,
) {
  if (!s) return;
  const size = fitFont(ctx, s, maxW, start, font);
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

/** Round "paper cut" letter token: striped disc with a bold red letter. */
function token(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = "#111111";
  for (let i = -r; i < r; i += 9) ctx.fillRect(x + i, y - r, 4, r * 2);
  ctx.restore();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${r * 1.35}px Georgia, "Times New Roman", serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = "#111111";
  ctx.strokeText(ch, x, y + r * 0.05);
  ctx.fillStyle = "#e3263a";
  ctx.fillText(ch, x, y + r * 0.05);
}

/** Cardboard-prop style frames: the photo shows through the middle and the prop border is drawn on top. */
export function drawProps<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
) {
  const style = t.prop?.style;
  if (!style) return;
  const W = t.width;
  const H = t.height;
  const slot = t.slots[0];
  const rnd = seeded(hash(t.id));
  const v = (k: string) => val(t, values, k);

  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  const shot = shots[0];
  if (shot) h.drawCover(ctx, shot, slot.x, slot.y, slot.w, slot.h);
  else {
    ctx.fillStyle = "#2b2b2f";
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.fillStyle = "#6b6b72";
    ctx.font = `bold ${Math.round(slot.h * 0.3)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", slot.x + slot.w / 2, slot.y + slot.h / 2);
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style === "touchdown") {
    const top = 150;
    const side = 90;
    const bottom = 120;
    ctx.fillStyle = "#1f7a2a";
    ctx.fillRect(0, 0, W, top);
    ctx.fillRect(0, H - bottom, W, bottom);
    ctx.fillRect(0, 0, side, H);
    ctx.fillRect(W - side, 0, side, H);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 4;
    for (let x = 60; x < W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, top - 8);
      ctx.moveTo(x, H - bottom + 8);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = top; y < H - bottom; y += 90) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(side - 8, y);
      ctx.moveTo(W - side + 8, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(side, top, W - side * 2, H - top - bottom);
    label(ctx, v("title").toUpperCase(), W / 2, 78, W - 520, 120, "condensed", "#ffffff", "#0e4a16");
    helmet(ctx, 105, 140, 230, "#d42a2a", -0.15);
    helmet(ctx, W - 110, H - 125, 240, "#1f4fd4", 0.1);
    football(ctx, W - 110, 120, 230, 0.7);
    football(ctx, 105, H - 270, 220, -0.6);
    trophy(ctx, 380, H - 95, 200);
    star5(ctx, 250, H - 70, 26, "#ffd23f", "#9a7600");
    star5(ctx, 520, H - 60, 22, "#ffd23f", "#9a7600");
    star5(ctx, W - 130, 330, 24, "#ffd23f", "#9a7600");
  } else if (style === "allstars") {
    const left = 130;
    const right = 110;
    const top = 140;
    const bottom = 190;
    ctx.fillStyle = "#f7f7f3";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 14;
    ctx.fillRect(0, 0, W, top);
    ctx.fillRect(0, H - bottom, W, bottom);
    ctx.fillRect(0, 0, left, H);
    ctx.fillRect(W - right, 0, right, H);
    ctx.shadowColor = "transparent";
    // Grass.
    ctx.fillStyle = "#2e9a46";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 14) ctx.lineTo(x, H - 50 - rnd() * 40);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.fillStyle = "#1f7a34";
    ctx.fillRect(0, H - 34, W, 34);
    soccerBall(ctx, 120, 130, 125);
    // Speech bubble.
    ctx.fillStyle = "#a9d3e2";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(400, 80, 140, 62, 0, 0, Math.PI * 2);
    ctx.moveTo(330, 125);
    ctx.lineTo(300, 175);
    ctx.lineTo(380, 135);
    ctx.fill();
    ctx.stroke();
    label(ctx, "Hello!", 400, 82, 200, 54, "marker", "#111111");
    football(ctx, W - 210, 80, 240, 0.2);
    // Smile banner.
    ctx.fillStyle = "#7d86d9";
    ctx.beginPath();
    ctx.moveTo(W - 330, 300);
    ctx.lineTo(W - 10, 330);
    ctx.lineTo(W - 190, 470);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(W - 200, 365);
    ctx.rotate(-0.25);
    label(ctx, "Smile!", 0, 0, 200, 56, "marker", "#ffb02e");
    ctx.restore();
    // Smiley.
    ctx.fillStyle = "#f6e44a";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(95, 330, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(70, 310, 8, 0, Math.PI * 2);
    ctx.arc(120, 310, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(95, 335, 34, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 7;
    ctx.stroke();
    // Letter tokens: word 1 down the left, word 2 along the bottom.
    const w1 = v("word1").toUpperCase().slice(0, 5);
    [...w1].forEach((ch, i) => token(ctx, ch, 66, 470 + i * 104, 46));
    const w2 = v("word2").toUpperCase().slice(0, 8);
    const r2 = Math.min(52, (W - 360) / (w2.length * 2.1));
    [...w2].forEach((ch, i) => token(ctx, ch, 230 + i * r2 * 2.15, H - 110, r2));
  } else {
    const b = 90;
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, W, b);
    ctx.fillRect(0, H - b, W, b);
    ctx.fillRect(0, 0, b, H);
    ctx.fillRect(W - b, 0, b, H);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(b, b, W - b * 2, H - b * 2);
    // Glitter lettering down the left, tilted.
    const words = [v("l1").toUpperCase(), v("l2").toUpperCase(), v("l3").toUpperCase()];
    words.forEach((w, i) => {
      ctx.save();
      ctx.translate(190, 380 + i * 150);
      ctx.rotate(-0.28 + i * 0.1);
      const size = fitFont(ctx, w, 270, 130, "comic");
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = "#1b1b1f";
      ctx.strokeText(w, 0, 0);
      ctx.lineWidth = size * 0.1;
      ctx.strokeStyle = "#f2f2f5";
      ctx.strokeText(w, 0, 0);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, "#d8dae0");
      g.addColorStop(1, "#8b8e99");
      ctx.fillStyle = g;
      ctx.fillText(w, 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let k = 0; k < 18; k++) ctx.fillRect((rnd() - 0.5) * 240, (rnd() - 0.5) * size * 0.7, 3, 3);
      ctx.restore();
    });
    soccerBall(ctx, 120, 130, 120);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(W - 125, 150, 112, 0, Math.PI * 2);
    ctx.fill();
    volleyball(ctx, W - 125, 150, 100, "#ff7a9a", "#d6325e");
    // Trophy with a name plate.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(W / 2 - 150, 40, 300, 250);
    trophy(ctx, W / 2, 130, 230, "#f6e83a", "#a89a00");
    star5(ctx, W / 2, 70, 38, "#9a2fb0", "#4a1060");
    ctx.fillStyle = "#6a1a2a";
    ctx.fillRect(W / 2 - 70, 245, 140, 44);
    label(ctx, v("plate").toUpperCase(), W / 2, 268, 120, 30, "condensed", "#f6d85a");
    const sc = ["#3a9a4a", "#e86aa0", "#b3262a", "#8a2fb0", "#f2b620"];
    sc.forEach((c, i) => star5(ctx, W - 160 + (i % 2) * 40, 330 + i * 80, 48, c, "#ffffff", 0.2 * i));
    volleyball(ctx, W - 130, H - 130, 125, "#fff06a", "#e6c800");
    basketball(ctx, 130, H - 95, 80, "#c24ad6", "#7a1a90");
    // "Game On" label.
    ctx.fillStyle = "#f6edd2";
    ctx.strokeStyle = "#2e9a46";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 80, 210, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, v("bottom"), W / 2, H - 80, 340, 76, "elegant", "#1a3a9a");
  }
  void shot;
}
