import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { checkReadmeScripts } from "./baseline.js";
import { compareBaseline, type BaselineFile } from "./baseline-report.js";
import { inferProfile, loadConfig, type ProjectProfile } from "./config.js";
import { checkDependencies, checkRegistryDependencies } from "./dependencies.js";
import { checkEnvironment } from "./env.js";
import { inventoryRepository } from "./inventory.js";
import { findPlaceholders } from "./placeholders.js";
import { detectProject } from "./project.js";
import { evaluateClaims, extractClaims, extractReadmeClaims, extractReadmeRequirements, normalizeMatches } from "./requirements.js";
import { commandsForProject, runCommand } from "./runner.js";
import { scoreReport } from "./score.js";
import type { Finding, PackageManifest, ScanReport, Severity } from "./types.js";

export interface ScanOptions { requirementsPath?: string; promptPath?: string; runInstall?: boolean; runScripts?: boolean; online?: boolean; configPath?: string; projectType?: ProjectProfile; baselinePath?: string; passEnv?: string[] }

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|py)$/i;
const TEST_SOURCE = /(?:^|\/)(?:__tests__|specs?|tests?)(?:\/|$)|(?:^|\/)(?:test_.*|.*(?:\.test|\.spec|_test))\.[^/]+$/i;
const DOCUMENTATION = /(?:^|\/)(?:docs?|documentation|examples?|fixtures?)(?:\/|$)|\.(?:md|mdx|txt)$/i;

