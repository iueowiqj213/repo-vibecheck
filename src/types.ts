export type Severity = "info" | "warning" | "error";
export type FindingCategory = "project" | "baseline" | "requirements" | "claims" | "env" | "dependencies" | "placeholders";
export type RequirementStatus = "satisfied" | "partially_satisfied" | "missing" | "unverifiable";

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  message: string;
  evidence: string[];
  remediation?: string;
  baselineState?: "new" | "unchanged";
}

export interface RequirementMatch {
  claim: string;
  claims?: string[];
  concept: string;
  status: RequirementStatus;
  evidence: string[];
  missingEvidence: string[];
  baselineState?: "new" | "unchanged";
  requirementId?: string;
  sourceLine?: number;
}

export interface ProjectInfo {
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  lockfiles: string[];
  projectTypes: string[];
  scripts: string[];
  profile?: "app" | "library" | "cli" | "template";
}

export interface CategoryScore { status: "scored" | "not_run" | "not_applicable"; score: number | null; maxScore: number; coverage?: number }

export interface ScanReport {
  schemaVersion: "2.0";
  product: "repo-vibecheck";
  targetPath: string;
  generatedAt: string;
  score: number;
  scoreCoverage: number;
  categoryScores: { requirements: CategoryScore; baseline: CategoryScore; consistency: CategoryScore; hygiene: CategoryScore };
  project: ProjectInfo;
  checksExecuted: string[];
  requirementMatches: RequirementMatch[];
  findings: Finding[];
  summary: Record<Severity, number>;
  configPath?: string;
  baseline?: { new: number; unchanged: number; resolved: number };
}

export interface PackageManifest {
  name?: string;
  packageManager?: string;
  license?: string;
  repository?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin?: unknown;
  private?: boolean;
}
