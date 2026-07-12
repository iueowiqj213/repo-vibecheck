import type { Finding } from "./types.js";

export function checkReadmeScripts(readme: string, scripts: Record<string, string>): Finding[] {
  const mentioned = new Set<string>();
  for (const match of readme.matchAll(/(?:npm run|pnpm|yarn|bun run)\s+([\w:-]+)/gi)) if (match[1]) mentioned.add(match[1]);
  if (/\bnpm test\b/i.test(readme)) mentioned.add("test");
  return [...mentioned].filter((script) => !scripts[script]).map((script) => ({
    id: "baseline.missing-readme-script", category: "baseline" as const, severity: "error" as const,
    message: `README references missing package script: ${script}`, evidence: [`package.json scripts.${script}`],
    remediation: `Add the ${script} script or correct the README.`
  }));
}
