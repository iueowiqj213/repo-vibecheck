import type { Finding, PackageManifest } from "./types.js";

export function checkDependencies(manifest: PackageManifest): Finding[] {
  const findings: Finding[] = [];
  const dependencies = Object.keys(manifest.dependencies ?? {});
  const devDependencies = Object.keys(manifest.devDependencies ?? {});
  findings.push({ id: "dependencies.count", category: "dependencies", severity: "info", message: `${dependencies.length} dependencies, ${devDependencies.length} devDependencies`, evidence: [] });
  if (!manifest.license) findings.push({ id: "dependencies.missing-license", category: "dependencies", severity: "warning", message: "package.json is missing license metadata", evidence: ["package.json"] });
  if (!manifest.repository) findings.push({ id: "dependencies.missing-repository", category: "dependencies", severity: "warning", message: "package.json is missing repository metadata", evidence: ["package.json"] });
  for (const script of ["preinstall", "install", "postinstall"]) if (manifest.scripts?.[script]) findings.push({ id: "dependencies.lifecycle-script", category: "dependencies", severity: "warning", message: `Package defines a ${script} lifecycle script`, evidence: [`${script}: ${manifest.scripts[script]}`] });
  return findings;
}

interface OutdatedEntry { current?: string; wanted?: string; latest?: string; deprecated?: string }

export function parseOutdated(output: string): Finding[] {
  if (!output.trim()) return [];
  let parsed: Record<string, OutdatedEntry>;
  try { parsed = JSON.parse(output) as Record<string, OutdatedEntry>; } catch { return []; }
  return Object.entries(parsed).map(([name, value]) => ({
    id: "dependencies.outdated", category: "dependencies", severity: "warning",
    message: `${name} is outdated`,
    evidence: [`current=${value.current ?? "unknown"}`, `wanted=${value.wanted ?? "unknown"}`, `latest=${value.latest ?? "unknown"}`, ...(value.deprecated ? [`deprecated=${value.deprecated}`] : [])]
  }));
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function checkRegistryDependencies(dependencies: Record<string, string>, fetcher: Fetcher = fetch): Promise<Finding[]> {
  const entries = Object.entries(dependencies).slice(0, 100);
  const results = await Promise.all(entries.map(async ([name, requested]) => {
    try {
      const response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const metadata = await response.json() as { "dist-tags"?: { latest?: string }; versions?: Record<string, { deprecated?: string }> };
      const latest = metadata["dist-tags"]?.latest;
      if (!latest) return [];
      const current = requested.replace(/^[~^<>=v\s]+/, "");
      const deprecated = metadata.versions?.[current]?.deprecated;
      const findings: Finding[] = [];
      if (current !== latest) findings.push({ id: "dependencies.outdated", category: "dependencies", severity: "warning", message: `${name} may be outdated`, evidence: [`declared=${requested}`, `latest=${latest}`] });
      if (deprecated) findings.push({ id: "dependencies.deprecated", category: "dependencies", severity: "warning", message: `${name}@${current} is deprecated`, evidence: [deprecated] });
      return findings;
    } catch (error) {
      return [{ id: "dependencies.registry-unavailable", category: "dependencies", severity: "warning", message: `Could not check registry metadata for ${name}`, evidence: [error instanceof Error ? error.message : String(error)] } satisfies Finding];
    }
  }));
  return results.flat();
}
