import type { Finding, RequirementMatch, ScanReport } from "./types.js";

const SYMBOLS = { satisfied: "✓", partially_satisfied: "!", missing: "✗", unverifiable: "?" } as const;

export function renderHuman(report: ScanReport): string {
  const lines = [
    "Repo Vibecheck Report", "", `Score: ${report.score}/100`,
    `  Requirements: ${report.categoryScores.requirements}/50`,
    `  Baseline: ${report.categoryScores.baseline}/25`,
    `  Consistency: ${report.categoryScores.consistency}/15`,
    `  Hygiene: ${report.categoryScores.hygiene}/10`,
    `Project: ${report.project.projectTypes.join(", ")}`, `Package manager: ${report.project.packageManager}`, ""
  ];
  if (report.requirementMatches.length) {
    lines.push("Requirements Match", ...report.requirementMatches.flatMap(formatMatch), "");
  }
  const categories = ["project", "baseline", "claims", "env", "dependencies", "placeholders"];
  for (const category of categories) {
    const findings = report.findings.filter((finding) => finding.category === category);
    if (findings.length) lines.push(title(category), ...findings.map(formatFinding), "");
  }
  lines.push("Build passed does not mean production-ready.");
  return lines.join("\n");
}

export function renderJson(report: ScanReport): string { return JSON.stringify(report, null, 2); }
function formatMatch(match: RequirementMatch): string[] { return [`${SYMBOLS[match.status]} ${title(match.concept)}`, `  Status: ${match.status}`, `  Claims: ${(match.claims ?? [match.claim]).join(" | ")}`, ...(match.evidence.length ? [`  Evidence: ${match.evidence.join(", ")}`] : []), ...(match.missingEvidence.length ? [`  Missing: ${match.missingEvidence.join(", ")}`] : [])]; }
function formatFinding(finding: Finding): string { return `${finding.severity === "error" ? "✗" : finding.severity === "warning" ? "!" : "?"} ${finding.message}${finding.evidence.length ? `\n  Evidence: ${finding.evidence.join(", ")}` : ""}`; }
function title(value: string): string { return value[0]?.toUpperCase() + value.slice(1); }
