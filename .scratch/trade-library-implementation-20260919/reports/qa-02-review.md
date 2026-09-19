# Independent QA — ticket 02 filter drawer and FX date hardening

Date: 2026-09-19\
Reviewer: Luna QA\
Scope: `library-filter-drawer`, its option builder, current shared-state integration boundaries, and the requested FX calendar-date fix. No production edits, browser run, database writes, or full-suite run.

## Verification

```text
npx vitest run \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.test.tsx \
  app/lib/fx/provider.test.ts
  3 files, 14 tests passed

npx eslint \
  app/components/library/library-filter-options.ts \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx \
  app/lib/fx/contracts.ts app/lib/fx/provider.test.ts
  exit 0
```

The repository-wide typecheck is currently blocked outside this slice by the parallel summary work: `app/components/library/library-performance-summary.test.tsx` imports the not-yet-present `./library-performance-summary`. I do not count that as a drawer failure.

## Drawer pass boundaries

- `LibraryFilterDrawer` copies the canonical state into a local draft on mount, sends one patch only from “应用筛选”, and closes without applying from the close button, cancel button, or Escape (`library-filter-drawer.tsx:64-102`). The focused tests cover source/account OR selection, staged year changes, discard, Escape, and focus restoration.
- `useModalFocus` focuses the first drawer control, loops Tab/Shift-Tab between the first and last listed controls, handles Escape at document level, and restores the previously focused trigger during cleanup (`app/components/import/use-modal-focus.ts:12-48`). The drawer has a labelled modal role and a fixed, scrollable content area with a bottom action bar. The focused tests prove Escape/focus restore; a browser check is still needed for the actual Tab cycle and narrow viewport.
- The drawer has no fetch or market-data call. Option construction is pure `useMemo` work over `entries`; opening and changing draft controls cannot issue a network request.
- Broker labels, account disambiguation, tags, and simulation-run labels are readable for canonical data. Runs preserve the full opaque ID as the option value while displaying instrument name/code plus a stable short ID (`library-filter-options.ts:42-64,92-134`). The FX provider now rejects calendar-invalid rate dates through the strict `isIsoDate` check (`app/lib/fx/contracts.ts:46-57`); the `2026-02-31` rejection test passes.

## Integration findings

### P1 — the shared page still bypasses drawer staging

The current `TradeLibrary` mounts the new drawer, but the queue still renders its old “更多筛选” controls and advanced panel (`app/components/library/review-queue.tsx:185-212`). The stock view also keeps inline account, year, position, market-data, tag, and simulation-run controls (`app/components/library/trade-library.tsx:786-899`). Those handlers update the canonical state immediately, while drawer edits remain local until Apply. A user can therefore change an advanced condition, close the drawer, and still have a different condition applied through the legacy controls; queue and stock views also expose two different paths.

The owner integration must remove or route the duplicate controls through the drawer so every advanced field follows the same staged Apply/Close/Escape contract. This report does not claim the main page is accepted while both paths remain.

### P1 — applied advanced conditions are not removable chips in stock view

`TradeLibrary` currently renders only an advanced-condition count and the drawer trigger (`trade-library.tsx:391-447`). There is no stock-view list of applied broker/account/year/run/position/data/tag conditions with per-condition remove actions. `ReviewQueue` has a partial legacy chip row (`review-queue.tsx:198-203`) that omits year, run, position status, data status, and tag, and it is not shared with the stock view. R3 requires applied conditions to be visible above the list and removable one at a time. The UI integration must derive those labels from the canonical state and remove a single value without clearing compatible siblings.

### P1 — legacy run control exposes incompatible and opaque choices

The drawer correctly hides the run selector for a live scope (`library-filter-drawer.tsx:73-74`), but the stock fallback selector is shown whenever there are multiple runs regardless of `tradeNature` and displays raw trailing ID text (`trade-library.tsx:855-868`). The queue fallback likewise shows every run from `entries` and raw IDs (`review-queue.tsx:154-157,204-206`). In live mode this permits selecting a simulation run that yields an empty range, and it bypasses the drawer’s friendly identity. Removing the fallback controls resolves both the compatibility and label mismatch; the integrated path must show runs only for an applicable simulation/all scope and keep the full ID hidden behind a stable friendly label.

### P2 — broker aliases can produce duplicate visible platform options

`brokerOptions` deduplicates raw `execution.source.platform` strings before formatting (`library-filter-options.ts:77-89`). `formatBrokerLabel` maps `tradingview`, `TradingView`, `china-merchants`, `china_merchants`, and `cmb` to shared labels, but it does not canonicalize the option ID. If legacy or manually edited data contains both `tradingview` and `TradingView`, the drawer renders two checkboxes both labelled “TradingView”; the same problem applies to招商证券 aliases. Current importers emit lowercase canonical IDs, so this is a data-hardening boundary rather than a demonstrated 766-fixture failure. Normalize aliases before building the set and add a duplicate-label fixture if the input contract permits arbitrary platform strings.

## Test evidence gaps

The drawer test harness passes a fixed `initial` value on every mount. Its “reopen” assertion proves that a discarded draft is gone, but it does not prove that a parent stores the Apply patch and a later mount displays that applied value. Add that assertion at the integrated `TradeLibrary` boundary. The unit suite also does not send Tab/Shift-Tab through every control; the shared hook’s static path is sound, but final browser QA should verify the focus never leaves the drawer when details summaries and the narrow-screen footer are involved.

## FX date verdict

The requested calendar validation hardening is correct within scope: month lengths and leap years are checked without altering the FX snapshot contract, and the provider rejects an invalid date before accepting a complete snapshot. The focused provider suite, including timeout/body-timeout cases, remains green. This does not cover the final UI’s manual-refresh/cache behavior or any browser integration.

## Overall boundary

The drawer component, option formatting for canonical inputs, no-fetch behavior, Escape/focus cleanup, and FX calendar validation pass focused review. Main-page staging, applied-condition chips, and final narrow-screen keyboard behavior remain coordinator/UI integration gates.
