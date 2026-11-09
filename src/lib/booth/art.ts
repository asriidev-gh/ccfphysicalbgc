/** Small vector illustrations (balls, trophy, helmet...) shared by the sport-themed templates. */

type Ctx = CanvasRenderingContext2D;

export function basketball(ctx: Ctx, x: number, y: number, r: number, c1 = "#ffa04a", c2 = "#c4560e") {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "#1c0d05";
  ctx.lineWidth = Math.max(3, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * r * 1.45, y, r * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function soccerBall(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#cfd3da");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#15151a";
  ctx.strokeStyle = "#15151a";
  ctx.lineWidth = Math.max(2, r * 0.03);
  const poly = (cx: number, cy: number, pr: number, rot: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5;
      ctx.lineTo(cx + pr * Math.cos(a), cy + pr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  };
  poly(x, y, r * 0.32, -Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32);
    ctx.lineTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
    ctx.stroke();
    poly(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, r * 0.3, a + Math.PI / 2);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(2, r * 0.03);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function football(ctx: Ctx, x: number, y: number, w: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const h = w * 0.55;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#b4622c");
  g.addColorStop(1, "#6d3412");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, w * 0.025);
  for (const sx of [-0.33, 0.33]) {
    ctx.beginPath();
    ctx.ellipse(sx * w, 0, w * 0.04, h * 0.42, 0, -Math.PI / 2, Math.PI / 2, sx < 0);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-w * 0.16, 0);
  ctx.lineTo(w * 0.16, 0);
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(i * w * 0.07, -h * 0.1);
    ctx.lineTo(i * w * 0.07, h * 0.1);
  }
  ctx.stroke();
  ctx.restore();
}

export function volleyball(ctx: Ctx, x: number, y: number, r: number, c1: string, c2: string) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = Math.max(3, r * 0.05);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, r * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function star5(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

export function trophy(ctx: Ctx, x: number, y: number, s: number, fill = "#f2c200", edge = "#9a7600") {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(3, s * 0.03);
  ctx.lineJoin = "round";
  // Handles.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.3, -s * 0.42);
    ctx.bezierCurveTo(side * s * 0.62, -s * 0.5, side * s * 0.6, -s * 0.05, side * s * 0.2, -s * 0.05);
    ctx.lineWidth = s * 0.07;
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(3, s * 0.03);
  // Cup.
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.5);
  ctx.lineTo(s * 0.32, -s * 0.5);
  ctx.bezierCurveTo(s * 0.32, -s * 0.05, s * 0.12, s * 0.02, s * 0.06, s * 0.1);
  ctx.lineTo(-s * 0.06, s * 0.1);
  ctx.bezierCurveTo(-s * 0.12, s * 0.02, -s * 0.32, -s * 0.05, -s * 0.32, -s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-s * 0.05, s * 0.1, s * 0.1, s * 0.2);
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, s * 0.5);
  ctx.lineTo(-s * 0.14, s * 0.3);
  ctx.lineTo(s * 0.14, s * 0.3);
  ctx.lineTo(s * 0.2, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function helmet(ctx: Ctx, x: number, y: number, s: number, color: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(3, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.1);
  ctx.bezierCurveTo(-s * 0.55, -s * 0.5, s * 0.2, -s * 0.6, s * 0.42, -s * 0.1);
  ctx.lineTo(s * 0.5, s * 0.25);
  ctx.lineTo(s * 0.2, s * 0.3);
  ctx.lineTo(s * 0.1, s * 0.12);
  ctx.lineTo(-s * 0.1, s * 0.4);
  ctx.lineTo(-s * 0.4, s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#e8e8ee";
  ctx.lineWidth = s * 0.04;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * (0.06 + i * 0.07));
    ctx.lineTo(s * 0.1, s * (0.12 + i * 0.07));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.2, s * 0.1, s * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ring of black and white squares just outside the rectangle, like a racing flag. */
export function checkerRing(ctx: Ctx, x: number, y: number, w: number, h: number, size: number) {
  const nx = Math.ceil(w / size) + 2;
  const ny = Math.ceil(h / size) + 2;
  const draw = (cx: number, cy: number, i: number) => {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#111111";
    ctx.fillRect(cx, cy, size, size);
  };
  for (let i = 0; i < nx; i++) {
    draw(x - size + i * size, y - size, i);
    draw(x - size + i * size, y + h, i + 1);
  }
  for (let j = 1; j < ny - 1; j++) {
    draw(x - size, y - size + j * size, j);
    draw(x + w, y - size + j * size, j + 1);
  }
}

/** Torn, brush-stroke rectangle. */
export function roughPath(ctx: Ctx, x: number, y: number, w: number, h: number, jitter: number, rnd: () => number) {
  const j = () => (rnd() - 0.5) * 2 * jitter;
  const step = 30;
  const pts: [number, number][] = [];
  for (let px = x; px < x + w; px += step) pts.push([px, y + j()]);
  for (let py = y; py < y + h; py += step) pts.push([x + w + j(), py]);
  for (let px = x + w; px > x; px -= step) pts.push([px, y + h + j()]);
  for (let py = y + h; py > y; py -= step) pts.push([x + j(), py]);
  ctx.beginPath();
  pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.closePath();
}

/** Black ink blots and droplets. */
export function inkSplats(ctx: Ctx, rnd: () => number, cx: number, cy: number, spread: number, count: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * spread;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 3 + rnd() * (i % 6 === 0 ? 34 : 12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 14) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * r * 3, y + (rnd() - 0.5) * r * 3, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** A crowd silhouette along a baseline: heads and raised arms. */
export function crowd(ctx: Ctx, rnd: () => number, x0: number, x1: number, base: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let x = x0; x < x1; x += 26 + rnd() * 16) {
    const hgt = 40 + rnd() * 50;
    ctx.beginPath();
    ctx.arc(x, base - hgt, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 17, base - hgt + 12, 34, hgt + 40);
    if (rnd() > 0.55) {
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x + 14, base - hgt + 22);
      ctx.lineTo(x + 30, base - hgt - 22 - rnd() * 18);
      ctx.stroke();
    }
  }
}
