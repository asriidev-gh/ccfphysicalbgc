/** Photobooth templates. Pure data (safe for server and client): one slot per shot, in pixels of the final image. */

export interface BoothSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoothTemplate {
  id: string;
  name: string;
  blurb: string;
  width: number;
  height: number;
  slots: BoothSlot[];
  /** Background gradient + accent used when the frame is drawn. */
  theme: { from: string; to: string; accent: string; ink: string };
  /** Sport-themed layout: the photo slots surround a title panel instead of a header and footer. */
  sport?: SportStyle;
  panel?: BoothSlot;
  /** Portrait trading card with a name and title the visitor types in. */
  card?: CardStyle;
  /** Elegant party / wedding strip. */
  event?: EventStyle;
  /** Vertical-name sports poster. */
  poster?: PosterStyle;
  /** Single-photo party frame (balloons, neon, glitter...). */
  overlay?: { style: "gold-double" | "gold-swoosh" | "plaque" | "badge" | "floral" | "neon-purple" | "neon-glow" };
  /** Text the visitor can type in on the review screen. Placeholders double as the defaults. */
  fields?: BoothField[];
}

export interface BoothField {
  key: string;
  label: string;
  placeholder: string;
  max: number;
}

export interface EventStyle {
  style: "gold" | "white" | "bulbs" | "lights" | "billboard";
  /** Where the lettering goes. */
  textBox: BoothSlot;
  balloons?: "edge";
}

export interface PosterStyle {
  style: "smoke" | "ghost" | "stripes" | "midnight" | "team";
  bg: [string, string];
  accent: string;
  accent2: string;
}

export interface CardStyle {
  /** Which layout draws the card. */
  kind: "plate" | "classic" | "grunge";
  foil: "rainbow" | "pink" | "prism" | "silver" | "grunge";
  main: string;
  dark: string;
  accent: string;
  /** Colour of the name plate or ribbon. */
  plate: string;
  label?: string;
  labelPos?: "top-center" | "top-right";
  /** Show the anniversary info box under the plates. */
  info?: boolean;
  /** Short text in the corner shield badge. */
  shield?: string;
  emoji?: string;
  sport?: string;
}

export interface SportStyle {
  /** Big title, upper case. */
  name: string;
  /** Decor emoji for the panel corners and the centre of the collage. */
  emoji: string[];
  pattern: "turf" | "lanes" | "court" | "net" | "diagonal";
  bg: [string, string];
  accent: string;
  /** Colour of the torn frames around each photo. */
  frame: string;
  /** Colour of the title panel. */
  panel: string;
  /** "burst" (square collage with a star panel, default) or "card" (landscape printed card with sport artwork). */
  variant?: "burst" | "card";
  /** Card artwork. */
  art?: "basketball" | "shuttlecock" | "pickleball" | "stopwatch" | "kettlebell" | "barbell";
}

const RED = { from: "#1a0805", to: "#3b0f08", accent: "#e5301f", ink: "#ffffff" };
const ORANGE = { from: "#1a0f05", to: "#3d2208", accent: "#f08a3c", ink: "#ffffff" };
const GOLD = { from: "#1a1405", to: "#3d3008", accent: "#f2b134", ink: "#ffffff" };
const CREAM = { from: "#fff7ee", to: "#ffe1c4", accent: "#e5301f", ink: "#1b1b1d" };
const DARK = { from: "#0b0b0c", to: "#1d1d20", accent: "#e5301f", ink: "#ffffff" };

/** Slots stacked in one column, evenly sized between a header and a footer band. */
function column(n: number, width: number, height: number, margin: number, top: number, bottom: number, gap: number): BoothSlot[] {
  const h = Math.floor((height - top - bottom - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: margin, y: top + i * (h + gap), w: width - margin * 2, h }));
}

