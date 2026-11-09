import { Patrick_Hand } from "next/font/google";

/** Handwriting for the sticky notes. Self-hosted by next/font, so no request goes to Google at runtime. */
export const noteFont = Patrick_Hand({ weight: "400", subsets: ["latin"], display: "swap" });
