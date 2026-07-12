import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("benchmark harness", () => {
  it("validates the pinned public corpus", () => {
    const output = execFileSync(process.execPath, ["scripts/benchmark.mjs", "--validate"], { encoding: "utf8" });
    expect(output).toContain("Benchmark manifest valid");
  });

  it("runs the network-free fixture and emits a parseable summary", () => {
    const output = execFileSync(process.execPath, ["scripts/benchmark.mjs", "--fixture", "--json"], { encoding: "utf8" });
    const summary = JSON.parse(output) as { repositories: Array<{ name: string; score: number; projectTypes: string[]; outcome: string; exitCode: number }> };
    expect(summary.repositories).toHaveLength(1);
    expect(summary.repositories[0]?.name).toBe("fixture-vite-react");
    expect(summary.repositories[0]?.projectTypes).toEqual(expect.arrayContaining(["Vite", "React"]));
    expect(summary.repositories[0]?.outcome).toBe("completed");
    expect(summary.repositories[0]?.exitCode).toBe(0);
  });

  it("rejects repository names that could escape the temporary root", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibecheck-manifest-"));
    const manifest = join(directory, "repos.json");
    writeFileSync(manifest, JSON.stringify({ repositories: [{ name: "..", url: "https://github.com/example/repo.git", commit: "a".repeat(40), expectedTypes: ["Node.js"] }] }));
    const result = spawnSync(process.execPath, ["scripts/benchmark.mjs", "--validate", "--manifest", manifest], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("safe slug");
  });
});
