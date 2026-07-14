# Requirement Depth Heuristics Implementation Plan

> **For implementers:** Use the test-driven-development skill for every behavior change. Work in `D:\repo-doctor\.worktrees\v0.2-policy-and-integrations` on `feat/v0.2-policy-and-integrations`. Do not alter the external `C:\Users\liewy\OneDrive\文档\test-vibe-check` working tree.

**Goal:** Make explicit README requirement checklists fully visible and deterministically classify domain-specific requirements as satisfied, partial, missing, or unverifiable using repository evidence.

**Architecture:** Keep the existing generic concept rules in `requirements.ts`. Add a focused `requirement-depth.ts` fallback for unknown claims, preserving stable source metadata from extraction through reporting. Scoring consumes requirement-level evaluability instead of assuming the entire requirements category is covered when any one rule matches.

**Constraints:** Offline, deterministic, read-only, schema 2.0 additive compatibility, no LLM/API calls, no exact-score fitting to 78/68, and no README prose as positive implementation evidence.

---

## File Map

- Create `src/requirement-depth.ts`: claim tokenization, identifier normalization, fallback evidence matching, and negative status downgrades.
- Modify `src/requirements.ts`: extract explicit README requirement sections with metadata and route unknown claims through the fallback evaluator.
- Modify `src/types.ts`: add optional requirement metadata and optional per-category coverage.
- Modify `src/scan.ts`: preserve extracted metadata, provide production/test evidence separately, and emit an uncovered-requirements warning.
- Modify `src/score.ts`: score partial requirements and weight overall coverage by requirement evaluability.
- Modify `src/reporters.ts`: display IDs, source lines, depth gaps, and requirements coverage.
- Create `tests/fixtures/realistic-half-built/`: minimal committed fixture derived from behavior, not copied runtime data from the external repository.
- Modify `tests/requirements.test.ts`, `tests/score.test.ts`, `tests/scan.test.ts`, and `tests/reporters.test.ts`: unit and integration coverage.
- Modify `README.md` and `CHANGELOG.md`: document requirement-section scope and score/coverage semantics.

## Task 1: Extract Explicit Requirement Sections

**Files:** `src/types.ts`, `src/requirements.ts`, `tests/requirements.test.ts`

1. Add failing tests for `extractReadmeRequirements`:
   - extracts numbered and bulleted items below `Requirements`, `Requirement Checklist`, `Acceptance Criteria`, and `Feature Requirements` headings;
   - stops at the next heading of equal or higher depth;
   - ignores `Examples`, `Current Status`, `Honest Gaps`, and arbitrary README lists;
   - assigns explicit IDs unchanged and fallback IDs `README-1`, `README-2` in source order;
   - records the original one-based source line.
2. Run `npm test -- --run tests/requirements.test.ts` and confirm the new tests fail for missing behavior.
3. Add an internal `ExtractedRequirement` interface with `claim`, `requirementId`, `sourceLine`, and optional declared downgrade. Keep new public `RequirementMatch` fields optional for schema compatibility.
4. Implement heading-scoped extraction without changing `extractClaims` behavior for external requirement files.
5. Re-run the focused test and confirm it passes.
6. Commit: `feat: extract explicit README requirements`.

## Task 2: Parse Negative Self-Assessment Without Trusting Completion Claims

**Files:** `src/requirements.ts`, `tests/requirements.test.ts`

1. Add failing tests using status lines such as `Done: 1, 2`, `Partial / shallow: 3, 4`, and `Missing depth: 5`.
2. Assert that partial/missing-depth references attach only to matching numbered requirements, while `Done` does not produce a positive status or evidence.
3. Assert that unrelated prose containing `partial` cannot downgrade a requirement.
4. Implement reference parsing for explicit requirement numbers/IDs. Represent negative declarations as downgrade hints; never represent `done` as evidence.
5. Run the focused tests.
6. Commit: `feat: capture requirement depth declarations`.

## Task 3: Add Deterministic Fallback Evidence Matching

**Files:** `src/requirement-depth.ts`, `src/requirements.ts`, `tests/requirements.test.ts`

1. Add failing tests for token normalization:
   - split snake_case, kebab-case, camelCase, punctuation, and common stop words;
   - retain meaningful nouns and verbs;
   - map a small documented synonym set needed for common repository language (`done`/`complete`, `remove`/`delete`, `modify`/`edit`, `persist`/`save`/`load`).
2. Add failing classification tests:
   - matching function or command branch plus focused test/second implementation signal is `satisfied`;
   - one implementation signal without depth is `partially_satisfied`;
   - a concrete claim with no implementation signal is `missing`;
   - an abstract claim with insufficient meaningful tokens is `unverifiable`;
   - README text, comments alone, generated files, dependencies, and test filenames alone cannot satisfy a feature.
3. Implement a small pure evaluator returning status, evidence, missing-evidence reasons, and evaluability. Keep evidence bounded and stable-sorted.
4. Route only claims not matched by existing generic rules through the fallback. Do not normalize distinct fallback requirements into one concept.
5. Apply negative declarations after evidence evaluation: they may lower `satisfied` to partial/missing but never upgrade any status.
6. Run `npm test -- --run tests/requirements.test.ts`.
7. Commit: `feat: evaluate domain requirements from code evidence`.

## Task 4: Integrate Requirement-Level Coverage and Scoring

