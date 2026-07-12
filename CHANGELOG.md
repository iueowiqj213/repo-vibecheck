# Changelog

## 0.2.0

- Add YAML policy configuration and app/library/CLI/template profiles.
- Normalize scores over applicable and executed categories; JSON schema is now 2.0.
- Add baseline write/compare and new-only CI gating.
- Add deterministic requirement IDs, multiline criteria, and negation handling.
- Add SARIF, atomic output files, and GitHub Step Summary support.
- Add benchmark labels, redaction, sanitized execution environments, process-tree cleanup, and offline/redacted Action defaults.

Schema 2.0 changes `categoryScores` from numbers to status-bearing objects and adds `scoreCoverage`.
