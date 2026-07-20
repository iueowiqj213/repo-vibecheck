import { describe, expect, it } from "vitest";
import { detectProject } from "../src/project.js";

describe("detectProject", () => {
  it("detects package manager conflicts and project types", () => {
    const result = detectProject(
      ["package.json", "package-lock.json", "pnpm-lock.yaml", "tsconfig.json", "vite.config.ts"],
      {
        packageManager: "pnpm@10.0.0",
        scripts: { build: "vite build", test: "vitest" },
        dependencies: { react: "latest", vite: "latest" }
      }
    );

    expect(result.packageManager).toBe("pnpm");
    expect(result.projectTypes).toEqual(expect.arrayContaining(["Node.js", "TypeScript", "Vite", "React"]));
    expect(result.findings.some((finding) => finding.id === "project.multiple-lockfiles")).toBe(true);
  });

  it("uses the lockfile before a conflicting packageManager declaration", () => {
    const result = detectProject(["package.json", "package-lock.json"], { packageManager: "pnpm@10.0.0" });
    expect(result.packageManager).toBe("npm");
    expect(result.findings.some((finding) => finding.id === "project.package-manager-mismatch")).toBe(true);
  });

  it("uses peer dependencies for framework detection", () => {
    const result = detectProject(["package.json", "vite.config.ts"], { peerDependencies: { react: "^19.0.0" } });
    expect(result.projectTypes).toEqual(expect.arrayContaining(["Vite", "React"]));
  });

  it("detects Python without mislabeling it as Node.js", () => {
    const result = detectProject(["app.py"], {});
    expect(result.projectTypes).toEqual(["Python"]);
  });

  it("does not detect Python from documentation or fixture files alone", () => {
    const result = detectProject(
      ["package.json", "tests/fixtures/python/test_example.py", "examples/demo.py"],
      { scripts: { test: "vitest" } }
    );

    expect(result.projectTypes).toEqual(["Node.js"]);
  });
});
