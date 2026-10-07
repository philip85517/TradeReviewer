# R04 refresh-order diagnosis

## Exact failure location

The four-file serial run did not time out. It produced one order-sensitive failure in
`app/components/trade-review-workspace.refresh.test.tsx`, in the test
`refreshes the global saved summary after a single instrument update`.
The Testing Library stack points to line 427:

```text
await screen.findByRole("button", { name: "行情数据详情" });
```

This is the **first** open of the default stock round. The second open is line 443,
after the refresh and navigation back to the review view; execution never reaches it.
The failure is therefore not a stale result from the second open.

The failure DOM contains the application in `is-review`, but no chart toolbar. The
workspace render has an intermediate branch for `selectedImportedInstrument` while
either `hydratedMarketIds` lacks the instrument or `selectedIntradayReady` is false.
That branch renders `section.review-workspace-loading` with
`aria-label="交易复盘图表工作区"`, `aria-busy="true"`, and the text
`正在读取本地行情与回放状态…`. The `行情数据详情` button is inside `RecallWorkspace`'s
chart toolbar, so its absence is evidence that local market/readiness hydration had
not crossed the render gate within Testing Library's default one-second `findByRole`
budget. It is not a selector ambiguity.

## Candidate causes

1. **Async readiness budget (strongest).** The test writes a terminal market-data job,
   but that localStorage record does not provide chart candles. Entering the round
   still performs the daily and intraday IndexedDB reads before `RecallWorkspace` can
   render. The mocked `daily` and `intraday` refresh functions are only used after the
   toolbar is opened, so they cannot make the initial toolbar appear.

2. **Residual async repository/read state (plausible).** The preceding tests in the
   same file run in one process. Their cleanup unmounts React and clears mocks, but the
   legacy fixture's IndexedDB market repository has no explicit close/dispose seam.
   An in-flight read or connection/cache work left by an earlier test could stretch the
   next round's hydration beyond one second. This needs a bounded ordered probe before
   choosing a fixture cleanup change.

3. **Mock implementation leakage (weak for this failure).** `vi.clearAllMocks()` does
   not reset implementations, and an earlier test installs a deferred `daily`
   implementation. However, this failing test explicitly assigns resolved
   implementations to **both** `refreshMocks.daily` and `refreshMocks.intraday` before
   rendering. The first toolbar lookup happens before either provider is called.
   Leakage remains a general suite risk but does not explain this initial missing
   button.

4. **Unawaited fixture write (weak).** `saveImportedExecutions` and
   `saveMarketDataJob` use synchronous localStorage writes in the legacy test client.
   The database deletion is awaited before the execution fixture is written. There is
   no evidence in the failure path for an unawaited fixture write; the pending work is
   the component's local-market hydration.

## Minimal probe after the centralized run

Run only the ordered prefix that can contaminate this test, in one worker, and retain
the timing output:

```sh
npx vitest run app/components/trade-review-workspace.refresh.test.tsx \
  -t 'cancels a running batch, persists a terminal job, and waits before the next batch|restores saved result and failure details without starting provider work|refreshes the global saved summary after a single instrument update' \
  --maxWorkers=1 --reporter=verbose
```

If this reproduces, the smallest diagnostic instrumentation is immediately after
`openDefaultStockRound(user)`: record whether
`screen.queryByRole("region", {name: "交易复盘图表工作区"})` is still loading and its
`aria-busy` value, then wait for that region to become non-busy. That distinguishes a
one-second readiness budget from a permanently blocked hydration gate. Do not increase
the project default timeout as a fix. If the ordered prefix passes, compare it with the
four-file serial ordering to attribute the delay to cross-file shared state/worker
contention.

No implementation or test change is recommended from this evidence alone. If the
probe confirms an order-only hydration delay, the minimal likely change is confined to
the R04 test fixture's awaited cleanup/readiness seam; production workspace code,
Vitest defaults, and shared setup should remain unchanged pending stronger evidence.
