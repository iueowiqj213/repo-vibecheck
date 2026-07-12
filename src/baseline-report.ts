import { createHash } from "node:crypto";
import type { Finding, RequirementMatch } from "./types.js";

export interface BaselineFile { schemaVersion: 1; fingerprints: string[] }
export type BaselineState = "new" | "unchanged";
export function fingerprint(value: Finding | RequirementMatch): string {
  const raw = "id" in value ? [value.id, value.category, value.message, ...value.evidence.map(normalizeEvidence)] : ["requirement", value.concept, value.status];
  return createHash("sha256").update(raw.join("\0")).digest("hex").slice(0, 24);
}
const normalizeEvidence = (value: string): string => value.replace(/^[A-Za-z]:\\[^:]+/, "<PATH>").replace(/\\/g, "/");
export function createBaseline(findings: Finding[], matches: RequirementMatch[]): BaselineFile { return { schemaVersion: 1, fingerprints: [...new Set([...findings, ...matches].map(fingerprint))].sort() }; }
export function compareBaseline(findings: Finding[], matches: RequirementMatch[], baseline: BaselineFile) {
  const previous = new Set(baseline.fingerprints), current = new Set([...findings, ...matches].map(fingerprint));
  for (const finding of findings) finding.baselineState = previous.has(fingerprint(finding)) ? "unchanged" : "new";
  for (const match of matches) match.baselineState = previous.has(fingerprint(match)) ? "unchanged" : "new";
  const summary = { new: [...current].filter((value) => !previous.has(value)).length, unchanged: [...current].filter((value) => previous.has(value)).length, resolved: [...previous].filter((value) => !current.has(value)).length };
  return { summary };
}
