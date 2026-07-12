import { describe, expect, it } from "vitest";
import { renderHuman, renderJson } from "../src/reporters.js";
import type { ScanReport } from "../src/types.js";

const report: ScanReport = {
  schemaVersion: "1.1",
  product: "repo-vibecheck",
  targetPath: "/repo",
  generatedAt: "2026-07-11T00:00:00.000Z",
  score: 72,
  categoryScores: { requirements: 30, baseline: 20, consistency: 14, hygiene: 8 },
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
