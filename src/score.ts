import type { Finding, RequirementMatch, ScanReport } from "./types.js";

export function scoreReport(matches: RequirementMatch[], findings: Finding[], baselineExecuted = false, profile: "app" | "library" | "cli" | "template" = "app"): Pick<ScanReport, "score" | "scoreCoverage" | "categoryScores"> {
  const requirementRatio = matches.length === 0 ? 0 : matches.reduce((sum, match) => sum + ({ satisfied: 1, partially_satisfied: 0.5, missing: 0, unverifiable: 0.25 }[match.status]), 0) / matches.length;
  const penalty = (categories: Finding["category"][]) => findings.filter((finding) => categories.includes(finding.category)).reduce((sum, finding) => sum + (finding.severity === "error" ? 5 : finding.severity === "warning" ? 2 : 0), 0);
  const baselineApplicable = profile !== "template";
  const consistencyApplicable = profile === "app";
  const categoryScores: ScanReport["categoryScores"] = {
    requirements: matches.length === 0 ? { status: "not_applicable", score: null, maxScore: 50 } : { status: "scored", score: Math.round(50 * requirementRatio), maxScore: 50 },
    baseline: !baselineApplicable ? { status: "not_applicable", score: null, maxScore: 25 } : baselineExecuted ? { status: "scored", score: Math.max(0, 25 - penalty(["baseline", "project"])), maxScore: 25 } : { status: "not_run", score: null, maxScore: 25 },
    consistency: !consistencyApplicable ? { status: "not_applicable", score: null, maxScore: 15 } : { status: "scored", score: Math.max(0, 15 - penalty(["env", "placeholders", "claims"])), maxScore: 15 },
    hygiene: { status: "scored", score: Math.max(0, 10 - penalty(["dependencies"])), maxScore: 10 }
  };
  const scored = Object.values(categoryScores).filter((item) => item.status === "scored");
  const score = Math.round(100 * scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.reduce((sum, item) => sum + item.maxScore, 0));
  const applicable = Object.values(categoryScores).filter((item) => item.status !== "not_applicable");
  const scoreCoverage = Math.round(100 * scored.reduce((sum, item) => sum + item.maxScore, 0) / applicable.reduce((sum, item) => sum + item.maxScore, 0));
  return { score, scoreCoverage, categoryScores };
}