function grid(cols: number, rows: number, width: number, margin: number, top: number, gap: number, h: number): BoothSlot[] {
  const w = Math.floor((width - margin * 2 - gap * (cols - 1)) / cols);
  const out: BoothSlot[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: margin + c * (w + gap), y: top + r * (h + gap), w, h });
  return out;
}

/** Square 2x2 layout: three photos and the title panel, whose cell (0-3, reading order) varies per sport. */
function sportTemplate(id: string, panelCell: number, sport: SportStyle): BoothTemplate {
  const size = 1400;
  const margin = 60;
  const gap = 30;
  const cell = (size - margin * 2 - gap) / 2;
  const cells: BoothSlot[] = [0, 1, 2, 3].map((i) => ({
    x: margin + (i % 2) * (cell + gap),
    y: margin + Math.floor(i / 2) * (cell + gap),
    w: cell,
    h: cell,
  }));
  return {
    id,
    name: sport.name.charAt(0) + sport.name.slice(1).toLowerCase(),
    blurb: "3 shots",
    width: size,
    height: size,
    slots: cells.filter((_, i) => i !== panelCell),
    panel: cells[panelCell],
    theme: { from: sport.bg[0], to: sport.bg[1], accent: sport.accent, ink: "#ffffff" },
    sport,
  };
}

/** Landscape card: two stacked photos on the left, title and sport artwork on the right. */
function cardTemplate(id: string, sport: SportStyle): BoothTemplate {
  return {
    id,
    name: sport.name.charAt(0) + sport.name.slice(1).toLowerCase(),
    blurb: "2 shots",
    width: 1800,
    height: 1200,
    slots: [
      { x: 60, y: 60, w: 860, h: 520 },
      { x: 60, y: 620, w: 860, h: 520 },
    ],
    panel: { x: 980, y: 60, w: 760, h: 1080 },
    theme: { from: sport.bg[0], to: sport.bg[1], accent: sport.accent, ink: "#ffffff" },
    sport: { ...sport, variant: "card" },
  };
}

export const CARD_TEMPLATES: BoothTemplate[] = [
  cardTemplate("card-basketball", {
    name: "BASKETBALL",
    emoji: [],
    pattern: "diagonal",
    bg: ["#161616", "#26201b"],
    accent: "#f08a3c",
    frame: "#f08a3c",
    panel: "#161616",
    art: "basketball",
  }),
  cardTemplate("card-badminton", {
    name: "BADMINTON",
    emoji: [],
    pattern: "diagonal",
    bg: ["#0a1a10", "#14301e"],
    accent: "#b6f23a",
    frame: "#b6f23a",
    panel: "#0a1a10",
    art: "shuttlecock",
  }),
  cardTemplate("card-running", {
    name: "RUNNING",
    emoji: [],
    pattern: "diagonal",
    bg: ["#1c0d0d", "#331513"],
    accent: "#ff6a3d",
    frame: "#ff6a3d",
    panel: "#1c0d0d",
    art: "stopwatch",
  }),
  cardTemplate("card-pickleball", {
    name: "PICKLEBALL",
    emoji: [],
    pattern: "diagonal",
    bg: ["#08181e", "#0f2f3a"],
    accent: "#e6ff3d",
    frame: "#e6ff3d",
    panel: "#08181e",
    art: "pickleball",
  }),
  cardTemplate("card-hyrox", {
    name: "HYROX",
    emoji: [],
    pattern: "diagonal",
    bg: ["#0d0d0d", "#222222"],
    accent: "#ffd400",
    frame: "#ffd400",
    panel: "#0d0d0d",
    art: "kettlebell",
  }),
  cardTemplate("card-crossfit", {
    name: "CROSSFIT",
    emoji: [],
    pattern: "diagonal",
    bg: ["#0b1020", "#18224a"],
    accent: "#ff4a3a",
    frame: "#ff4a3a",
    panel: "#0b1020",
    art: "barbell",
  }),
];

