# Repo Vibecheck

[![CI](https://github.com/iueowiqj213/repo-vibecheck/actions/workflows/ci.yml/badge.svg)](https://github.com/iueowiqj213/repo-vibecheck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Verify that your AI-generated repo actually works and matches what was requested.

Repo Vibecheck is an evidence-based CLI for auditing vibe-coded repositories. It compares requirements and README claims with repository evidence, detects common signs of fake completeness, checks environment-variable consistency, and optionally verifies install/build/test reality.

It does **not** certify security or production readiness. Build passed does not mean production-ready.

## What it checks

- Package manager, lockfile consistency, and basic Node/TypeScript/Next.js/Vite/React detection
- Requirements or original prompts against auth, payments, database, email, Docker, tests, API, and deployment evidence
- README claims against the same evidence rules
- Missing package scripts referenced by the README
- TODO, FIXME, not-implemented, coming-soon, mock, and fake-service markers
- Code, `.env.example`, and README environment-variable consistency
- Dependency counts, install lifecycle scripts, package metadata, and best-effort npm registry version/deprecation metadata
- Optional install, build, and test execution with finite timeouts

## Install

Requires Node.js 20 or newer.

```sh
npm install
npm run build
npm link
```

After publication, install globally with `npm install --global repo-vibecheck` or run it with `npx repo-vibecheck`.

## Usage

Scan the current directory:

```sh
repo-vibecheck scan
```

### Policy configuration

```yaml
# repo-vibecheck.yml
projectType: library # auto | app | library | cli | template
failOn: error
offline: true
redact: true
ignore:
  findings: [env.example-unused]
requirements:
  disable: [deployment]
execution:
  passEnv: []
```

CLI flags override configuration. Categories that are not applicable or not run are reported explicitly and excluded from the normalized score.

### Baselines and SARIF

```sh
repo-vibecheck scan --write-baseline .repo-vibecheck-baseline.json
repo-vibecheck scan --baseline .repo-vibecheck-baseline.json --fail-on error
repo-vibecheck scan --format sarif --output repo-vibecheck.sarif --redact
```

With a baseline, CI policy considers only new findings. JSON schema 2.0 includes category status, score coverage, and baseline counts.

Scan another repository and compare it with a requirements file:

```sh
repo-vibecheck scan ./my-project --requirements requirements.md
repo-vibecheck scan ./my-project --prompt original-prompt.md
```

Emit JSON for CI, a future GitHub Action, or another service:

```sh
repo-vibecheck scan ./my-project --json
```

Control CI failure without changing report content:

```sh
repo-vibecheck scan ./my-project --fail-on error
repo-vibecheck scan ./my-project --fail-on warning
```

The local CLI defaults to `--fail-on never`. Invalid input/internal failures exit 2; a selected finding threshold exits 1.

## GitHub Action

```yaml
- uses: iueowiqj213/repo-vibecheck@v0.1.0
  with:
    path: .
    requirements: requirements.md
    fail-on: error
```

The Action defaults to `fail-on: error`. `run-install` and `run-scripts` remain explicit opt-ins because they execute repository code.

Static analysis is the default. Executing repository code is always opt-in:

```sh
repo-vibecheck scan ./my-project --run-install --run-scripts
```

These flags may execute arbitrary code from the target repository. Repo Vibecheck runs only install plus existing `build` and `test` scripts; it never starts `dev` or `start`.

## Understanding requirement results

Each requirement is reported with a stable ID, status, source line, evidence, and missing evidence when the result is not satisfied:

- `satisfied`: the required evidence groups were found.
- `partially_satisfied`: meaningful evidence exists, but implementation evidence is incomplete.
- `missing`: the requirement is recognized and no meaningful evidence was found.
- `unverifiable`: the claim is outside the supported evidence catalog.

The scanner extracts explicit requirement checklists from the README alongside any external requirements file. Recognized section headings (case-insensitive) are `Requirements`, `Requirement Checklist`, `Acceptance Criteria`, and `Feature Requirements`. Extraction stops at the next heading of the same or higher level, so ordinary lists, examples, status summaries, and honest-gap sections are not treated as requirements. Explicit IDs such as `REQ-12` are preserved; numbered items without IDs become `README-1`, `README-2`, and so on.

README self-assessment can only lower confidence. If a status summary explicitly links a requirement ID or number to terms like `partial`, `shallow`, `incomplete`, `missing depth`, or `not implemented`, the result is downgraded. A `done` label never upgrades a requirement and never replaces code evidence.

Requirements that do not match an existing concept rule fall back to a deterministic lexical heuristic. The fallback searches source files for related symbols, commands, persisted fields, and focused tests, but ignores generated folders, dependency directories, comments, and the README text itself. One implementation signal without depth is reported as partially satisfied; no signal for a concrete claim is reported as missing; abstract claims are unverifiable. The heuristic is offline and deterministic, not a semantic or AI evaluation, so it can still miss nuanced quality.

For Python and JavaScript/TypeScript fallback requirements, Repo Vibecheck also inspects the already-matched function body. Empty functions, Python `pass`, and functions that only return an input unchanged are treated as shallow and can downgrade `satisfied` to `partially_satisfied`. A mutation, branch, transformation, validation step, delegated function call, or any other substantive matching implementation prevents the downgrade. Ambiguous syntax is treated as substantive to avoid false penalties.

A dependency alone normally does not prove a feature. For example, the `stripe` package without server-side checkout/payment usage is reported as partial.

### Score and coverage

The requirements category contributes up to 50 points. Requirement points are distributed evenly across extracted items:

- `satisfied`: full item credit
- `partially_satisfied`: half item credit
- `missing`: zero credit
- `unverifiable`: zero credit and explicitly uncovered

Requirement coverage is the share of requirement weight that is satisfied, partially satisfied, or missing. Unverifiable requirements reduce coverage instead of disappearing. Overall `scoreCoverage` combines executed categories, but the requirements category now contributes its measured requirement coverage rather than being counted as fully covered after a single recognized claim.

Score measures how much weighted evidence was found. Coverage measures how much of the weighted audit surface could be evaluated. A high score with low coverage means the evaluated portion performed well, but much of the repository remains unverified.

## Example

```sh
node dist/cli.js scan examples/sample-project --requirements requirements.md
node dist/cli.js scan examples/sample-project --requirements requirements.md --json
```

The sample intentionally includes false and partial claims so the report demonstrates useful failures.

Example excerpt:

```text
Repo Vibecheck Report

Requirements Match
! Payment
  Status: partially_satisfied
  Missing: server-side payment call
! Payment evidence found, but no webhook handler evidence was detected
```

## Benchmarks

Validate the pinned public corpus manifest or run the network-free fixture:

```sh
npm run benchmark:validate
npm run benchmark:fixture
```

`npm run benchmark` clones public repositories at pinned commits into a temporary directory and produces scan summaries. The corpus is for reproducibility and framework coverage; it is not an accuracy claim until results have been manually labeled.

## Environment setup

Repo Vibecheck itself requires no environment variables. Repositories being scanned can document non-secret names in `.env.example`; actual `.env` files are excluded from inventory.

## Development

```sh
npm install
npm test
npm run build
```

## Limits

The MVP uses transparent heuristics rather than an LLM or framework-specific ASTs. A satisfied result means the expected evidence exists, not that the feature is correct, secure, or production-ready. Optional commands are not sandboxed.

## License

MIT
