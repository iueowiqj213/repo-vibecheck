import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { parseDocument } from "yaml";

export type ProjectProfile = "auto" | "app" | "library" | "cli" | "template";

export interface VibecheckConfig {
  projectType: ProjectProfile;
  failOn: "never" | "error" | "warning";
  offline: boolean;
  redact: boolean;
  ignore: { findings: string[]; paths: string[] };
  requirements: { disable: string[] };
  execution: { passEnv: string[] };
}

export interface LoadedConfig { config: VibecheckConfig; path?: string }

const defaults: VibecheckConfig = {
  projectType: "auto",
  failOn: "never",
  offline: false,
  redact: false,
  ignore: { findings: [], paths: [] },
  requirements: { disable: [] },
  execution: { passEnv: [] }
};
const topKeys = new Set(["projectType", "failOn", "offline", "redact", "ignore", "requirements", "execution"]);
const nestedKeys = {
  ignore: new Set(["findings", "paths"]),
  requirements: new Set(["disable"]),
  execution: new Set(["passEnv"])
};

export async function loadConfig(root: string, requested?: string): Promise<LoadedConfig> {
  const candidates = requested
    ? [isAbsolute(requested) ? requested : resolve(root, requested)]
    : [resolve(root, "repo-vibecheck.yml"), resolve(root, "repo-vibecheck.yaml")];
  let text: string | undefined;
  let path: string | undefined;
  for (const candidate of candidates) {
    try {
      text = await readFile(candidate, "utf8");
      path = candidate;
      break;
    } catch (error) {
      if (requested || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (text === undefined) return { config: structuredClone(defaults) };

  const document = parseDocument(text, { prettyErrors: true, strict: true, stringKeys: true, uniqueKeys: true });
  if (document.errors.length > 0) throw invalidConfig(document.errors[0]?.message ?? "invalid YAML");
  const value = document.toJS();
  if (!isRecord(value)) throw invalidConfig("root must be a YAML mapping");
  for (const key of Object.keys(value)) if (!topKeys.has(key)) throw invalidConfig(`unknown key: ${key}`);

  const projectType = value.projectType ?? defaults.projectType;
  if (typeof projectType !== "string" || !["auto", "app", "library", "cli", "template"].includes(projectType)) throw invalidConfig("projectType must be auto, app, library, cli, or template");
  const failOn = value.failOn ?? defaults.failOn;
  if (typeof failOn !== "string" || !["never", "error", "warning"].includes(failOn)) throw invalidConfig("failOn must be never, error, or warning");

  const boolean = (key: "offline" | "redact"): boolean => {
    const item = value[key];
    if (item === undefined) return defaults[key];
    if (typeof item !== "boolean") throw invalidConfig(`${key} must be a boolean`);
    return item;
  };
  const array = (groupName: keyof typeof nestedKeys, key: string): string[] => {
    const group = value[groupName];
    if (group !== undefined && !isRecord(group)) throw invalidConfig(`${groupName} must be a mapping`);
    if (group) for (const nestedKey of Object.keys(group)) if (!nestedKeys[groupName].has(nestedKey)) throw invalidConfig(`unknown key: ${groupName}.${nestedKey}`);
    const item = group?.[key];
    if (item === undefined) return [];
    if (!Array.isArray(item) || item.some((entry) => typeof entry !== "string")) throw invalidConfig(`${groupName}.${key} must be a string array`);
    return item;
  };

  return {
    ...(path ? { path } : {}),
    config: {
      projectType: projectType as ProjectProfile,
      failOn: failOn as VibecheckConfig["failOn"],
      offline: boolean("offline"),
      redact: boolean("redact"),
      ignore: { findings: array("ignore", "findings"), paths: array("ignore", "paths") },
      requirements: { disable: array("requirements", "disable") },
      execution: { passEnv: array("execution", "passEnv") }
    }
  };
}

export function inferProfile(manifest: { bin?: unknown; private?: boolean }, files: string[]): Exclude<ProjectProfile, "auto"> {
  if (manifest.bin) return "cli";
  if (files.some((file) => file.endsWith(".py"))) return "app";
  if (files.some((file) => /(?:^|\/)templates?(?:\/|$)/i.test(file))) return "template";
  if (!manifest.private && !files.some((file) => /(?:app|pages|src)\//.test(file))) return "library";
  return "app";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidConfig(message: string): Error {
  return new Error(`Invalid configuration: ${message}`);
}
