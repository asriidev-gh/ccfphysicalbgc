import { drawShape, shapeAspect } from "./shapes";

/** Photobooth stickers: drawn on the canvas (emoji, lettering, badges, props and speech bubbles), so they end up inside the exported JPEG. */

export type StickerFont = "slab" | "script" | "marker" | "comic" | "lobster" | "elegant" | "condensed" | "serif";

export interface Sticker {
  id: string;
  /**
   * emoji: one glyph. badge: text on a coloured pill. text: outlined lettering with no background.
   * shape: a vector prop, `text` is its id (see shapes.ts). bubble: speech bubble with `text` inside.
   */
  kind: "emoji" | "badge" | "text" | "shape" | "bubble";
  /** Use \n for a second line. */
  text: string;
  font?: StickerFont;
  /** Badge or bubble fill, or the lettering colour for kind "text". */
  color?: string;
  /** Badge or bubble text colour, or the lettering outline colour for kind "text". */
  ink?: string;
  /** Centre, in pixels of the template. */
  x: number;
  y: number;
  /** Base size in template pixels. */
  size: number;
  /** Rotation in radians. */
  rot: number;
}

export type StickerGroup = "faith" | "sport" | "fun";
export type StickerDef = Pick<Sticker, "kind" | "text" | "font" | "color" | "ink"> & { group: StickerGroup };

const faith = (def: Omit<StickerDef, "group">): StickerDef => ({ ...def, group: "faith" });
const sport = (def: Omit<StickerDef, "group">): StickerDef => ({ ...def, group: "sport" });
const fun = (def: Omit<StickerDef, "group">): StickerDef => ({ ...def, group: "fun" });

type Maker = (def: Omit<StickerDef, "group">) => StickerDef;
const word = (make: Maker, text: string, font: StickerFont, color: string, ink: string): StickerDef =>
  make({ kind: "text", text, font, color, ink });
const bubble = (make: Maker, text: string, color: string, ink: string, font: StickerFont = "marker"): StickerDef =>
  make({ kind: "bubble", text, font, color, ink });
const prop = (make: Maker, id: string): StickerDef => make({ kind: "shape", text: id });

