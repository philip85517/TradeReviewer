# 自动化验证 · 2026-10-11

## Baseline

- First pre-install attempt: `npm run test -- --run ...` failed before tests with
  `sh: vinext: command not found`; this was an environment dependency miss, not
  a product failure.
- After `npm ci`, focused baseline unit tests passed: 2 files, 16 tests.

## Current commands

| Command | Result | Evidence / limitation |
| --- | --- | --- |
| `npm run test:unit -- app/components/recall/recall-workspace.test.tsx --run -t "does not let full history|keeps all full-history"` | PASS · 2 tests | Locks both regressions introduced by the audit |
| `npm run test:unit -- app/lib/replay/recall-replay.test.ts app/components/design-prototype/recall-design-prototype.test.ts app/components/recall/recall-workspace.test.tsx app/components/recall/recall-integration.recall-review.test.tsx --run` | PASS · 4 files, 112 tests | State, prototype and integration focus suite |
| `npm run typecheck` | PASS | exit 0 |
| `npx eslint app/components/recall/recall-workspace.tsx app/components/recall/recall-workspace.test.tsx` | PASS | changed TS/TSX files clean |
| `npm run build` | PASS | existing OpenCV externalization/chunk-size/dynamic-route warnings only |
| `npm run lint` | FAIL / out-of-scope repository noise | 17 errors and 1645 warnings from `.scratch` historical scripts and vendored `lightweight-charts`; changed files pass targeted lint |
| `git diff --check` | PASS | no whitespace errors |
| `npm test` | PASS · build + 5 node tests | SQLite storage API, server-rendered review workspace, no unrevealed demo executions, and ONNX module checks all passed |

The full repository-level command passed after the browser fix. The repo-wide
`npm run lint` result remains a separate failure caused by existing `.scratch`
historical scripts and the vendored chart bundle included by the project lint
command; changed files were linted directly.
