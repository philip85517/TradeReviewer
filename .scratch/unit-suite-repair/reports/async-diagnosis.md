# R04–R07 async timeout diagnosis

Date: 2026-10-06
Scope: read-only diagnosis only. No implementation, test, Vitest config, setup, or database files were changed.

## Commands and evidence

Each census case was run as its own Vitest process with `--maxWorkers=1`, the project default timeout, and `--reporter=verbose`. The raw outputs are preserved in the sibling `async-red-*.log` files:

| ID | Exact case | Result | Test time |
| --- | --- | --- | ---: |
| R04 | refresh: cancels a running batch, persists a terminal job, and waits before the next batch | PASS | 2576 ms |
| R04 | refresh: refreshes the global saved summary after a single instrument update | PASS | 4995 ms |
| R04 | refresh: refreshes the global failure summary and details after a single hard failure | PASS | 3693 ms |
| R04 | refresh: keeps a running global batch in control when a single refresh is requested | PASS | 4239 ms |
| R05 | dashboard: reactively bounds all observation history by selected account, nature/run and refreshed entries | PASS | 3015 ms |
| R05 | dashboard: restores only applied dashboard filters and statistics period after a reload, then keeps reset cleared | PASS | 2235 ms |
| R06 | library: resets both page cursors when scope, sort, or reset changes | PASS | 1473 ms |
| R07 | storage: persists an imported trade and chart settings through SQLite without legacy browser writes | PASS | 2475 ms |

The four complete files were then run together, still with `--maxWorkers=1`. The run completed in 77.69 s with 57/58 tests passing. It did not reproduce an R04 timeout. One R04 test failed with a deterministic Testing Library lookup instead:

`refreshes the global saved summary after a single instrument update` could not find the `行情数据详情` button after returning from the data page to the stock round (`trade-review-workspace.refresh.test.tsx:427`). This is preserved in `async-red-four-files-serial.log`.

The exact case passes in a fresh process, so the combined-file failure is a test-order/state-isolation signal rather than proof of a product path timeout. The target files themselves have no production database access in these commands; R07 uses its in-test mocked SQLite client.

## Findings

1. All eight census timeouts are false as isolated reproductions under one worker. No case remained pending or exceeded 5 s when run alone. R04's saved-summary case is close to the default limit (4995 ms), so parallel transform/JSDOM/worker load can plausibly turn a marginal case into the recorded 5000 ms timeout. This supports shared suite resource contention as the primary timeout mechanism; increasing the project default timeout would mask it.

2. There is a separate order-dependent R04 fixture signal. `trade-review-workspace.refresh.test.tsx` clears call history in `beforeEach` with `vi.clearAllMocks()`, while its hoisted `refreshMocks.daily` and `refreshMocks.intraday` mocks receive per-test `mockImplementation`/`mockResolvedValue` assignments. `clearAllMocks` does not reset implementations. The file also relies on module-level refresh/storage state and asynchronous IndexedDB deletion. The single-file serial run therefore needs a bounded fixture reset investigation before any implementation change is proposed. The combined run's missing `行情数据详情` is the concrete symptom.

3. R05, R06 and R07 have no isolated timeout evidence. Their exact cases passed in 3015 ms, 2235 ms, 1473 ms, and 2475 ms respectively. Their recorded full-suite timeout status should be treated as contention-sensitive until a reproduction under a controlled multi-file run is obtained.

## Minimal next-step recommendation (implementation not authorized)

Do not change production code, test timeout defaults, `vitest.config.ts`, or `tests/setup.ts` based on this diagnosis. The smallest bounded follow-up is a test-fixture investigation in `trade-review-workspace.refresh.test.tsx`: compare `vi.clearAllMocks()` with explicit per-test mock implementation reset and verify all singleton/IndexedDB cleanup promises before remounting. Keep the current red serial log as evidence; add a new red log only if that controlled probe reproduces the lookup or timeout. For R05–R07, first repeat the exact cases in the coordinator's multi-file contention run before assigning a fix.

## Files changed

Only this report and the requested raw diagnostic logs were written under `.scratch/unit-suite-repair/reports/`. No implementation or test source was modified.