export const SPORT_TEMPLATES: BoothTemplate[] = [
  sportTemplate("sport-basketball", 3, {
    name: "BASKETBALL",
    emoji: ["🏀", "🏆", "🔥", "⛹️"],
    pattern: "court",
    bg: ["#1a0c04", "#8a3508"],
    accent: "#ff8a1f",
    frame: "#ffb066",
    panel: "#2a1305",
  }),
  sportTemplate("sport-badminton", 2, {
    name: "BADMINTON",
    emoji: ["🏸", "🏆", "💨", "🥇"],
    pattern: "turf",
    bg: ["#0b3d1e", "#18803a"],
    accent: "#b6f23a",
    frame: "#a4e07a",
    panel: "#082a15",
  }),
  sportTemplate("sport-running", 1, {
    name: "RUNNING",
    emoji: ["🏃", "👟", "🥇", "⏱️"],
    pattern: "lanes",
    bg: ["#3a0d0d", "#a8321f"],
    accent: "#ffd23f",
    frame: "#ffb199",
    panel: "#2a0808",
  }),
  sportTemplate("sport-pickleball", 3, {
    name: "PICKLEBALL",
    emoji: ["🏓", "🎾", "⭐", "🏆"],
    pattern: "net",
    bg: ["#052e3a", "#0e7a92"],
    accent: "#e6ff3d",
    frame: "#8fe3f0",
    panel: "#03202a",
  }),
  sportTemplate("sport-hyrox", 0, {
    name: "HYROX",
    emoji: ["🏋️", "🔥", "💪", "⏱️"],
    pattern: "diagonal",
    bg: ["#0b0b0b", "#2a2a2a"],
    accent: "#ffd400",
    frame: "#ffe766",
    panel: "#111111",
  }),
  sportTemplate("sport-crossfit", 2, {
    name: "CROSSFIT",
    emoji: ["🏋️", "💪", "🔥", "🤸"],
    pattern: "diagonal",
    bg: ["#0b1020", "#1f2d5a"],
    accent: "#e5301f",
    frame: "#ff8a7d",
    panel: "#080c18",
  }),
];

const CARD_W = 1000;
const CARD_H = 1400;

const CARD_FIELDS: BoothField[] = [
  { key: "name", label: "Name on the card", placeholder: "YOUR NAME", max: 24 },
  { key: "title", label: "Title (position, team or a tagline)", placeholder: "PHYSICAL BGC 2026", max: 32 },
];

function tradingCard(id: string, name: string, slot: BoothSlot, card: CardStyle): BoothTemplate {
  return {
    fields: CARD_FIELDS,
    id,
    name,
    blurb: "1 shot + your name",
    width: CARD_W,
    height: CARD_H,
    slots: [slot],
    theme: { from: card.dark, to: card.main, accent: card.accent, ink: "#ffffff" },
    card,
  };
}

const grungeSlot: BoothSlot = { x: 60, y: 60, w: 880, h: 1280 };
function grungeCard(id: string, sport: string, emoji: string, main: string, dark: string, accent: string): BoothTemplate {
  return tradingCard(id, sport.charAt(0) + sport.slice(1).toLowerCase() + " card", grungeSlot, {
    kind: "grunge",
    foil: "grunge",
    main,
    dark,
    accent,
    plate: "#000000",
    emoji,
    sport,
  });
}

const GOLD_FIELDS: BoothField[] = [
  { key: "script", label: "Script line", placeholder: "Celebrating", max: 22 },
  { key: "big", label: "Big line", placeholder: "2nd Year", max: 16 },
  { key: "sub", label: "Under line", placeholder: "ANNIVERSARY", max: 24 },
  { key: "date", label: "Date or note", placeholder: "PHYSICAL BGC 2026", max: 30 },
];
const WHITE_FIELDS: BoothField[] = [
  { key: "script", label: "Script line", placeholder: "Physical BGC", max: 24 },
  { key: "sub", label: "Names or title", placeholder: "CCF BGC SPORTS", max: 30 },
  { key: "date", label: "Date or note", placeholder: "2ND YEAR ANNIVERSARY", max: 30 },
];

