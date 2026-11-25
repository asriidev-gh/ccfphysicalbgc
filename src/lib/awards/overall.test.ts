import { describe, expect, it } from "vitest";
import { overallStandings, type SportRank } from "./overall";

const places = (id: string, ...ranks: number[]): SportRank[] =>
  ranks.map((rank, i) => ({ participantId: id, name: id, photoUrl: null, activityId: `sport${i}`, rank }));

describe("overall standings", () => {
  it("averages places, so people who played different numbers of sports compare fairly", () => {
    const out = overallStandings([...places("four", 1, 2, 3, 2), ...places("three", 1, 2, 2)]);
    expect(out.map((e) => [e.name, Number(e.average.toFixed(2)), e.sports])).toEqual([
      ["three", 1.67, 3],
      ["four", 2, 4],
    ]);
  });

  it("needs at least three sports to qualify", () => {
    expect(overallStandings([...places("two", 1, 1), ...places("three", 4, 4, 4)]).map((e) => e.name)).toEqual(["three"]);
  });

  it("splits equal averages by sports played, then 1st places, and shares a true tie", () => {
    const out = overallStandings([...places("a", 2, 2, 2), ...places("b", 2, 2, 2, 2), ...places("c", 1, 2, 3), ...places("d", 3, 2, 1)]);
    expect(out.map((e) => [e.name, e.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["d", 2],
      ["a", 4],
    ]);
  });

  it("counts only the best place in each sport", () => {
    const out = overallStandings([...places("x", 5, 1, 3), ...places("x", 2)]);
    expect(out[0]).toMatchObject({ average: 2, sports: 3 });
    expect(out[0].places.map((p) => [p.activityId, p.rank])).toEqual([
      ["sport0", 2],
      ["sport1", 1],
      ["sport2", 3],
    ]);
  });
});
