/** Photobooth stickers: drawn on the canvas (emoji, lettering and badges), so they end up inside the exported JPEG. */

export type StickerFont = "slab" | "script" | "marker" | "comic" | "lobster" | "elegant" | "condensed" | "serif";

export interface Sticker {
  id: string;
  /** emoji: one glyph. badge: text on a coloured pill. text: outlined lettering with no background. */
  kind: "emoji" | "badge" | "text";
  /** Use \n for a second line. */
  text: string;
  font?: StickerFont;
  /** Badge fill, or the lettering colour for kind "text". */
  color?: string;
  /** Badge text colour, or the lettering outline colour for kind "text". */
  ink?: string;
  /** Centre, in pixels of the template. */
  x: number;
  y: number;
  /** Base size in template pixels. */
  size: number;
  /** Rotation in radians. */
  rot: number;
}

export type StickerGroup = "faith" | "sport";
export type StickerDef = Pick<Sticker, "kind" | "text" | "font" | "color" | "ink"> & { group: StickerGroup };

const faith = (def: Omit<StickerDef, "group">): StickerDef => ({ ...def, group: "faith" });
const sport = (def: Omit<StickerDef, "group">): StickerDef => ({ ...def, group: "sport" });

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

  sport({ kind: "badge", text: "CCF BGC SPORTS", font: "slab", color: "#e5301f", ink: "#ffffff" }),
  sport({ kind: "badge", text: "2ND YEAR!", font: "slab", color: "#f08a3c", ink: "#111111" }),
  sport({ kind: "badge", text: "PHYSICAL BGC", font: "slab", color: "#ffffff", ink: "#111111" }),
  sport({ kind: "badge", text: "MVP", font: "slab", color: "#f2b134", ink: "#111111" }),
  sport({ kind: "badge", text: "CHAMP", font: "slab", color: "#e5301f", ink: "#ffffff" }),
  sport({ kind: "badge", text: "SQUAD GOALS", font: "slab", color: "#34c77b", ink: "#111111" }),
  sport({ kind: "text", text: "GAME ON!", font: "comic", color: "#ffd23f", ink: "#111111" }),
  sport({ kind: "text", text: "Let's Go!", font: "script", color: "#ffffff", ink: "#e5301f" }),
  ...["🏆", "🥇", "🔥", "💪", "⭐", "🎉", "👑", "😎", "⚡", "🏃", "🏀", "⚽", "🏸", "🏓", "🏋️"].map((text): StickerDef =>
    sport({ kind: "emoji", text }),
  ),
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
    size: Math.min(width, height) * (def.kind === "text" ? 0.2 : 0.16),
    rot: (Math.random() - 0.5) * 0.4,
  };
}
