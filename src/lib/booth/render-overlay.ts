import { balloon, sparkle } from "./render-event";
import { hash, seeded, type SportHelpers } from "./render-sport";
import { fitFont, goldGradient } from "./text";
import type { BoothTemplate } from "./templates";

type Values = Record<string, string>;
type Rnd = () => number;

function val(t: BoothTemplate, v: Values, key: string): string {
  return (v[key]?.trim() || t.fields?.find((f) => f.key === key)?.placeholder || "").trim();
}

function confetti(ctx: CanvasRenderingContext2D, rnd: Rnd, W: number, H: number, n: number, maxY: number) {
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(rnd() * W, rnd() * maxY);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = rnd() > 0.5 ? "#e8c15a" : "#d8dbe2";
    ctx.globalAlpha = 0.6 + rnd() * 0.4;
    ctx.fillRect(0, 0, 6 + rnd() * 10, 3 + rnd() * 6);
    ctx.restore();
  }
}

/** Gold glitter scattered along a cubic curve. */
function glitterCurve(ctx: CanvasRenderingContext2D, rnd: Rnd, p: number[], count: number, spread: number) {
  for (let i = 0; i < count; i++) {
    const t = rnd();
    const u = 1 - t;
    const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
    const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
    ctx.fillStyle = `rgba(${rnd() > 0.3 ? "240,200,100" : "255,245,210"},${0.3 + rnd() * 0.7})`;
    ctx.beginPath();
    ctx.arc(x + (rnd() - 0.5) * spread, y + (rnd() - 0.5) * spread, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function goldRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number) {
  ctx.strokeStyle = goldGradient(ctx, x, y, x + w, y + h);
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.7, y - s * 0.2, x - s * 0.35, y - s * 0.7, x, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.7, x + s * 0.7, y - s * 0.2, x, y + s * 0.35);
  ctx.closePath();
}

function glass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-s * 0.26, -s * 0.5);
  ctx.quadraticCurveTo(-s * 0.3, s * 0.06, 0, s * 0.14);
  ctx.quadraticCurveTo(s * 0.3, s * 0.06, s * 0.26, -s * 0.5);
  ctx.closePath();
  ctx.moveTo(0, s * 0.14);
  ctx.lineTo(0, s * 0.5);
  ctx.moveTo(-s * 0.2, s * 0.52);
  ctx.quadraticCurveTo(0, s * 0.44, s * 0.2, s * 0.52);
  ctx.restore();
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, blur = 24) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function neonPath(ctx: CanvasRenderingContext2D, color: string | CanvasGradient, lw: number, glow: string, draw: () => void) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 26;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  draw();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = lw * 0.28;
  draw();
  ctx.stroke();
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = r * 0.3;
  ctx.fillStyle = "#f7f7f2";
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#e8e0a0";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Single-photo party frames: the photo fills the area and a themed frame, balloons and lettering go on top. */
export function drawOverlay<S>(
  ctx: CanvasRenderingContext2D,
  t: BoothTemplate,
  shots: (S | null | undefined)[],
  h: SportHelpers<S>,
  values: Values,
) {
  const style = t.overlay?.style;
  if (!style) return;
  const W = t.width;
  const H = t.height;
  const rnd = seeded(hash(t.id));
  const slot = t.slots[0];
  const v = (k: string) => val(t, values, k);

  const neon = style === "neon-purple" || style === "neon-glow";
  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (style === "neon-purple") {
    bg.addColorStop(0, "#14041f");
    bg.addColorStop(1, "#050212");
  } else if (style === "neon-glow") {
    bg.addColorStop(0, "#0a0a10");
    bg.addColorStop(1, "#05050a");
  } else {
    bg.addColorStop(0, "#050505");
    bg.addColorStop(1, "#16130c");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (style === "neon-glow") {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    for (let p = 0; p <= W; p += 44) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, H);
      ctx.moveTo(0, p);
      ctx.lineTo(W, p);
      ctx.stroke();
    }
  }
  if (style === "neon-purple") {
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `hsla(${rnd() > 0.5 ? 320 : 210},90%,65%,${0.2 + rnd() * 0.6})`;
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H * 0.08 + (rnd() > 0.7 ? rnd() * H * 0.12 : 0), 1 + rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Photo.
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
  const cx = W / 2;
  const shade = (y0: number, y1: number, a: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
  };
  const goldText = (text: string, y: number, maxW: number, start: number, font: "elegant" | "serif" | "condensed") => {
    const size = fitFont(ctx, text, maxW, start, font);
    ctx.fillStyle = goldGradient(ctx, 0, y - size / 2, 0, y + size / 2);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 10;
    ctx.fillText(text, cx, y);
    ctx.shadowColor = "transparent";
  };

  if (style === "gold-double") {
    confetti(ctx, rnd, W, H, 110, H * 0.55);
    shade(H - 340, H, 0.75);
    ctx.save();
    ctx.translate(16, -8);
    goldRect(ctx, W * 0.05, H * 0.05, W * 0.9, H * 0.9, 6);
    ctx.restore();
    goldRect(ctx, W * 0.045, H * 0.045, W * 0.9, H * 0.91, 5);
    const kinds = ["gold", "silver", "gold", "silver", "gold", "gold"] as const;
    for (let i = 0; i < 6; i++) {
      balloon(ctx, 60 + (i % 2) * 22, H * (0.38 + i * 0.105), 56 + rnd() * 14, kinds[i], (rnd() - 0.5) * 0.4);
      balloon(ctx, W - 60 - (i % 2) * 22, H * (0.4 + i * 0.1), 56 + rnd() * 14, kinds[(i + 2) % 6], (rnd() - 0.5) * 0.4);
    }
    goldText(v("top").toUpperCase(), H - 170, W * 0.5, 54, "serif");
    goldText(v("main"), H - 100, W * 0.6, 130, "elegant");
    ctx.fillStyle = "#fff6cf";
    sparkle(ctx, cx, H - 78, 34);
  } else if (style === "gold-swoosh") {
    shade(H - 380, H, 0.7);
    goldRect(ctx, 38, 38, W - 76, H - 76, 6);
    for (const [y0, dir] of [
      [40, 1],
      [H - 40, -1],
    ] as const) {
      glitterCurve(ctx, rnd, [40, y0, W * 0.3, y0 + dir * 170, W * 0.7, y0 - dir * 60, W - 40, y0 + dir * 70], 420, 40);
      ctx.strokeStyle = goldGradient(ctx, 0, 0, W, 0);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(40, y0);
      ctx.bezierCurveTo(W * 0.3, y0 + dir * 170, W * 0.7, y0 - dir * 60, W - 40, y0 + dir * 70);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      balloon(ctx, 95 + (i % 2) * 38, H - 330 + i * 75, 58, "gold", (rnd() - 0.5) * 0.4);
      balloon(ctx, W - 95 - (i % 2) * 38, H - 330 + i * 75, 58, "gold", (rnd() - 0.5) * 0.4);
    }
    goldText(v("top").toUpperCase(), H - 200, W * 0.36, 54, "condensed");
    goldText(v("main"), H - 125, W * 0.5, 120, "elegant");
    ctx.fillStyle = "#fff6cf";
    sparkle(ctx, 70, H * 0.4, 40);
    sparkle(ctx, W - 70, H * 0.32, 44);
  } else if (style === "plaque") {
    goldRect(ctx, 46, 46, W - 92, H - 92, 12);
    goldRect(ctx, 66, 66, W - 132, H - 132, 3);
    // Streamers.
    ctx.lineCap = "round";
    for (const side of [0, 1]) {
      const x0 = side ? W - 70 : 70;
      const dir = side ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = goldGradient(ctx, 0, 0, 0, 220);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x0 + dir * k * 22, 60);
        ctx.bezierCurveTo(x0 + dir * (60 + k * 22), 120, x0 - dir * 40, 170, x0 + dir * (30 + k * 22), 240);
        ctx.stroke();
      }
    }
    confetti(ctx, rnd, W, H, 40, 260);
    balloon(ctx, 120, H - 150, 78, "gold", -0.2);
    balloon(ctx, 215, H - 100, 70, "gold", 0.2);
    balloon(ctx, 105, H - 60, 62, "gold", 0);
    balloon(ctx, W - 120, H - 150, 78, "silver", 0.2);
    balloon(ctx, W - 215, H - 100, 70, "silver", -0.2);
    const px = cx - 160;
    const py = H - 330;
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(px, py, 320, 270);
    goldRect(ctx, px, py, 320, 270, 8);
    goldText(v("l1").toUpperCase(), py + 52, 260, 54, "condensed");
    const size = fitFont(ctx, v("l2").toUpperCase(), 270, 120, "condensed");
    const sg = ctx.createLinearGradient(0, py + 135 - size / 2, 0, py + 135 + size / 2);
    sg.addColorStop(0, "#ffffff");
    sg.addColorStop(1, "#8d93a3");
    ctx.fillStyle = sg;
    ctx.fillText(v("l2").toUpperCase(), cx, py + 135);
    goldText(v("l3").toUpperCase(), py + 218, 270, 56, "condensed");
  } else if (style === "badge") {
    goldRect(ctx, 38, 38, W - 76, H - 76, 3);
    for (const [x, y, dx, dy] of [
      [38, 38, 1, 1],
      [W - 38, 38, -1, 1],
      [38, H - 38, 1, -1],
      [W - 38, H - 38, -1, -1],
    ] as const) {
      ctx.fillStyle = goldGradient(ctx, x, y, x + dx * 100, y + dy * 100);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 110, y);
      ctx.lineTo(x, y + dy * 110);
      ctx.fill();
    }
    glitterCurve(ctx, rnd, [W * 0.1, H * 0.93, W * 0.35, H * 0.55, W * 0.7, H * 0.95, W * 0.95, H * 0.62], 380, 50);
    const by = H - 230;
    ctx.fillStyle = "#0b0b0d";
    ctx.beginPath();
    ctx.arc(cx, by, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = goldGradient(ctx, cx - 150, by - 150, cx + 150, by + 150);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, by, 132, 0, Math.PI * 2);
    ctx.stroke();
    goldText(v("l1"), by - 62, 200, 76, "elegant");
    goldText(v("l2"), by + 8, 210, 76, "elegant");
    // Ribbon with the name.
    const ry = by + 80;
    ctx.fillStyle = goldGradient(ctx, cx - 230, ry, cx + 230, ry + 80);
    ctx.beginPath();
    ctx.moveTo(cx - 240, ry + 10);
    ctx.lineTo(cx - 180, ry + 10);
    ctx.lineTo(cx - 180, ry + 90);
    ctx.lineTo(cx - 240, ry + 90);
    ctx.lineTo(cx - 215, ry + 50);
    ctx.closePath();
    ctx.moveTo(cx + 240, ry + 10);
    ctx.lineTo(cx + 180, ry + 10);
    ctx.lineTo(cx + 180, ry + 90);
    ctx.lineTo(cx + 240, ry + 90);
    ctx.lineTo(cx + 215, ry + 50);
    ctx.closePath();
    ctx.moveTo(cx - 200, ry);
    ctx.quadraticCurveTo(cx, ry + 20, cx + 200, ry);
    ctx.lineTo(cx + 200, ry + 80);
    ctx.quadraticCurveTo(cx, ry + 100, cx - 200, ry + 80);
    ctx.closePath();
    ctx.fill();
    fitFont(ctx, v("name"), 300, 60, "elegant");
    ctx.fillStyle = "#17120a";
    ctx.fillText(v("name"), cx, ry + 46);
  } else if (style === "floral") {
    goldRect(ctx, 8, 8, W - 16, H - 16, 18);
    for (let i = 0; i < 700; i++) {
      const left = rnd() > 0.5;
      const y = H * (0.3 + rnd() * 0.7);
      const x = (left ? 0 : W) + (left ? 1 : -1) * rnd() * 90 * (0.3 + (y / H) * 0.9);
      ctx.fillStyle = rnd() > 0.7 ? "rgba(240,200,100,0.9)" : "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, 1 + rnd() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const left of [true, false]) {
      const bx = left ? 120 : W - 120;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = "#6f8f5d";
        ctx.beginPath();
        ctx.ellipse(bx + (rnd() - 0.5) * 190, 110 + rnd() * 110, 46, 18, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 11; i++) {
        flower(ctx, bx + (rnd() - 0.5) * 170, 100 + rnd() * 120, 30 + rnd() * 24, rnd() * Math.PI);
      }
    }
    shade(H - 260, H, 0.6);
    const size = fitFont(ctx, v("main"), W * 0.8, 150, "elegant");
    ctx.shadowColor = "rgba(255,210,120,0.95)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#fff8e0";
    ctx.fillText(v("main"), cx, H - 100);
    ctx.fillText(v("main"), cx, H - 100);
    ctx.shadowColor = "transparent";
    void size;
    ctx.fillStyle = "#fff6cf";
    sparkle(ctx, W * 0.2, H - 170, 22);
    sparkle(ctx, W * 0.82, H - 60, 26);
  } else if (style === "neon-purple") {
    const frame = ctx.createLinearGradient(slot.x, slot.y, slot.x + slot.w, slot.y + slot.h);
    frame.addColorStop(0, "#ff3df0");
    frame.addColorStop(1, "#3db8ff");
    neonPath(ctx, frame, 9, "#c23dff", () => {
      ctx.beginPath();
      ctx.rect(slot.x - 16, slot.y - 16, slot.w + 32, slot.h + 32);
    });
    neonPath(ctx, "#8a5bff", 5, "#8a5bff", () => {
      ctx.beginPath();
      ctx.rect(slot.x - 38, slot.y - 30, slot.w + 60, slot.h + 50);
    });
    neonPath(ctx, "#ff7ad9", 6, "#ff3df0", () => {
      heart(ctx, W * 0.82, H * 0.1, 90);
    });
    neonPath(ctx, "#4fd8ff", 6, "#3db8ff", () => {
      heart(ctx, W * 0.86, H * 0.13, 70);
    });
    neonPath(ctx, "#b88cff", 7, "#9a5bff", () => {
      ctx.beginPath();
      glass(ctx, W * 0.92, H * 0.78, 240, 0.28);
      glass(ctx, W * 0.84, H * 0.84, 220, -0.2);
    });
    ctx.fillStyle = "rgba(130,40,150,0.78)";
    ctx.fillRect(0, H - 190, W, 110);
    ctx.shadowColor = "#ff7ad9";
    ctx.shadowBlur = 22;
    fitFont(ctx, v("main"), W * 0.72, 92, "elegant");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(v("main"), cx - 40, H - 135);
    ctx.shadowColor = "transparent";
  } else {
    // neon-glow
    const rainbow = ctx.createLinearGradient(slot.x, slot.y, slot.x + slot.w, slot.y + slot.h);
    for (const [s, c] of [
      [0, "#ff3df0"],
      [0.33, "#3df5ff"],
      [0.66, "#a8ff3d"],
      [1, "#ffd23d"],
    ] as const)
      rainbow.addColorStop(s, c);
    neonPath(ctx, rainbow, 8, "#8a5bff", () => {
      ctx.beginPath();
      ctx.roundRect(slot.x - 14, slot.y - 14, slot.w + 28, slot.h + 28, 22);
    });
    const colors = ["#ff3df0", "#3df5ff", "#a8ff3d", "#ffd23d"];
    for (let i = 0; i < 10; i++) {
      const x = i % 2 ? W - 40 - rnd() * 30 : 40 + rnd() * 30;
      const y = 90 + i * 85;
      neonPath(ctx, colors[i % 4], 4, colors[i % 4], () => {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 === 0 ? 24 : 10;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        }
        ctx.closePath();
      });
    }
    // Disco ball.
    const dbx = W - 130;
    const dby = 120;
    const disco = ctx.createLinearGradient(dbx - 70, dby - 70, dbx + 70, dby + 70);
    disco.addColorStop(0, "#3df5ff");
    disco.addColorStop(1, "#ff3df0");
    neonPath(ctx, disco, 4, "#3df5ff", () => {
      ctx.beginPath();
      ctx.arc(dbx, dby, 62, 0, Math.PI * 2);
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(dbx - 62, dby + k * 22);
        ctx.lineTo(dbx + 62, dby + k * 22);
        ctx.moveTo(dbx + k * 22, dby - 62);
        ctx.lineTo(dbx + k * 22, dby + 62);
      }
    });
    // Glow sticks.
    for (const [x, y, rot, c] of [
      [90, H - 190, -0.5, "#a8ff3d"],
      [150, H - 160, -0.2, "#ff3df0"],
      [W - 110, H - 230, 0.5, "#3df5ff"],
    ] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      neonPath(ctx, c, 6, c, () => {
        ctx.beginPath();
        ctx.roundRect(-14, -90, 28, 180, 12);
      });
      ctx.restore();
    }
    ctx.textAlign = "left";
    const g1 = v("l1").toUpperCase();
    const gs = fitFont(ctx, g1, W * 0.5, 150, "comic");
    let gx = 150;
    [...g1].forEach((ch, i) => {
      neonText(ctx, ch, gx, H - 150, colors[i % 4], 26);
      gx += ctx.measureText(ch).width;
    });
    fitFont(ctx, v("l2"), W * 0.4, 56, "elegant");
    neonText(ctx, v("l2"), 170, H - 150 + gs * 0.55, "#3df5ff", 22);
  }
  void neon;
}
