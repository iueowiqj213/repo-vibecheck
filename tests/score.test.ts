import { describe, expect, it } from "vitest";
import { scoreReport } from "../src/score.js";

describe("scoreReport", () => {
  it("does not award requirement points when no claims were evaluated", () => {
    expect(scoreReport([], []).categoryScores.requirements).toBe(0);
  });

  it("does not award optional baseline execution points when scripts were not run", () => {
    expect(scoreReport([], [], false).categoryScores.baseline).toBe(0);
  });
});
