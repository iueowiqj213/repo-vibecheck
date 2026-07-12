import type { ScanReport } from "./types.js";

export type FailLevel = "never" | "error" | "warning";

export function parseFailLevel(value: string): FailLevel {
  if (value === "never" || value === "error" || value === "warning") return value;
  throw new Error("--fail-on must be never, error, or warning");
}

export function exitCodeForReport(report: ScanReport, level: FailLevel, baselineOnly = false): 0 | 1 {
  if (level === "never") return 0;
  const relevantMatches = baselineOnly ? report.requirementMatches.filter((match) => match.baselineState === "new") : report.requirementMatches;
  const missing = relevantMatches.some((match) => match.status === "missing");
  const eligible = baselineOnly ? report.findings.filter((finding) => finding.baselineState === "new") : report.findings;
  if (eligible.some((finding) => finding.severity === "error") || (!baselineOnly && report.summary.error > 0) || missing) return 1;
  if (level === "warning") {
    const partial = relevantMatches.some((match) => match.status === "partially_satisfied");
    if (eligible.some((finding) => finding.severity === "warning") || (!baselineOnly && report.summary.warning > 0) || partial) return 1;
  }
  return 0;
}
