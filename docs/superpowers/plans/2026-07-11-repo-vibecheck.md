# Repo Vibecheck MVP Implementation Plan

**Goal:** Build and verify an open-source TypeScript CLI that audits whether AI-generated Node repositories work and match requirements and README claims.

**Architecture:** A pure scan orchestrator consumes a safe repository inventory and composes focused detectors. Declarative requirement rules evaluate file, dependency, and source evidence. Reporters serialize the same typed result to terminal text or stable JSON. Optional process execution is isolated behind an injected runner.

**Tech stack:** Node.js 20+, TypeScript ESM, Commander 14, Vitest.

## Files

- `package.json`, `tsconfig.json`, `vitest.config.ts`: package, ESM build, and tests.
- `src/types.ts`: shared report and detector contracts.
- `src/inventory.ts`: bounded recursive file inventory and text loading.
- `src/project.ts`: manifest, project type, package manager, lockfile, and script detection.
- `src/env.ts`: env usage/example/README extraction and mismatch findings.
- `src/placeholders.ts`: high-signal fake-completeness markers.
- `src/requirements.ts`: claim extraction, evidence catalog, and status evaluation.
- `src/baseline.ts`: README script consistency and optional command execution.
- `src/dependencies.ts`: dependency metadata, lifecycle risk, and best-effort npm outdated check.
- `src/score.ts`: explainable category scores.
- `src/scan.ts`: side-effect-light orchestration.
- `src/reporters.ts`: human and JSON output.
- `src/cli.ts`: Commander adapter and error handling.
- `tests/*.test.ts`: focused unit tests and built CLI integration test.
- `examples/sample-project/**`: intentionally incomplete fixture.
- `README.md`, `LICENSE`, `.gitignore`: open-source package documentation.

## Task 1: Scaffold and contracts

1. Add package/config files and the executable TypeScript entry point.
2. Add a failing report-schema smoke test.
3. Run the focused test and confirm it fails.
4. Implement `src/types.ts` and a minimal scan result factory.
5. Run the focused test and confirm it passes.

## Task 2: Inventory and project detection

1. Add failing fixture tests for ignored directories, package managers, lock conflicts, scripts, and framework labels.
2. Run the tests and confirm expected failures.
3. Implement bounded inventory and package/project detection.
4. Run focused tests and type diagnostics.

## Task 3: Requirements and README reality

1. Add failing tests for satisfied, partial, missing, and unverifiable claims.
2. Include Stripe dependency-only partial evidence and auth multi-evidence success.
3. Implement claim extraction and declarative concept rules.
4. Reuse the evaluator for README claims.
5. Run focused tests.

## Task 4: Fake completeness and env consistency

1. Add failing tests for TODO/unimplemented/mock markers and ignored generated files.
2. Add failing tests for all required JavaScript, Deno, and Python env patterns.
3. Implement both detectors with file/line evidence.
4. Run focused tests.

## Task 5: Baseline and dependency checks

1. Add failing tests for README commands that reference absent scripts.
2. Add runner tests for package-manager commands, timeout/result metadata, and never running dev/start.
3. Add package metadata/lifecycle script tests.
4. Implement static baseline checks, opt-in install/build/test runner, and best-effort npm outdated parsing.
5. Run focused tests.

## Task 6: Scoring, orchestration, and reporters

1. Add failing tests for bounded score, category breakdown, human disclaimer, and deterministic JSON structure.
2. Implement scoring and compose all detectors in `scanRepository`.
3. Implement human and JSON reporters.
4. Run all unit tests.

## Task 7: CLI and sample project

1. Add a failing child-process integration test for default path, explicit path, `--requirements`, and `--json`.
2. Implement Commander command/options and actionable errors.
3. Build an intentionally partial sample project and requirements file.
4. Run integration tests against the built CLI.

## Task 8: Open-source documentation

1. Write README positioning, installation, usage, report example, safety warning, limits, development, and license sections.
2. Add MIT LICENSE and `.gitignore`.
3. Confirm README claims correspond to implemented behavior.

## Task 9: Final verification

1. Run `npm install`.
2. Run `npm test` and fix only root causes.
3. Run TypeScript diagnostics and `npm run build`.
4. Run `node dist/cli.js scan examples/sample-project --requirements requirements.md` (requirements paths are resolved from the scanned repository).
5. Run the same scan with `--json` and parse the output as JSON.
6. Re-read the product requirements and design; confirm all MVP promises are represented or explicitly documented as limitations.

No commits are included because the workspace is not currently a Git repository and no commit was requested.