function eventTemplate(
  id: string,
  name: string,
  width: number,
  height: number,
  slots: BoothSlot[],
  event: EventStyle,
  fields?: BoothField[],
): BoothTemplate {
  const light = event.style === "white";
  return {
    id,
    name,
    blurb: `${slots.length} shot${slots.length > 1 ? "s" : ""} + your text`,
    width,
    height,
    slots,
    theme: light
      ? { from: "#ffffff", to: "#f3f3f5", accent: "#1b1b1d", ink: "#1b1b1d" }
      : { from: "#050505", to: "#1a1710", accent: "#e3b94e", ink: "#ffffff" },
    event,
    fields: fields ?? (light ? WHITE_FIELDS : GOLD_FIELDS),
  };
}

const LIGHT_FIELDS: BoothField[] = [
  { key: "script", label: "Greeting", placeholder: "Happy Anniversary!", max: 28 },
  { key: "date", label: "Date or note", placeholder: "PHYSICAL BGC 2026", max: 30 },
];
const BILLBOARD_FIELDS: BoothField[] = [
  { key: "sub", label: "Small line", placeholder: "HAPPY ANNIVERSARY", max: 28 },
  { key: "script", label: "Name", placeholder: "Physical BGC", max: 16 },
  { key: "date", label: "Date or note", placeholder: "2ND YEAR • 2026", max: 24 },
];
const stripSlots = [560, 1040, 1520].map((y) => ({ x: 60, y, w: 580, h: 450 }));

export const EVENT_TEMPLATES: BoothTemplate[] = [
  eventTemplate(
    "event-bulbs",
    "Edison bulbs strip",
    700,
    2100,
    stripSlots,
    { style: "bulbs", textBox: { x: 40, y: 400, w: 620, h: 150 } },
    LIGHT_FIELDS,
  ),
  eventTemplate(
    "event-lights",
    "Fairy lights strip",
    700,
    2100,
    stripSlots,
    { style: "lights", textBox: { x: 40, y: 380, w: 620, h: 160 } },
    LIGHT_FIELDS,
  ),
  eventTemplate(
    "event-billboard",
    "Gold billboard",
    1800,
    1200,
    [
      { x: 800, y: 60, w: 940, h: 520 },
      { x: 170, y: 620, w: 790, h: 520 },
      { x: 1000, y: 620, w: 740, h: 520 },
    ],
    { style: "billboard", textBox: { x: 170, y: 60, w: 590, h: 520 } },
    BILLBOARD_FIELDS,
  ),
  eventTemplate(
    "event-gold-strip",
    "Black & gold strip",
    1200,
    2050,
    [60, 600, 1140].map((y) => ({ x: 60, y, w: 860, h: 500 })),
    { style: "gold", textBox: { x: 60, y: 1680, w: 860, h: 340 }, balloons: "edge" },
  ),
  eventTemplate(
    "event-gold-4up",
    "Black & gold 4-up",
    1800,
    1200,
    [
      { x: 60, y: 60, w: 820, h: 520 },
      { x: 920, y: 60, w: 820, h: 520 },
      { x: 60, y: 620, w: 820, h: 520 },
    ],
    { style: "gold", textBox: { x: 60 + 860, y: 620, w: 700, h: 520 }, balloons: "edge" },
  ),
  eventTemplate(
    "event-white-strip",
    "White strip",
    700,
    2100,
    [60, 620, 1180].map((y) => ({ x: 60, y, w: 580, h: 520 })),
    { style: "white", textBox: { x: 40, y: 1740, w: 620, h: 320 } },
  ),
  eventTemplate(
    "event-white-wide",
    "White wide",
    1800,
    1200,
    [80, 637, 1194].map((x) => ({ x, y: 80, w: 527, h: 700 })),
    { style: "white", textBox: { x: 80, y: 800, w: 1640, h: 340 } },
  ),
  eventTemplate("event-white-single", "White single", 1000, 1400, [{ x: 70, y: 70, w: 860, h: 880 }], {
    style: "white",
    textBox: { x: 70, y: 960, w: 860, h: 380 },
  }),
  eventTemplate(
    "event-white-grid",
    "White grid",
    1200,
    1800,
    [
      { x: 70, y: 70, w: 515, h: 600 },
      { x: 615, y: 70, w: 515, h: 600 },
      { x: 70, y: 700, w: 515, h: 600 },
      { x: 615, y: 700, w: 515, h: 600 },
    ],
    { style: "white", textBox: { x: 70, y: 1330, w: 1060, h: 420 } },
  ),
];

