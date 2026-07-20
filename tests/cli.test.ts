import { describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli.js";
import type { ScanReport } from "../src/types.js";

describe("CLI", () => {
  it("passes scan path and JSON options to the scanner", async () => {
    const report = { product: "repo-vibecheck" } as ScanReport;
    const scan = vi.fn(async () => report);
    let output = "";
    const program = createProgram(scan, (value) => { output += value; });
    await program.parseAsync(["node", "repo-vibecheck", "scan", "fixture", "--json", "--offline", "--requirements", "requirements.md"]);
    expect(scan).toHaveBeenCalledWith("fixture", expect.objectContaining({ requirementsPath: "requirements.md", online: false }));
    expect(JSON.parse(output).product).toBe("repo-vibecheck");
  });

  it("passes explicit project type overrides to the scanner", async () => {
    const report = { product: "repo-vibecheck" } as ScanReport;
    const scan = vi.fn(async () => report);
    await createProgram(scan, () => {}).parseAsync([
      "node", "repo-vibecheck", "scan", "fixture", "--json", "--project-type", "cli"
    ]);

    expect(scan).toHaveBeenCalledWith("fixture", expect.objectContaining({ projectType: "cli" }));
  });

  it("keeps SARIF output machine-readable when execution is enabled", async () => {
    const report = { product: "repo-vibecheck", findings: [], requirementMatches: [] } as unknown as ScanReport;
    const scan = vi.fn(async () => report);
    let output = "";

    await createProgram(scan, (value) => { output += value; }).parseAsync([
      "node", "repo-vibecheck", "scan", "fixture", "--format", "sarif", "--run-scripts"
    ]);

    expect(JSON.parse(output).version).toBe("2.1.0");
  });

  it("sets the policy exit code without changing report output", async () => {
    const scan = vi.fn(async () => ({
      product: "repo-vibecheck", findings: [], summary: { error: 1, warning: 0, info: 0 }, requirementMatches: []
    } as unknown as ScanReport));
    let output = "";
    process.exitCode = undefined;
    await createProgram(scan, (value) => { output += value; }).parseAsync(["node", "repo-vibecheck", "scan", ".", "--json", "--fail-on", "error"]);
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(output).product).toBe("repo-vibecheck");
    process.exitCode = undefined;
  });

  it("classifies unknown commands and options as usage errors", async () => {
    await expect(createProgram().parseAsync(["node", "repo-vibecheck", "nope"])).rejects.toMatchObject({ exitCode: 2 });
    await expect(createProgram().parseAsync(["node", "repo-vibecheck", "scan", ".", "--bad"])).rejects.toMatchObject({ exitCode: 2 });
  });
});
