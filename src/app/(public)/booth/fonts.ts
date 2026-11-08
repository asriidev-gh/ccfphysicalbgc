import { Anton, Bangers, Great_Vibes, Lobster, Pacifico, Permanent_Marker, Playfair_Display } from "next/font/google";

/** Lettering fonts for stickers and templates. Self-hosted by next/font, so no request goes to Google at runtime. */
const script = Pacifico({ weight: "400", subsets: ["latin"], display: "swap" });
const comic = Bangers({ weight: "400", subsets: ["latin"], display: "swap" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap" });
const lobster = Lobster({ weight: "400", subsets: ["latin"], display: "swap" });
const elegant = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap" });
const condensed = Anton({ weight: "400", subsets: ["latin"], display: "swap" });
const serif = Playfair_Display({ weight: "700", subsets: ["latin"], display: "swap" });

/** CSS font-family values, keyed by the sticker font names. */
export const STICKER_FONT_FAMILIES = {
  script: script.style.fontFamily,
  comic: comic.style.fontFamily,
  marker: marker.style.fontFamily,
  lobster: lobster.style.fontFamily,
  elegant: elegant.style.fontFamily,
  condensed: condensed.style.fontFamily,
  serif: serif.style.fontFamily,
};
