# Changelog

## 0.3.0

- Detect empty, `pass`, and identity-return Python and JavaScript/TypeScript implementations.
- Conservatively downgrade only satisfied fallback requirements to partial when every matched implementation is shallow.
- Keep mutations, branches, transformations, validation, and delegated calls substantive.
- Verify shallow depth independently of README self-assessment.

## 0.2.0

- Add YAML policy configuration and app/library/CLI/template profiles.
- Normalize scores over applicable and executed categories; JSON schema is now 2.0.
- Add baseline write/compare and new-only CI gating.
- Add deterministic requirement IDs, multiline criteria, and negation handling.
- Extract explicit README requirement checklists (`Requirements`, `Requirement Checklist`, `Acceptance Criteria`, `Feature Requirements`) with stable IDs, source lines, and per-requirement status/evidence.
- README self-assessment (`partial`, `shallow`, `missing depth`, `not implemented`) can only downgrade a result; `done` never upgrades.
- Unknown explicit requirements now reduce requirement coverage instead of disappearing; overall `scoreCoverage` separates category execution coverage from requirement evaluability.
- Add SARIF, atomic output files, and GitHub Step Summary support.
- Add benchmark labels, redaction, sanitized execution environments, process-tree cleanup, and offline/redacted Action defaults.

Schema 2.0 changes `categoryScores` from numbers to status-bearing objects and adds `scoreCoverage`.