**Files:** `src/types.ts`, `src/score.ts`, `tests/score.test.ts`

1. Add failing tests for requirement credit: satisfied `1`, partial `0.5`, missing `0`, unverifiable `0`.
2. Add failing tests showing `categoryScores.requirements.coverage` equals the percentage of non-unverifiable requirement weight.
3. Add failing tests showing overall `scoreCoverage` uses the requirements category's fractional covered weight while retaining existing handling for `not_run` and `not_applicable` categories.
4. Add optional `coverage?: number` to `CategoryScore`; no existing field is removed or renamed.
5. Refactor `scoreReport` to calculate score and coverage separately. Guard empty denominators and keep results bounded from 0 to 100.
6. Run `npm test -- --run tests/score.test.ts`.
7. Commit: `feat: weight score coverage by evaluated requirements`.

## Task 5: Wire the Scanner and Reports

**Files:** `src/scan.ts`, `src/reporters.ts`, `tests/scan.test.ts`, `tests/reporters.test.ts`

1. Add failing scan tests showing all explicit checklist items reach `requirementMatches` with IDs/source lines and documentation is excluded from positive evidence.
2. Add a failing test for a `requirements.unverifiable` warning when one or more explicit requirements cannot be classified.
3. Add reporter tests for ID, status, evidence, missing-depth reason, source line, and `Requirements: X/50 (Y% covered)`.
4. Change `scan.ts` to combine external requirement claims with scoped README requirements while preserving metadata. Provide implementation and test source maps separately to the evaluator.
5. Ensure config disable rules still affect generic concepts and cannot accidentally remove all fallback claims via the shared `unknown` label.
6. Update human rendering; JSON remains the serialized schema 2.0 report with additive optional fields.
7. Run `npm test -- --run tests/scan.test.ts tests/reporters.test.ts`.
8. Commit: `feat: report requirement depth and coverage`.

## Task 6: Add a Realistic Half-Built Regression Fixture

**Files:** `tests/fixtures/realistic-half-built/README.md`, `tests/fixtures/realistic-half-built/app.py`, `tests/fixtures/realistic-half-built/test_app.py`, `tests/scan.test.ts`

1. Create a compact fixture with ten requirements: completed core task operations, shallow edit/priority/open filtering, weak validation, and basic tests.
2. Add an integration test asserting:
   - all ten requirement IDs are reported;
   - known shallow items are partial rather than satisfied;
   - validation is not marked satisfied merely because error strings exist;
   - the placeholder marker remains visible;
   - score is below a fully completed equivalent fixture;
   - coverage is below 100 when at least one requirement remains unverifiable;
   - no assertion requires exact 78 or 68.
3. Add a completed comparison fixture in the test body or temporary directory only as needed for monotonic comparison; do not duplicate a second permanent project.
4. Run `npm test -- --run tests/scan.test.ts`.
5. Commit: `test: cover realistic half-built requirements`.

## Task 7: Document Semantics and Verify Compatibility

**Files:** `README.md`, `CHANGELOG.md`, all modified source/tests`

1. Document accepted requirement headings, fallback heuristic limits, negative-only README status hints, and the distinction between score and coverage.
2. Add a changelog entry noting that explicit unknown requirements now reduce score/coverage instead of disappearing.
3. Run `npm test` and require all tests to pass.
4. Run `npm run build` and require exit 0.
5. Run `npm pack --dry-run --json` and inspect that no fixture secrets or external target files are packaged unexpectedly.
6. Run `node dist/cli.js scan "C:\Users\liewy\OneDrive\文档\test-vibe-check" --offline --redact`. Require ten requirement entries, at least one partial item, the `app.py:140` placeholder, no raw home path, and no `Basic <REDACTED>` false redaction.
7. Run the same target scan with `--json`, parse stdout, and require schema 2.0, ten distinct requirement IDs, bounded score/coverage, at least one satisfied and one partial item, and the placeholder finding. Require a score below the pre-fix 97, not exact 78/68.
8. Run the target scan with `--format sarif`; require SARIF 2.1.0, one run, a placeholder result, and no absolute target/home path in serialized output.
9. Confirm `git diff --check` has no output and `$env:GIT_MASTER='1'; git status --short` is clean after commits. Verify the external target has no new source files from this work.
10. Commit docs separately: `docs: explain requirement depth scoring`.

## Task 8: Review and Update the Existing PR

1. Invoke `review-work`. Require goal/constraint, code-quality, and security lanes to return PASS. Hands-on QA must execute focused/full tests and all three target output modes. Traceability must map every design success criterion to a test or verification command. Resolve concrete blockers with regression tests and rerun failed lanes.
2. Push `feat/v0.2-policy-and-integrations` without rewriting history.
3. Run `gh pr checks 1 --watch --interval 10`; require `action-smoke`, `verify (20)`, and `verify (24)` to pass.
4. Run `gh pr view 1 --json url,state,mergeable`; require `OPEN` and `MERGEABLE`. Do not merge it.

## Definition of Done

- Explicit requirement checklists cannot silently collapse to one recognized generic concept.
- Every extracted requirement has a stable ID, source line, explainable status, and bounded evidence.
- Unsupported requirements visibly lower coverage.
- Existing generic evidence rules and schema 2.0 consumers remain compatible.
- The half-built branch receives a materially more conservative, explainable result without hard-coded fixture-specific scores.
- Full local verification and GitHub CI pass.
