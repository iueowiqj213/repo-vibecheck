# Repo Vibecheck MVP Design

## Product

`repo-vibecheck` verifies that an AI-generated repository works and matches what was requested. It audits false claims, missing implementation, placeholders, mock integrations, environment mismatches, and basic build reality.

The CLI is intentionally evidence-based rather than AI-powered. It reports what it can prove, what appears partial, what is absent, and what cannot be determined reliably.

## CLI contract

```text
repo-vibecheck scan [path]
  --json
  --requirements <file>
  --prompt <file>
  --run-install
  --run-scripts
```

- `path` defaults to the current directory.
- Static analysis is the safe default.
- `--run-install` and `--run-scripts` explicitly opt into executing untrusted repository code and display a warning on human-readable output.
- `--run-scripts` runs finite `build` and `test` scripts only, with a timeout. It never starts `dev` or `start`.
- Read-only HTTPS registry lookups are enabled by default and degrade to warnings if unavailable; they never invoke a target repository's package-manager executable.
- JSON output is deterministic and contains no ANSI formatting.

## Architecture

The implementation uses four small layers:

1. `inventory`: recursively lists relevant files while excluding `.git`, dependencies, generated output, binary files, and likely secret env files. It detects package manager, project types, manifests, scripts, and dependencies.
2. `checks`: performs baseline script checks, README-to-script consistency, env consistency, package metadata checks, placeholder/mock detection, and optional command execution.
3. `requirements`: extracts claims from a requirements file, prompt, or README and evaluates them with declarative evidence rules.
4. `reporters`: renders one typed report as human-readable text or JSON.

The scan orchestrator has no terminal formatting or process exit side effects, which keeps it directly testable and reusable by a future GitHub Action or SaaS service.

## Project detection

Package manager detection uses lockfiles first and `packageManager` second. Multiple lockfiles or disagreement with `packageManager` produce a finding. Supported managers are npm, pnpm, yarn, and bun.

Project types are inferred from manifests, dependencies, and conventional files. MVP labels include Node.js, TypeScript, Next.js, Vite, React, and unknown JavaScript.

## Requirements and claim matching

The extractor recognizes explicit bullets, headings, and sentences containing supported feature concepts. The MVP concept catalog includes:

- authentication/login
- Stripe/payment/checkout
- database/Prisma/Supabase/Firebase
- email/Resend/SendGrid/Nodemailer
- Docker/container support
- tests
- API/backend
- deployment

Each concept defines independent evidence groups such as file globs, dependency names, and source patterns. Status rules are:

- `satisfied`: all required evidence groups are present.
- `partially_satisfied`: some meaningful implementation evidence exists, but a required group is absent.
- `missing`: the requirement is recognized and no meaningful evidence exists.
- `unverifiable`: a claim is extracted but is outside the supported concept catalog or cannot be mapped safely.

Evidence from README text alone never proves implementation. Dependency presence alone is normally partial evidence. For example, Stripe is satisfied only when its package plus server-side checkout/payment usage exists; webhook evidence is reported separately when absent.

README claims are evaluated through the same engine, so the tool does not maintain two contradictory implementations.

## Fake-completeness checks

Relevant text source files are scanned for high-signal markers such as `TODO`, `FIXME`, `not implemented`, `coming soon`, placeholder UI text, mock/fake service declarations, and handlers that explicitly throw unimplemented errors. Findings include file and line evidence and avoid generated/vendor directories.

This is a warning system, not proof of fraud. Reports use cautious language and never label a repository deceptive solely from a marker.

## Baseline checks

- Report package scripts and whether README commands refer to missing scripts.
- Optionally run install using the detected manager.
- Optionally run existing build and test scripts with timeout and captured result metadata.
- Never run a development server.
- Always state: "Build passed does not mean production-ready."

Environment checks retain the useful Repo Doctor behavior:

- variables used by `process.env.NAME`, `import.meta.env.NAME`, `Deno.env.get("NAME")`, `os.environ["NAME"]`, and `os.getenv("NAME")`
- keys declared in `.env.example`
- uppercase env-like variables mentioned by README
- used but undocumented, documented but unused, and README-only mismatches

Dependency checks remain supporting evidence: counts, install lifecycle script risk, missing package metadata, outdated versions, and deprecation notices when registry data is available. Registry failure does not fail the scan.

## Findings and report schema

Every finding contains:

```ts
type Finding = {
  id: string;
  category: "project" | "baseline" | "requirements" | "claims" | "env" | "dependencies" | "placeholders";
  severity: "info" | "warning" | "error";
  message: string;
  evidence: string[];
  remediation?: string;
};
```

Requirement matches additionally contain the original claim, normalized concept, status, evidence, and missing evidence.

The top-level report includes schema version, product, target path, timestamp, score, detected project data, checks executed, requirement matches, findings, and summary counts.

## Scoring and exit behavior

The score is an explainable 0-100 signal, not a certification:

- 50 points: requirements and README claim reality
- 25 points: install/build/test baseline and script consistency
- 15 points: fake-completeness and env consistency
- 10 points: dependency and package hygiene

Unavailable or unrequested checks are excluded from their sub-score rather than treated as passing. The report shows category scores.

MVP exits non-zero only for invalid CLI input, unreadable targets, or internal failures. Findings do not fail the command yet; a future `--fail-on` option can add CI policy without breaking the initial contract.

## Open-source package

- Node.js 20 or newer
- TypeScript ESM
- Commander 14 for the CLI
- Vitest for unit and integration tests
- MIT license
- `examples/sample-project` deliberately contains partial claims, env mismatches, placeholders, and valid/invalid scripts so both report formats demonstrate useful output

The code avoids framework-specific AST dependencies in MVP. Declarative rules and narrow source patterns provide a simple extension path while keeping install size and maintenance low.

## Test strategy

Tests cover pure detectors and rules with temporary fixtures, then exercise the built CLI through child processes. Critical cases include package-manager conflict, README missing script, each requirement status, env patterns, placeholder exclusions, command timeout/result capture, stable JSON shape, and the sample project's human report.

## Explicit non-goals

- Security/CVE certification
- Running long-lived dev servers
- Proving production readiness
- Semantic understanding of arbitrary natural-language requirements
- Sandboxing untrusted commands
- Supporting non-Node build execution in the MVP
