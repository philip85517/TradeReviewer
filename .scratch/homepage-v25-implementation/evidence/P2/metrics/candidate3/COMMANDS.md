# Candidate3 bounded verification commands

All commands ran from `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview` with pinned runtime `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node` (`v26.0.0`). No full suite/build/browser/service/DB checks were run. Vitest4.1.10; jsdom; one worker; test cache disabled. Each log captures stdout and stderr. Exit codes were observed from the command runner. Existing DEP0205 module.register deprecation warnings are retained in logs and are not test failures.

## Product RED then GREEN

Exact command for each of01/02/03:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/metrics/candidate3/vitest.config.mjs --configLoader native
```

| Log | Production state | Result / interpretation |
| --- | --- | --- |
| 01-red-product.log | Candidate2 baseline | exit1;26 collected,24 pass/2 timeouts; INVALID harness failure from fake-timer/userEvent interaction; not product RED |
| 02-red-corrected-product.log | Same candidate2 baseline, corrected test driver | exit1;26 collected,24 pass/2 expected failures;10:29:19 CST,duration3.58s. Both assert retained exit DOM and fail because old close unmounted it immediately. Valid product RED |
| 03-green-product.log | Frozen candidate3 | exit0;26/26,1file;10:30:24 CST,duration3.08s |

Original23 test bodies remain byte-identical; imports add test clock/events, three lifecycle tests are appended. New tests verify closed access/exact opener immediately plus159/160ms removal; reopened current detail survives old cleanup and retains exact value; reduced motion reaches terminal close immediately. They do not claim real animation frames, native input or geometry.

## Original independent counterexample

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/metrics/independent-review/vitest.config.mjs --configLoader native
```

`04-independent-counterexample.log`: exit0,1/1,1file;10:30:54 CST,duration3.72s. Original independently authored test/config unchanged (hashes in SOURCE-SHA256.json). This is a worker rerun, not independent root review.

## Scoped static checks

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/metrics/candidate3/tsconfig.scoped.json --pretty false
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/metric-cards.tsx app/components/homepage-v25/metric-cards.test.tsx
```

`05-types.log` and `06-lint.log`: each exit0, empty diagnostics. The strict scoped config extends the unchanged repository tsconfig, disables incremental emission and includes the leaf plus its test/required type imports. No shared/root config writes. Lint covers TSX/test; no CSS lint result is asserted.

Independent counterexample, typecheck and lint were run concurrently after product GREEN; every result was inspected. No production edits followed those final checks.

## Freeze evidence

`git diff --no-index --check` compared each baseline product file to its current product. Each exit1 means the file differed; there were no whitespace diagnostics. A read-only Python check confirmed the complete original23 test body block remains byte-identical and wrote full candidate/current diffs and SHA manifests. `07-freeze.log` records these results and pinned runtime. Final evidence readback verifies frozen product hashes and all required report files without further product edits.
