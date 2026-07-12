import { describe, expect, it } from "vitest";
import { renderHuman, renderJson } from "../src/reporters.js";
import type { ScanReport } from "../src/types.js";

const report: ScanReport = {
  schemaVersion: "2.0",
  product: "repo-vibecheck",
  targetPath: "/repo",
  generatedAt: "2026-07-11T00:00:00.000Z",
  score: 72,
  scoreCoverage: 100,
  categoryScores: {
    requirements: { status: "scored", score: 30, maxScore: 50 },
    baseline: { status: "scored", score: 20, maxScore: 25 },
    consistency: { status: "scored", score: 14, maxScore: 15 },
    hygiene: { status: "scored", score: 8, maxScore: 10 }
  },
  project: { packageManager: "npm", lockfiles: ["package-lock.json"], projectTypes: ["Node.js"], scripts: ["build"] },
  checksExecuted: ["static"],
  requirementMatches: [],
  findings: [],
  summary: { error: 0, warning: 0, info: 0 }
};

describe("reporters", () => {
  it("includes the production-readiness disclaimer", () => {
    expect(renderHuman(report)).toContain("Build passed does not mean production-ready.");
    expect(renderHuman(report)).toContain("Requirements: 30/50");
  });

  it("emits valid stable JSON", () => {
    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});
