# Independent financial slice review — FX and library performance

Date: 2026-09-19\
Reviewer: Luna QA\
Baseline under review: current `e7ec/TradeReview` worktree\
Scope: ticket 04 FX implementation and the pure tickets 05/06 performance module. No production edits, full-suite run, or browser run in this review.

## Verification performed

The following focused checks were run after reading the worker reports and inspecting the actual code:

```text
npx vitest run app/lib/fx/fx-service.test.ts app/lib/fx/provider.test.ts app/api/fx/route.test.ts app/components/library/fx-rates-control.test.tsx
  4 files, 22 tests passed

npx vitest run app/lib/reviews/library-performance.test.ts
  1 file, 8 tests passed

npx eslint app/lib/fx app/api/fx/route.ts app/components/library/fx-rates-control.tsx \
  app/lib/reviews/library-performance.ts app/lib/reviews/library-performance.test.ts
  exit 0

npm run typecheck
  exit 0
```

The Node deprecation warning about `module.register()` appeared during Vitest startup; it did not fail a test. No browser or full-suite conclusion is made here.

## Independent findings and pass boundaries

### FX — passed within the reviewed slice

- `app/lib/fx/provider.ts:103-167` keeps one deadline alive across the fetch, response body read, and JSON parse. The timeout aborts the request and reports `timeout`; the focused body-hang test passes.
- The provider validates a full CNY/HKD/USD response, rejects duplicate/unexpected/missing/non-positive/non-finite rows, and inverts the CNY-base quote at the boundary to the required contract of “one foreign unit in CNY” (`provider.ts:57-95`).
- `app/lib/fx/storage.ts:28-44` replaces one complete snapshot in one SQLite transaction. `readFxSnapshot` fails closed for malformed persisted JSON. The focused reopen and incomplete-candidate tests pass.
- `app/lib/fx/service.ts:14-90` preserves the prior successful rates on a failed refresh, marks the saved snapshot cached, keeps its original `fetchedAt`/rate date, records `lastAttemptedAt` and the error, and uses the per-database generation guard so an older in-flight call cannot overwrite a newer result. Both success/failure overlap tests pass. `openSqliteDatabase` caches one handle per database path (`db/sqlite.ts:11-12,92-112`), so the guard is attached to the route’s shared handle in this runtime.
- `app/api/fx/route.ts:16-37` separates read-only GET from provider-fetching POST and sends `Cache-Control: no-store`; route tests cover GET not invoking refresh and POST failure statuses.
- `app/components/library/fx-rates-control.tsx:31-48,50-77` reads the saved snapshot on mount and refreshes only from the button. Cached provider responses and transport failures keep the visible previous rates and disclose the failure. The control tests cover no-snapshot, manual refresh, cached response, and client transport failure.

### Metrics — passed within the pure module

- `app/lib/reviews/library-performance.ts:247-293` selects closed trusted finite PnL and separates open/unavailable rows. Open rows never enter closed PnL or return samples; valid unrealized PnL is exposed through the independent `open` result (`:576-591`). The focused tests cover an unavailable open mark.
- `calculateMetricSet` (`:313-416`) uses the same trusted rows for each weighted-return numerator and denominator. Invalid/zero/negative exposure is excluded only from return coverage, while a valid closed PnL may remain in the net-PnL sample. No value is replaced with zero.
- CNY conversion is applied to both net PnL and exposure through one passed snapshot (`:295-305,330-371`). The 7.00 FX example and missing-rate symmetry pass. Raw-currency groups remain available when CNY conversion is unavailable.
- Fees, short direction, and IPO acquisition logic are delegated to `summarizeTradeEpisode`; the focused short/IPO test verifies that this module does not recalculate or double count those facts (`library-performance.test.ts:310-344`).
- Nature/run scope boundaries are encoded in `scopeOf` and `comparableGroups` (`:220-227,536-557`); multi-run input produces separate groups and an unavailable top-level CNY aggregate. Coverage counts remain disclosed.
- Grouping is linear: assessments are built once, then inserted into Maps; each assessment is visited once per required output grouping (`:529-538,576-582`). The implementation no longer has the previous repeated-search/O(n²) pattern.
- All-loss samples return profit factor `0` with no misleading “unavailable” reason (`:408-412`), and the focused test passes.

## Remaining findings

### Resolved scope ruling — market is a selected-range boundary

