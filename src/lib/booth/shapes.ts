/**
 * Vector photo props (mustaches, glasses, crowns, ...) drawn straight onto the canvas, so they end up in the exported JPEG.
 * Every shape is drawn in a box that is 1 tall and `aspect` wide, centred on the origin, then given a white sticker outline.
 */

type Ctx = CanvasRenderingContext2D;
type Mode = "halo" | "ink";

const HALO = 0.055;

/** Fill the current path (white + thick white stroke for the sticker outline, or the real colour). */
function paint(c: Ctx, mode: Mode, fill: string, line?: string, lw = 0.025) {
  c.lineJoin = "round";
  c.lineCap = "round";
  if (mode === "halo") {
    c.lineWidth = HALO;
    c.strokeStyle = "#ffffff";
    c.stroke();
    c.fillStyle = "#ffffff";
    c.fill();
    return;
  }
  c.fillStyle = fill;
  c.fill();
  if (line) {
    c.lineWidth = lw;
    c.strokeStyle = line;
    c.stroke();
  }
}

/** Stroke the current path as a thick line (frames, bands). */
function line(c: Ctx, mode: Mode, color: string, lw: number) {
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = mode === "halo" ? lw + HALO : lw;
  c.strokeStyle = mode === "halo" ? "#ffffff" : color;
  c.stroke();
}

function circle(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function heart(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 0.85, y - s * 0.9, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.85, y - s * 0.9, x + s * 1.25, y + s * 0.1, x, y + s * 0.9);
  c.closePath();
}

function star(c: Ctx, x: number, y: number, r: number, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5;
    c[i === 0 ? "moveTo" : "lineTo"](x + rad * Math.cos(a), y + rad * Math.sin(a));
  }
  c.closePath();
}

