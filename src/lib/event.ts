import { cache } from "react";
import { db } from "@/lib/db";

/** The event the public site is about: the soonest non-archived published/live event. */
export const getCurrentEvent = cache(async () => {
  return db.event.findFirst({
    where: { status: { in: ["PUBLISHED", "LIVE", "COMPLETED"] } },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
  });
});

export const SPORT_ICON_NAMES = [
  "trophy",
  "feather",
  "dribbble",
  "footprints",
  "circle-dot",
  "dumbbell",
  "weight",
  "swords",
  "bike",
  "waves",
  "target",
] as const;
