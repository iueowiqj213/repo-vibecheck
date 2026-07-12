# Repo Vibecheck Launch Readiness Design

## Goal

Move the working engineering MVP to an adoption-ready open-source `v0.1.0`: lower report noise, provide an explicit CI policy, ship a reusable GitHub Action and CI workflow, make npm packaging verifiable, and add a reproducible real-repository benchmark harness.

## Requirement match normalization

Requirement evaluation remains evidence-based, but output is normalized after evaluation:

- Recognized matches are grouped by normalized concept.
- All distinct source claims are retained in a `claims` array.
- Evidence and missing evidence are deduplicated.
- A concept is satisfied only when the grouped evidence satisfies that concept's rule; grouping cannot upgrade a result merely because the same weak evidence appeared repeatedly.
- Status precedence is evidence-aware: satisfied, partially satisfied, missing. Unknown claims remain separate and unverifiable.
- `Docker deployment` maps to Docker support only; a generic deployment match is suppressed when the same claim explicitly names Docker or containers.
- Human output prints one entry per recognized concept and shows the originating claims compactly.
- Scoring consumes normalized matches so repeated README prose cannot change the score.

The JSON schema advances to `1.1`. `RequirementMatch` keeps `claim` for compatibility and adds `claims`; `claim` is the first normalized source claim.

## Exit policy

The CLI adds `--fail-on <level>` with `never`, `error`, and `warning`:

- Local CLI default: `never`.
- `error`: exit 1 if at least one error finding exists, or a requirement is missing.
- `warning`: exit 1 for warning/error findings, missing requirements, or partially satisfied requirements.
- Invalid CLI values, unreadable input, and internal failures: exit 2.
- A successful scan that does not cross the selected policy: exit 0.
- Human and JSON report content is identical regardless of selected policy.

Policy evaluation is a pure exported function. The CLI adapter sets `process.exitCode`; the scan orchestrator remains reusable and side-effect free.

## GitHub Action and CI

Ship a composite `action.yml` with inputs for path, requirements, prompt, fail level, run-install, and run-scripts. It sets up Node, installs the package from the checked-out action directory, builds it, and runs the CLI. The Action default is `fail-on: error`.

The repository CI workflow runs on pushes and pull requests and performs:

1. checkout
2. Node setup with npm cache
3. `npm ci`
4. `npm test`
5. `npm run build`
6. `npm pack --dry-run`
7. local composite Action smoke test against `examples/sample-project`

The Action is intentionally composite rather than Docker or a committed bundle for `v0.1.0`. This keeps the CLI as the single implementation and avoids release artifact drift.

## Package and community metadata

Package metadata uses the actual repository URL and includes homepage, bugs, author, files, bin, engines, license, and publish access. Add `prepack` to guarantee a fresh build.

Add README badges, a concise report example, GitHub Action usage, exit-policy documentation, benchmark instructions, limitations, and a contribution guide. Do not claim npm publication or benchmark accuracy before evidence exists.

## Benchmark harness

Add `benchmarks/repos.json` with a small, diverse public corpus pinned to immutable commits. The corpus covers Node, TypeScript, Vite, React, and Next.js projects.

`scripts/benchmark.mjs`:

- validates the manifest
- clones each repo at its pinned commit into an OS temporary directory
- runs the built CLI in static JSON mode with registry checks disabled for reproducibility
- records duration, score, finding counts, detected project types, and process outcome
- writes a machine-readable result only when `--output` is supplied; otherwise prints a summary
- cleans temporary repositories
- supports `--fixture` to exercise the harness without network access

CI uses fixture mode. The public corpus is a manual benchmark because third-party network availability must not gate contributions. No precision/recall claim is made until results are manually labeled.

## Git integration

Initialize the local workspace on `main`, configure `origin` as `https://github.com/iueowiqj213/repo-vibecheck.git`, fetch the remote, and anchor local HEAD to `origin/main` while preserving the local working tree. Do not commit or push without an explicit request.

## Verification

- npm install/ci succeeds
- all tests pass
- TypeScript build succeeds
- npm pack dry-run contains only intended publish files
- human report has one entry per recognized concept
- JSON schema 1.1 parses
- all exit policy modes return expected codes
- composite Action smoke steps work locally
- benchmark fixture succeeds and public manifest validates
- full post-implementation review passes
