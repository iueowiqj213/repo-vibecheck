import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release contracts", () => {
  it("ships a composite Action that fails on errors by default", async () => {
    const action = await readFile("action.yml", "utf8");
    expect(action).toContain("using: composite");
    expect(action).toMatch(/fail-on:[\s\S]*default: error/);
    expect(action).toContain("--fail-on");
  });

  it("runs tests, build, package validation, benchmark, and Action smoke in CI", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    for (const command of ["npm test", "npm run build", "npm pack --dry-run", "npm run benchmark:fixture", "uses: ./"]) {
      expect(workflow).toContain(command);
    }
  });

  it("uses the real repository in package metadata", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as Record<string, unknown>;
    expect(manifest.repository).toEqual({ type: "git", url: "git+https://github.com/iueowiqj213/repo-vibecheck.git" });
    expect(manifest.homepage).toBe("https://github.com/iueowiqj213/repo-vibecheck#readme");
    expect(manifest.exports).toMatchObject({
      ".": { types: "./dist/scan.d.ts", import: "./dist/scan.js" },
      "./policy": { types: "./dist/policy.d.ts", import: "./dist/policy.js" },
      "./types": { types: "./dist/types.d.ts", import: "./dist/types.js" }
    });
  });

  it("keeps the CLI version aligned with package metadata", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as { version: string };
    const cli = await readFile("src/cli.ts", "utf8");
    expect(cli).toContain(`.version("${manifest.version}")`);
  });
});
