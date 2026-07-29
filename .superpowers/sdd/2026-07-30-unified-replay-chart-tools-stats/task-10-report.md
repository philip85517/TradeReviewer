# Task 10 report: unified demo/imported replay workspace

## Implementation

Replaced the static imported-trade detail path with one controlled replay
experience shared by demo and imported instruments.

- `ReviewChartWorkspace` is a UI-only shell driven by
  `ReviewChartViewModel`. It composes the chart, replay and drawing controls,
  layer list, episode selector, cursor-bounded execution details, path
  statistics, and autosaved notes without reading storage or fetching data.
- `TradeReviewWorkspace` now owns imported episode selection, IndexedDB cache
  hydration, daily and intraday sync state, local replay/autoplay, exact
  knowledge cursor preservation across periods, cursor-safe aggregation,
  episode-scoped drawings/UI state, and review records.
- Daily candles receive an end-of-day knowledge timestamp; intraday and daily
  sources are truncated at the cursor before aggregation. Future candles,
  executions, P&L/path metrics, and later-created drawings therefore remain
  unavailable until their knowledge boundary is reached.
- Imported refreshes read existing cache first, run daily and `15m` syncs
  under one per-instrument abort sequence, preserve cached candles on either
  failure, and expose independent interval messages.
- The legacy imported detail and thesis panel were deleted after their
  observable information moved into the shared shell, data popover, episode
  selector, execution details, and review side panel.

## Files

Primary Task 10 workspace changes:

- `app/components/review/review-chart-workspace.tsx`
- `app/components/review/review-chart-workspace.test.tsx`
- `app/components/review/episode-sidebar.tsx`
- `app/components/trade-review-workspace.tsx`
- `app/components/trade-review-workspace.test.tsx`
- `app/globals.css`
- deleted `app/components/review/imported-episode-review.tsx`
- deleted `app/components/review/imported-episode-review.test.tsx`
- deleted `app/components/review/thesis-panel.tsx`

Required adjacent controlled-contract cleanup:

- `app/components/chart/chart-toolbar.tsx`
- `app/components/chart/chart-toolbar.test.tsx`
- `app/components/chart/drawing-canvas.tsx`
- `app/components/chart/drawing-canvas.test.tsx`
- `app/components/chart/drawing-layers-panel.tsx`
- `app/components/chart/drawing-layers-panel.test.tsx`
- `app/components/chart/replay-chart.tsx`
- `app/components/library/trade-library.tsx`
- `app/lib/chart/drawing-commands.ts`
- `app/lib/chart/drawing-commands.test.ts`
- `app/lib/chart/drawings.ts`
- `app/lib/chart/drawings.test.ts`
- `app/lib/storage/review-storage.ts`
- `app/lib/storage/review-storage.test.ts`

The adjacent changes remove Task 6–9 compatibility defaults now that every
caller supplies controlled chart/drawing inputs. Legacy drawing and thesis
data remain readable only at the storage migration boundary; all new writes
are canonical v2 state without a thesis field.

## RED evidence

1. Added the imported-workspace integration scenario and ran:

   ```sh
   npm run test:unit -- app/components/trade-review-workspace.test.tsx
   ```

   Result: 1 failed / 7 tests. The cached imported instrument still rendered
   the static component, so the required `15m` period control was disabled.

2. Added the shared-shell component test before creating its module:

   ```sh
   npm run test:unit -- app/components/review/review-chart-workspace.test.tsx
   ```

   Result: failed to resolve `review-chart-workspace`, establishing the
   extraction boundary before implementation.

3. Added an observable chart-settings assertion before wiring settings into
   `ReplayChart`.

   Result: the chart stage lacked the expected `data-show-volume` state until
   the settings contract was implemented.

## GREEN and verification evidence

```sh
# exact Task 10 target
npm run test:unit -- app/components/review/review-chart-workspace.test.tsx app/components/trade-review-workspace.test.tsx
# 2 files passed, 11 tests passed

npm run test:unit
# 54 files passed, 253 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0, no findings

git diff --check
# exit 0
```

The integration coverage verifies imported/demo parity, future candle and
execution isolation, cursor-dependent MFE/net P&L, absolute cursor
preservation across periods, provider-limited intraday controls, cache
preservation after independent daily/intraday failures, toolbar behavior, and
episode-isolated cursor/drawings/tab/notes restoration.

## Commit

Implementation commit: `886ba6e048ca835dc2c646de83abfddb28938a6b`
(`feat: unify imported and demo replay`).

## Concerns / follow-up

No Task 10 requirement was deferred. Provider limitations remain represented
through the existing timeframe-availability and market-data status contracts;
the notes surface intentionally stays editable when no usable candles exist.
