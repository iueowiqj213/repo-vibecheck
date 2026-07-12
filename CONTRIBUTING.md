# Contributing

Thanks for helping make AI-generated repositories easier to verify.

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm test
npm run build
```

Use `npm run benchmark:fixture` for the network-free benchmark smoke test. The public benchmark corpus is manual and may clone third-party repositories.

## Changes

- Add or update tests before changing behavior.
- Keep evidence rules explainable and avoid treating documentation as implementation evidence.
- Include a minimal fixture for new detectors.
- Do not add generated dependencies, real secrets, or third-party repository contents.
- Keep pull requests focused and describe expected false-positive/false-negative trade-offs.

## Reporting issues

Open a GitHub issue with a minimal public reproduction, expected result, actual result, and JSON report when possible. Remove secrets before sharing reports.
