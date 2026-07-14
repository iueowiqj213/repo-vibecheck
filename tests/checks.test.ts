import { describe, expect, it } from "vitest";
import { checkEnvironment } from "../src/env.js";
import { findPlaceholders } from "../src/placeholders.js";
import { checkReadmeScripts } from "../src/baseline.js";
import { checkRegistryDependencies, parseOutdated } from "../src/dependencies.js";

describe("static checks", () => {
  it("finds JavaScript, Deno, and Python env mismatches", () => {
    const result = checkEnvironment(new Map([
      ["src/a.ts", "process.env.DATABASE_URL; import.meta.env.VITE_API; Deno.env.get(\"TOKEN\")"],
      ["app.py", "os.environ[\"PY_SECRET\"]; os.getenv('OPTIONAL')"]
    ]), "DATABASE_URL=\nUNUSED_KEY=", "MIT licensed. Configure README_TOKEN in your environment");
    expect(result.usedMissing).toEqual(["OPTIONAL", "PY_SECRET", "TOKEN", "VITE_API"]);
    expect(result.exampleUnused).toEqual(["UNUSED_KEY"]);
    expect(result.readmeMissing).toEqual(["README_TOKEN"]);
  });

  it("reports high-signal placeholders with line evidence", () => {
    const findings = findPlaceholders(new Map([["src/api.ts", "export function x() {\n  throw new Error('Not implemented');\n}"]]));
    expect(findings[0]?.evidence[0]).toContain("src/api.ts:2");
  });

  it("detects placeholder UI copy", () => {
    expect(findPlaceholders(new Map([["src/page.tsx", "return <p>Lorem ipsum placeholder</p>"]]))).toHaveLength(1);
  });

  it("detects handlers that explicitly throw unimplemented errors", () => {
    expect(findPlaceholders(new Map([["src/api.ts", "throw new Error('unimplemented')"]]))).toHaveLength(1);
  });

  it("aggregates many markers into one bounded finding", () => {
    const sources = new Map(Array.from({ length: 12 }, (_, index) => [`src/file-${index}.ts`, "// TODO: implement"]));
    const findings = findPlaceholders(sources);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("12");
    expect(findings[0]?.evidence).toHaveLength(10);
  });

  it("reports README commands that have no matching package script", () => {
    const findings = checkReadmeScripts("Run `npm run build` and `npm test`.", { build: "tsc" });
    expect(findings.some((finding) => finding.message.includes("test"))).toBe(true);
    expect(findings.some((finding) => finding.message.includes("build"))).toBe(false);
  });

  it("turns npm outdated JSON into supporting findings", () => {
    const findings = parseOutdated(JSON.stringify({ commander: { current: "13.0.0", wanted: "14.0.3", latest: "14.0.3" } }));
    expect(findings[0]?.message).toContain("commander");
    expect(findings[0]?.evidence).toContain("current=13.0.0");
  });

  it("checks registry metadata through fetch without executing npm", async () => {
    const fetcher = async () => new Response(JSON.stringify({ "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": {}, "2.0.0": {} } }));
    const findings = await checkRegistryDependencies({ demo: "1.0.0" }, fetcher);
    expect(findings[0]?.message).toContain("demo");
  });
});
