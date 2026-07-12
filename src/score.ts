import type { Finding, RequirementMatch, ScanReport } from "./types.js";

export function scoreReport(matches: RequirementMatch[], findings: Finding[], baselineExecuted = false): Pick<ScanReport, "score" | "categoryScores"> {
  const requirementRatio = matches.length === 0 ? 0 : matches.reduce((sum, match) => sum + ({ satisfied: 1, partially_satisfied: 0.5, missing: 0, unverifiable: 0.25 }[match.status]), 0) / matches.length;
  const penalty = (categories: Finding["category"][]) => findings.filter((finding) => categories.includes(finding.category)).reduce((sum, finding) => sum + (finding.severity === "error" ? 5 : finding.severity === "warning" ? 2 : 0), 0);
  const categoryScores = {
    requirements: Math.round(50 * requirementRatio),
    baseline: baselineExecuted ? Math.max(0, 25 - penalty(["baseline", "project"])) : 0,
    consistency: Math.max(0, 15 - penalty(["env", "placeholders", "claims"])),
    hygiene: Math.max(0, 10 - penalty(["dependencies"]))
  };
  return { score: Object.values(categoryScores).reduce((sum, value) => sum + value, 0), categoryScores };
}
