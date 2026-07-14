import { spawn, spawnSync } from "node:child_process";

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

export async function runCommand(spec: CommandSpec, cwd: string, timeoutMs = 120_000, passEnv: string[] = []): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { CI: "true" };
    for (const key of ["PATH", "Path", "SystemRoot", "HOME", "USERPROFILE", "TEMP", "TMP", ...passEnv]) if (process.env[key] !== undefined) env[key] = process.env[key];
    const child = spawn(spec.command, spec.args, { cwd, shell: process.platform === "win32", detached: process.platform !== "win32", env });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutMs);
    child.stdout?.on("data", (data: Buffer) => { stdout = appendBounded(stdout, data.toString()); });
    child.stderr?.on("data", (data: Buffer) => { stderr = appendBounded(stderr, data.toString()); });
    child.on("error", (error) => { stderr = appendBounded(stderr, error.message); });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ...spec, exitCode, timedOut, durationMs: Date.now() - started, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) });
    });
  });
}

function killTree(pid: number | undefined): void { if (!pid) return; if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); else try { process.kill(-pid, "SIGKILL"); } catch { /* process already exited */ } }

function appendBounded(current: string, next: string): string {
  const combined = current + next;
  return combined.length > 65_536 ? combined.slice(-65_536) : combined;
}