type OverlayStyle = NonNullable<BoothTemplate["overlay"]>["style"];

function overlayTemplate(
  id: string,
  name: string,
  style: OverlayStyle,
  slot: BoothSlot,
  fields: BoothField[],
  accent: string,
): BoothTemplate {
  return {
    id,
    name,
    blurb: "1 shot + your text",
    width: 1080,
    height: 1080,
    slots: [slot],
    theme: { from: "#050505", to: "#16130c", accent, ink: "#ffffff" },
    overlay: { style },
    fields,
  };
}

const full: BoothSlot = { x: 0, y: 0, w: 1080, h: 1080 };
const TOP_MAIN: BoothField[] = [
  { key: "top", label: "Small line", placeholder: "CCF BGC SPORTS", max: 24 },
  { key: "main", label: "Script line", placeholder: "2nd Anniversary", max: 22 },
];
const MAIN_ONLY = (placeholder: string): BoothField[] => [{ key: "main", label: "Greeting", placeholder, max: 26 }];

export const OVERLAY_TEMPLATES: BoothTemplate[] = [
  overlayTemplate("frame-gold-balloons", "Gold balloons frame", "gold-double", full, TOP_MAIN, "#e3b94e"),
  overlayTemplate("frame-gold-glitter", "Gold glitter frame", "gold-swoosh", full, TOP_MAIN, "#e3b94e"),
  overlayTemplate(
    "frame-plaque",
    "Plaque frame",
    "plaque",
    full,
    [
      { key: "l1", label: "Top word", placeholder: "HAPPY", max: 10 },
      { key: "l2", label: "Big word", placeholder: "2ND", max: 6 },
      { key: "l3", label: "Bottom word", placeholder: "ANNIVERSARY", max: 14 },
    ],
    "#e3b94e",
  ),
  overlayTemplate(
    "frame-badge",
    "Gold badge frame",
    "badge",
    full,
    [
      { key: "l1", label: "Script line 1", placeholder: "Happy", max: 10 },
      { key: "l2", label: "Script line 2", placeholder: "Anniversary", max: 14 },
      { key: "name", label: "Name on the ribbon", placeholder: "CCF BGC", max: 16 },
    ],
    "#e3b94e",
  ),
  overlayTemplate(
    "frame-floral",
    "White flowers frame",
    "floral",
    { x: 40, y: 40, w: 1000, h: 1000 },
    MAIN_ONLY("Happy Anniversary"),
    "#e3b94e",
  ),
  overlayTemplate(
    "frame-neon-purple",
    "Neon night frame",
    "neon-purple",
    { x: 90, y: 70, w: 900, h: 880 },
    MAIN_ONLY("Physical BGC 2026"),
    "#ff3df0",
  ),
  overlayTemplate(
    "frame-neon-glow",
    "Glow party frame",
    "neon-glow",
    { x: 70, y: 70, w: 940, h: 940 },
    [
      { key: "l1", label: "Big neon word", placeholder: "GLOW", max: 8 },
      { key: "l2", label: "Script line", placeholder: "in the Dark", max: 16 },
    ],
    "#3df5ff",
  ),
];

