#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { appendFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command, CommanderError } from "commander";
import { createBaseline } from "./baseline-report.js";
import { loadConfig } from "./config.js";
import { renderHuman, renderJson } from "./reporters.js";
import { redactReport } from "./redact.js";
import { renderSarif } from "./sarif.js";
import { renderSummary } from "./summary.js";
import { exitCodeForReport, parseFailLevel, type FailLevel } from "./policy.js";
import { scanRepository, type ScanOptions } from "./scan.js";
import type { ScanReport } from "./types.js";

type Scanner = (target: string, options: ScanOptions) => Promise<ScanReport>;
interface CliOptions { json?: boolean; offline?: boolean; requirements?: string; prompt?: string; runInstall?: boolean; runScripts?: boolean; failOn?: FailLevel; config?: string; projectType?: "auto" | "app" | "library" | "cli" | "template"; baseline?: string; writeBaseline?: string; format?: "human" | "json" | "sarif"; output?: string; redact?: boolean; passEnv?: string[] }

export function createProgram(scanner: Scanner = scanRepository, write: (value: string) => void = (value) => process.stdout.write(value)): Command {
  const program = new Command();
  program.exitOverride((error) => {
    if (error.exitCode === 0) throw error;
    throw new CommanderError(2, error.code, error.message);
  });
  program.name("repo-vibecheck").description("Verify that an AI-generated repo works and matches what was requested.").version("0.2.0");
  program.command("scan")
    .description("Audit a repository")
    .argument("[path]", "repository path", ".")
    .option("--json", "emit machine-readable JSON")
    .option("--offline", "skip npm registry metadata checks")
    .option("--config <file>", "policy configuration file")
    .option("--project-type <type>", "auto, app, library, cli, or template")
    .option("--baseline <file>", "compare against a baseline")
    .option("--write-baseline <file>", "write a baseline from this scan")
    .option("--format <format>", "human, json, or sarif", "human")
    .option("--output <file>", "write report to a file")
    .option("--redact", "redact secret-like evidence and home paths")
    .option("--pass-env <names...>", "explicit host environment variable allowlist for --run-*")
    .option("--requirements <file>", "requirements or product specification file")
    .option("--prompt <file>", "original AI prompt file")
    .option("--run-install", "run the detected package manager install command")
    .option("--run-scripts", "run finite build and test scripts")
    .option("--fail-on <level>", "exit 1 for findings at this level: never, error, warning", parseFailLevel)
    .action(async (target: string, flags: CliOptions) => {
      if ((flags.runInstall || flags.runScripts) && !flags.json) write("Warning: executing repository code because an explicit --run-* flag was supplied.\n\n");
      const loadedConfig = await loadConfig(resolve(target), flags.config);
      const options: ScanOptions = {
        ...(flags.offline ? { online: false } : {}),
        ...(flags.config ? { configPath: flags.config } : {}),
        ...(flags.projectType ? { projectType: flags.projectType } : {}),
        ...(flags.baseline ? { baselinePath: flags.baseline } : {}),
        ...(flags.requirements ? { requirementsPath: flags.requirements } : {}),
        ...(flags.prompt ? { promptPath: flags.prompt } : {}),
        ...(flags.runInstall ? { runInstall: true } : {}),
        ...(flags.runScripts ? { runScripts: true } : {})
        ,...(flags.passEnv ? { passEnv: flags.passEnv } : {})
      };
      const report = (flags.redact ?? loadedConfig.config.redact) ? redactReport(await scanner(target, options)) : await scanner(target, options);
      const format = flags.json ? "json" : flags.format ?? "human";
      const rendered = format === "sarif" ? renderSarif(report) : format === "json" ? renderJson(report) : renderHuman(report);
      if (flags.output) await atomicWrite(flags.output, `${rendered}\n`); else write(`${rendered}\n`);
      if (flags.writeBaseline) await atomicWrite(flags.writeBaseline, `${JSON.stringify(createBaseline(report.findings, report.requirementMatches), null, 2)}\n`);
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${renderSummary(report)}\n`);
      process.exitCode = exitCodeForReport(report, flags.failOn ?? loadedConfig.config.failOn, Boolean(flags.baseline));
    });
  return program;
}

async function atomicWrite(path: string, content: string): Promise<void> { const target = resolve(path), temporary = `${target}.${process.pid}.tmp`; await writeFile(temporary, content); await rename(temporary, target); }

async function main(): Promise<void> {
  try { await createProgram().parseAsync(process.argv); }
  catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      process.exitCode = 0;
      return;
    }
    process.stderr.write(`repo-vibecheck: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main();
