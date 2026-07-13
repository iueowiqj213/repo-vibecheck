import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareBaseline, createBaseline } from "../src/baseline-report.js";
import { loadConfig } from "../src/config.js";
import { redactReport, redactText } from "../src/redact.js";
import { renderSarif } from "../src/sarif.js";
import { scoreReport } from "../src/score.js";
import type { Finding, ScanReport } from "../src/types.js";

const finding: Finding = { id: "env.used-missing", category: "env", severity: "error", message: "TOKEN missing", evidence: ["src/a.ts:1"] };

describe("v0.2 policy integrations", () => {
  it("loads strict YAML configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibe-config-"));
    await writeFile(join(root, "repo-vibecheck.yml"), "projectType: library\noffline: true\nignore:\n  findings: [env.example-unused]\n");
    const loaded = await loadConfig(root);
    expect(loaded.config.projectType).toBe("library");
    expect(loaded.config.offline).toBe(true);
  });

  it("normalizes scores over applicable categories", () => {
    const scored = scoreReport([], [], false, "library");
    expect(scored.categoryScores.baseline.status).toBe("not_run");
    expect(scored.categoryScores.requirements.status).toBe("not_applicable");
    expect(scored.scoreCoverage).toBeLessThan(100);
  });

  it("compares stable finding baselines", () => {
    const baseline = createBaseline([finding], []);
    const compared = compareBaseline([finding, { ...finding, id: "new", message: "new" }], [], baseline);
    expect(compared.summary).toEqual({ new: 1, unchanged: 1, resolved: 0 });
  });

  it("redacts tokens and user home paths", () => {
    expect(redactText("TOKEN=secret C:\\Users\\alice\\repo")).not.toContain("secret");
    expect(redactText("TOKEN=secret C:\\Users\\alice\\repo")).toContain("<HOME>");
    expect(redactReport({ targetPath: "C:\\Users\\alice\\repo" })).toEqual({ targetPath: "<HOME>\\repo" });
    expect(redactText("Basic tests")).toBe("Basic tests");
    expect(redactText("Authorization: Basic dXNlcjpwYXNz")).toBe("Authorization: Basic <REDACTED>");
  });

  it("renders SARIF 2.1.0", () => {
    const report = { findings: [finding], requirementMatches: [] } as unknown as ScanReport;
    expect(JSON.parse(renderSarif(report)).version).toBe("2.1.0");
  });
});
