# Root-owned diagnosis

Baseline: `.scratch/native-debug-baseline/reports/full-unit.log`, unchanged application/test implementation at diagnosis start. 65 failures / 2999 passes / 6 pre-existing skips, 9 failed files, 369.17s.

## Ranked falsifiable hypotheses

1. Workspace/import/recall tests enter an obsolete route and fail before their intended behavioral assertion. Probe: exact individual failures with one worker; compare rendered current entry and approved chart-first contract. A matching failure in isolation falsifies resource-only causation.
2. Async UI and process-backed deploy tests exceed wall-clock budgets under the default worker pool. Probe: exact failed cases and then affected complete files in isolation, followed by integrated suite with a bounded worker pool without changing timeout values. A repeat isolated failure falsifies resource-only causation.
3. Holdings fallback uses a date assumption inconsistent with fixture source priority. Probe: deterministic exact case and independently inspect each parsed/fallback candidate. Pin the intended contract before changing either production or fixture.

## Deploy result

Command: `npm run test:unit -- scripts/deploy.test.mjs -t 'publishes a checked backup|restores a checked database|runs deployed operational Make targets' --maxWorkers=1`

Result: exit 0, 3 passed, 55 unselected, 12.86s test time / 16.27s elapsed. No timeout or test assertion changed. Full baseline had the same three cases timeout at 5000/15000/5000ms. Exact output: `deploy-red-green.log`.

Hardware: 4 physical / 8 logical CPU, 16GiB RAM. Installed Vitest 4.1.10 `resolveMaxWorkers` uses availableParallelism minus one in run mode (local source `node_modules/vitest/dist/chunks/cli-api.BK8pd4xc.js`). Thus default seven worker processes plus transform/main/UI services can contend on this machine. This is evidence supporting hypothesis 2, not yet integrated acceptance.

## Nine complete-file probe

After the independently reviewed R08 fixture clock repair, ran all nine complete affected files with `--maxWorkers=2`, all original timeouts and assertions. Exit 1, 270 passed / 3 failed (273), 8/9 files green, 190.03s. Exact evidence `affected-files.log` and `affected-files.json`.

Three remaining failures are default-5s timeouts in the main workspace file (drawing persistence + completion rejection cases, and confirmed-import library return context). The original 65-count census is reduced substantially without product or other fixture changes, but resource bounding alone is not sufficient. The three exact cases are back in bounded diagnosis. Default configuration remains unchanged pending repair and green affected-file acceptance.

Full-suite acceptance remains unverified. The R04 missing-details button from the earlier four-file serial probe is also retained as a prior flakiness signal; the complete R04 file passes in the two-worker probe and its read-only follow-up locates it in pre-provider local-market hydration.
