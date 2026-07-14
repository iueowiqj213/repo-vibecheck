# Shallow Implementation Detection Design

## Problem

Repo Vibecheck v0.2 can find requirement-aligned functions and focused tests, but a matching entry point may still be an identity stub such as `delete_task(task): return task`. README self-assessment can downgrade these cases, but a verifier must not depend on a repository admitting that its implementation is shallow.

## Scope

The first v0.3 slice adds deterministic, bounded shallow-body detection for Python and JavaScript/TypeScript functions already selected as requirement evidence. It does not attempt whole-program semantics, call-graph analysis, or general code-quality scoring.

## Classification

A shallow signal may downgrade `satisfied` to `partially_satisfied`. It never changes an existing `partially_satisfied`, `missing`, or `unverifiable` result, and it never produces `missing` by itself.

The result includes a stable missing-depth explanation. The scoring formula does not change; score changes follow from the status downgrade.

## Candidate Selection

Only implementation evidence lines already matched to a fallback requirement are inspected. Generic auth/payment/database/email/Docker/tests/API/deployment rules retain their existing behavior.

Inspection is bounded to the matched function and a small maximum body window. Evidence remains relative file and line metadata; source snippets are not added to reports.

## Shallow Patterns

The following bodies are shallow:

- empty body
- Python `pass`
- direct return of an input parameter
- JavaScript/TypeScript arrow or function body that directly returns an input parameter

The following are not shallow:

- returning a new object, literal, or transformed expression
- mutating a field, collection, file, or external state
- branching with `if`, `switch`, `match`, or conditional expressions
- filtering, sorting, validating, or comparing values
- delegating to another function or method call

All matched implementation signals must be shallow before a satisfied requirement is downgraded. A single substantive implementation signal is sufficient to avoid the downgrade.

## Architecture

Create `src/shallow-depth.ts` as a pure analyzer. `requirement-depth.ts` remains responsible for lexical evidence selection and calls the analyzer only after collecting implementation signals. The analyzer returns a bounded reason associated with the existing evidence line.

`RequirementDepthMatch` continues to return status, evidence, and missing evidence. No schema version change is required.

## Reporting

Existing human and JSON reporters need no structural changes. A downgraded result uses the existing `missingEvidence` field, for example:

```text
Status: partially_satisfied
Missing: implementation returns its input unchanged
```

## Safety and Limits

Analysis is offline, read-only, deterministic, and bounded. It does not execute target code, parse dependency folders, or expose source text. Ambiguous bodies are treated as substantive rather than shallow to avoid false downgrades.

## Success Criteria

1. Identity implementations with matching tests downgrade from satisfied to partial without README status declarations.
2. `pass` and empty functions downgrade from satisfied to partial.
3. mutations, branches, transformations, validation, and function delegation do not downgrade.
4. mixed evidence downgrades only when every matched implementation is shallow.
5. generic concept rules, schema 2.0, scoring arithmetic, baseline behavior, and report formats remain compatible.
6. The half-built fixture remains lower-scoring when its README status section is removed, for independently observed code-depth reasons.