export const STICKER_CATALOG: StickerDef[] = [
  faith({ kind: "text", text: "I ❤️ Jesus", font: "script", color: "#ffffff", ink: "#e5301f" }),
  faith({ kind: "text", text: "JESUS\nIS LORD", font: "marker", color: "#ffd23f", ink: "#1b1b1d" }),
  faith({ kind: "text", text: "Jesus Loves You", font: "script", color: "#ffffff", ink: "#c4220f" }),
  faith({ kind: "text", text: "God is Good", font: "lobster", color: "#ffffff", ink: "#0e7a92" }),
  faith({ kind: "text", text: "Blessed", font: "script", color: "#ffe9b8", ink: "#b3541e" }),
  faith({ kind: "text", text: "FAITH\nOVER FEAR", font: "comic", color: "#ffffff", ink: "#111111" }),
  faith({ kind: "text", text: "TEAM JESUS", font: "comic", color: "#ffd23f", ink: "#111111" }),
  faith({ kind: "text", text: "RUN THE\nRACE", font: "marker", color: "#ffffff", ink: "#e5301f" }),
  faith({ kind: "text", text: "Glory to God", font: "lobster", color: "#fff3d6", ink: "#7a2e0a" }),
  faith({ kind: "badge", text: "PHIL 4:13 💪", font: "slab", color: "#ffffff", ink: "#111111" }),
  faith({ kind: "badge", text: "HEBREWS 12:1", font: "slab", color: "#f08a3c", ink: "#111111" }),
  faith({ kind: "badge", text: "STRONG IN THE LORD", font: "slab", color: "#34c77b", ink: "#111111" }),
  faith({ kind: "badge", text: "FAITH • FAMILY • FITNESS", font: "slab", color: "#e5301f", ink: "#ffffff" }),
  faith({ kind: "badge", text: "CCF FAMILY", font: "slab", color: "#f2b134", ink: "#111111" }),
  ...["✝️", "🙏", "🕊️", "📖", "⛪", "😇", "❤️", "🙌"].map((text): StickerDef => faith({ kind: "emoji", text })),
  prop(faith, "halo"),
  prop(faith, "fish"),
  prop(faith, "cross"),
  bubble(faith, "LOVE LIKE\nJESUS", "#6a2db0", "#ffd23f", "comic"),
  bubble(faith, "I AM A\nCHILD OF GOD", "#ff3fa0", "#fff7a8", "comic"),
  bubble(faith, "FAITH, HOPE\n& LOVE", "#bfe9ff", "#e8611a", "comic"),
  bubble(faith, "SAVED BY\nHIS GRACE", "#e5301f", "#ffffff", "comic"),
  bubble(faith, "PRAY MORE,\nWORRY LESS", "#e9f9e1", "#1f4f8a"),
  bubble(faith, "GOD IS GOOD!", "#ffd23f", "#d6336c", "comic"),
  bubble(faith, "GOD'S PLAN", "#ffffff", "#243b9a", "comic"),
  bubble(faith, "JESUS IS\nLORD!", "#151517", "#ffffff"),
  bubble(faith, "THANKS BE\nTO GOD!", "#151517", "#ffffff"),
  word(faith, "SPEAK\nLIFE", "condensed", "#ffd23f", "#1b1b1d"),
  word(faith, "NEW\nCREATION", "comic", "#ffffff", "#111111"),
  word(faith, "FOR HIS\nGLORY", "comic", "#ffd23f", "#111111"),
  word(faith, "HOPE\nIN HIM", "condensed", "#ffffff", "#b3541e"),
  word(faith, "Filled\nwith Joy", "lobster", "#ffe9b8", "#8a5a00"),
  word(faith, "FAITH OVER\nNOISE", "comic", "#8ee0ff", "#0b2a52"),
  word(faith, "GRACE\nOVER GRIND", "condensed", "#ffffff", "#6a1bb1"),
  word(faith, "Calm in\nChrist", "lobster", "#bff5d9", "#0b5a45"),
  word(faith, "GOD IS\nIN CHARGE", "comic", "#8ee0ff", "#0b2a52"),
  word(faith, "Faith Still\nWorks", "lobster", "#ffb3d6", "#6b0f3a"),
  word(faith, "GOD DID!", "comic", "#aee3ff", "#111111"),
  word(faith, "Feeling\nBlessed", "script", "#ffffff", "#111111"),
  word(faith, "PRAY MORE\nWorry Less", "comic", "#ffffff", "#111111"),
  word(faith, "Holy Spirit\nACTIVATE", "script", "#ffd23f", "#111111"),
  word(faith, "Won't He\nDO IT", "lobster", "#ffd0c7", "#111111"),
  word(faith, "Too Blessed\nto be Stressed", "script", "#f3c969", "#111111"),
  word(faith, "Prayer\nChanges Things", "lobster", "#ffe08a", "#111111"),
  word(faith, "Faith Can Move\nMountains", "script", "#ffffff", "#111111"),
  word(faith, "His Grace\nis Enough", "lobster", "#ffffff", "#b3891f"),
  word(faith, "Created with\nA Purpose", "script", "#bfe3ff", "#111111"),
  word(faith, "Try Jesus\nNot Me!", "script", "#ffffff", "#111111"),
  word(faith, "I Vibe Heavy\nwith God", "lobster", "#f3c969", "#111111"),
  word(faith, "Pray &\nSlay", "script", "#ff4f9a", "#ffffff"),
  word(faith, "Faith Hope\nLove", "lobster", "#ffb3d6", "#111111"),
  word(faith, "Keep the\nFAITH", "lobster", "#ffffff", "#c4220f"),
  word(faith, "AMEN", "comic", "#ffd23f", "#7a2e0a"),
  word(faith, "HALLELUJAH", "comic", "#ffffff", "#6a1bb1"),

  sport({ kind: "badge", text: "CCF BGC SPORTS", font: "slab", color: "#e5301f", ink: "#ffffff" }),
  sport({ kind: "badge", text: "2ND YEAR!", font: "slab", color: "#f08a3c", ink: "#111111" }),
  sport({ kind: "badge", text: "PHYSICAL BGC", font: "slab", color: "#ffffff", ink: "#111111" }),
  sport({ kind: "badge", text: "MVP", font: "slab", color: "#f2b134", ink: "#111111" }),
  sport({ kind: "badge", text: "CHAMP", font: "slab", color: "#e5301f", ink: "#ffffff" }),
  sport({ kind: "badge", text: "SQUAD GOALS", font: "slab", color: "#34c77b", ink: "#111111" }),
  sport({ kind: "text", text: "GAME ON!", font: "comic", color: "#ffd23f", ink: "#111111" }),
  sport({ kind: "text", text: "Let's Go!", font: "script", color: "#ffffff", ink: "#e5301f" }),
  prop(sport, "foam-finger"),
  prop(sport, "pennant"),
  prop(sport, "popcorn"),
  bubble(sport, "GO, FIGHT,\nWIN!", "#151517", "#ffffff"),
  bubble(sport, "ALL I DO\nIS BALL", "#1f56c4", "#ffffff", "comic"),
  bubble(sport, "GAME DAY!", "#e5301f", "#ffffff", "comic"),
  bubble(sport, "WE'RE #1!", "#17a2c9", "#ffffff", "comic"),
  bubble(sport, "MVP!", "#ffd23f", "#111111", "comic"),
  ...["🏆", "🥇", "🔥", "💪", "⭐", "🎉", "👑", "😎", "⚡", "🏃", "🏀", "⚽", "🏸", "🏓", "🏋️"].map((text): StickerDef =>
    sport({ kind: "emoji", text }),
  ),

  ...[
    "mustache",
    "mustache2",
    "glasses-round",
    "glasses-heart",
    "glasses-star",
    "shades",
    "crown",
    "party-hat",
    "top-hat",
    "bowler",
    "lips",
    "bunny",
    "bow-tie",
    "heart",
    "star",
  ].map((id) => prop(fun, id)),
  bubble(fun, "#SELFIE", "#151517", "#ffffff"),
  bubble(fun, "CHEERS!", "#151517", "#ffffff"),
  bubble(fun, "DANCING\nQUEEN", "#151517", "#ffffff"),
  bubble(fun, "THANK YOU!", "#151517", "#ffffff"),
  bubble(fun, "I CAME FOR\nTHE CAKE!", "#151517", "#ffffff"),
  bubble(fun, "OMG!", "#ffd23f", "#111111", "comic"),
  bubble(fun, "SQUAD", "#a53a12", "#ffffff", "comic"),
  bubble(fun, "BEST DAY\nEVER!", "#f59f0b", "#ffffff", "comic"),
  word(fun, "Photo\nBooth", "script", "#ff4f2e", "#111111"),
  ...["🎈", "🎂", "🥳", "🎊", "🤩", "😂", "🍕", "📸"].map((text): StickerDef => fun({ kind: "emoji", text })),
];

