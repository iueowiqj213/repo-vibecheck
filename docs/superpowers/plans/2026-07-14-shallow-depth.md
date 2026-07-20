# Shallow Implementation Detection Implementation Plan

> Work in `D:\repo-doctor\.worktrees\v0.3-shallow-depth` on `feat/v0.3-shallow-depth`. Follow strict RED-GREEN TDD and commit each independently revertible concern.

**Goal:** Downgrade requirement matches backed only by identity/pass/empty implementations from satisfied to partial without relying on README self-assessment.

**Architecture:** Add a pure bounded analyzer in `src/shallow-depth.ts`. `src/requirement-depth.ts` passes its already-selected implementation signals and source maps to the analyzer before finalizing a satisfied fallback match. No schema or score formula changes.

## Task 1: Pure Python Body Analysis

**Files:** create `src/shallow-depth.ts`, create `tests/shallow-depth.test.ts`

1. Write failing tests for Python empty bodies, `pass`, and direct parameter returns.
2. Add negative tests for object/literal returns, mutations, branches, transformations, validation, and delegated calls.
3. Run `npm test -- --run tests/shallow-depth.test.ts` and confirm RED.
4. Implement bounded function extraction from a one-based evidence line with a maximum body window. Return `{ shallow: boolean; reason?: string }` without source snippets.
5. Re-run focused tests and require GREEN.
6. Commit: `feat: detect shallow Python implementations`.

## Task 2: JavaScript and TypeScript Body Analysis

**Files:** `src/shallow-depth.ts`, `tests/shallow-depth.test.ts`

1. Add failing tests for empty functions, direct parameter returns, expression arrows returning a parameter, and block arrows returning a parameter.
2. Add negative tests for objects/literals, mutation, branches/ternaries, transforms, and function/method delegation.
3. Confirm RED, implement minimal bounded brace/arrow handling, and confirm GREEN.
4. Keep ambiguous or unbalanced syntax substantive rather than shallow.
5. Commit: `feat: detect shallow JavaScript implementations`.

## Task 3: Integrate with Fallback Requirement Depth

**Files:** `src/requirement-depth.ts`, `src/shallow-depth.ts`, `tests/requirements.test.ts`

1. Add failing tests showing a fallback requirement with implementation plus focused test is initially satisfied but becomes partial when every implementation signal is shallow.
2. Assert one substantive signal prevents downgrade; existing partial/missing/unverifiable results remain unchanged.
3. Assert generic concept rules never invoke this downgrade.
4. Add stable missing reason `implementation returns its input unchanged`, `implementation body is empty`, or `implementation body only passes`.
5. Confirm focused GREEN and run existing requirements tests.
6. Commit: `feat: downgrade shallow requirement evidence`.

## Task 4: Evidence-Only Fixture Regression

**Files:** `tests/fixtures/realistic-half-built/*`, `tests/scan.test.ts`

1. Add focused tests for delete/edit/priority/open-filter implementations with matching tests but no README `Current Status` section.
2. Confirm identity implementations are partial independently of README declarations.
3. Confirm substantive completed equivalents score higher without asserting exact scores.
4. Run `npm test -- --run tests/scan.test.ts tests/shallow-depth.test.ts`.
5. Commit: `test: verify shallow depth without README hints`.

## Task 5: Documentation and Verification

**Files:** `README.md`, `CHANGELOG.md`

1. Document conservative shallow detection and false-positive safeguards. State that it only downgrades satisfied to partial.
2. Run `npm test` and require all tests pass.
3. Run `npm run build`, `npm pack --dry-run --json`, and `git diff --check`.
4. Scan `tests/fixtures/realistic-half-built` and `C:\Users\liewy\OneDrive\文档\test-vibe-check` in human, JSON, and SARIF modes with `--offline --redact`; require valid schemas, ten requirements, bounded scores, and placeholders retained.
5. Commit docs separately: `docs: explain shallow implementation checks`.

## Task 6: Review and PR

1. Run the five-lane `review-work` workflow against this design and plan. Resolve concrete blockers with regression tests.
2. Push `feat/v0.3-shallow-depth` without rewriting history.
3. Open a PR against `main`; do not merge it.
4. Run `gh pr checks <number> --watch --interval 10`; require Action smoke and Node 20/24 checks pass.
5. Confirm PR state `OPEN` and `MERGEABLE` and worktree clean.

## Definition of Done

- Python and JS/TS identity/pass/empty bodies are detected deterministically and conservatively.
- Substantive branches, mutations, transforms, validation, and delegation are not downgraded.
- Only satisfied fallback requirements can become partial.
- The behavior does not depend on README negative declarations.
- Schema 2.0, scoring, generic rules, baseline, redaction, SARIF, and CI remain compatible.
