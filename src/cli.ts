#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { renderHuman, renderJson } from "./reporters.js";
import { exitCodeForReport, parseFailLevel, type FailLevel } from "./policy.js";
import { scanRepository, type ScanOptions } from "./scan.js";
import type { ScanReport } from "./types.js";

type Scanner = (target: string, options: ScanOptions) => Promise<ScanReport>;
interface CliOptions { json?: boolean; offline?: boolean; requirements?: string; prompt?: string; runInstall?: boolean; runScripts?: boolean; failOn: FailLevel }

export function createProgram(scanner: Scanner = scanRepository, write: (value: string) => void = (value) => process.stdout.write(value)): Command {
  const program = new Command();
  program.exitOverride((error) => {
    if (error.exitCode === 0) throw error;
    throw new CommanderError(2, error.code, error.message);
  });
  program.name("repo-vibecheck").description("Verify that an AI-generated repo works and matches what was requested.").version("0.1.0");
  program.command("scan")
    .description("Audit a repository")
    .argument("[path]", "repository path", ".")
    .option("--json", "emit machine-readable JSON")
    .option("--offline", "skip npm registry metadata checks")
    .option("--requirements <file>", "requirements or product specification file")
    .option("--prompt <file>", "original AI prompt file")
    .option("--run-install", "run the detected package manager install command")
    .option("--run-scripts", "run finite build and test scripts")
    .option("--fail-on <level>", "exit 1 for findings at this level: never, error, warning", parseFailLevel, "never")
    .action(async (target: string, flags: CliOptions) => {
      if ((flags.runInstall || flags.runScripts) && !flags.json) write("Warning: executing repository code because an explicit --run-* flag was supplied.\n\n");
      const options: ScanOptions = {
        online: !flags.offline,
        ...(flags.requirements ? { requirementsPath: flags.requirements } : {}),
        ...(flags.prompt ? { promptPath: flags.prompt } : {}),
        ...(flags.runInstall ? { runInstall: true } : {}),
        ...(flags.runScripts ? { runScripts: true } : {})
      };
      const report = await scanner(target, options);
      write(`${flags.json ? renderJson(report) : renderHuman(report)}\n`);
      process.exitCode = exitCodeForReport(report, flags.failOn);
    });
  return program;
}

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