const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

/** Fallbacks used until the page registers its web fonts (and when they fail to load). */
const FAMILIES: Record<StickerFont, string> = {
  slab: `"Arial Narrow", Impact, "Helvetica Neue", Arial, sans-serif`,
  script: `"Brush Script MT", "Segoe Script", cursive`,
  marker: `"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive`,
  comic: `Impact, "Arial Black", sans-serif`,
  lobster: `"Brush Script MT", "Segoe Script", cursive`,
  elegant: `"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive`,
  condensed: `Impact, "Arial Narrow", "Helvetica Neue", sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
};
const WEIGHTS: Record<StickerFont, string> = {
  slab: "bold",
  script: "normal",
  marker: "normal",
  comic: "normal",
  lobster: "normal",
  elegant: "normal",
  condensed: "normal",
  serif: "bold",
};
const registered: Partial<Record<StickerFont, string>> = {};

/** Web-font family names from next/font; they are tried before the system fallbacks. */
export function registerStickerFonts(fonts: Partial<Record<StickerFont, string>>) {
  Object.assign(registered, fonts);
}

/** Resolves once every registered web font has loaded (or failed, which is fine: fallbacks are used). */
export async function loadStickerFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(Object.values(registered).map((f) => document.fonts.load(`40px ${f}`, "Aa").catch(() => undefined)));
}

export function stickerFontCss(font: StickerFont | undefined, px: number): string {
  const f = font ?? "slab";
  const family = registered[f] ? `${registered[f]}, ${FAMILIES[f]}` : FAMILIES[f];
  return `${WEIGHTS[f]} ${px}px ${family}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

function textMetrics(s: Sticker, px: number) {
  const lines = s.text.split("\n");
  const ctx = measure();
  let w = Math.max(...lines.map((l) => l.length)) * px * 0.55;
  if (ctx) {
    ctx.font = stickerFontCss(s.font, px);
    w = Math.max(...lines.map((l) => ctx.measureText(l).width));
  }
  return { lines, w, lineH: px * 1.15 };
}

/** Full width and height of a sticker's (unrotated) box. */
export function stickerBox(s: Sticker): { w: number; h: number } {
  if (s.kind === "emoji") return { w: s.size * 1.2, h: s.size * 1.2 };
  if (s.kind === "shape") return { w: s.size * 1.1 * shapeAspect(s.text), h: s.size * 1.1 };
  if (s.kind === "bubble") {
    const m = textMetrics(s, s.size * 0.36);
    const body = m.lines.length * m.lineH + s.size * 0.3;
    return { w: m.w + s.size * 0.55, h: body * 1.28 };
  }
  if (s.kind === "text") {
    const m = textMetrics(s, s.size * 0.6);
    return { w: m.w + s.size * 0.3, h: m.lines.length * m.lineH + s.size * 0.15 };
  }
  const m = textMetrics(s, s.size * 0.5);
  return { w: m.w + s.size * 0.5, h: s.size * 0.8 };
}

/** True when the point (template pixels) lies on the sticker, accounting for its rotation. */
export function hitSticker(s: Sticker, px: number, py: number): boolean {
  const { w, h } = stickerBox(s);
  const dx = px - s.x;
  const dy = py - s.y;
  const cos = Math.cos(-s.rot);
  const sin = Math.sin(-s.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}

export type StickerHandle = "delete" | "rotate" | "resize";

/** Line width and handle size scale with the canvas so they stay finger-sized when it is shown small. */
export const stickerUnit = (canvasWidth: number) => Math.max(2, canvasWidth * 0.003);
const handleRadius = (unit: number) => unit * 15;

/** Corner handles of the selection box (template pixels): delete top-left, rotate top-right, resize bottom-right. */
function handlePoints(s: Sticker, unit: number): Record<StickerHandle, { x: number; y: number }> {
  const { w, h } = stickerBox(s);
  const hw = w / 2 + unit * 2;
  const hh = h / 2 + unit * 2;
  const cos = Math.cos(s.rot);
  const sin = Math.sin(s.rot);
  const at = (lx: number, ly: number) => ({ x: s.x + lx * cos - ly * sin, y: s.y + lx * sin + ly * cos });
  return { delete: at(-hw, -hh), rotate: at(hw, -hh), resize: at(hw, hh) };
}

export function hitHandle(s: Sticker, px: number, py: number, unit: number): StickerHandle | null {
  const pts = handlePoints(s, unit);
  const reach = handleRadius(unit) * 1.5;
  for (const k of ["delete", "rotate", "resize"] as const) {
    if (Math.hypot(px - pts[k].x, py - pts[k].y) <= reach) return k;
  }
  return null;
}

function drawHandles(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const r = handleRadius(unit);
  const hw = w / 2 + unit * 2;
  const hh = h / 2 + unit * 2;
  const disc = (x: number, y: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = unit;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = unit * 1.8;
  ctx.strokeStyle = "#ffffff";
  const k = r * 0.42;

  disc(-hw, -hh, "#e5301f");
  ctx.beginPath();
  ctx.moveTo(-hw - k, -hh - k);
  ctx.lineTo(-hw + k, -hh + k);
  ctx.moveTo(-hw + k, -hh - k);
  ctx.lineTo(-hw - k, -hh + k);
  ctx.stroke();

  disc(hw, -hh, "#2b6bff");
  ctx.beginPath();
  ctx.arc(hw, -hh, k * 1.15, -Math.PI * 0.15, Math.PI * 1.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hw + k * 1.15 * Math.cos(-Math.PI * 0.15) + k * 0.1, -hh + k * 1.15 * Math.sin(-Math.PI * 0.15) - k * 0.9);
  ctx.lineTo(hw + k * 1.15 * Math.cos(-Math.PI * 0.15), -hh + k * 1.15 * Math.sin(-Math.PI * 0.15));
  ctx.lineTo(hw + k * 1.15 * Math.cos(-Math.PI * 0.15) + k * 0.95, -hh + k * 1.15 * Math.sin(-Math.PI * 0.15) + k * 0.1);
  ctx.stroke();

  disc(hw, hh, "#1f9d55");
  ctx.beginPath();
  ctx.moveTo(hw - k, hh - k);
  ctx.lineTo(hw + k, hh + k);
  ctx.moveTo(hw + k, hh + k * 0.1);
  ctx.lineTo(hw + k, hh + k);
  ctx.lineTo(hw + k * 0.1, hh + k);
  ctx.moveTo(hw - k, hh - k * 0.1);
  ctx.lineTo(hw - k, hh - k);
  ctx.lineTo(hw - k * 0.1, hh - k);
  ctx.stroke();
}

/** Speech bubble with a stitched inner line and a tail at the bottom left. */
function drawBubble(ctx: CanvasRenderingContext2D, s: Sticker, w: number, h: number) {
  const px = s.size * 0.36;
  const m = textMetrics(s, px);
  const bodyH = h / 1.28;
  const top = -h / 2;
  const left = -w / 2;
  const r = bodyH * 0.42;
  const halo = s.size * 0.07;
  const tail = (): void => {
    ctx.beginPath();
    ctx.moveTo(left + w * 0.14, top + bodyH - r * 0.3);
    ctx.lineTo(left + w * 0.1, top + h);
    ctx.lineTo(left + w * 0.34, top + bodyH - r * 0.3);
    ctx.closePath();
  };
  const body = (): void => {
    ctx.beginPath();
    ctx.roundRect(left, top, w, bodyH, r);
  };
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = s.size * 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = halo * 2;
  for (const draw of [body, tail]) {
    draw();
    ctx.stroke();
    ctx.fill();
  }
  ctx.shadowColor = "transparent";
  ctx.fillStyle = s.color ?? "#151517";
  for (const draw of [body, tail]) {
    draw();
    ctx.fill();
  }
  const inset = s.size * 0.06;
  ctx.beginPath();
  ctx.roundRect(left + inset, top + inset, w - inset * 2, bodyH - inset * 2, Math.max(2, r - inset));
  ctx.setLineDash([s.size * 0.05, s.size * 0.04]);
  ctx.lineWidth = Math.max(1.5, s.size * 0.012);
  ctx.strokeStyle = s.ink ?? "#ffffff";
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = s.ink ?? "#ffffff";
  ctx.font = stickerFontCss(s.font ?? "marker", px);
  m.lines.forEach((line, i) => ctx.fillText(line, 0, top + bodyH / 2 + (i - (m.lines.length - 1) / 2) * m.lineH + px * 0.04));
}

export function drawSticker(ctx: CanvasRenderingContext2D, s: Sticker, selected: boolean, unit: number) {
  const { w, h } = stickerBox(s);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (s.kind === "emoji") {
    ctx.font = `${s.size}px ${EMOJI_FONT}`;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = s.size * 0.08;
    ctx.fillText(s.text, 0, s.size * 0.04);
  } else if (s.kind === "shape") {
    drawShape(ctx, s.text, h);
  } else if (s.kind === "bubble") {
    drawBubble(ctx, s, w, h);
  } else if (s.kind === "text") {
    const px = s.size * 0.6;
    const m = textMetrics(s, px);
    ctx.font = stickerFontCss(s.font, px);
    ctx.lineJoin = "round";
    ctx.lineWidth = px * 0.16;
    ctx.strokeStyle = s.ink ?? "#111111";
    ctx.fillStyle = s.color ?? "#ffffff";
    m.lines.forEach((line, i) => {
      const y = (i - (m.lines.length - 1) / 2) * m.lineH;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = px * 0.12;
      ctx.shadowOffsetY = px * 0.05;
      ctx.strokeText(line, 0, y);
      ctx.shadowColor = "transparent";
      ctx.fillText(line, 0, y);
    });
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = s.size * 0.1;
    ctx.fillStyle = s.color ?? "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.3);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(2, s.size * 0.04);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = s.ink ?? "#111111";
    ctx.font = stickerFontCss(s.font, s.size * 0.5);
    ctx.fillText(s.text, 0, s.size * 0.03);
  }
  if (selected) {
    ctx.shadowColor = "transparent";
    ctx.setLineDash([unit * 2, unit * 1.5]);
    ctx.lineWidth = unit;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(-w / 2 - unit * 2, -h / 2 - unit * 2, w + unit * 4, h + unit * 4);
    ctx.setLineDash([]);
    drawHandles(ctx, w, h, unit);
  }
  ctx.restore();
}

/** A new sticker near the middle of a template-sized canvas, with a little random scatter and tilt. */
export function newSticker(def: StickerDef, width: number, height: number): Sticker {
  const { group: _group, ...rest } = def;
  void _group;
  return {
    ...rest,
    id: Math.random().toString(36).slice(2),
    x: width / 2 + (Math.random() - 0.5) * width * 0.3,
    y: height / 2 + (Math.random() - 0.5) * height * 0.3,
    size: Math.min(width, height) * (def.kind === "text" || def.kind === "bubble" ? 0.2 : 0.16),
    rot: (Math.random() - 0.5) * 0.4,
  };
}
