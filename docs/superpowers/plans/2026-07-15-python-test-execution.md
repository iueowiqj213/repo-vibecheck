# Opt-In Python Test Execution Implementation Plan

> Work in `D:\repo-doctor\.worktrees\v0.4-python-tests` on `feat/v0.4-python-tests`. Follow strict RED-GREEN TDD. The branch is stacked on `feat/v0.3-shallow-depth`.

## Task 1: Select the Python Test Command

**Files:** `src/runner.ts`, `tests/runner.test.ts`

1. Add failing tests that select `python -m unittest discover -v` only when `runScripts` is true and project types include Python.
2. Assert Node command selection is unchanged and mixed projects receive both command sets.
3. Add a stable `python-test` command label without shell invocation.
4. Run `npm test -- --run tests/runner.test.ts`; before implementation require the new selection assertions to fail, then require the file to pass after implementation.
5. Commit: `feat: select opt-in Python unittest command`.

## Task 2: Integrate Python Results and Zero-Test Detection

**Files:** `src/scan.ts`, `tests/scan.test.ts`

1. Add temporary Python repositories for passing `unittest.TestCase`, failing unittest, zero tests, and no opt-in.
2. Run `npm test -- --run tests/scan.test.ts`; confirm new passing/failing/zero/no-opt-in scenarios fail before scan integration.
3. Feed detected project types into command selection and append attempted command labels to `checksExecuted`.
4. Treat `Ran 0 tests` in bounded command output as a baseline error even on exit 0.
5. Reuse existing sanitized environment, timeout, output cap, and process-tree cleanup.
6. Re-run `npm test -- --run tests/scan.test.ts`; require every Python scenario and all existing scan tests to pass.
7. Commit: `feat: execute opt-in Python tests`.

## Task 3: Make Executed Baseline Failures Decisive

**Files:** `src/score.ts`, `tests/score.test.ts`

1. Add failing tests showing any baseline/project error after execution yields baseline `0/25`.
2. Preserve warning-only penalties, successful `25/25`, `not_run`, and profile applicability.
3. Implement the smallest scoring change and run `npm test -- --run tests/score.test.ts`; require baseline error `0/25`, warning-only penalty, success `25/25`, `not_run`, and profile cases to pass.
4. Commit: `fix: zero failed execution baselines`.

## Task 4: Report Executed Checks Clearly

**Files:** `src/reporters.ts`, `tests/reporters.test.ts`

1. Add failing human-report tests for `Executed checks: python-test` and omission when no checks ran.
2. Keep JSON schema 2.0 unchanged through existing `checksExecuted`.
3. Implement and run `npm test -- --run tests/reporters.test.ts`; require the executed-check line only for non-empty `checksExecuted`.
4. Commit: `feat: show executed verification checks`.

## Task 5: Release Metadata and Documentation

**Files:** `package.json`, `package-lock.json`, `src/cli.ts`, `tests/release.test.ts`, `README.md`, `CHANGELOG.md`

1. Bump package, lockfile, and CLI to 0.4.0; retain the version-alignment regression.
2. Document `--run-scripts` Python behavior, arbitrary-code warning, unittest-only scope, zero-test behavior, and no dependency installation.
3. Add changelog entries and run `npm test -- --run tests/release.test.ts`; require package/lock/CLI version alignment and existing release contracts.
4. Commit metadata and docs separately.

## Task 6: Verification

1. Run `npm test`, `npm run build`, `npm pack --dry-run --json`, and `git diff --check`.
2. Run `npm test -- --run tests/scan.test.ts`; its temporary passing unittest repository must record `python-test`, baseline 25, and increased coverage, while failing and zero-test repositories must produce baseline errors and baseline 0.
3. Run `node dist/cli.js scan tests/fixtures/realistic-half-built --json --offline --redact`; require no `python-test` without opt-in. Then run `node dist/cli.js scan tests/fixtures/realistic-half-built --json --offline --redact --run-scripts`; require `python-test`, a zero-test baseline error, and baseline 0 because this fixture uses pytest-style functions.
4. Run `node dist/cli.js scan "C:\Users\liewy\OneDrive\文档\test-vibe-check" --run-scripts --offline --redact`, then repeat with `--json` and `--format sarif`; require its unittest suite to execute, valid schema 2.0/SARIF 2.1.0 output, `python-test` in JSON, and no source changes in the target repository.

## Task 7: GPT-Only Review and Stacked PR

1. Launch five GPT-only lanes using Oracle and `deep`: goal, QA, quality, security, and traceability.
2. Resolve every blocker with regression tests and rerun failed lanes.
3. Push `feat/v0.4-python-tests`.
4. Open a stacked PR with base `feat/v0.3-shallow-depth`; do not merge either PR.
5. Require Action smoke and Node 20/24 CI pass; confirm PR open/mergeable and worktree clean.

## Definition of Done

- Python tests execute only under the existing explicit opt-in.
- Passing, failing, timeout/spawn, and zero-test outcomes are distinct and bounded.
- Executed baseline errors score zero.
- Human and JSON reports clearly distinguish executed checks from static evidence.
- Node behavior, schema 2.0, baseline files, SARIF, redaction, and static defaults remain compatible.
