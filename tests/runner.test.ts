import { describe, expect, it } from "vitest";
import { commandsForProject } from "../src/runner.js";

describe("commandsForProject", () => {
  it("only returns finite opted-in scripts", () => {
    expect(commandsForProject("pnpm", { dev: "vite", build: "vite build", test: "vitest" }, true, true)).toEqual([
      { command: "pnpm", args: ["install"] },
      { command: "pnpm", args: ["run", "build"] },
      { command: "pnpm", args: ["test"] }
    ]);
  });
});
