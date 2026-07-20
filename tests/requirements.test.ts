import { describe, expect, it } from "vitest";
import { evaluateRequirementDepth, normalizeRequirementTokens } from "../src/requirement-depth.js";
import { evaluateClaims, extractClaims, extractReadmeClaims, extractReadmeRequirements, normalizeMatches } from "../src/requirements.js";

describe("requirements matching", () => {
  it("classifies satisfied, partial, missing, and unverifiable claims", () => {
    const claims = extractClaims(`
- User authentication and login
- Stripe payment checkout
- Email notifications
- Admin dashboard analytics
`);
    const matches = evaluateClaims(claims, {
      files: ["src/auth.ts", "src/login.ts", "middleware.ts", "src/checkout.ts"],
      dependencies: ["next-auth", "stripe"],
      sources: new Map([
        ["src/auth.ts", "getServerSession()"],
        ["src/checkout.ts", "stripe.checkout.sessions.create({})"]
      ])
    });

    expect(matches.find((match) => match.concept === "authentication")?.status).toBe("satisfied");
    expect(matches.find((match) => match.concept === "payment")?.status).toBe("satisfied");
    expect(matches.find((match) => match.concept === "email")?.status).toBe("missing");
    expect(matches.find((match) => match.concept === "unknown")?.status).toBe("missing");
  });

  it("does not treat a Stripe dependency alone as complete", () => {
    const [match] = evaluateClaims(["Stripe payment flow"], {
      files: ["package.json"], dependencies: ["stripe"], sources: new Map()
    });
    expect(match?.status).toBe("partially_satisfied");
  });

  it("requires a server-side payment call even when a matching file exists", () => {
    const [match] = evaluateClaims(["Stripe checkout"], {
      files: ["src/checkout.ts"], dependencies: ["stripe"], sources: new Map([["src/checkout.ts", "return 'mock checkout'"]])
    });
    expect(match?.status).toBe("partially_satisfied");
    expect(match?.missingEvidence).toContain("server-side payment call");
  });

  it("normalizes repeated recognized concepts while preserving source claims", () => {
    const matches = evaluateClaims([
      "Stripe checkout",
      "Payments are powered by Stripe checkout",
      "Docker deployment"
    ], { files: ["src/checkout.ts"], dependencies: ["stripe"], sources: new Map() });
    const normalized = normalizeMatches(matches);
    expect(normalized.filter((match) => match.concept === "payment")).toHaveLength(1);
    expect(normalized.find((match) => match.concept === "payment")?.claims).toEqual([
      "Stripe checkout",
      "Payments are powered by Stripe checkout"
    ]);
    expect(normalized.filter((match) => match.claim === "Docker deployment")).toHaveLength(1);
    expect(normalized.find((match) => match.claim === "Docker deployment")?.concept).toBe("docker");
  });

  it("keeps explicit requirements with the same recognized concept distinct", () => {
    const normalized = normalizeMatches(evaluateClaims([
      { claim: "REQ-AUTH-1: User authentication", requirementId: "REQ-AUTH-1", sourceLine: 3 },
      { claim: "REQ-AUTH-2: User authentication", requirementId: "REQ-AUTH-2", sourceLine: 4 }
    ], { files: ["src/auth.ts"], dependencies: [], sources: new Map([["src/auth.ts", "authenticate(user)"]]) }));

    expect(normalized).toEqual([
      expect.objectContaining({ requirementId: "REQ-AUTH-1", sourceLine: 3, concept: "authentication" }),
      expect.objectContaining({ requirementId: "REQ-AUTH-2", sourceLine: 4, concept: "authentication" })
    ]);
  });

  it("keeps unknown claims separate", () => {
    const normalized = normalizeMatches([
      { claim: "Admin dashboard", concept: "unknown", status: "unverifiable", evidence: [], missingEvidence: [] },
      { claim: "Dark mode", concept: "unknown", status: "unverifiable", evidence: [], missingEvidence: [] }
    ]);
    expect(normalized).toHaveLength(2);
  });

  it("recognizes conventional Python test filenames", () => {
    const [match] = evaluateClaims(["Basic tests"], { files: ["test_app.py"], dependencies: [], sources: new Map() });
    expect(match?.status).toBe("satisfied");
  });

  it("extracts README product claims without treating command instructions as features", () => {
    const claims = extractReadmeClaims(`# Shop\n\nA storefront with Stripe checkout and email notifications.\n\n## Development\n\nRun npm test and npm run build.\n\n- Docker deployment`);
    expect(claims).toEqual([
      "A storefront with Stripe checkout and email notifications.",
      "Docker deployment"
    ]);
  });

  it("extracts numbered and bulleted items only under accepted requirement headings", () => {
    const requirements = extractReadmeRequirements([
      "- Ordinary list item",
      "## Requirements",
      "1. REQ-12: Support exports",
      "## requirement checklist",
      "- Retain audit history",
      "## Acceptance Criteria",
      "1) Validate API input",
      "## Feature Requirements",
      "* Offer account deletion"
    ].join("\n"));

    expect(requirements).toEqual([
      { claim: "REQ-12: Support exports", requirementId: "REQ-12", sourceLine: 3 },
      { claim: "Retain audit history", requirementId: "README-1", sourceLine: 5 },
      { claim: "Validate API input", requirementId: "README-2", sourceLine: 7 },
      { claim: "Offer account deletion", requirementId: "README-3", sourceLine: 9 }
    ]);
  });

  it("stops extraction at equal or higher headings", () => {
    const requirements = extractReadmeRequirements([
      "### Requirements",
      "- Keep nested headings in scope",
      "#### Detail",
      "- Preserve this item",
      "### Current Status",
      "- Ignore this equal-depth item",
      "## Requirements",
      "- Start a new scoped section",
      "# Honest Gaps",
      "- Ignore this higher-level item"
    ].join("\n"));

    expect(requirements).toEqual([
      { claim: "Keep nested headings in scope", requirementId: "README-1", sourceLine: 2 },
      { claim: "Preserve this item", requirementId: "README-2", sourceLine: 4 },
      { claim: "Start a new scoped section", requirementId: "README-3", sourceLine: 8 }
    ]);
  });

  it("ignores examples, status, gaps, and other ordinary README lists", () => {
    const requirements = extractReadmeRequirements([
      "- Arbitrary README list",
      "## Examples",
      "1. Example item",
      "## Current Status",
      "- Status item",
      "## Honest Gaps",
      "* Gap item",
      "## Product Requirements",
      "- Unaccepted heading item"
    ].join("\n"));

    expect(requirements).toEqual([]);
  });

  it("normalizes GitHub checklist markers before assigning IDs", () => {
    const requirements = extractReadmeRequirements([
      "## Requirement Checklist",
      "- [ ] REQ-9: Validate input",
      "- [x] Persist changes"
    ].join("\n"));

    expect(requirements).toEqual([
      { claim: "REQ-9: Validate input", requirementId: "REQ-9", sourceLine: 2 },
      { claim: "Persist changes", requirementId: "README-1", sourceLine: 3 }
    ]);
  });

  it("attaches explicit negative status summaries by requirement number or ID without trusting Done", () => {
    const requirements = extractReadmeRequirements([
      "## Requirements",
      "1. Provide account registration",
      "2. REQ-ACCOUNT-2: Support user profiles",
      "3. Keep an audit log",
      "4. Validate configuration",
      "5. Render reports",
      "## Current Status",
      "- Done: 1, REQ-ACCOUNT-2",
      "- Partial / shallow: 3, REQ-ACCOUNT-2",
      "- Incomplete: 4",
      "- Missing depth: 5"
    ].join("\n"));

    expect(requirements).toEqual([
      { claim: "Provide account registration", requirementId: "README-1", sourceLine: 2 },
      { claim: "REQ-ACCOUNT-2: Support user profiles", requirementId: "REQ-ACCOUNT-2", sourceLine: 3, declaredDowngrade: "partially_satisfied" },
      { claim: "Keep an audit log", requirementId: "README-2", sourceLine: 4, declaredDowngrade: "partially_satisfied" },
      { claim: "Validate configuration", requirementId: "README-3", sourceLine: 5, declaredDowngrade: "partially_satisfied" },
      { claim: "Render reports", requirementId: "README-4", sourceLine: 6, declaredDowngrade: "partially_satisfied" }
    ]);
  });

  it("does not downgrade requirements from unrelated prose", () => {
    const requirements = extractReadmeRequirements([
      "## Requirements",
      "1. Provide account registration",
      "2. Keep an audit log",
      "## Notes",
      "The partial implementation mentioned in item 2 needs a follow-up."
    ].join("\n"));

    expect(requirements).toEqual([
      { claim: "Provide account registration", requirementId: "README-1", sourceLine: 2 },
      { claim: "Keep an audit log", requirementId: "README-2", sourceLine: 3 }
    ]);
  });

  it("normalizes identifiers, punctuation, stop words, and common requirement synonyms", () => {
    expect(normalizeRequirementTokens("The task_manager should remove-item, modifyStatus, and persist/load when done.")).toEqual([
      "task", "manager", "delete", "item", "edit", "status", "save", "complete"
    ]);
  });

  it("classifies generic fallback requirements from implementation and depth evidence", () => {
    const satisfied = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/tasks.ts", "export function deleteTaskRecords() { return removeTask(); }"]]),
      testSources: new Map([["tests/tasks.test.ts", "it('delete task records', () => {});"]])
    });
    const partial = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/tasks.ts", "export function deleteTaskRecords() { return removeTask(); }"]])
    });
    const missing = evaluateRequirementDepth("Delete task records", { implementationSources: new Map() });
    const unverifiable = evaluateRequirementDepth("Improve overall quality", { implementationSources: new Map() });

    expect(satisfied.status).toBe("satisfied");
    expect(partial.status).toBe("partially_satisfied");
    expect(missing.status).toBe("missing");
    expect(unverifiable.status).toBe("unverifiable");
  });

  it.each([
    ["an identity return", "src/tasks.ts", "export function deleteTaskRecords(task) { return task; }", "implementation returns its input unchanged"],
    ["an empty body", "src/tasks.ts", "export function deleteTaskRecords(task) {}", "implementation body is empty"],
    ["a Python pass body", "src/tasks.py", "def delete_task_records(task): pass", "implementation body only passes"]
  ])("downgrades satisfied fallback evidence backed only by %s", (_name, file, source, reason) => {
    const match = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([[file, source]]),
      testSources: new Map([["tests/tasks.test.ts", "it('delete task records', () => {});"]])
    });

    expect(match).toMatchObject({ status: "partially_satisfied", missingEvidence: [reason] });
  });

  it("keeps satisfied fallback evidence when one matching implementation is substantive", () => {
    const match = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([
        ["src/identity.ts", "export function deleteTaskRecords(task) { return task; }"],
        ["src/implementation.ts", "export function deleteTaskRecords(task) { return removeTask(task); }"]
      ]),
      testSources: new Map([["tests/tasks.test.ts", "it('delete task records', () => {});"]])
    });

    expect(match).toMatchObject({ status: "satisfied", missingEvidence: [] });
  });

  it("leaves non-satisfied and generic requirement results unchanged", () => {
    const partial = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/tasks.ts", "export function deleteTaskRecords(task) { return task; }"]])
    });
    const missing = evaluateRequirementDepth("Delete task records", { implementationSources: new Map() });
    const unverifiable = evaluateRequirementDepth("Improve overall quality", { implementationSources: new Map() });
    const [generic] = evaluateClaims(["Stripe checkout"], {
      files: ["src/checkout.ts"],
      dependencies: ["stripe"],
      sources: new Map([["src/checkout.ts", "export function checkoutPayment(checkout) { return checkout; }\nstripe.checkout.sessions.create({})"]])
    });

    expect(partial).toMatchObject({ status: "partially_satisfied", missingEvidence: ["focused test or a second implementation signal"] });
    expect(missing.status).toBe("missing");
    expect(unverifiable.status).toBe("unverifiable");
    expect(generic).toMatchObject({ concept: "payment", status: "satisfied", missingEvidence: [] });
  });

  it("preserves original evidence lines when removing multiline comments", () => {
    const source = "/*\nleading block\ncomment\n*/\nexport function deleteTaskRecords(task) { return task; }";
    const match = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/tasks.ts", source]]),
      testSources: new Map([["tests/tasks.test.ts", "it('delete task records', () => {});"]])
    });

    expect(match).toMatchObject({
      status: "partially_satisfied",
      evidence: expect.arrayContaining(["implementation: src/tasks.ts:5"]),
      missingEvidence: ["implementation returns its input unchanged"]
    });
  });

  it("excludes documentation, generated files, dependencies, comments, and test filenames as fallback proof", () => {
    const [match] = evaluateClaims(["Delete task records"], {
      files: ["README.md", "src/generated/tasks.ts", "tests/delete-task-records.test.ts"],
      dependencies: ["delete-task-records"],
      sources: new Map([
        ["README.md", "export function deleteTaskRecords() {}"],
        ["src/generated/tasks.ts", "export function deleteTaskRecords() {}"],
        ["src/tasks.ts", "// export function deleteTaskRecords() {}"]
      ]),
      testSources: new Map([["tests/delete-task-records.test.ts", ""]])
    });

    expect(match).toMatchObject({ concept: "unknown", status: "missing", evidence: [] });
    expect(match?.missingEvidence).toContain("matching implementation function or command branch");
  });

  it("keeps fallback evidence bounded and stable regardless of source iteration order", () => {
    const sources = [
      ["src/z.ts", "export function deleteTaskRecords() {}"],
      ["src/a.ts", "export function deleteTaskRecords() {}"],
      ["src/c.ts", "if (command === 'delete-task-records') {}"],
      ["src/b.ts", "def delete_task_records(): pass"]
    ] as const;
    const forward = evaluateRequirementDepth("Delete task records", { implementationSources: new Map(sources) });
    const reversed = evaluateRequirementDepth("Delete task records", { implementationSources: new Map([...sources].reverse()) });

    expect(forward.status).toBe("satisfied");
    expect(forward.evidence).toEqual([
      "implementation: src/a.ts:1",
      "implementation: src/b.ts:1",
      "implementation: src/c.ts:1"
    ]);
    expect(forward.evidence).toHaveLength(3);
    expect(forward.evidence).toEqual(reversed.evidence);
    expect(forward.missingEvidence).toEqual(reversed.missingEvidence);
  });

  it("preserves requirement metadata and only applies declared downgrades after fallback evidence", () => {
    const requirements = extractReadmeRequirements([
      "## Requirements",
      "1. Add task records",
      "2. Open archived task view",
      "## Current Status",
      "Partial: 1, 2"
    ].join("\n"));
    const matches = normalizeMatches(evaluateClaims(requirements, {
      files: ["src/tasks.ts"],
      dependencies: [],
      sources: new Map([["src/tasks.ts", "export function addTaskRecords() {}"]]),
      testSources: new Map([["tests/tasks.test.ts", "it('add task records', () => {});"]])
    }));

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ requirementId: "README-1", sourceLine: 2, concept: "unknown", status: "partially_satisfied" }),
      expect.objectContaining({ requirementId: "README-2", sourceLine: 3, concept: "unknown", status: "missing" })
    ]));
  });

  it("treats explicit Not implemented declarations as missing-only downgrades", () => {
    const requirements = extractReadmeRequirements([
      "## Requirements",
      "1. Add task records",
      "## Current Status",
      "Not implemented: 1"
    ].join("\n"));
    const [match] = evaluateClaims(requirements, {
      files: ["src/tasks.ts"],
      dependencies: [],
      sources: new Map([["src/tasks.ts", "export function addTaskRecords() {}"]]),
      testSources: new Map([["tests/tasks.test.ts", "it('add task records', () => {});"]])
    });

    expect(requirements).toEqual([
      { claim: "Add task records", requirementId: "README-1", sourceLine: 2, declaredDowngrade: "missing" }
    ]);
    expect(match).toMatchObject({ status: "missing", requirementId: "README-1" });
  });

  it("requires implementation and test anchors outside quoted literals", () => {
    const literalOnly = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/messages.ts", "const hint = 'function deleteTaskRecords';"]])
    });
    const quotedTestAnchor = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/tasks.ts", "export function deleteTaskRecords() {}"]]),
      testSources: new Map([["tests/tasks.test.ts", "const label = 'it delete task records';"]])
    });
    const commandBranch = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([["src/commands.ts", "if (command === 'delete_task_records') {}"]])
    });

    expect(literalOnly.status).toBe("missing");
    expect(quotedTestAnchor.status).toBe("partially_satisfied");
    expect(commandBranch).toMatchObject({ status: "partially_satisfied", evidence: ["implementation: src/commands.ts:1"] });
  });

  it("ignores Python inline comments and feature words in non-command literals", () => {
    const match = evaluateRequirementDepth("Delete task records", {
      implementationSources: new Map([
        ["src/tasks.py", "def unrelated(): pass # delete task records"],
        ["src/tasks.ts", "if (message) console.log('delete task records')"]
      ])
    });

    expect(match).toMatchObject({ status: "missing", evidence: [] });
  });

  it("leaves recognized generic rules authoritative", () => {
    const [match] = evaluateClaims(["Stripe checkout"], {
      files: ["src/checkout.ts"],
      dependencies: ["stripe"],
      sources: new Map([["src/checkout.ts", "stripe.checkout.sessions.create({})"]])
    });

    expect(match).toMatchObject({ concept: "payment", status: "satisfied" });
    expect(match?.evidence).toEqual([
      "dependency: stripe",
      "file: src/checkout.ts",
      "source usage: src/checkout.ts"
    ]);
  });

  it("does not let a requirement ID namespace trigger a generic rule", () => {
    const [match] = evaluateClaims([
      { claim: "REQ-API-1: Export CSV reports", requirementId: "REQ-API-1", sourceLine: 2 }
    ], {
      files: ["src/reports.ts", "tests/reports.test.ts"],
      implementationFiles: ["src/reports.ts"],
      testFiles: ["tests/reports.test.ts"],
      dependencies: [],
      sources: new Map([["src/reports.ts", "export function exportCsvReports() { return csv; }"]]),
      implementationSources: new Map([["src/reports.ts", "export function exportCsvReports() { return csv; }"]]),
      testSources: new Map([["tests/reports.test.ts", "it('exports CSV reports', () => {});"]])
    });

    expect(match).toMatchObject({ requirementId: "REQ-API-1", concept: "unknown", status: "satisfied" });
  });

  it("allows generic add requirements to use entity evidence without matching conflicting actions", () => {
    const darkMode = evaluateRequirementDepth("Add dark mode", {
      implementationSources: new Map([["src/theme.ts", "export function toggleDarkMode() { globalThis.darkModeEnabled = !globalThis.darkModeEnabled; }"]]),
      testSources: new Map([["tests/theme.test.ts", "it('toggles dark mode', () => {});"]])
    });
    const wrongAction = evaluateRequirementDepth("Add task records", {
      implementationSources: new Map([["src/tasks.py", "def list_task_records(): return []"]]),
      testSources: new Map([["test_tasks.py", "def test_list_task_records(): pass"]])
    });

    expect(darkMode.status).toBe("satisfied");
    expect(wrongAction.status).toBe("missing");
  });
});