const POSTER_FIELDS: BoothField[] = [
  { key: "first", label: "First name", placeholder: "Jordan", max: 14 },
  { key: "last", label: "Last name", placeholder: "SMITH", max: 14 },
  { key: "team", label: "Team or group", placeholder: "CCF BGC SPORTS", max: 24 },
  { key: "number", label: "Number", placeholder: "23", max: 3 },
  { key: "label", label: "Label (position, year, captain...)", placeholder: "ATHLETE", max: 18 },
];

function posterTemplate(id: string, name: string, poster: PosterStyle): BoothTemplate {
  return {
    id,
    name,
    blurb: "1 shot + your name",
    width: 1000,
    height: 1250,
    slots: [{ x: 0, y: 0, w: 1000, h: 1250 }],
    theme: { from: poster.bg[0], to: poster.bg[1], accent: poster.accent, ink: "#ffffff" },
    poster,
    fields: POSTER_FIELDS,
  };
}

export const POSTER_TEMPLATES: BoothTemplate[] = [
  posterTemplate("poster-smoke", "Smoke poster", { style: "smoke", bg: ["#0d0d0f", "#2b2d33"], accent: "#3b82ff", accent2: "#0a2a70" }),
  posterTemplate("poster-ghost", "Ghost poster", { style: "ghost", bg: ["#0b1a2e", "#1f4a77"], accent: "#ff8a2a", accent2: "#a64800" }),
  posterTemplate("poster-stripes", "Stripes poster", {
    style: "stripes",
    bg: ["#141010", "#1c1713"],
    accent: "#f2b620",
    accent2: "#9a6b00",
  }),
  posterTemplate("poster-midnight", "Midnight poster", {
    style: "midnight",
    bg: ["#05070f", "#14264b"],
    accent: "#e0b84f",
    accent2: "#7a5d14",
  }),
  posterTemplate("poster-team", "Team poster", { style: "team", bg: ["#0e2a14", "#1f5a2a"], accent: "#ffd23f", accent2: "#a07800" }),
];

export const TRADING_TEMPLATES: BoothTemplate[] = [
  tradingCard(
    "trade-allstar",
    "All-Star foil",
    { x: 100, y: 175, w: 800, h: 860 },
    {
      kind: "plate",
      foil: "rainbow",
      main: "#ff4fa3",
      dark: "#3a8cff",
      accent: "#e8c15a",
      plate: "#16161a",
      label: "★ ALL-STAR ★",
      labelPos: "top-center",
      shield: "2ND",
      info: true,
    },
  ),
  tradingCard(
    "trade-classic",
    "Classic silver",
    { x: 90, y: 120, w: 820, h: 1020 },
    {
      kind: "classic",
      foil: "silver",
      main: "#f6f6f8",
      dark: "#c4c8d0",
      accent: "#14306b",
      plate: "#14306b",
      label: "CCF BGC",
    },
  ),
  tradingCard(
    "trade-pink",
    "Pink foil",
    { x: 100, y: 175, w: 800, h: 1000 },
    {
      kind: "plate",
      foil: "pink",
      main: "#ff5fa8",
      dark: "#a3124f",
      accent: "#ff8cc4",
      plate: "#1f5bd6",
      label: "2026 / PHYSICAL BGC",
      labelPos: "top-right",
    },
  ),
  tradingCard(
    "trade-prism",
    "Prism",
    { x: 100, y: 175, w: 800, h: 1000 },
    {
      kind: "plate",
      foil: "prism",
      main: "#d9c6f2",
      dark: "#f6d6c0",
      accent: "#14306b",
      plate: "#14306b",
      label: "PLAYER SERIES",
      labelPos: "top-center",
    },
  ),
  grungeCard("trade-basketball", "BASKETBALL", "🏀", "#e8721a", "#4a1c05", "#ffd9a8"),
  grungeCard("trade-badminton", "BADMINTON", "🏸", "#27a844", "#06301a", "#d6ff7a"),
  grungeCard("trade-running", "RUNNING", "🏃", "#e5301f", "#3a0b07", "#ffd9d2"),
  grungeCard("trade-pickleball", "PICKLEBALL", "🏓", "#1aa6c4", "#052f3a", "#f0ff7a"),
  grungeCard("trade-hyrox", "HYROX", "🏋️", "#f2c200", "#1a1500", "#fff2a0"),
  grungeCard("trade-crossfit", "CROSSFIT", "💪", "#1f4fe0", "#081445", "#bcd0ff"),
];

