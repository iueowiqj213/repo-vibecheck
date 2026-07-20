# Opt-In Python Test Execution Design

## Problem

Repo Vibecheck detects Python projects, Python test files, and Python implementation depth, but `--run-scripts` executes only package-manager scripts. A Python repository can therefore receive static test evidence without proving that its tests were executed or passed.

## Scope

When a project is detected as Python and the user explicitly supplies `--run-scripts`, Repo Vibecheck runs the standard-library unittest discovery command:

```text
python -m unittest discover -v
```

The slice does not install Python, create a virtual environment, install dependencies, or invoke pytest. Static scanning remains the default.

## Opt-In Contract

- Without `--run-scripts`, Python execution remains `not_run`.
- With `--run-scripts`, Python unittest discovery is added alongside any applicable Node build/test commands.
- The existing GitHub Action `run-scripts` input controls the same behavior; no new Action or CLI option is added.
- Execution uses the existing sanitized environment, output cap, 120-second timeout, and process-tree cleanup.

## Command Result Semantics

- Exit code 0 with at least one discovered test is success.
- Non-zero exit, timeout, or spawn failure is a baseline error.
- Output indicating `Ran 0 tests` is a baseline error even if Python exits 0.
- The command label `python-test` is always appended to `checksExecuted` once attempted.
- Findings include bounded command metadata already supported by the runner; source output is not copied into requirement evidence.

## Scoring

Any error finding in the executed baseline/project command categories makes the baseline category `0/25`. A warning alone retains the existing penalty behavior. This applies consistently to Python and Node command failures.

Successful Python execution makes the baseline category scored. If no execution was requested, it remains `not_run`.

## Reporting

Human output adds an `Executed checks` line when one or more commands were attempted. JSON continues to use the existing `checksExecuted` field and schema 2.0.

The report must not describe a discovered test file as a passed test. Static requirement evidence and executed baseline checks remain separate.

## Safety

Python tests execute arbitrary target code. The existing execution warning remains prominent, and execution is never automatic. No shell is used; the executable and arguments are fixed. No target dependencies are installed.

## Compatibility

- Existing Node install/build/test selection remains unchanged.
- Mixed Node/Python repositories may execute both applicable command sets under `--run-scripts`.
- Existing schema, baseline files, SARIF, redaction, and fail-on behavior remain compatible.

## Success Criteria

1. A temporary Python `unittest.TestCase` repository passes under `--run-scripts` and records `python-test`.
2. A failing unittest repository produces a baseline error and baseline score 0.
3. A zero-test Python repository is not reported as a successful execution.
4. A timeout/spawn failure uses existing bounded runner behavior.
5. Without opt-in, no Python command runs and baseline remains `not_run`.
6. Node-only behavior and all existing tests remain unchanged.
7. Human, JSON, and SARIF outputs remain valid and distinguish static from executed checks.
