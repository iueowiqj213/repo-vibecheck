import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inferProfile, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("discovers repo-vibecheck.yml and applies configuration defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-config-"));
    await writeFile(join(root, "repo-vibecheck.yml"), "projectType: library\nignore:\n  findings: [env.example-unused]\n");

    await expect(loadConfig(root)).resolves.toEqual({
      path: join(root, "repo-vibecheck.yml"),
      config: {
        projectType: "library",
        failOn: "never",
        offline: false,
        redact: false,
        ignore: { findings: ["env.example-unused"], paths: [] },
        requirements: { disable: [] },
        execution: { passEnv: [] }
      }
    });
  });

  it("rejects unknown keys and invalid values as usage errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-config-"));
    const config = join(root, "invalid.yaml");
    await writeFile(config, "projectType: service\nunknown: true\n");

    await expect(loadConfig(root, config)).rejects.toThrow("Invalid configuration");
  });
});

describe("inferProfile", () => {
  it("classifies CLI, template, library, and application manifests", () => {
    expect(inferProfile({ bin: "dist/cli.js" }, ["src/index.ts"])).toBe("cli");
    expect(inferProfile({}, ["templates/starter/package.json"])).toBe("template");
    expect(inferProfile({}, ["package.json", "tsconfig.json"])).toBe("library");
    expect(inferProfile({ private: true }, ["src/app.ts"])).toBe("app");
  });
});
