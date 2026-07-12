import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepository } from "../src/scan.js";

describe("scanRepository", () => {
  it("composes project, requirement, env, script, and placeholder checks", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "tsc" }, dependencies: { stripe: "latest" } }));
    await writeFile(join(root, "package-lock.json"), "{}");
    await writeFile(join(root, "README.md"), "# Shop\nRun npm test. Configure DATABASE_URL. Stripe checkout is supported.");
    await writeFile(join(root, ".env.example"), "UNUSED=\n");
    await writeFile(join(root, "requirements.md"), "- Stripe payment checkout\n- Email notifications");
    await writeFile(join(root, "src", "index.ts"), "process.env.DATABASE_URL; // TODO: checkout");

    const report = await scanRepository(root, { requirementsPath: "requirements.md", online: false });

    expect(report.project.packageManager).toBe("npm");
    expect(report.requirementMatches.find((match) => match.concept === "payment")?.status).toBe("partially_satisfied");
    expect(report.findings.some((finding) => finding.id === "baseline.missing-readme-script")).toBe(true);
    expect(report.findings.some((finding) => finding.category === "env")).toBe(true);
    expect(report.findings.some((finding) => finding.category === "placeholders")).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("evaluates README claims alongside requirements without using docs as implementation evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-evidence-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { stripe: "latest" } }));
    await writeFile(join(root, "package-lock.json"), "{}");
    await writeFile(join(root, "README.md"), "Stripe checkout uses stripe.checkout.sessions.create and includes Docker support.");
    await writeFile(join(root, "requirements.md"), "- Email notifications");
    await writeFile(join(root, "src", "checkout.ts"), "export const checkout = 'mock';");
    const report = await scanRepository(root, { requirementsPath: "requirements.md", online: false });
    expect(report.requirementMatches.map((match) => match.concept)).toEqual(expect.arrayContaining(["email", "payment", "docker"]));
    expect(report.requirementMatches.find((match) => match.concept === "payment")?.status).toBe("partially_satisfied");
    expect(report.findings.some((finding) => finding.id === "claims.payment-webhook-missing")).toBe(true);
  });

  it("does not use documentation filenames as feature evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-doc-file-"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "auth-guide.md"), "# Authentication");
    await writeFile(join(root, "requirements.md"), "- User authentication");
    const report = await scanRepository(root, { requirementsPath: "requirements.md", online: false });
    expect(report.requirementMatches.find((match) => match.concept === "authentication")?.status).toBe("missing");
  });

  it("does not report placeholders from tests or documentation", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-placeholder-scope-"));
    await mkdir(join(root, "tests"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), "TODO: document setup");
    await writeFile(join(root, "tests", "mock.test.ts"), "// TODO: add another assertion");
    const report = await scanRepository(root, { online: false });
    expect(report.findings.some((finding) => finding.category === "placeholders")).toBe(false);
  });

  it("does not treat env usage in tests as production configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-env-scope-"));
    await mkdir(join(root, "tests"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "tests", "env.test.ts"), "process.env.TEST_DATABASE_URL");
    const report = await scanRepository(root, { online: false });
    expect(report.findings.some((finding) => finding.id === "env.used-missing")).toBe(false);
  });
});
