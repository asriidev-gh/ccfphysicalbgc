/** Shared (client + server) definitions for the informal awards. No server-only imports here. */

export type AwardGender = "MALE" | "FEMALE";

/** Reveal key prefix for a sport's Top Athletes card on the Awardees page (followed by the activity id). */
export const ATHLETE_PREFIX = "athlete-";

export const AWARD_CATEGORIES = [
  {
    id: "best-outfit-male",
    label: "Best Outfit (Male)",
    emoji: "👕",
    blurb: "Dressed to win, on and off the field.",
    gender: "MALE",
    group: "Best Outfit",
  },
  {
    id: "best-outfit-female",
    label: "Best Outfit (Female)",
    emoji: "👕",
    blurb: "Dressed to win, on and off the field.",
    gender: "FEMALE",
    group: "Best Outfit",
  },
  {
    id: "most-punctual-male",
    label: "Most Punctual (Male)",
    emoji: "⏰",
    blurb: "First one in. Never late.",
    gender: "MALE",
    group: "Most Punctual",
  },
  {
    id: "most-punctual-female",
    label: "Most Punctual (Female)",
    emoji: "⏰",
    blurb: "First one in. Never late.",
    gender: "FEMALE",
    group: "Most Punctual",
  },
  { id: "mr-energetic", label: "Mr. Energetic", emoji: "⚡", blurb: "Non-stop energy, all day long.", gender: "MALE", group: "Energetic" },
  {
    id: "ms-energetic",
    label: "Ms. Energetic",
    emoji: "⚡",
    blurb: "Non-stop energy, all day long.",
    gender: "FEMALE",
    group: "Energetic",
  },
  { id: "mr-olympia", label: "Mr. Olympia", emoji: "💪", blurb: "The strongest presence on the field.", gender: "MALE", group: "Olympia" },
  {
    id: "ms-olympia",
    label: "Ms. Olympia",
    emoji: "💪",
    blurb: "The strongest presence on the field.",
    gender: "FEMALE",
    group: "Olympia",
  },
] as const satisfies readonly { id: string; label: string; emoji: string; blurb: string; gender: AwardGender | null; group: string }[];

/** Award groups in display order; each pairs a male and a female category. */
export const AWARD_GROUPS: string[] = [...new Set<string>(AWARD_CATEGORIES.map((c) => c.group))];

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];
export const AWARD_CATEGORY_IDS: string[] = AWARD_CATEGORIES.map((c) => c.id);

export const awardCategory = (id: string): AwardCategory | undefined => AWARD_CATEGORIES.find((c) => c.id === id);

/** Mr./Ms. awards only accept a matching gender; the rest are open to all. Someone with no gender on file matches none of the gendered ones. */
export function canBeNominated(categoryId: string, gender: AwardGender | null): boolean {
  const c = awardCategory(categoryId);
  if (!c) return false;
  return c.gender === null || c.gender === gender;
}

export function eligibleCategories(gender: AwardGender | null): AwardCategory[] {
  return AWARD_CATEGORIES.filter((c) => canBeNominated(c.id, gender));
}

export interface Nominee {
  id: string;
  name: string;
  photoUrl: string | null;
  gender: AwardGender | null;
  /** Votes received per category id (only categories with at least one vote). */
  votes: Record<string, number>;
}

/** The viewer's own ballot: category id -> nominee id. */
export type MyBallot = Record<string, string>;
