import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { checkReadmeScripts } from "./baseline.js";
import { checkDependencies, checkRegistryDependencies } from "./dependencies.js";
import { checkEnvironment } from "./env.js";
import { inventoryRepository } from "./inventory.js";
import { findPlaceholders } from "./placeholders.js";
import { detectProject } from "./project.js";
import { evaluateClaims, extractClaims, extractReadmeClaims, normalizeMatches } from "./requirements.js";
import { commandsForProject, runCommand } from "./runner.js";
import { scoreReport } from "./score.js";
import type { Finding, PackageManifest, ScanReport, Severity } from "./types.js";

export interface ScanOptions { requirementsPath?: string; promptPath?: string; runInstall?: boolean; runScripts?: boolean; online?: boolean }

export async function scanRepository(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const root = resolve(target);
  const inventory = await inventoryRepository(root);
  const manifest = parseManifest(inventory.sources.get("package.json"));
  const detected = detectProject(inventory.files, manifest);
  const readme = inventory.sources.get("README.md") ?? inventory.sources.get("readme.md") ?? "";
  const implementationSources = new Map([...inventory.sources].filter(([file]) => /\.(?:[cm]?[jt]sx?|py)$/i.test(file) && !/(?:^|\/)(?:tests?|__tests__|examples?|fixtures?)(?:\/|$)/i.test(file)));
  const findings: Finding[] = [...detected.findings, ...checkReadmeScripts(readme, manifest.scripts ?? {}), ...checkDependencies(manifest)];
  const env = checkEnvironment(implementationSources, inventory.sources.get(".env.example") ?? "", readme);
  for (const variable of env.usedMissing) findings.push({ id: "env.used-missing", category: "env", severity: "error", message: `${variable} is used in code but missing from .env.example`, evidence: [variable] });
  for (const variable of env.exampleUnused) findings.push({ id: "env.example-unused", category: "env", severity: "warning", message: `${variable} exists in .env.example but is not used in code`, evidence: [variable] });
  for (const variable of env.readmeMissing) findings.push({ id: "env.readme-missing", category: "env", severity: "warning", message: `${variable} is mentioned in README but missing from .env.example`, evidence: [variable] });
  const requirementText = await loadOptional(root, options.requirementsPath ?? options.promptPath);
  const claims = [...new Set([...extractClaims(requirementText), ...extractReadmeClaims(readme)])];
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  findings.push(...findPlaceholders(implementationSources));
  const evidenceFiles = inventory.files.filter((file) => !/\.(?:md|mdx|txt)$/i.test(file) && !/(?:^|\/)(?:requirements?|prompts?|specs?)(?:[./_-]|$)/i.test(file));
  const requirementMatches = normalizeMatches(evaluateClaims(claims, { files: evidenceFiles, dependencies, sources: implementationSources }));
  const hasPaymentEvidence = requirementMatches.some((match) => match.concept === "payment" && match.evidence.length > 0);
  const hasWebhookEvidence = [...implementationSources].some(([file, source]) => /webhook/i.test(file) || /webhooks\.constructEvent/i.test(source));
  if (hasPaymentEvidence && !hasWebhookEvidence) findings.push({ id: "claims.payment-webhook-missing", category: "claims", severity: "warning", message: "Payment evidence found, but no webhook handler evidence was detected", evidence: [], remediation: "Add and document a verified server-side payment webhook handler if the flow requires one." });
  const specs = commandsForProject(detected.packageManager, manifest.scripts ?? {}, options.runInstall ?? false, options.runScripts ?? false);
  for (const spec of specs) {
    const result = await runCommand(spec, root);
    findings.push({ id: "baseline.command", category: "baseline", severity: result.exitCode === 0 && !result.timedOut ? "info" : "error", message: `${spec.command} ${spec.args.join(" ")} ${result.exitCode === 0 ? "passed" : "failed"}`, evidence: [`exit=${result.exitCode}`, `duration=${result.durationMs}ms`, ...(result.timedOut ? ["timed out"] : [])] });
  }
  if (options.online !== false) findings.push(...await checkRegistryDependencies({ ...manifest.dependencies, ...manifest.devDependencies }));
  const scored = scoreReport(requirementMatches, findings, Boolean(options.runInstall || options.runScripts));
  const summary = { error: 0, warning: 0, info: 0 } satisfies Record<Severity, number>;
  for (const finding of findings) summary[finding.severity]++;
  return {
    schemaVersion: "1.1", product: "repo-vibecheck", targetPath: root, generatedAt: new Date().toISOString(),
    ...scored,
    project: { packageManager: detected.packageManager, lockfiles: detected.lockfiles, projectTypes: detected.projectTypes, scripts: detected.scripts },
    checksExecuted: ["static", ...(options.online === false ? [] : ["registry"]), ...(options.runInstall ? ["install"] : []), ...(options.runScripts ? ["build-test"] : [])],
    requirementMatches, findings, summary
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
