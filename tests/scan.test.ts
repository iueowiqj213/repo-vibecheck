import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository } from "../src/scan.js";

describe("scanRepository", () => {
  it("reports the discovered config path and lets an explicit project type override it", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-profile-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), JSON.stringify({ private: true }));
    await writeFile(join(root, "repo-vibecheck.yaml"), "projectType: library\noffline: true\n");
    await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n");

    const report = await scanRepository(root, { online: false, projectType: "cli" });

    expect(report.configPath).toBe(join(root, "repo-vibecheck.yaml"));
    expect(report.project.profile).toBe("cli");
  });

  it("applies passEnv and offline mode from an auto-discovered config", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-auto-config-"));
    const key = "VIBECHECK_AUTO_CONFIG_VALUE";
    process.env[key] = "available";
    await writeFile(join(root, "repo-vibecheck.yaml"), `offline: true\nexecution:\n  passEnv:\n    - ${key}\n`);
    await writeFile(join(root, "test_env.py"), [
      "import os",
      "import unittest",
      "",
      "class EnvironmentTest(unittest.TestCase):",
      "    def test_configured_environment(self):",
      `        self.assertEqual(os.environ.get('${key}'), 'available')`
    ].join("\n"));

    try {
      const report = await scanRepository(root, { runScripts: true });

      expect(report.checksExecuted).toEqual(["static", "python-test"]);
      expect(report.findings).toContainEqual(expect.objectContaining({
        id: "baseline.command",
        severity: "info",
        message: "python -m unittest discover -v passed"
      }));
    } finally {
      delete process.env[key];
    }
  }, 15_000);

  it("runs opted-in Python unittest discovery and records the attempted check", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-pass-"));
    await writeFile(join(root, "test_math.py"), [
      "import unittest",
      "",
      "class MathTest(unittest.TestCase):",
      "    def test_addition(self):",
      "        self.assertEqual(1 + 1, 2)"
    ].join("\n"));

    const report = await scanRepository(root, { online: false, runScripts: true });

    expect(report.checksExecuted).toContain("python-test");
    expect(report.findings).toContainEqual(expect.objectContaining({
      id: "baseline.command",
      severity: "info",
      message: "python -m unittest discover -v passed"
    }));
    expect(report.categoryScores.baseline.status).toBe("scored");
    if (process.platform === "win32") await expect(access(join(root, "Python"))).rejects.toThrow();
    await expect(access(join(root, "__pycache__"))).rejects.toThrow();
  }, 15_000);

  it("does not confuse test output with the unittest zero-test summary", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-output-"));
    await writeFile(join(root, "test_output.py"), [
      "import unittest",
      "",
      "class OutputTest(unittest.TestCase):",
      "    def test_output(self):",
      "        print('Ran 0 tests in 0.000s')",
      "        self.assertTrue(True)"
    ].join("\n"));

    const report = await scanRepository(root, { online: false, runScripts: true });

    expect(report.checksExecuted).toEqual(["static", "python-test"]);
    expect(report.findings).toContainEqual(expect.objectContaining({
      id: "baseline.command",
      severity: "info",
      message: "python -m unittest discover -v passed"
    }));
  }, 15_000);

  it("turns failed Python unittest discovery into a baseline error", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-fail-"));
    await writeFile(join(root, "test_failure.py"), [
      "import unittest",
      "",
      "class FailureTest(unittest.TestCase):",
      "    def test_failure(self):",
      "        self.fail('expected failure')"
    ].join("\n"));

    const report = await scanRepository(root, { online: false, runScripts: true });

    expect(report.checksExecuted).toContain("python-test");
    expect(report.findings).toContainEqual(expect.objectContaining({
      id: "baseline.command",
      severity: "error",
      message: "python -m unittest discover -v failed"
    }));
  }, 15_000);

  it("turns zero discovered Python tests into a baseline error", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-zero-"));
    await writeFile(join(root, "app.py"), "def value():\n    return 1\n");

    const report = await scanRepository(root, { online: false, runScripts: true });

    expect(report.checksExecuted).toContain("python-test");
    expect(report.findings).toContainEqual(expect.objectContaining({
      id: "baseline.command",
      severity: "error",
      message: "python -m unittest discover -v failed",
      evidence: expect.arrayContaining(["no tests discovered"])
    }));
  }, 15_000);

  it("does not run Python tests without explicit opt-in", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-static-"));
    await writeFile(join(root, "test_static.py"), "import unittest\n");

    const report = await scanRepository(root, { online: false });

    expect(report.checksExecuted).toEqual(["static"]);
    expect(report.findings.some((finding) => finding.id === "baseline.command")).toBe(false);
    expect(report.categoryScores.baseline.status).toBe("not_run");
  });

  it("preserves Node execution and adds Python discovery for mixed projects", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-mixed-tests-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "npm", scripts: { test: "node -e \"process.exit(0)\"" } }));
    await writeFile(join(root, "test_python.py"), [
      "import unittest",
      "",
      "class PythonTest(unittest.TestCase):",
      "    def test_passes(self):",
      "        self.assertTrue(True)"
    ].join("\n"));

    const report = await scanRepository(root, { online: false, runScripts: true });

    expect(report.checksExecuted).toEqual(["static", "build-test", "python-test"]);
    expect(report.findings.filter((finding) => finding.id === "baseline.command" && finding.severity === "info")).toHaveLength(2);
  }, 15_000);

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

  it("preserves scoped README requirements, separates test evidence, and warns for explicit unverifiable items", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-readme-requirements-"));
    await Promise.all([mkdir(join(root, "src")), mkdir(join(root, "tests")), mkdir(join(root, "docs"))]);
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), [
      "# Task app",
      "## Requirements",
      "- REQ-AUTH-1: User authentication",
      "- REQ-TASK-2: Save task record",
      "- REQ-QUALITY-3: Improve quality",
      "## Current Status",
      "Partial: REQ-AUTH-1"
    ].join("\n"));
    await writeFile(join(root, "src", "auth.ts"), "export function authenticate(user: string) { return user; }");
    await writeFile(join(root, "src", "tasks.ts"), "export function saveTaskRecord(task: string) { return task; }");
    await writeFile(join(root, "tests", "tasks.test.ts"), "it(\"save task record\", () => {});");
    await writeFile(join(root, "docs", "auth.ts"), "export function authenticateAdmin(user: string) { return user; }");

    const report = await scanRepository(root, { online: false });

    expect(report.requirementMatches.filter((match) => match.requirementId).map((match) => [match.requirementId, match.sourceLine])).toEqual([
      ["REQ-AUTH-1", 3],
      ["REQ-TASK-2", 4],
      ["REQ-QUALITY-3", 5]
    ]);
    expect(report.requirementMatches.filter((match) => match.concept === "authentication")).toHaveLength(1);
    expect(report.requirementMatches.find((match) => match.requirementId === "REQ-AUTH-1")).toMatchObject({
      status: "partially_satisfied",
      missingEvidence: expect.arrayContaining(["README declares requirement as partially_satisfied"])
    });
    expect(report.requirementMatches.find((match) => match.requirementId === "REQ-TASK-2")?.evidence).toContain("test: tests/tasks.test.ts:1");
    expect(report.requirementMatches.find((match) => match.requirementId === "REQ-QUALITY-3")?.status).toBe("unverifiable");
    expect(report.findings).toContainEqual(expect.objectContaining({
      id: "requirements.unverifiable",
      category: "requirements",
      severity: "warning",
      evidence: ["REQ-QUALITY-3"]
    }));
  });

  it("does not use TypeScript files under documentation as implementation evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-doc-source-"));
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), "## Requirements\n- REQ-AUTH-1: User authentication");
    await writeFile(join(root, "docs", "auth.ts"), "export function authenticate(user: string) { return user; }");

    const report = await scanRepository(root, { online: false });

    expect(report.requirementMatches.find((match) => match.requirementId === "REQ-AUTH-1")?.status).toBe("missing");
  });

  it("does not use example source files as implementation evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-example-source-"));
    await mkdir(join(root, "examples"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), "## Requirements\n- REQ-AUTH-1: User authentication");
    await writeFile(join(root, "examples", "auth.ts"), "export function authenticate(user: string) { return user; }");

    const report = await scanRepository(root, { online: false });

    expect(report.requirementMatches.find((match) => match.requirementId === "REQ-AUTH-1")?.status).toBe("missing");
  });

  it("keeps production source files with documentation-like names in implementation evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-production-names-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "src", "docs.ts"), "process.env.DOCS_TOKEN;");
    await writeFile(join(root, "src", "spec.ts"), "process.env.SPEC_TOKEN;");
    await writeFile(join(root, "src", "requirements.ts"), "process.env.REQUIREMENTS_TOKEN;");

    const report = await scanRepository(root, { online: false });

    expect(report.findings.filter((finding) => finding.id === "env.used-missing").map((finding) => finding.evidence[0]).sort()).toEqual([
      "DOCS_TOKEN",
      "REQUIREMENTS_TOKEN",
      "SPEC_TOKEN"
    ]);
  });

  it("uses test files only for generic test requirements, not implementation file evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-test-file-evidence-"));
    await mkdir(join(root, "tests"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), "# App\n\nUser authentication\n\n- Tests");
    await writeFile(join(root, "tests", "auth.test.ts"), "export function authenticate(user: string) { return user; }");

    const report = await scanRepository(root, { online: false });

    expect(report.requirementMatches.find((match) => match.concept === "authentication")?.status).toBe("missing");
    expect(report.requirementMatches.find((match) => match.concept === "tests")?.status).toBe("satisfied");
  });

  it("gives explicit README requirements precedence over same-concept prose claims", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-readme-precedence-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "README.md"), "# App\n\nUser authentication\n\n## Requirements\n- [ ] REQ-AUTH-1: User authentication");
    await writeFile(join(root, "src", "auth.ts"), "export function authenticate(user: string) { return user; }");

    const report = await scanRepository(root, { online: false });

    expect(report.requirementMatches.filter((match) => match.concept === "authentication")).toEqual([
      expect.objectContaining({ requirementId: "REQ-AUTH-1" })
    ]);
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

  it("does not apply package metadata checks without package.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "vibecheck-python-"));
    await writeFile(join(root, "app.py"), "print('hello')");
    const report = await scanRepository(root, { online: false });
    expect(report.project.projectTypes).toContain("Python");
    expect(report.findings.some((finding) => finding.id === "dependencies.missing-license")).toBe(false);
  });

  it("classifies a realistic half-built task app below a completed equivalent", async () => {
    const fixtureRoot = fileURLToPath(new URL("./fixtures/realistic-half-built/", import.meta.url));
    const report = await scanRepository(fixtureRoot, { online: false });
    const expectedIds = [
      "REQ-TASK-1",
      "REQ-TASK-2",
      "REQ-TASK-3",
      "REQ-TASK-4",
      "REQ-TASK-5",
      "REQ-TASK-6",
      "REQ-TASK-7",
      "REQ-TASK-8",
      "REQ-TASK-9",
      "REQ-TASK-10"
    ];
    const requirements = new Map(report.requirementMatches.map((match) => [match.requirementId ?? "", match]));

    expect([...requirements.keys()].filter((id) => id.startsWith("REQ-TASK-"))).toEqual(expectedIds);
    for (const id of ["REQ-TASK-1", "REQ-TASK-3", "REQ-TASK-4"]) expect(requirements.get(id)?.status).toBe("satisfied");
    expect(requirements.get("REQ-TASK-2")?.status).toBe("partially_satisfied");
    for (const id of expectedIds.slice(4, 8)) expect(requirements.get(id)?.status).toBe("partially_satisfied");
    expect(requirements.get("REQ-TASK-9")?.status).toBe("missing");
    expect(requirements.get("REQ-TASK-9")?.status).not.toBe("satisfied");
    expect(requirements.get("REQ-TASK-10")?.status).toBe("satisfied");
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "placeholders.marker",
        evidence: expect.arrayContaining([expect.stringContaining("app.py:")])
      })
    ]));

    const evidenceOnlyRoot = await mkdtemp(join(tmpdir(), "vibecheck-half-built-evidence-"));
    const fixtureReadme = await readFile(join(fixtureRoot, "README.md"), "utf8");
    await Promise.all([
      writeFile(join(evidenceOnlyRoot, "README.md"), fixtureReadme.split("## Current Status")[0] ?? fixtureReadme),
      writeFile(join(evidenceOnlyRoot, "app.py"), await readFile(join(fixtureRoot, "app.py"), "utf8")),
      writeFile(join(evidenceOnlyRoot, "test_app.py"), await readFile(join(fixtureRoot, "test_app.py"), "utf8"))
    ]);
    const evidenceOnlyReport = await scanRepository(evidenceOnlyRoot, { online: false });
    const evidenceOnlyRequirements = new Map(evidenceOnlyReport.requirementMatches.map((match) => [match.requirementId ?? "", match]));
    for (const id of expectedIds.slice(4, 8)) expect(evidenceOnlyRequirements.get(id)?.status).toBe("partially_satisfied");
    expect(evidenceOnlyRequirements.get("REQ-TASK-9")?.status).toBe("missing");

    const completedRoot = await mkdtemp(join(tmpdir(), "vibecheck-complete-task-app-"));
    await Promise.all([
      writeFile(join(completedRoot, "README.md"), [
        "# Task app",
        "",
        "## Requirements",
        "1. REQ-TASK-1: Add task records",
        "2. REQ-TASK-2: List task records",
        "3. REQ-TASK-3: Mark task records done",
        "4. REQ-TASK-4: Persist task records",
        "5. REQ-TASK-5: Delete task records",
        "6. REQ-TASK-6: Edit task records",
        "7. REQ-TASK-7: Prioritize task records",
        "8. REQ-TASK-8: Open task filtering",
        "9. REQ-TASK-9: Robust input validation",
        "10. REQ-TASK-10: Basic task tests"
      ].join("\n")),
      writeFile(join(completedRoot, "app.py"), [
        "def add_task(task): return {'title': task, 'done': False}",
        "def list_task_records(tasks): return list(tasks)",
        "def mark_task_done(task): task['done'] = True; return task",
        "def persist_task_records(tasks): return {'saved': list(tasks)}",
        "def delete_task(tasks, task): return [item for item in tasks if item != task]",
        "def edit_task(task, title): return {**task, 'title': title}",
        "def prioritize_task(task, priority): return {**task, 'priority': priority}",
        "def filter_open_tasks(tasks): return [item for item in tasks if not item['done']]",
        "def input_validation(value):",
        "    if not isinstance(value, str) or not value.strip(): raise ValueError('invalid input')",
        "    return value.strip()"
      ].join("\n")),
      writeFile(join(completedRoot, "test_app.py"), [
        "from app import *",
        "def test_add_task(): assert add_task('x')['done'] is False",
        "def test_list_task_records(): assert list_task_records([]) == []",
        "def test_mark_task_done(): assert mark_task_done({'done': False})['done'] is True",
        "def test_persist_task_records(): assert persist_task_records([]) == {'saved': []}",
        "def test_delete_task(): assert delete_task(['x'], 'x') == []",
        "def test_edit_task(): assert edit_task({'title': 'x'}, 'y')['title'] == 'y'",
        "def test_prioritize_task(): assert prioritize_task({}, 'high')['priority'] == 'high'",
        "def test_filter_open_tasks(): assert filter_open_tasks([{'done': True}]) == []",
        "def test_input_validation(): assert input_validation(' x ') == 'x'"
      ].join("\n"))
    ]);

    const completedReport = await scanRepository(completedRoot, { online: false });
    expect(report.score).toBeLessThan(completedReport.score);
  });
});