export const BOOTH_TEMPLATES: BoothTemplate[] = [
  {
    id: "polaroid",
    name: "Polaroid",
    blurb: "1 shot",
    width: 1000,
    height: 1400,
    slots: [{ x: 60, y: 170, w: 880, h: 880 }],
    theme: DARK,
  },
  {
    id: "duo",
    name: "Duo",
    blurb: "2 shots",
    width: 800,
    height: 1500,
    slots: column(2, 800, 1500, 40, 170, 190, 30),
    theme: ORANGE,
  },
  {
    id: "triple",
    name: "Triple",
    blurb: "3 shots",
    width: 700,
    height: 1900,
    slots: column(3, 700, 1900, 40, 170, 190, 30),
    theme: RED,
  },
  {
    id: "strip",
    name: "Classic strip",
    blurb: "4 shots",
    width: 700,
    height: 2400,
    slots: column(4, 700, 2400, 40, 170, 190, 30),
    theme: DARK,
  },
  {
    id: "collage",
    name: "Collage",
    blurb: "6 shots",
    width: 1200,
    height: 1900,
    slots: grid(2, 3, 1200, 50, 180, 30, 470),
    theme: RED,
  },
  {
    id: "side-by-side",
    name: "Side by side",
    blurb: "2 shots",
    width: 1500,
    height: 980,
    slots: grid(2, 1, 1500, 40, 170, 30, 620),
    theme: CREAM,
  },
  {
    id: "banner",
    name: "Banner",
    blurb: "3 shots",
    width: 1800,
    height: 920,
    slots: grid(3, 1, 1800, 40, 170, 30, 560),
    theme: GOLD,
  },
  {
    id: "grid",
    name: "Four grid",
    blurb: "4 shots",
    width: 1200,
    height: 1510,
    slots: grid(2, 2, 1200, 50, 170, 30, 560),
    theme: ORANGE,
  },
  {
    id: "story",
    name: "Story",
    blurb: "3 shots",
    width: 1080,
    height: 1920,
    slots: [
      { x: 40, y: 170, w: 1000, h: 900 },
      { x: 40, y: 1100, w: 485, h: 485 },
      { x: 555, y: 1100, w: 485, h: 485 },
    ],
    theme: RED,
  },
  {
    id: "postcard",
    name: "Postcard",
    blurb: "1 shot",
    width: 1600,
    height: 1200,
    slots: [{ x: 60, y: 170, w: 1480, h: 840 }],
    theme: CREAM,
  },
  {
    id: "mini-strip",
    name: "Mini strip",
    blurb: "3 shots",
    width: 600,
    height: 1800,
    slots: column(3, 600, 1800, 36, 160, 180, 26),
    theme: GOLD,
  },
];

BOOTH_TEMPLATES.push(
  ...OVERLAY_TEMPLATES,
  ...POSTER_TEMPLATES,
  ...EVENT_TEMPLATES,
  ...TRADING_TEMPLATES,
  ...SPORT_TEMPLATES,
  ...CARD_TEMPLATES,
);

export const BOOTH_TEMPLATE_IDS = BOOTH_TEMPLATES.map((t) => t.id);

export function getBoothTemplate(id: string): BoothTemplate | undefined {
  return BOOTH_TEMPLATES.find((t) => t.id === id);
}
