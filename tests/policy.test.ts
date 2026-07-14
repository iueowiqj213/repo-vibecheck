import { describe, expect, it } from "vitest";
import { exitCodeForReport, parseFailLevel } from "../src/policy.js";
import type { ScanReport } from "../src/types.js";

function report(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    schemaVersion: "1.1", product: "repo-vibecheck", targetPath: "/repo", generatedAt: "2026-07-11T00:00:00.000Z",
    score: 100, categoryScores: { requirements: 50, baseline: 25, consistency: 15, hygiene: 10 },
    project: { packageManager: "npm", lockfiles: [], projectTypes: ["Node.js"], scripts: [] }, checksExecuted: ["static"],
    requirementMatches: [], findings: [], summary: { error: 0, warning: 0, info: 0 }, ...overrides
  };
}

describe("exit policy", () => {
  it("never fails a completed scan under the default policy", () => {
    expect(exitCodeForReport(report({ summary: { error: 3, warning: 4, info: 0 } }), "never")).toBe(0);
  });

  it("fails error policy for error findings or missing requirements", () => {
    expect(exitCodeForReport(report({ summary: { error: 1, warning: 0, info: 0 } }), "error")).toBe(1);
    expect(exitCodeForReport(report({ requirementMatches: [{ claim: "Email", claims: ["Email"], concept: "email", status: "missing", evidence: [], missingEvidence: [] }] }), "error")).toBe(1);
  });

  it("fails warning policy for warnings and partial requirements", () => {
    expect(exitCodeForReport(report({ summary: { error: 0, warning: 1, info: 0 } }), "warning")).toBe(1);
    expect(exitCodeForReport(report({ requirementMatches: [{ claim: "Payments", claims: ["Payments"], concept: "payment", status: "partially_satisfied", evidence: [], missingEvidence: [] }] }), "warning")).toBe(1);
  });

  it("rejects invalid policy names", () => {
    expect(() => parseFailLevel("fatal")).toThrow("never, error, or warning");
  });
});