The earlier review treated the absence of `market` from `LibraryPerformanceScope` (`library-performance.ts:29-33`) as a P1 boundary. The coordinator’s final ruling resolves that ambiguity: the selected market filter defines the range, and an all-markets selection may combine live CNY/HKD/USD rows after the single FX snapshot conversion. Nature and simulation run remain mandatory performance boundaries. This matches the final spec rule that CNY conversion may compare currencies within the current live selection and the R7 CNY/USD example.

The pure API is therefore acceptable for the current contract. The final UI still needs to prove that the displayed summary uses the selected market range and that nature/run groups remain separate; no new market key is required solely to split all-markets live results.

### P2 validation hardening — ISO date checks are lexical only

`app/lib/fx/contracts.ts:46-52` accepts any `YYYY-MM-DD` shape and `Date.parse`-accepted timestamp. A value such as `2026-02-31` satisfies `isIsoDate` and can flow through provider/storage validation. The trusted provider is expected to return real dates, so this did not affect the focused tests or the manual refresh contract, but persisted/imported metadata can be calendar-invalid. If the implementation promises strict snapshot validation, add calendar validity checks and a focused rejection test. This is outside the current acceptance blocker unless malformed provider payloads are in scope.

### Integration remains unverified

The FX control is not yet wired to the library summary, and `summarizeLibraryPerformance` is not yet called by the stock/queue UI in this worktree (`rg` finds only its pure tests/module). Therefore this review does not pass:

- the browser requirement that entering/filtering/sorting the library performs only local FX GET and no external provider request;
- consistent use of one snapshot for stock totals, weighted return, and sorting;
- the visible CNY metric labels, cache-date disclosure, missing-rate row behavior, or mixed-scope cards;
- source/market/run labels after ticket 03/06/07/08 integration;
- isolated-database browser writes, desktop/narrow layout, or the final preview.

The coordinator should keep these as integration gates even though the pure financial modules are green.

## 766/5000 production performance methodology

Use the isolated database for the 766-round run and a separate ephemeral benchmark database or deterministic in-memory fixture for 5,000 rounds. Do not add synthetic rows to `.data/library-ux/acceptance.sqlite`, and do not use command/tool round-trip time as a UI timing measurement.

### Dataset and environment

1. Record the exact worktree commit, Node version, browser version, viewport, OS, CPU/power mode, database path, and server port.
2. Run a production build and serve that build on a dedicated loopback port. Use the 766-round isolated DB with its pre-existing source fingerprints. For 5,000 rounds, generate deterministic IDs and realistic distributions across instruments, accounts, years, nature/run, review states, currencies, open/untrusted rows, and child counts in a throwaway DB or benchmark harness.
3. Pin one complete FX snapshot in the fixture and disable external network access during timing. Warm the app and browser once before collecting samples. Record browser console errors and `PerformanceObserver` long tasks if available.

### Interaction timing

Instrument the browser with `performance.mark()`/`performance.measure()` around the user-visible action. The start mark is immediately before dispatching the click or select/input event. The end mark is after the expected DOM state is committed and two `requestAnimationFrame` callbacks have completed, or after a `MutationObserver` sees the expected row/count/summary update followed by two frames. This measures event handling, filtering/grouping, React render and paint scheduling; it excludes CUA/Playwright command latency, network wait, and human think time.

For each dataset:

- Warm up with 3 expand/collapse and 3 filter changes, discard them.
- Run 20 randomized stock expand/collapse pairs, including small, medium and high-child-count stocks. Measure each expand and collapse separately and record median, p95, max, and every raw sample.
- Run 20 filter updates covering search, market, nature, review status, year, account/source, and simulation run. Wait for the expected row/count change before ending each sample. Record the same statistics.
- Repeat the 20 + 20 sequence at least three times without changing the dataset; report each repetition and the aggregate p95. Keep the 766 and 5,000 results separate.
- During every sequence verify that summary sample IDs, review state, and FX snapshot identity are unchanged except where the action intentionally changes the filter. Capture a screenshot or DOM assertion for the final state, but do not include those capture calls in the measured duration.

### Acceptance interpretation

Report the exact samples and p95 against the provisional targets: expand/collapse p95 ≤ 200 ms and filter-result update p95 ≤ 300 ms. If a target misses, preserve the raw trace and identify the operation, child count, dataset, and long-task stack; do not hide it by increasing server limits, adding retries, or measuring only a helper function. A passing 766-round result does not imply a passing 5,000-round result, and a passing pure function benchmark does not substitute for the browser interaction measurement.
