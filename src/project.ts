import type { Finding, PackageManifest, ProjectInfo } from "./types.js";

const LOCKFILES = new Map([
  ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lock", "bun"], ["bun.lockb", "bun"]
] as const);
const NON_PROJECT_PYTHON = /(?:^|\/)(?:docs?|documentation|examples?|fixtures?)(?:\/|$)/i;

export function detectProject(files: string[], manifest: PackageManifest): ProjectInfo & { findings: Finding[] } {
  const lockfiles = files.filter((file) => LOCKFILES.has(file as never));
  const declared = manifest.packageManager?.split("@")[0];
  const fromLock = lockfiles.map((file) => LOCKFILES.get(file as never)).filter((value): value is "npm" | "pnpm" | "yarn" | "bun" => Boolean(value));
  const lockManager = fromLock[0];
  const packageManager: ProjectInfo["packageManager"] = fromLock.length === 1 && lockManager ? lockManager : (isManager(declared) ? declared : (lockManager ?? "unknown"));
  const findings: Finding[] = [];
  if (new Set(fromLock).size > 1) {
    findings.push({ id: "project.multiple-lockfiles", category: "project", severity: "error", message: "Multiple package-manager lockfiles found", evidence: lockfiles });
  }
  if (isManager(declared) && fromLock.length > 0 && !fromLock.includes(declared)) {
    findings.push({ id: "project.package-manager-mismatch", category: "project", severity: "error", message: `packageManager declares ${declared}, but lockfile indicates ${fromLock[0]}`, evidence: lockfiles });
  }
  const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
  const projectTypes: string[] = [];
  if (files.includes("package.json") || Object.keys(deps).length > 0 || manifest.scripts) projectTypes.push("Node.js");
  if (files.some((file) => file.endsWith(".py") && !NON_PROJECT_PYTHON.test(file)) || files.includes("pyproject.toml") || files.includes("requirements.txt")) projectTypes.push("Python");
  if (files.includes("tsconfig.json") || deps.typescript) projectTypes.push("TypeScript");
  if (deps.next) projectTypes.push("Next.js");
  if (deps.vite || files.some((file) => /^vite\.config\./.test(file))) projectTypes.push("Vite");
  if (deps.react) projectTypes.push("React");
  if (projectTypes.length === 0) projectTypes.push("Unknown");
  return { packageManager, lockfiles, projectTypes, scripts: Object.keys(manifest.scripts ?? {}), findings };
}

function isManager(value: string | undefined): value is "npm" | "pnpm" | "yarn" | "bun" {
  return value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";
}
