# Requirement Depth Heuristics Design

## Problem

Repo Vibecheck currently scores only requirements covered by its fixed concept rules. A README can contain ten explicit requirements while the scanner recognizes only one; the recognized item can then receive full requirement points and produce a misleadingly high score. The `codex/realistic-half-built` fixture demonstrates this: the scanner reports 97/100 after recognizing only `Basic tests`, despite the README declaring several shallow or incomplete features.

The goal is not to reproduce an LLM's exact score. The goal is to make unsupported coverage visible and produce deterministic, evidence-backed classifications for domain-specific requirements.

## Scope

The scanner will extract arbitrary list items only from explicitly named requirement sections in README files. Accepted section headings are case-insensitive variants of:

- Requirements
- Requirement Checklist
- Acceptance Criteria
- Feature Requirements

Extraction ends at the next heading of the same or higher level. Ordinary README lists, examples, status summaries, and honest-gap sections are not requirements.

Existing generic concept rules remain authoritative when they apply. The new lexical heuristic is a fallback for otherwise unknown requirements.

## Requirement Identity

Explicit IDs such as `REQ-12` remain unchanged. Numbered README requirements without IDs receive deterministic IDs in source order: `README-1`, `README-2`, and so on. The report preserves the original claim and source line.

## Evidence Model

The fallback normalizes a claim into meaningful tokens by splitting punctuation, camel case, snake case, and common stop words. It then searches non-generated source paths and source text for related symbols and terms.

Evidence has two strengths:

- Strong evidence: a matching function, command branch, persisted field, or focused test name containing the meaningful claim terms.
- Weak evidence: isolated token mentions, generic prose, comments, or a field with no behavior around it.

Generated output, dependency folders, README text, and the requirement line itself never count as implementation evidence.

Tests are supporting depth evidence, not proof by themselves. A test filename alone cannot satisfy an arbitrary feature requirement.

## Status Classification

- `satisfied`: strong implementation evidence plus either focused test evidence or a second independent implementation signal.
- `partial`: implementation evidence exists, but depth evidence is absent or a trusted negative signal identifies shallow/incomplete behavior.
- `missing`: no implementation evidence is found for a concrete requirement.
- `unverifiable`: the claim is too abstract or has too few meaningful tokens for deterministic matching.

README self-assessment can only lower confidence. Terms such as `partial`, `shallow`, `missing depth`, `not implemented`, and `incomplete`, when explicitly associated with a requirement ID or number, downgrade `satisfied` to `partial` or `missing`. Labels such as `done` never upgrade a requirement and never replace code evidence.

## Scoring and Coverage

Requirement points use the existing requirement category weight and are distributed evenly across extracted requirements:

- satisfied: full item credit
- partial: half item credit
- missing: zero credit
- unverifiable: zero credit and explicitly uncovered

Requirement coverage is the proportion of requirement weight classified as satisfied, partial, or missing rather than unverifiable. Overall `scoreCoverage` continues to combine category execution coverage, but the requirements category contributes only its measured requirement coverage instead of being treated as fully covered after one recognized claim.

The implementation must not target the manually estimated 78/100 or 68% values. Those values are comparison points, not golden outputs. Tests assert classifications, evidence, monotonic scoring, and bounded ranges rather than a hand-tuned exact score.

## Reporting

Human and JSON reports show every extracted requirement with:

- stable ID
- status
- implementation evidence
- missing-depth reason when partial, missing, or unverifiable
- source line

The report includes a warning when one or more explicit requirements are unverifiable so a high score cannot be read as complete verification.

## Safety and Determinism

The heuristic is offline, deterministic, and read-only. It does not execute target code, call an LLM, inspect dependency directories, or include secrets in evidence. Existing redaction applies to all new evidence strings.

## Success Criteria

1. All ten items in the half-built fixture's `Requirement Checklist` are represented in the report.
2. The scanner finds implementation evidence for the concrete task operations without treating mere README text as evidence.
3. Explicit partial/missing-depth declarations can lower, but never raise, a status.
4. Unknown or abstract claims reduce coverage instead of silently disappearing.
5. Existing generic auth, payment, database, email, Docker, tests, API, and deployment rules retain their behavior.
6. JSON schema compatibility is preserved within schema version 2.0 by making new fields optional where necessary.
