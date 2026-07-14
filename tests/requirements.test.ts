import { describe, expect, it } from "vitest";
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
    expect(matches.find((match) => match.concept === "unknown")?.status).toBe("unverifiable");
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
      "Done: 1, REQ-ACCOUNT-2",
      "Partial / shallow: 3, REQ-ACCOUNT-2",
      "Incomplete: 4",
      "Missing depth: 5"
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
});
