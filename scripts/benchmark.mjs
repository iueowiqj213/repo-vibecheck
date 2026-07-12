#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const fixtureMode = argv.includes("--fixture");
const validateOnly = argv.includes("--validate");
const jsonOutput = argv.includes("--json");
const outputIndex = argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? argv[outputIndex + 1] : undefined;
const manifestIndex = argv.indexOf("--manifest");
const manifestPath = manifestIndex >= 0 ? argv[manifestIndex + 1] : join(root, "benchmarks", "repos.json");

if (!manifestPath) throw new Error("--manifest requires a file path");
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
validateManifest(manifest);

if (validateOnly) {
  console.log(`Benchmark manifest valid (${manifest.repositories.length} repositories)`);
  process.exit(0);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "repo-vibecheck-benchmark-"));
try {
  const targets = fixtureMode
    ? [{ name: "fixture-vite-react", path: join(root, "benchmarks", "fixtures", "vite-react") }]
    : await cloneCorpus(manifest.repositories, temporaryRoot);
  const repositories = targets.map(({ name, path }) => scanTarget(name, path));
  const summary = { generatedAt: new Date().toISOString(), mode: fixtureMode ? "fixture" : "public", repositories };
  if (outputPath) await writeFile(resolve(outputPath), `${JSON.stringify(summary, null, 2)}\n`);
  if (jsonOutput) console.log(JSON.stringify(summary));
  else printSummary(summary);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function validateManifest(value) {
  if (!value || !Array.isArray(value.repositories) || value.repositories.length === 0) throw new Error("Benchmark manifest must contain repositories");
  const names = new Set();
  for (const entry of value.repositories) {
    if (!entry || typeof entry.name !== "string" || names.has(entry.name)) throw new Error("Benchmark repository names must be unique strings");
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(entry.name) || entry.name === "." || entry.name === "..") throw new Error(`Benchmark repository name must be a safe slug: ${entry.name}`);
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(entry.url)) throw new Error(`Invalid GitHub URL for ${entry.name}`);
    if (!/^[0-9a-f]{40}$/i.test(entry.commit)) throw new Error(`Commit for ${entry.name} must be a 40-character SHA`);
    if (!Array.isArray(entry.expectedTypes) || entry.expectedTypes.length === 0) throw new Error(`Expected project types missing for ${entry.name}`);
    names.add(entry.name);
  }
}

async function cloneCorpus(repositories, destination) {
  const targets = [];
  for (const repository of repositories) {
    const path = join(destination, repository.name);
    execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", repository.url, path], { stdio: "ignore" });
    execFileSync("git", ["-C", path, "fetch", "--depth", "1", "origin", repository.commit], { stdio: "ignore" });
    execFileSync("git", ["-C", path, "checkout", "--detach", "FETCH_HEAD"], { stdio: "ignore" });
    targets.push({ name: repository.name, path });
  }
  return targets;
}

function scanTarget(name, target) {
  const started = Date.now();
  const builtCli = join(root, "dist", "cli.js");
  if (!existsSync(builtCli)) throw new Error("Built CLI not found. Run npm run build before benchmarking.");
  const result = spawnSync(process.execPath, [builtCli, "scan", target, "--json", "--offline", "--fail-on", "never"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout) {
    return { name, durationMs: Date.now() - started, score: null, projectTypes: [], findings: null, requirementMatches: 0, outcome: "failed", exitCode: result.status, error: result.stderr.trim() };
  }
  const report = JSON.parse(result.stdout);
  return {
    name,
    durationMs: Date.now() - started,
    score: report.score,
    projectTypes: report.project.projectTypes,
    findings: report.summary,
    requirementMatches: report.requirementMatches.length,
    outcome: "completed",
    exitCode: result.status
  };
}

function printSummary(summary) {
  console.log(`Repo Vibecheck benchmark (${summary.mode})`);
  for (const repository of summary.repositories) {
    console.log(`${repository.name}: ${repository.score}/100, ${repository.projectTypes.join(", ")} (${repository.durationMs}ms)`);
  }
}
