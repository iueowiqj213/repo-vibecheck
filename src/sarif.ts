import type { ScanReport } from "./types.js";
export function renderSarif(report: ScanReport): string {
  const rules = [...new Map(report.findings.map((f) => [f.id, { id: f.id, shortDescription: { text: f.message } }])).values()];
  const results = [
    ...report.findings.map((f) => ({ ruleId: f.id, level: f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "note", message: { text: f.message }, ...(location(f.evidence[0]) ? { locations: [location(f.evidence[0])!] } : {}) })),
    ...report.requirementMatches.filter((match) => match.status !== "satisfied").map((match) => ({ ruleId: `requirement.${match.concept}`, level: match.status === "missing" ? "error" : "warning", message: { text: `${match.claim}: ${match.status}` }, properties: { logicalLocation: match.concept, requirementId: match.requirementId } }))
  ];
  return JSON.stringify({ version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{ tool: { driver: { name: "repo-vibecheck", rules } }, results }] }, null, 2);
}
function location(evidence?: string) { const match = evidence?.match(/^([^:]+):(\d+)/); return match ? { physicalLocation: { artifactLocation: { uri: match[1] }, region: { startLine: Number(match[2]) } } } : undefined; }
