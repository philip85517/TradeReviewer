# R7 US39 metric scope evidence

Date: 2026-09-27

Scope was limited to `app/lib/recall/actual-metrics.test.ts`. The approved US39 evidence gap is the direct Recall metrics boundary: live executions and each simulation `simulationRunId` must remain isolated. Existing upstream episode and trading-room tests already cover grouping/filtering; this file now verifies the metrics entry point with real `TradeEpisode` and `TradeExecution` inputs.

## Contract checked

`calculateRecallActualMetrics` derives the visible ledger from `context.cursor` and `context.executionCursor`, then checks each visible execution against the episode account, instrument, trade nature, and simulation run. A visible mismatch returns `null` metrics with reason `execution-scope-mismatch`. Executions beyond the knowledge boundary are not visible to that guard and must not contaminate an earlier result.

## Added boundary cases

- Same simulation run: all visible executions and the episode carry `tradeNature: "simulation"` and `simulationRunId: "run-a"`; the calculation still returns net PnL `6760` and actual R `1.69`.
- Different visible simulation run: the final visible execution is changed to `run-b`; realized gross, net PnL, and actual R are all `null` with `execution-scope-mismatch`, rather than a fabricated zero.
- Visible live/simulation mix: the episode and first two executions are live, while the final visible execution is simulation `run-a`; the same explicit mismatch reason and null metrics are required.
- Future wrong-run execution: the final execution is `run-b` but the context only reveals through `exit-a`; the early visible ledger still computes realized gross `4800`, while open-position metrics retain their explicit `episode-open` reason.

## Verification

Command:

```sh
PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
./node_modules/vitest/vitest.mjs run app/lib/recall/actual-metrics.test.ts \
--pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose
```

Result:

```text
Test Files  1 passed (1)
Tests       22 passed (22)
```

Full verbose output is preserved in `R7-metric-scope.txt`. No production file, schema, aggregation implementation, or unrelated test file was changed.
