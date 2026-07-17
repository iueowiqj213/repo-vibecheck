import { describe, expect, it } from "vitest";
import { commandsForProject } from "../src/runner.js";

describe("commandsForProject", () => {
  it("only returns finite opted-in scripts", () => {
    expect(commandsForProject("pnpm", { dev: "vite", build: "vite build", test: "vitest" }, true, true, ["Node.js"])).toEqual([
      { command: "pnpm", args: ["install"] },
      { command: "pnpm", args: ["run", "build"] },
      { command: "pnpm", args: ["test"] }
    ]);
  });

  it("selects fixed unittest discovery only for opted-in Python projects", () => {
    expect(commandsForProject("unknown", {}, false, true, ["Python"])).toEqual([
      { label: "python-test", command: "python", args: ["-m", "unittest", "discover", "-v"], shell: false }
    ]);
    expect(commandsForProject("unknown", {}, false, false, ["Python"])).toEqual([]);
    expect(commandsForProject("unknown", {}, false, true, ["Unknown"])).toEqual([]);
  });

  it("keeps Node selection unchanged and appends Python discovery in mixed projects", () => {
    expect(commandsForProject("npm", { build: "tsc", test: "vitest" }, false, true, ["Node.js", "Python"])).toEqual([
      { command: "npm", args: ["run", "build"] },
      { command: "npm", args: ["test"] },
      { label: "python-test", command: "python", args: ["-m", "unittest", "discover", "-v"], shell: false }
    ]);
  });
});
