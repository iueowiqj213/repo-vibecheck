import type { Finding } from "./types.js";

const MARKERS = /\b(TODO|FIXME|not[\s_-]*implemented|unimplemented|coming soon|mock(?:ed)? data|fake service|lorem ipsum|placeholder(?: text| copy)?|replace me|dummy data)\b/i;

export function findPlaceholders(sources: Map<string, string>): Finding[] {
  const evidence: string[] = [];
  let count = 0;
  for (const [file, source] of sources) {
    source.split(/\r?\n/).forEach((line, index) => {
      const match = line.match(MARKERS);
      if (match) {
        count++;
        if (evidence.length < 10) evidence.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
  }
  return count === 0 ? [] : [{
    id: "placeholders.marker", category: "placeholders", severity: "warning",
    message: `${count} possible incomplete or mock implementation marker${count === 1 ? "" : "s"} found`,
    evidence
  }];
}
