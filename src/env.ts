export interface EnvCheckResult { used: string[]; example: string[]; readme: string[]; usedMissing: string[]; exampleUnused: string[]; readmeMissing: string[] }

export function checkEnvironment(sources: Map<string, string>, exampleText = "", readme = ""): EnvCheckResult {
  const used = new Set<string>();
  const patterns = [
    /(?:process|import\.meta)\.env\.([A-Z][A-Z0-9_]*)/g,
    /Deno\.env\.get\(["']([A-Z][A-Z0-9_]*)["']\)/g,
    /os\.environ\[["']([A-Z][A-Z0-9_]*)["']\]/g,
    /os\.getenv\(["']([A-Z][A-Z0-9_]*)["']\)/g
  ];
  for (const source of sources.values()) for (const pattern of patterns) collect(pattern, source, used);
  const example = new Set<string>();
  collect(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm, exampleText, example);
  const readmeVars = new Set<string>();
  collect(/\b([A-Z][A-Z0-9_]{2,})\b/g, readme, readmeVars);
  const commonSingleWordVars = new Set(["CI", "PORT", "HOME", "PATH", "DEBUG"]);
  for (const variable of readmeVars) if (!variable.includes("_") && !commonSingleWordVars.has(variable)) readmeVars.delete(variable);
  return {
    used: sorted(used), example: sorted(example), readme: sorted(readmeVars),
    usedMissing: sortedDifference(used, example), exampleUnused: sortedDifference(example, used), readmeMissing: sortedDifference(readmeVars, example)
  };
}

function collect(pattern: RegExp, text: string, target: Set<string>): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) if (match[1]) target.add(match[1]);
}
const sorted = (values: Set<string>): string[] => [...values].sort();
const sortedDifference = (left: Set<string>, right: Set<string>): string[] => [...left].filter((value) => !right.has(value)).sort();
