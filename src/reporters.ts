import type { Finding, RequirementMatch, ScanReport } from "./types.js";

const SYMBOLS = { satisfied: "✓", partially_satisfied: "!", missing: "✗", unverifiable: "?" } as const;

export function renderHuman(report: ScanReport): string {
  const lines = [
    "Repo Vibecheck Report", "", `Score: ${report.score}/100`,
    `Coverage: ${report.scoreCoverage}%`,
    `  Requirements: ${formatScore(report.categoryScores.requirements)}`,
    `  Baseline: ${formatScore(report.categoryScores.baseline)}`,
    `  Consistency: ${formatScore(report.categoryScores.consistency)}`,
    `  Hygiene: ${formatScore(report.categoryScores.hygiene)}`,
    `Project: ${report.project.projectTypes.join(", ")}`, `Package manager: ${report.project.packageManager}`,
    ...(report.checksExecuted.length ? [`Executed checks: ${report.checksExecuted.join(", ")}`] : []), ""
  ];
  if (report.requirementMatches.length) {
    lines.push("Requirements Match", ...report.requirementMatches.flatMap(formatMatch), "");
  }
  const categories = ["requirements", "project", "baseline", "claims", "env", "dependencies", "placeholders"];
  for (const category of categories) {
    const findings = report.findings.filter((finding) => finding.category === category);
    if (findings.length) lines.push(title(category), ...findings.map(formatFinding), "");
  }
  lines.push("Build passed does not mean production-ready.");
  return lines.join("\n");
}

export function renderJson(report: ScanReport): string { return JSON.stringify(report, null, 2); }
function formatMatch(match: RequirementMatch): string[] { return [`${SYMBOLS[match.status]} ${title(match.concept)}`, ...(match.requirementId ? [`  ID: ${match.requirementId}`] : []), ...(match.sourceLine ? [`  Source line: ${match.sourceLine}`] : []), `  Status: ${match.status}`, `  Claims: ${(match.claims ?? [match.claim]).join(" | ")}`, ...(match.evidence.length ? [`  Evidence: ${match.evidence.join(", ")}`] : []), ...(match.missingEvidence.length ? [`  Missing: ${match.missingEvidence.join(", ")}`] : [])]; }
function formatFinding(finding: Finding): string { return `${finding.severity === "error" ? "✗" : finding.severity === "warning" ? "!" : "?"} ${finding.message}${finding.evidence.length ? `\n  Evidence: ${finding.evidence.join(", ")}` : ""}`; }
function title(value: string): string { return value[0]?.toUpperCase() + value.slice(1); }
function formatScore(value: ScanReport["categoryScores"][keyof ScanReport["categoryScores"]] | number): string { if (typeof value === "number") return `${value}`; return value.status === "scored" ? `${value.score}/${value.maxScore}${value.coverage === undefined ? "" : ` (${value.coverage}% covered)`}` : value.status; }
