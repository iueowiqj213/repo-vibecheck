import { spawn } from "node:child_process";

type Manager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";
export interface CommandSpec { command: string; args: string[] }
export interface CommandResult extends CommandSpec { exitCode: number | null; timedOut: boolean; durationMs: number; stdout: string; stderr: string }

export function commandsForProject(manager: Manager, scripts: Record<string, string>, runInstall: boolean, runScripts: boolean): CommandSpec[] {
  if (manager === "unknown") return [];
  const commands: CommandSpec[] = [];
  if (runInstall) commands.push({ command: manager, args: manager === "npm" ? ["install"] : ["install"] });
  if (runScripts && scripts.build) commands.push({ command: manager, args: manager === "npm" || manager === "pnpm" || manager === "bun" ? ["run", "build"] : ["build"] });
  if (runScripts && scripts.test) commands.push({ command: manager, args: manager === "npm" || manager === "pnpm" || manager === "bun" ? ["test"] : ["test"] });
  return commands;
}

export async function runCommand(spec: CommandSpec, cwd: string, timeoutMs = 120_000): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, { cwd, shell: process.platform === "win32", env: { ...process.env, CI: "true" } });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout?.on("data", (data: Buffer) => { stdout = appendBounded(stdout, data.toString()); });
    child.stderr?.on("data", (data: Buffer) => { stderr = appendBounded(stderr, data.toString()); });
    child.on("error", (error) => { stderr = appendBounded(stderr, error.message); });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ...spec, exitCode, timedOut, durationMs: Date.now() - started, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) });
    });
  });
}

function appendBounded(current: string, next: string): string {
  const combined = current + next;
  return combined.length > 65_536 ? combined.slice(-65_536) : combined;
}
