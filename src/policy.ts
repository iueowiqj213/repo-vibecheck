import type { ScanReport } from "./types.js";

export type FailLevel = "never" | "error" | "warning";

export function parseFailLevel(value: string): FailLevel {
  if (value === "never" || value === "error" || value === "warning") return value;
  throw new Error("--fail-on must be never, error, or warning");
}

export function exitCodeForReport(report: ScanReport, level: FailLevel): 0 | 1 {
  if (level === "never") return 0;
  const missing = report.requirementMatches.some((match) => match.status === "missing");
  if (report.summary.error > 0 || missing) return 1;
  if (level === "warning") {
    const partial = report.requirementMatches.some((match) => match.status === "partially_satisfied");
    if (report.summary.warning > 0 || partial) return 1;
  }
  return 0;
}
