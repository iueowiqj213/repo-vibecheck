import { describe, expect, it } from "vitest";
import { evaluateClaims, extractClaims, extractReadmeClaims, normalizeMatches } from "../src/requirements.js";

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
});
