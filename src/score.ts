import type { Finding, RequirementMatch, ScanReport } from "./types.js";

const requirementCredit = {
  satisfied: 1,
  partially_satisfied: 0.5,
  missing: 0,
  unverifiable: 0
} as const;

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round(Math.max(0, Math.min(1, numerator / denominator)) * 100);
}

export function scoreReport(matches: RequirementMatch[], findings: Finding[], baselineExecuted = false, profile: "app" | "library" | "cli" | "template" = "app"): Pick<ScanReport, "score" | "scoreCoverage" | "categoryScores"> {
  const requirementRatio = matches.length === 0 ? 0 : matches.reduce((sum, match) => sum + requirementCredit[match.status], 0) / matches.length;
  const requirementCoverage = percentage(matches.filter((match) => match.status !== "unverifiable").length, matches.length);
  const penalty = (categories: Finding["category"][]) => findings.filter((finding) => categories.includes(finding.category)).reduce((sum, finding) => sum + (finding.severity === "error" ? 5 : finding.severity === "warning" ? 2 : 0), 0);
  const baselineFailure = findings.some((finding) => finding.severity === "error" && (finding.category === "baseline" || finding.category === "project"));
  const baselineApplicable = profile !== "template";
  const consistencyApplicable = profile === "app";
  const categoryScores: ScanReport["categoryScores"] = {
    requirements: matches.length === 0 ? { status: "not_applicable", score: null, maxScore: 50 } : { status: "scored", score: Math.round(50 * requirementRatio), maxScore: 50, coverage: requirementCoverage },
    baseline: !baselineApplicable ? { status: "not_applicable", score: null, maxScore: 25 } : baselineExecuted ? { status: "scored", score: baselineFailure ? 0 : Math.max(0, 25 - penalty(["baseline", "project"])), maxScore: 25 } : { status: "not_run", score: null, maxScore: 25 },
    consistency: !consistencyApplicable ? { status: "not_applicable", score: null, maxScore: 15 } : { status: "scored", score: Math.max(0, 15 - penalty(["env", "placeholders", "claims"])), maxScore: 15 },
    hygiene: { status: "scored", score: Math.max(0, 10 - penalty(["dependencies"])), maxScore: 10 }
  };
  const scored = Object.values(categoryScores).filter((item) => item.status === "scored");
  const score = percentage(scored.reduce((sum, item) => sum + (item.score ?? 0), 0), scored.reduce((sum, item) => sum + item.maxScore, 0));
  const applicable = Object.values(categoryScores).filter((item) => item.status !== "not_applicable");
  const scoreCoverage = percentage(scored.reduce((sum, item) => sum + item.maxScore * ((item.coverage ?? 100) / 100), 0), applicable.reduce((sum, item) => sum + item.maxScore, 0));
  return { score, scoreCoverage, categoryScores };
}