export async function scanRepository(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const root = resolve(target);
  const loadedConfig = await loadConfig(root, options.configPath);
  const inventory = await inventoryRepository(root);
  for (const file of [...inventory.files]) if (loadedConfig.config.ignore.paths.some((pattern) => ignored(file, pattern))) { inventory.files.splice(inventory.files.indexOf(file), 1); inventory.sources.delete(file); }
  const manifest = parseManifest(inventory.sources.get("package.json"));
  const detected = detectProject(inventory.files, manifest);
  const configuredProfile = options.projectType ?? loadedConfig.config.projectType;
  const profile = configuredProfile === "auto" ? inferProfile(manifest, inventory.files) : configuredProfile;
  const readme = inventory.sources.get("README.md") ?? inventory.sources.get("readme.md") ?? "";
  const sourceEntries = [...inventory.sources].filter(([file]) => SOURCE_FILE.test(file));
  const implementationSources = new Map(sourceEntries.filter(([file]) => !TEST_SOURCE.test(file) && !DOCUMENTATION.test(file)));
  const testSources = new Map(sourceEntries.filter(([file]) => TEST_SOURCE.test(file)));
  let findings: Finding[] = [...detected.findings, ...checkReadmeScripts(readme, manifest.scripts ?? {}), ...(inventory.files.includes("package.json") ? checkDependencies(manifest) : [])];
  const env = checkEnvironment(implementationSources, inventory.sources.get(".env.example") ?? "", readme);
  for (const variable of env.usedMissing) findings.push({ id: "env.used-missing", category: "env", severity: "error", message: `${variable} is used in code but missing from .env.example`, evidence: [variable] });
  for (const variable of env.exampleUnused) findings.push({ id: "env.example-unused", category: "env", severity: "warning", message: `${variable} exists in .env.example but is not used in code`, evidence: [variable] });
  for (const variable of env.readmeMissing) findings.push({ id: "env.readme-missing", category: "env", severity: "warning", message: `${variable} is mentioned in README but missing from .env.example`, evidence: [variable] });
  const requirementText = await loadOptional(root, options.requirementsPath ?? options.promptPath);
  const readmeRequirements = extractReadmeRequirements(readme);
  const explicitClaims = new Set(readmeRequirements.map((requirement) => withoutChecklistMarker(requirement.claim)));
  const explicitRequirementIds = new Set(readmeRequirements.map((requirement) => requirement.requirementId));
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  findings.push(...findPlaceholders(implementationSources));
  const evidenceFiles = inventory.files.filter((file) => !DOCUMENTATION.test(file));
  const testFiles = evidenceFiles.filter((file) => TEST_SOURCE.test(file));
  const implementationFiles = evidenceFiles.filter((file) => !TEST_SOURCE.test(file));
  const evidenceContext = { files: evidenceFiles, implementationFiles, testFiles, dependencies, sources: implementationSources, implementationSources, testSources };
  const explicitMatches = evaluateClaims(readmeRequirements, evidenceContext);
  const explicitConcepts = new Set(explicitMatches.map((match) => match.concept).filter((concept) => concept !== "unknown"));
  const genericReadmeMatches = evaluateClaims(extractReadmeClaims(readme).filter((claim) => !explicitClaims.has(withoutChecklistMarker(claim)) && ![...explicitRequirementIds].some((id) => claim.includes(id))), evidenceContext)
    .filter((match) => !explicitConcepts.has(match.concept));
  let requirementMatches = [
    ...normalizeMatches([...evaluateClaims(extractClaims(requirementText), evidenceContext), ...genericReadmeMatches]),
    ...explicitMatches
  ].filter((match) => match.concept === "unknown" || !loadedConfig.config.requirements.disable.includes(match.concept));
  const unverifiableRequirements = requirementMatches.filter((match) => match.status === "unverifiable" && match.requirementId && explicitRequirementIds.has(match.requirementId));
  if (unverifiableRequirements.length > 0) {
    findings.push({
      id: "requirements.unverifiable",
      category: "requirements",
      severity: "warning",
      message: `${unverifiableRequirements.length} explicit requirement${unverifiableRequirements.length === 1 ? "" : "s"} could not be classified`,
      evidence: unverifiableRequirements.map((match) => match.requirementId ?? "").sort()
    });
  }
  const hasPaymentEvidence = requirementMatches.some((match) => match.concept === "payment" && match.evidence.length > 0);
  const hasWebhookEvidence = [...implementationSources].some(([file, source]) => /webhook/i.test(file) || /webhooks\.constructEvent/i.test(source));
  if (hasPaymentEvidence && !hasWebhookEvidence) findings.push({ id: "claims.payment-webhook-missing", category: "claims", severity: "warning", message: "Payment evidence found, but no webhook handler evidence was detected", evidence: [], remediation: "Add and document a verified server-side payment webhook handler if the flow requires one." });
  const specs = commandsForProject(detected.packageManager, manifest.scripts ?? {}, options.runInstall ?? false, options.runScripts ?? false, detected.projectTypes);
  const executedChecks: string[] = [];
  for (const spec of specs) {
    const result = await runCommand(spec, root, 120_000, options.passEnv ?? loadedConfig.config.execution.passEnv);
    if (spec.label) executedChecks.push(spec.label);
    const unittestSummaries = result.stderr.match(/^Ran \d+ tests? in [^\r\n]+$/gm) ?? [];
    const noTests = spec.label === "python-test" && /^Ran 0 tests? /.test(unittestSummaries.at(-1) ?? "");
    const passed = result.exitCode === 0 && !result.timedOut && !noTests;
    findings.push({ id: "baseline.command", category: "baseline", severity: passed ? "info" : "error", message: `${spec.command} ${spec.args.join(" ")} ${passed ? "passed" : "failed"}`, evidence: [`exit=${result.exitCode}`, `duration=${result.durationMs}ms`, ...(result.timedOut ? ["timed out"] : []), ...(noTests ? ["no tests discovered"] : [])] });
  }
  const online = options.online ?? !loadedConfig.config.offline;
  if (online) findings.push(...await checkRegistryDependencies({ ...manifest.dependencies, ...manifest.devDependencies }));
  findings = findings.filter((finding) => !loadedConfig.config.ignore.findings.includes(finding.id));
  let baselineSummary: ScanReport["baseline"];
  if (options.baselinePath) {
    const baseline = JSON.parse(await loadOptional(root, options.baselinePath)) as BaselineFile;
    baselineSummary = compareBaseline(findings, requirementMatches, baseline).summary;
  }
  const scored = scoreReport(requirementMatches, findings, specs.length > 0, profile);
  const summary = { error: 0, warning: 0, info: 0 } satisfies Record<Severity, number>;
  for (const finding of findings) summary[finding.severity]++;
  return {
    schemaVersion: "2.0", product: "repo-vibecheck", targetPath: root, generatedAt: new Date().toISOString(),
    ...scored,
    project: { packageManager: detected.packageManager, lockfiles: detected.lockfiles, projectTypes: detected.projectTypes, scripts: detected.scripts, profile },
    checksExecuted: [...new Set(["static", ...(online ? ["registry"] : []), ...executedChecks])],
    requirementMatches, findings, summary, ...(loadedConfig.path ? { configPath: loadedConfig.path } : {}), ...(baselineSummary ? { baseline: baselineSummary } : {})
  };
}

function parseManifest(value: string | undefined): PackageManifest {
  if (!value) return {};
  try { return JSON.parse(value) as PackageManifest; } catch { throw new Error("package.json contains invalid JSON"); }
}
async function loadOptional(root: string, file: string | undefined): Promise<string> {
  if (!file) return "";
  return readFile(isAbsolute(file) ? file : resolve(root, file), "utf8");
}
function ignored(file: string, pattern: string): boolean { const normalized = pattern.replace(/\\/g, "/"); if (normalized.endsWith("/**")) return file.startsWith(normalized.slice(0, -3)); const regex = new RegExp(`^${normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`); return regex.test(file); }
function withoutChecklistMarker(claim: string): string { return claim.replace(/^\[[ xX]\]\s*/, "").trim(); }
