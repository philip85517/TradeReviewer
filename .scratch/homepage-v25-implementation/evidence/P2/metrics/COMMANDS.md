# Commands and observed results

All commands ran in `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview` using pinned Node:

`/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`

No service/browser/DB, full suite, performance run, dependency/config mutation outside this evidence directory, or commit/push/merge was performed. Scoped evidence config extends project strict settings with incremental=false and the test ambient types; it includes only the new source/test and their imported type dependencies. It is not a project config change.

## TDD and final verification

Common test command (the exact command for every numbered test log):

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/metric-cards.test.tsx --maxWorkers=1
```

Output was redirected to each named log with `> LOG 2>&1`. Subsequent commands capture `result=$?`, display the log/tail and `exit $result` so their shell exit is the tested command exit. Exception: initial01 wrapper printed a file afterward and therefore ended0; the actual Vitest import-failure exit is1.

| Log | Stage | Actual tool/command exit | Observed result |
| --- | --- | --- | --- |
| 01-red.log | New test imports absent leaf | Vitest1; original display wrapper0 | Import failure; no behavioral tests executed. This alone was not accepted as behavioral RED. |
| 02-red-behavior.log | Minimal empty component after test specification | 1 | All19 behavioral tests fail. |
| 03-green.log | Initial complete leaf | 0 | 19/19 PASS. |
| 04-green.log | Currency/display ruling and exact accessible precision | 0 | 19/19 PASS. |
| 05-future-red.log | New future-detail boundary assertion before fix | 1 | 1 failed/18 passed; source/original amount incorrectly present despite unknown future state. |
| 06-green.log | Suppress future/empty metric evidence | 0 | 19/19 PASS. |
| 09-switch-red.log | Direct card-to-card detail assertion before fix | 1 | 1 failed/19 passed; old outside handler closed the new detail. |
| 10-final-tests.log | Final new-file test run | 0 | 20/20 PASS, 1 file; 07:12:29 CST, duration5.18s. |

The runner emits Node DEP0205 `module.register()` deprecation. No application warning/error occurred in the passing test log; this is not a claim that all project/toolchain warnings were eliminated.

Type command:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/metrics/tsconfig.scoped.json --pretty false
```

07-types.log exit0, empty output. Final11-final-types.log exit0, empty output after both boundary fixes.

Lint command:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/metric-cards.tsx app/components/homepage-v25/metric-cards.test.tsx
```

08-lint.log exit0, empty output. Final12-final-lint.log exit0, empty output after both fixes. CSS is visually/source-reviewed here, not claimed to have ESLint coverage.

## Reference rendering / repository evidence

The five original images/copies listed in REFERENCE-READS.md were directly viewed. Three SVG originals were converted to PNG with installed sharp through pinned Node and saved only in metrics. No browser viewport/render measurements are inferred from those design rasters.

`git rev-parse HEAD` returned5a94ee3ff76e32993fe2c4791a83b40e877a7344. `git status --short --` for the three scoped files reports each as new/untracked. Full new-file diff was captured using `git diff --no-index -- /dev/null FILE` for each file (expected exit1 signifies new contents, not a failed verification), combined into NEW-FILES.diff. Hashes were generated with Node crypto SHA256 over exact bytes, with no mutation of product/reference files.

The first freeze helper exited1 because it incorrectly expected exit0 from `git diff --no-index --check` for new files; Git returned1 with no diagnostics (difference exit). The helper was corrected to accept that expected new-file exit when output is empty. No product change or new behavioral test run followed. `13-freeze.log` records the corrected hash/whitespace verification and the initial helper failure explicitly.
