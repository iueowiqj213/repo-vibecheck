import { describe, expect, it } from "vitest";
import { scoreReport } from "../src/score.js";
import type { RequirementMatch, RequirementStatus } from "../src/types.js";

function requirement(status: RequirementStatus): RequirementMatch {
  return {
    claim: "A requirement",
    concept: "requirement",
    status,
    evidence: [],
    missingEvidence: []
  };
}

describe("scoreReport", () => {
  it.each([
    ["satisfied", 50],
    ["partially_satisfied", 25],
    ["missing", 0],
    ["unverifiable", 0]
  ] as const)("awards %s requirements %i points", (status, expectedScore) => {
    expect(scoreReport([requirement(status)], []).categoryScores.requirements.score).toBe(expectedScore);
  });

  it("reports requirement coverage from evaluable requirement weight", () => {
    expect(scoreReport([
      requirement("satisfied"),
      requirement("partially_satisfied"),
      requirement("missing"),
      requirement("unverifiable")
    ], []).categoryScores.requirements).toMatchObject({ coverage: 75 });
  });

  it("uses fractional requirement coverage in overall verification scope", () => {
    expect(scoreReport([
      requirement("satisfied"),
      requirement("partially_satisfied"),
      requirement("missing"),
      requirement("unverifiable")
    ], [], false).scoreCoverage).toBe(63);
  });

  it("does not award requirement points when no claims were evaluated", () => {
    expect(scoreReport([], []).categoryScores.requirements).toMatchObject({ status: "not_applicable", score: null, maxScore: 50 });
  });

  it("does not award optional baseline execution points when scripts were not run", () => {
    expect(scoreReport([], [], false).categoryScores.baseline).toMatchObject({ status: "not_run", score: null, maxScore: 25 });
  });

  it("marks runtime consistency as inapplicable for libraries and CLIs", () => {
    expect(scoreReport([], [], false, "library").categoryScores.consistency.status).toBe("not_applicable");
    expect(scoreReport([], [], false, "cli").categoryScores.consistency.status).toBe("not_applicable");
  });

  it("uses the narrow template policy without penalizing unscannable runtime categories", () => {
    const score = scoreReport([], [], false, "template");
    expect(score.categoryScores.baseline.status).toBe("not_applicable");
    expect(score.categoryScores.consistency.status).toBe("not_applicable");
    expect(score.scoreCoverage).toBe(100);
  });
});
