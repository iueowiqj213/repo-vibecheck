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

- `satisfied`: the rule's required evidence groups were found.
- `partially_satisfied`: meaningful evidence exists, but implementation evidence is incomplete.
- `missing`: the requirement is recognized and no meaningful evidence was found.
- `unverifiable`: the claim is outside the MVP's supported evidence catalog.

A dependency alone normally does not prove a feature. For example, the `stripe` package without server-side checkout/payment usage is reported as partial.

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