/** Text in a scaled space: font sizes that small are unreliable, so undo the scale around the fill. */
function label(c: Ctx, H: number, text: string, x: number, y: number, size: number, color: string, italic = false) {
  c.save();
  c.scale(1 / H, 1 / H);
  c.font = `${italic ? "italic " : ""}bold ${size * H}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(text, x * H, y * H);
  c.restore();
}

/** Run `fn` once per side, mirrored, so symmetric props only describe one half. */
function mirrored(c: Ctx, fn: () => void) {
  for (const s of [1, -1]) {
    c.save();
    c.scale(s, 1);
    fn();
    c.restore();
  }
}

type Draw = (c: Ctx, mode: Mode, H: number) => void;

function mustacheCurl(c: Ctx, mode: Mode, fill: string) {
  mirrored(c, () => {
    c.beginPath();
    c.moveTo(0, -0.16);
    c.bezierCurveTo(0.25, -0.42, 0.62, -0.3, 0.8, -0.04);
    c.bezierCurveTo(0.93, 0.2, 1.05, -0.15, 1.0, -0.46);
    c.bezierCurveTo(1.2, -0.15, 1.17, 0.34, 0.9, 0.42);
    c.bezierCurveTo(0.6, 0.54, 0.25, 0.3, 0, 0.18);
    c.closePath();
    paint(c, mode, fill);
  });
}

function glassesFrame(c: Ctx, mode: Mode, color: string) {
  // Bridge and temples.
  c.beginPath();
  c.moveTo(-0.3, -0.05);
  c.quadraticCurveTo(0, -0.22, 0.3, -0.05);
  c.moveTo(-1.02, -0.05);
  c.lineTo(-1.3, -0.12);
  c.moveTo(1.02, -0.05);
  c.lineTo(1.3, -0.12);
  line(c, mode, color, 0.06);
}

const draw: Record<string, { aspect: number; draw: Draw }> = {
  mustache: { aspect: 2.4, draw: (c, m) => mustacheCurl(c, m, "#1d1a1a") },
  mustache2: {
    aspect: 2.4,
    draw: (c, m) => {
      mirrored(c, () => {
        c.beginPath();
        c.moveTo(0, -0.18);
        c.bezierCurveTo(0.3, -0.45, 0.85, -0.35, 1.15, 0.22);
        c.bezierCurveTo(0.8, -0.02, 0.4, 0.08, 0, 0.3);
        c.closePath();
        paint(c, m, "#8a3a14");
      });
    },
  },

  "glasses-round": {
    aspect: 2.7,
    draw: (c, m) => {
      glassesFrame(c, m, "#8a2d12");
      for (const x of [-0.65, 0.65]) {
        circle(c, x, 0.05, 0.4);
        if (m === "ink") {
          c.fillStyle = "rgba(190,230,255,0.35)";
          c.fill();
        }
        line(c, m, "#8a2d12", 0.07);
      }
    },
  },
  "glasses-heart": {
    aspect: 2.7,
    draw: (c, m) => {
      glassesFrame(c, m, "#8f1d22");
      for (const x of [-0.65, 0.65]) {
        heart(c, x, 0.02, 0.42);
        paint(c, m, "#c42d36", "#7a161c", 0.04);
        if (m === "ink") {
          c.beginPath();
          c.ellipse(x - 0.2, -0.12, 0.09, 0.05, -0.6, 0, Math.PI * 2);
          c.fillStyle = "rgba(255,255,255,0.65)";
          c.fill();
        }
      }
    },
  },
  "glasses-star": {
    aspect: 2.7,
    draw: (c, m) => {
      glassesFrame(c, m, "#d98a0b");
      for (const x of [-0.65, 0.65]) {
        star(c, x, 0.04, 0.55);
        paint(c, m, "#ffc83d", "#d98a0b", 0.04);
      }
    },
  },
  shades: {
    aspect: 2.7,
    draw: (c, m) => {
      glassesFrame(c, m, "#151515");
      for (const x of [-0.62, 0.62]) {
        c.beginPath();
        c.roundRect(x - 0.46, -0.28, 0.92, 0.66, [0.08, 0.08, 0.3, 0.3]);
        paint(c, m, "#19c58f", "#151515", 0.07);
        if (m === "ink") {
          c.beginPath();
          c.moveTo(x - 0.3, -0.18);
          c.lineTo(x - 0.05, -0.18);
          c.lineTo(x - 0.28, 0.2);
          c.lineTo(x - 0.4, 0.2);
          c.closePath();
          c.fillStyle = "rgba(255,255,255,0.5)";
          c.fill();
        }
      }
    },
  },

  crown: {
    aspect: 1.5,
    draw: (c, m) => {
      c.beginPath();
      c.moveTo(-0.72, 0.42);
      c.lineTo(-0.78, -0.25);
      c.lineTo(-0.38, 0.08);
      c.lineTo(0, -0.46);
      c.lineTo(0.38, 0.08);
      c.lineTo(0.78, -0.25);
      c.lineTo(0.72, 0.42);
      c.closePath();
      paint(c, m, "#ffc83d", "#c98a0b", 0.035);
      if (m === "ink") {
        c.fillStyle = "#e0a31a";
        c.fillRect(-0.74, 0.22, 1.48, 0.2);
        for (const [x, y, col] of [
          [0, 0.02, "#e5301f"],
          [-0.4, 0.3, "#2ec27e"],
          [0.4, 0.3, "#2ec27e"],
        ] as const) {
          circle(c, x, y, 0.08);
          c.fillStyle = col;
          c.fill();
        }
        for (const [x, y] of [
          [-0.78, -0.27],
          [0, -0.48],
          [0.78, -0.27],
        ]) {
          circle(c, x, y, 0.07);
          c.fillStyle = "#fff3b0";
          c.fill();
        }
      }
    },
  },
  "party-hat": {
    aspect: 0.9,
    draw: (c, m) => {
      c.beginPath();
      c.moveTo(-0.42, 0.48);
      c.lineTo(0, -0.42);
      c.lineTo(0.42, 0.48);
      c.closePath();
      paint(c, m, "#ff5fa2", "#c2185b", 0.03);
      if (m === "ink") {
        c.save();
        c.clip();
        c.strokeStyle = "#ffe066";
        c.lineWidth = 0.1;
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.moveTo(-0.6, 0.1 + i * 0.28);
          c.lineTo(0.6, -0.2 + i * 0.28);
          c.stroke();
        }
        c.restore();
      }
      circle(c, 0, -0.42, 0.09);
      paint(c, m, "#ffe066", "#d9a406", 0.02);
    },
  },
  "top-hat": {
    aspect: 1.2,
    draw: (c, m) => {
      c.beginPath();
      c.roundRect(-0.38, -0.48, 0.76, 0.84, 0.05);
      paint(c, m, "#1b1b1d");
      c.beginPath();
      c.roundRect(-0.62, 0.28, 1.24, 0.2, 0.1);
      paint(c, m, "#1b1b1d");
      if (m === "ink") {
        c.fillStyle = "#e5301f";
        c.fillRect(-0.38, 0.1, 0.76, 0.14);
      }
    },
  },
  bowler: {
    aspect: 1.5,
    draw: (c, m) => {
      c.beginPath();
      c.moveTo(-0.45, 0.2);
      c.bezierCurveTo(-0.5, -0.55, 0.5, -0.55, 0.45, 0.2);
      c.closePath();
      paint(c, m, "#3d5aa6", "#25356b", 0.03);
      ellipse(c, 0, 0.26, 0.74, 0.17);
      paint(c, m, "#3d5aa6", "#25356b", 0.03);
      if (m === "ink") {
        c.fillStyle = "#16203d";
        c.fillRect(-0.45, 0.04, 0.9, 0.1);
      }
    },
  },
  lips: {
    aspect: 1.7,
    draw: (c, m) => {
      mirrored(c, () => {
        c.beginPath();
        c.moveTo(0, -0.18);
        c.bezierCurveTo(0.16, -0.5, 0.5, -0.38, 0.8, 0.02);
        c.bezierCurveTo(0.55, 0.5, 0.2, 0.52, 0, 0.5);
        c.closePath();
        paint(c, m, "#d81f2b", "#8f1019", 0.03);
      });
      if (m === "ink") {
        c.beginPath();
        c.moveTo(-0.8, 0.02);
        c.quadraticCurveTo(-0.3, 0.12, 0, 0.04);
        c.quadraticCurveTo(0.3, 0.12, 0.8, 0.02);
        c.lineWidth = 0.035;
        c.strokeStyle = "#8f1019";
        c.stroke();
        ellipse(c, 0.18, 0.3, 0.16, 0.05, -0.15);
        c.fillStyle = "rgba(255,255,255,0.45)";
        c.fill();
      }
    },
  },
  bunny: {
    aspect: 1.5,
    draw: (c, m) => {
      for (const s of [-1, 1]) {
        ellipse(c, s * 0.38, -0.1, 0.17, 0.42, s * 0.18);
        paint(c, m, "#ffffff", "#c9c9d1", 0.03);
        if (m === "ink") {
          ellipse(c, s * 0.38, -0.08, 0.08, 0.3, s * 0.18);
          c.fillStyle = "#ffb3cf";
          c.fill();
        }
      }
      c.beginPath();
      c.arc(0, 0.62, 0.72, Math.PI * 1.17, Math.PI * 1.83);
      line(c, m, "#ff8fb8", 0.08);
    },
  },
  "bow-tie": {
    aspect: 1.6,
    draw: (c, m) => {
      mirrored(c, () => {
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0.78, -0.42);
        c.quadraticCurveTo(0.9, 0, 0.78, 0.42);
        c.closePath();
        paint(c, m, "#e5301f", "#9c1a0e", 0.03);
        if (m === "ink") {
          c.fillStyle = "rgba(255,255,255,0.8)";
          for (const [x, y] of [
            [0.4, -0.08],
            [0.55, 0.14],
            [0.62, -0.17],
            [0.3, 0.14],
          ]) {
            circle(c, x, y, 0.035);
            c.fill();
          }
        }
      });
      c.beginPath();
      c.roundRect(-0.14, -0.17, 0.28, 0.34, 0.06);
      paint(c, m, "#b3200f", "#7a1409", 0.03);
    },
  },

  halo: {
    aspect: 2,
    draw: (c, m) => {
      ellipse(c, 0, 0, 0.8, 0.2);
      line(c, m, "#f2b705", 0.12);
      if (m === "ink") {
        ellipse(c, 0, -0.02, 0.8, 0.2);
        c.lineWidth = 0.04;
        c.strokeStyle = "#ffe58a";
        c.stroke();
      }
    },
  },
  fish: {
    aspect: 1.9,
    draw: (c, m) => {
      c.beginPath();
      c.moveTo(-0.85, 0);
      c.quadraticCurveTo(-0.1, -0.85, 0.5, 0);
      c.lineTo(0.9, -0.34);
      c.lineTo(0.9, 0.34);
      c.lineTo(0.5, 0);
      c.quadraticCurveTo(-0.1, 0.85, -0.85, 0);
      c.closePath();
      paint(c, m, "#2e7d4f", "#1c5233", 0.03);
      if (m === "ink") {
        c.fillStyle = "#ffffff";
        c.fillRect(-0.12, -0.2, 0.08, 0.4);
        c.fillRect(-0.28, -0.09, 0.4, 0.08);
        circle(c, -0.55, -0.06, 0.05);
        c.fill();
      }
    },
  },
  cross: {
    aspect: 0.75,
    draw: (c, m) => {
      c.beginPath();
      c.moveTo(-0.11, -0.48);
      c.lineTo(0.11, -0.48);
      c.lineTo(0.11, -0.22);
      c.lineTo(0.34, -0.22);
      c.lineTo(0.34, 0);
      c.lineTo(0.11, 0);
      c.lineTo(0.11, 0.48);
      c.lineTo(-0.11, 0.48);
      c.lineTo(-0.11, 0);
      c.lineTo(-0.34, 0);
      c.lineTo(-0.34, -0.22);
      c.lineTo(-0.11, -0.22);
      c.closePath();
      paint(c, m, "#c48a3a", "#7a4f14", 0.03);
      if (m === "ink") {
        c.beginPath();
        c.moveTo(-0.03, -0.4);
        c.lineTo(-0.03, 0.4);
        c.lineWidth = 0.02;
        c.strokeStyle = "rgba(90,50,10,0.45)";
        c.stroke();
      }
    },
  },

  "foam-finger": {
    aspect: 0.95,
    draw: (c, m, H) => {
      // Index finger, palm and thumb as overlapping rounded rectangles in one colour.
      const parts: [number, number, number, number, number][] = [
        [-0.14, -0.5, 0.28, 0.6, 0.14],
        [-0.38, -0.08, 0.76, 0.58, 0.14],
        [-0.55, 0.0, 0.26, 0.3, 0.12],
      ];
      for (const [x, y, w, h, r] of parts) {
        c.beginPath();
        c.roundRect(x, y, w, h, r);
        paint(c, m, "#17a2c9");
      }
      if (m === "ink") {
        c.beginPath();
        c.roundRect(-0.38, 0.4, 0.76, 0.12, 0.05);
        c.fillStyle = "#0f7896";
        c.fill();
        label(c, H, "#1", 0, 0.2, 0.26, "#ffffff");
      }
    },
  },
  pennant: {
    aspect: 2.2,
    draw: (c, m, H) => {
      c.beginPath();
      c.moveTo(-1.0, -0.42);
      c.lineTo(1.05, 0);
      c.lineTo(-1.0, 0.42);
      c.closePath();
      paint(c, m, "#1f56c4", "#12338a", 0.03);
      if (m === "ink") label(c, H, "MVP", -0.25, 0, 0.3, "#ffffff", true);
    },
  },
  popcorn: {
    aspect: 0.95,
    draw: (c, m) => {
      for (const [x, y, r] of [
        [-0.28, -0.22, 0.17],
        [-0.08, -0.36, 0.18],
        [0.14, -0.34, 0.18],
        [0.3, -0.2, 0.16],
        [0, -0.18, 0.2],
      ]) {
        circle(c, x, y, r);
        paint(c, m, "#fff2c2", "#e0b85a", 0.025);
      }
      c.beginPath();
      c.moveTo(-0.42, -0.1);
      c.lineTo(0.42, -0.1);
      c.lineTo(0.33, 0.5);
      c.lineTo(-0.33, 0.5);
      c.closePath();
      paint(c, m, "#ffffff", "#c4220f", 0.03);
      if (m === "ink") {
        c.save();
        c.clip();
        c.fillStyle = "#e5301f";
        for (let i = -3; i <= 3; i += 2) c.fillRect(i * 0.12 - 0.06, -0.12, 0.12, 0.65);
        c.restore();
      }
    },
  },

  heart: {
    aspect: 1.1,
    draw: (c, m) => {
      heart(c, 0, 0.02, 0.5);
      paint(c, m, "#e5304a", "#9c1a2e", 0.03);
      if (m === "ink") {
        ellipse(c, -0.25, -0.18, 0.1, 0.06, -0.7);
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.fill();
      }
    },
  },
  star: {
    aspect: 1.05,
    draw: (c, m) => {
      star(c, 0, 0.03, 0.55);
      paint(c, m, "#ffc83d", "#d98a0b", 0.035);
    },
  },
};

export const SHAPE_IDS = Object.keys(draw);

export function shapeAspect(id: string): number {
  return draw[id]?.aspect ?? 1;
}

/** Draw a shape centred on the origin, `h` pixels tall. */
export function drawShape(ctx: Ctx, id: string, h: number) {
  const d = draw[id];
  if (!d) return;
  for (const mode of ["halo", "ink"] as const) {
    ctx.save();
    ctx.scale(h, h);
    d.draw(ctx, mode, h);
    ctx.restore();
  }
}
