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
}

export interface RequirementMatch {
  claim: string;
  claims?: string[];
  concept: string;
  status: RequirementStatus;
  evidence: string[];
  missingEvidence: string[];
}

export interface ProjectInfo {
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  lockfiles: string[];
  projectTypes: string[];
  scripts: string[];
}

export interface ScanReport {
  schemaVersion: "1.1";
  product: "repo-vibecheck";
  targetPath: string;
  generatedAt: string;
  score: number;
  categoryScores: { requirements: number; baseline: number; consistency: number; hygiene: number };
  project: ProjectInfo;
  checksExecuted: string[];
  requirementMatches: RequirementMatch[];
  findings: Finding[];
  summary: Record<Severity, number>;
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
}
