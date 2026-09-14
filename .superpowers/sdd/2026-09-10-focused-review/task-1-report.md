# Task 1 Report: 指标准入与事实一致性

## Outcome

- Closed episodes with reliable accounting now remain eligible insight facts when market data is unavailable. `netPnl`, return, R, holding, and tag facts remain available; MFE, MAE, and giveback are `null` when the episode lacks complete daily path coverage.
- Closed episodes with incomplete accounting remain excluded with `missing-comparison-metric`, preserving the existing fee/history accuracy boundary.
- `buildInsightEpisodeFacts` remains compatible with its four existing arguments and accepts an optional fifth per-instrument daily coverage map. Episode path eligibility uses the daily coverage intersecting that episode rather than the combined daily/hourly display status.
- Broad partial daily segments are accepted when all named missing dates fall outside the episode, including provider-latest tails. In-episode gaps and overlapping failed coverage segments still make path metrics unavailable.
- Pattern aggregation filters out unavailable path values independently and returns `null` when no eligible values exist. The insights UI renders unavailable path aggregates as `—`, never `0%`, and states the daily-path sample count separately from the accounting sample.
- Trade library display nature uses one canonical broker/platform classification while scope keys and episode IDs continue to use the historical reconciliation nature.
- Stock episode navigation uses `replayExecutionAt`/`replayCursorAt`, so date-only executions reveal at day end, locate to that boundary, and display the date with “未提供成交时刻”. Precise executions keep their original locate timestamp.
- Workspace wiring passes daily coverage into insight facts and uses the same canonical trading-nature label in the header.

## Regression evidence

Before implementation, the focused regressions failed in the intended seven branches:

- accounting fact was discarded when the source was unavailable;
- complete daily coverage was blocked by the combined hourly failure;
- incomplete accounting was classified as a market-data failure;
- nullable path aggregation threw or treated missing values incorrectly;
- legacy broker display nature disagreed with its label;
- date-only navigation revealed the fill at the raw synthetic timestamp.

An additional render regression failed because `null` path aggregates displayed as `0%`.

## Verification

- `npx vitest run app/lib/insights app/lib/trades/library.test.ts app/components/review/stock-episode-navigation.test.tsx app/components/insights/pattern-insights.test.tsx`
  - 6 test files passed
  - 36 tests passed
- `npm run typecheck`
  - passed with exit code 0
- `git diff --check`
  - passed with exit code 0

Vitest emits Node's existing `DEP0205 module.register()` deprecation warning; it does not affect the passing result.

## Scope and data safety

- No review types, review editors, autosave logic, server processes, or databases were changed.
- Historical trade scope calculation, episode construction, and episode IDs were not changed.
- Accounting availability still comes from the existing episode metric accuracy checks, including unknown fees and incomplete statement history.
