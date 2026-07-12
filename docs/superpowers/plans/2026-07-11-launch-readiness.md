# Repo Vibecheck Launch Readiness Implementation Plan

**Goal:** Turn the verified CLI MVP into an adoption-ready open-source v0.1.0 without committing or pushing.

**Architecture:** Normalize requirement matches between evaluation and scoring/reporting; keep exit policy in a pure module; make the composite Action a thin CLI adapter; make the benchmark runner consume a pinned manifest and support network-free fixtures.

**Tech stack:** TypeScript, Node.js 20+, Commander, Vitest, composite GitHub Actions, npm.

## Files

- Modify `src/types.ts`, `src/requirements.ts`, `src/scan.ts`, `src/score.ts`, `src/reporters.ts` for concept normalization and schema 1.1.
- Add `src/policy.ts`; modify `src/cli.ts` for `--fail-on` and exit 0/1/2.
- Update focused tests and add policy/normalization integration coverage.
- Add `action.yml` and `.github/workflows/ci.yml`.
- Update `package.json`, lockfile, README; add `CONTRIBUTING.md`.
- Add `benchmarks/repos.json`, `benchmarks/fixtures/`, `scripts/benchmark.mjs`, and benchmark tests.
- Initialize `.git` and configure `origin` only after content is ready.

## Task 1: Normalize requirement matches

1. Write failing tests proving one match per recognized concept, Docker/deployment suppression, unknown preservation, claim-source retention, and score stability under duplicate prose.
2. Run focused tests and confirm failures.
3. Add `claims` to the match contract and implement a pure normalization function.
4. Normalize before scoring/reporting and advance schema to 1.1.
5. Update human output to show compact source claims.
6. Run focused and full tests.

## Task 2: Add exit policy

1. Write failing pure policy tests for never/error/warning.
2. Write failing CLI tests for option validation and selected exit code.
3. Implement `src/policy.ts` and Commander parsing.
4. Keep scan failures at exit 2 and policy failures at exit 1.
5. Run focused and full tests.

## Task 3: Add Action and CI

1. Add tests that parse/inspect Action and workflow contracts without network execution.
2. Add composite `action.yml` with the specified inputs and default `fail-on: error`.
3. Add CI workflow for npm ci, test, build, pack dry-run, benchmark fixture, and local Action smoke test.
4. Validate YAML syntax and referenced commands.

## Task 4: Prepare npm/community metadata

1. Update package repository, homepage, bugs, author, exports, publish config, scripts, and prepack.
2. Add CONTRIBUTING and README badges, report sample, Action usage, fail policy, benchmark docs, and limitations.
3. Run `npm pack --dry-run --json` and verify intended file list.

## Task 5: Add benchmark harness

1. Write failing tests for manifest validation, fixture mode, deterministic summary, and cleanup/error behavior where practical.
2. Add a pinned public corpus manifest spanning Node, TypeScript, React, Vite, and Next.js.
3. Implement fixture and public clone modes in `scripts/benchmark.mjs`.
4. Add a tiny local benchmark fixture and npm scripts.
5. Run manifest validation and fixture benchmark; do not invent accuracy metrics.

## Task 6: Initialize Git safely

1. Confirm the workspace is still not a git repository.
2. Initialize branch `main` with git-master environment enabled.
3. Add the supplied origin and fetch `origin/main`.
4. Anchor HEAD/index to the existing remote commit while preserving local working-tree content.
5. Verify status, remote URL, branch, and diff; do not stage, commit, or push.

## Task 7: Final verification and review

1. Run npm install/ci, all tests, build, and package dry run.
2. Run human and parsed JSON scans and verify normalized output.
3. Exercise exit codes for never, error, warning, invalid input, and internal input failure.
4. Run benchmark fixture and validate public manifest.
5. Validate Action/CI configuration and smoke commands.
6. Run post-implementation review; fix all blocking findings and repeat verification.
