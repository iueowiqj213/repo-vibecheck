import { createHash } from "node:crypto";
import type { Finding, RequirementMatch } from "./types.js";

export interface BaselineFile { schemaVersion: 1; fingerprints: string[] }
export type BaselineState = "new" | "unchanged";
export function fingerprint(value: Finding | RequirementMatch): string {
  const raw = "id" in value ? [value.id, value.category, value.message, ...value.evidence.map(normalizeEvidence)] : ["requirement", value.concept, value.status, ...(value.requirementId || value.sourceLine ? [value.requirementId ?? "", String(value.sourceLine ?? "")] : [])];
  return hash(raw);
}
const legacyRequirementFingerprint = (value: RequirementMatch): string => hash(["requirement", value.concept, value.status]);
const hash = (parts: string[]): string => createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
const normalizeEvidence = (value: string): string => value.replace(/^[A-Za-z]:\\[^:]+/, "<PATH>").replace(/\\/g, "/");
export function createBaseline(findings: Finding[], matches: RequirementMatch[]): BaselineFile { return { schemaVersion: 1, fingerprints: [...new Set([...findings, ...matches].map(fingerprint))].sort() }; }
export function compareBaseline(findings: Finding[], matches: RequirementMatch[], baseline: BaselineFile) {
  const previous = new Set(baseline.fingerprints), matched = new Set<string>(), added = new Set<string>();
  for (const finding of findings) classify(finding, fingerprint(finding));
  for (const match of matches) {
    const current = fingerprint(match), legacy = legacyRequirementFingerprint(match);
    classify(match, current, legacy);
  }
  const summary = { new: added.size, unchanged: matched.size, resolved: [...previous].filter((value) => !matched.has(value)).length };
  return { summary };

  function classify(value: Finding | RequirementMatch, current: string, legacy?: string): void {
    const existing = previous.has(current) && !matched.has(current) ? current : legacy && previous.has(legacy) && !matched.has(legacy) ? legacy : undefined;
    value.baselineState = existing ? "unchanged" : "new";
    if (existing) matched.add(existing); else added.add(current);
  }
}
