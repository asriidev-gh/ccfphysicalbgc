import { describe, expect, it } from "vitest";
import { AWARD_CATEGORIES, canBeNominated, eligibleCategories } from "./categories";

describe("award eligibility", () => {
  it("has unique category ids", () => {
    expect(new Set(AWARD_CATEGORIES.map((c) => c.id)).size).toBe(AWARD_CATEGORIES.length);
  });

  it("limits Mr. awards to men and Ms. awards to women", () => {
    expect(canBeNominated("mr-olympia", "MALE")).toBe(true);
    expect(canBeNominated("mr-olympia", "FEMALE")).toBe(false);
    expect(canBeNominated("ms-energetic", "FEMALE")).toBe(true);
    expect(canBeNominated("ms-energetic", "MALE")).toBe(false);
  });

  it("keeps open awards open to everyone, including people with no gender on file", () => {
    expect(eligibleCategories(null).map((c) => c.id)).toEqual(["best-outfit", "most-punctual"]);
    expect(eligibleCategories("MALE").map((c) => c.id)).toEqual(["best-outfit", "most-punctual", "mr-energetic", "mr-olympia"]);
  });

  it("rejects unknown categories", () => {
    expect(canBeNominated("nope", "MALE")).toBe(false);
  });
});
