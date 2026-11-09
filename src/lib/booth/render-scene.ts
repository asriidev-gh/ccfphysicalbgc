import { basketball, checkerRing, crowd, inkSplats, roughPath, soccerBall, star5, trophy } from "./art";
import { slotPhoto } from "./render-event";
import { hash, seeded, type SportHelpers } from "./render-sport";
import { fitFont } from "./text";
import type { BoothSlot, BoothTemplate } from "./templates";

type Values = Record<string, string>;
type Rnd = () => number;

function val(t: BoothTemplate, v: Values, key: string): string {
  return (v[key]?.trim() || t.fields?.find((f) => f.key === key)?.placeholder || "").trim();
}

function text(
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
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

function halftone(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, color: string, step: number) {
  ctx.fillStyle = color;
  for (let y = y0; y < y0 + h; y += step) {
    for (let x = x0 + (((y - y0) / step) % 2) * (step / 2); x < x0 + w; x += step) {
      const k = 1 - (x - x0) / w;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, step * 0.4 * k), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function chamferPath(ctx: CanvasRenderingContext2D, s: BoothSlot, c: number, pad = 0) {
  const x = s.x - pad;
  const y = s.y - pad;
  const w = s.w + pad * 2;
  const h = s.h + pad * 2;
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

/** Themed multi-photo layouts: a background scene plus lettering, with the photos placed in framed slots. */
export function drawScene<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
) {
  const style = t.scene?.style;
  if (!style) return;
  const W = t.width;
  const H = t.height;
  const rnd: Rnd = seeded(hash(t.id));
  const v = (k: string) => val(t, values, k);
  const photos = (frame: (s: BoothSlot) => void) =>
    t.slots.forEach((s, i) => {
      slotPhoto(ctx, s, shots[i], i, h);
      frame(s);
    });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style === "hoops") {
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f07a1a";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.55, 0);
    ctx.lineTo(0, H * 0.4);
    ctx.fill();
    halftone(ctx, W * 0.45, 0, W * 0.55, H * 0.5, "rgba(240,122,26,0.5)", 26);
    ctx.fillStyle = "#f07a1a";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.74);
    ctx.lineTo(W, H * 0.7);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    halftone(ctx, 0, H * 0.74, W * 0.5, H * 0.26, "rgba(0,0,0,0.18)", 22);
    basketball(ctx, 40, 90, 250);
    basketball(ctx, W - 20, H - 200, 300);
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 20;
      chamferPath(ctx, s, 70, 6);
      ctx.stroke();
    });
    ctx.fillStyle = "#ffffff";
    for (const [x, y, r] of [
      [W - 90, 70, 34],
      [120, H * 0.73, 26],
    ] as const)
      star5(ctx, x, y, r, "#ffffff");
    const by = H * 0.74;
    text(ctx, v("kicker"), W * 0.37, by + 40, W * 0.5, 54, "serif", "#ffffff");
    text(ctx, v("title"), W * 0.5, by + 125, W * 0.8, 150, "comic", "#ffffff", "#111111");
    text(ctx, v("date").toUpperCase(), W * 0.4, by + 215, W * 0.5, 44, "serif", "#ffffff");
  } else if (style === "soccer") {
    ctx.fillStyle = "#4c9a2c";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    for (let x = -200; x < W; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 120, H);
      ctx.lineTo(x + 520, 0);
      ctx.lineTo(x + 400, 0);
      ctx.fill();
    }
    for (const [x, c] of [
      [840, "#1f2f6b"],
      [980, "#f2b620"],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, 560);
      ctx.lineTo(x + 70, 560);
      ctx.lineTo(x - 50, 660);
      ctx.lineTo(x - 120, 660);
      ctx.fill();
    }
    soccerBall(ctx, 330, 960, 230);
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 16;
      ctx.strokeRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16);
      checkerRing(ctx, s.x - 16, s.y - 16, s.w + 32, s.h + 32, 22);
    });
    ctx.textAlign = "left";
    text(ctx, v("top"), 80, 600, 560, 54, "elegant", "#111111");
    ctx.textAlign = "left";
    text(ctx, v("name"), 80, 700, 600, 150, "comic", "#f6e013", "#111111");
    text(ctx, v("sub"), 90, 800, 520, 80, "comic", "#f6e013", "#111111");
    ctx.textAlign = "right";
    text(ctx, v("date"), W - 70, H - 50, 700, 52, "condensed", "#ffffff", "#111111");
    soccerBall(ctx, W - 520, H - 90, 60);
  } else if (style === "ink") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      inkSplats(ctx, rnd, rnd() * W, rnd() * H, 260, 40, i % 2 ? "#111111" : "#f07a1a");
    }
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 14;
      ctx.strokeRect(s.x - 7, s.y - 7, s.w + 14, s.h + 14);
      ctx.strokeStyle = "#f07a1a";
      ctx.lineWidth = 5;
      ctx.strokeRect(s.x - 16, s.y - 16, s.w + 32, s.h + 32);
    });
    const box = t.scene?.textBox ?? { x: 0, y: 0, w: W, h: H };
    const cx = box.x + box.w * 0.5;
    // Ball bursting out of a cracked wall.
    const bx = box.x + box.w * 0.58;
    const by = box.y + box.h * 0.66;
    const br = Math.min(box.w, box.h) * 0.2;
    ctx.strokeStyle = "rgba(60,60,60,0.8)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.2;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * br * 0.9, by + Math.sin(a) * br * 0.9);
      ctx.lineTo(bx + Math.cos(a + 0.12) * br * 1.5, by + Math.sin(a + 0.12) * br * 1.5);
      ctx.lineTo(bx + Math.cos(a - 0.05) * br * 1.9, by + Math.sin(a - 0.05) * br * 1.9);
      ctx.stroke();
    }
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(bx, by, br * 1.12, 0, Math.PI * 2);
    ctx.fill();
    basketball(ctx, bx, by, br);
    text(ctx, v("name"), cx, box.y + box.h * 0.12, box.w * 0.92, box.h * 0.2, "condensed", "#f07a1a", "#111111");
    text(ctx, v("sub"), cx, box.y + box.h * 0.3, box.w * 0.92, box.h * 0.12, "condensed", "#111111");
    text(ctx, v("date"), cx, box.y + box.h * 0.4, box.w * 0.8, box.h * 0.06, "serif", "#333333");
  } else if (style === "court") {
    for (let y = 0; y < H; y += 80) {
      for (let x = (y / 80) % 2 ? -150 : 0; x < W; x += 300) {
        ctx.fillStyle = `hsl(${32 + rnd() * 8},${58 + rnd() * 12}%,${58 + rnd() * 10}%)`;
        ctx.fillRect(x, y, 298, 78);
      }
    }
    ctx.strokeStyle = "rgba(120,70,20,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(1440, 380, 330, 0, Math.PI * 2);
    ctx.stroke();
    basketball(ctx, 1440, 370, 290, "#ff9a3c", "#d9560a");
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(1440 + i * 50, 650);
      ctx.lineTo(1440 + i * 30, 740);
      ctx.stroke();
    }
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 8;
      ctx.strokeRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
      ctx.strokeStyle = "#f07a1a";
      ctx.lineWidth = 14;
      ctx.strokeRect(s.x - 16, s.y - 16, s.w + 32, s.h + 32);
    });
    text(ctx, v("kicker"), 1440, 130, 520, 50, "serif", "#1d5a2a", "#ffffff");
    text(ctx, v("big1"), 1440, 250, 540, 130, "comic", "#f07a1a", "#1d4a22");
    text(ctx, v("big2"), 1440, 400, 540, 190, "comic", "#f6e013", "#1d4a22");
    text(ctx, v("script"), 1440, 560, 440, 120, "elegant", "#f6e013", "#7a3a00");
  } else if (style === "grass") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1fa04a");
    g.addColorStop(1, "#0f7a30");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 700; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y - 14 - rnd() * 14);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    roughPath(ctx, 70, 60, W - 140, 500, 14, rnd);
    ctx.fill();
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(150, 130);
    ctx.lineTo(150, 520);
    ctx.moveTo(W - 150, 100);
    ctx.lineTo(W - 150, 470);
    ctx.moveTo(150, 130);
    ctx.lineTo(W - 400, 120);
    ctx.stroke();
    text(ctx, v("l1"), W / 2 - 20, 190, W - 360, 110, "marker", "#111111");
    text(ctx, v("l2"), W / 2 - 20, 315, W - 360, 110, "marker", "#111111");
    text(ctx, v("l3"), W / 2 - 20, 440, W - 360, 110, "marker", "#111111");
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(W - 170, 610, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    soccerBall(ctx, W - 170, 520, 80);
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 14;
      ctx.strokeRect(s.x - 7, s.y - 7, s.w + 14, s.h + 14);
    });
  } else if (style === "bigame") {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b2f6b");
    sky.addColorStop(0.45, "#102a4a");
    sky.addColorStop(1, "#1d7a34");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W;
      const y = rnd() * H * 0.45;
      const r = 10 + rnd() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rnd() > 0.5 ? "255,160,60" : "255,255,255"},0.4)`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    for (let y = 900; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    photos((s) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 10;
      ctx.strokeRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10);
      ctx.strokeStyle = "#d42a2a";
      ctx.lineWidth = 4;
      ctx.strokeRect(s.x - 14, s.y - 14, s.w + 28, s.h + 28);
    });
    crowd(ctx, rnd, 40, 1180, H - 4, "#05060c");
    ctx.textAlign = "left";
    text(ctx, v("top"), 110, 905, 600, 50, "condensed", "#ffffff", "#0a1a3a");
    const size = fitFont(ctx, v("big"), 820, 130, "condensed");
    const g = ctx.createLinearGradient(0, 960 - size / 2, 0, 960 + size / 2);
    g.addColorStop(0, "#ff6a4a");
    g.addColorStop(1, "#c4220f");
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(v("big"), 110, 990);
    ctx.fillStyle = g;
    ctx.fillText(v("big"), 110, 990);
    text(ctx, v("sub"), 110, 1085, 700, 50, "condensed", "#ffffff", "#0a1a3a");
    trophy(ctx, 1010, 1000, 200, "#d9dde6", "#7a8090");
    ctx.textAlign = "right";
    text(ctx, v("date"), W - 60, H - 50, 520, 40, "condensed", "#ffffff", "#0a1a3a");
  } else {
    // airmail
    ctx.fillStyle = "#cdb68a";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(90,60,20,${0.03 + rnd() * 0.06})`;
      ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2);
    }
    // Striped border.
    const band = 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(band, band, W - band * 2, H - band * 2);
    ctx.clip("evenodd");
    const stripe = 46;
    for (let i = -H; i < W + H; i += stripe * 2) {
      ctx.fillStyle = (i / (stripe * 2)) % 2 === 0 ? "#c4332f" : "#1f3f8a";
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + stripe, 0);
      ctx.lineTo(i + stripe - H, H);
      ctx.lineTo(i - H, H);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#cdb68a";
    ctx.fillRect(band, band, W - band * 2, H - band * 2);
    photos((s) => {
      ctx.strokeStyle = "#f6f0e2";
      ctx.lineWidth = 10;
      ctx.strokeRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10);
    });
    ctx.textAlign = "left";
    text(ctx, v("big"), 130, 925, 1100, 150, "condensed", "#1f3f8a");
    text(ctx, v("script"), 140, 1040, 600, 80, "elegant", "#6a3b1a");
    ctx.textAlign = "right";
    text(ctx, v("date"), W - 120, 925, 400, 80, "condensed", "#c4332f");
    // Postmark.
    ctx.strokeStyle = "rgba(60,40,20,0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(W - 250, 1030, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W - 250, 1030, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `bold 22px Arial, sans-serif`;
    ctx.fillStyle = "rgba(60,40,20,0.6)";
    ctx.fillText("PHYSICAL", W - 250, 1012);
    ctx.fillText("BGC 2026", W - 250, 1042);
  }
}
