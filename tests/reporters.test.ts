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

  it("shows executed checks when checks ran", () => {
    expect(renderHuman({ ...report, checksExecuted: ["python-test", "static"] }))
      .toContain("Executed checks: python-test, static");
  });

  it("omits executed checks when no checks ran", () => {
    expect(renderHuman({ ...report, checksExecuted: [] })).not.toContain("Executed checks:");
  });

  it("shows requirement metadata, depth gaps, coverage, and requirement warnings", () => {
    const human = renderHuman({
      ...report,
      categoryScores: {
        ...report.categoryScores,
        requirements: { status: "scored", score: 30, maxScore: 50, coverage: 67 }
      },
      requirementMatches: [{
        claim: "Save task record",
        concept: "unknown",
        status: "partially_satisfied",
        evidence: ["implementation: src/tasks.ts:4"],
        missingEvidence: ["focused test or a second implementation signal"],
        requirementId: "REQ-TASK-2",
        sourceLine: 14
      }],
      findings: [{
        id: "requirements.unverifiable",
        category: "requirements",
        severity: "warning",
        message: "1 explicit requirement could not be classified",
        evidence: ["REQ-QUALITY-3"]
      }]
    });

    expect(human).toContain("Requirements: 30/50 (67% covered)");
    expect(human).toContain("ID: REQ-TASK-2");
    expect(human).toContain("Source line: 14");
    expect(human).toContain("Status: partially_satisfied");
    expect(human).toContain("Evidence: implementation: src/tasks.ts:4");
    expect(human).toContain("Missing: focused test or a second implementation signal");
    expect(human).toContain("1 explicit requirement could not be classified");
  });

  it("emits valid stable JSON", () => {
    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});
