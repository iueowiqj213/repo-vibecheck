# Public repository benchmark

This corpus checks that Repo Vibecheck can scan varied real repositories without crashing and records detector behavior for review. Repositories are fetched at immutable commits listed in `repos.json`; their source is never committed here.

## Latest baseline

Run on 2026-07-11 with registry checks disabled:

| Repository | Detected project types | Score | Errors | Warnings | Requirement matches |
|---|---|---:|---:|---:|---:|
| node-ts-api-template | Node.js, TypeScript | 46 | 13 | 1 | 4 |
| vite-plugin-react | Node.js, TypeScript, Vite | 2 | 15 | 5 | 0 |
| next-learn | Node.js, Next.js | 64 | 1 | 3 | 2 |
| react-fundamentals | Node.js, TypeScript, React | 16 | 1 | 2 | 1 |
| clsx | Node.js | 25 | 0 | 0 | 1 |

The raw run is in `latest-results.json`. Scores are not quality rankings of these upstream projects: repositories may be libraries, tutorials, or tools whose documentation and package conventions differ from an application. This baseline is for crash resistance, detection coverage, and tracking report noise—not an accuracy or endorsement claim.

## Commands

```sh
npm run benchmark:validate
npm run benchmark:fixture
npm run benchmark -- --json --output benchmarks/latest-results.json
```

Public mode requires Git and network access. Fixture mode is network-free and is the only mode run in CI.
