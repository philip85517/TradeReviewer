# Phase 1 implementation report

Status: implementation-ready; coordinator browser acceptance pending.

## Scope delivered

- UR01: replaced the inline SVG toy renderer with Lightweight Charts 5.2.0 standalone production build in `vendor/`. The chart uses a 12px initial bar spacing, real time scale interaction, and separate candlestick/net-value series.
- UR02: added deterministic independent OHLC for `贵州茅台 600519 · 日线 · CNY · 合成行情`. Every bar satisfies `low ≤ min(open, close) ≤ max(open, close) ≤ high`.
- Replay data now has 80 weekday bars before T0 and 170 simulation weekdays beginning at T0, including more than 90 weekdays beyond T0. The first event indices retain their existing semantics and the complete scenario points to the actual generated end date.
- Rendering filters chart data to the current effective visible cutoff. Step and playback follow the newly revealed bar; ordinary renders and resize preserve the Lightweight Charts logical range. The accessible chart summary reports only visible OHLC and the visible cutoff.
- Chart-layer correction: net value now starts at T0 and uses an independent right axis with four decimal places; inactive OHLC data is removed from the net view so it cannot affect net scaling. Comparison uses two distinct synthetic portfolio net series with an explicit momentum/defensive legend. Loading and unavailable states clear all series and show a neutral in-chart message. Visible event markers are attached to the actual candle series and reveal only at their effective cutoff. Candle mode shows a visible date/OHLC/CNY readout plus the accessible summary. Explicit date/event/scenario navigation requests chart relocation while ordinary renders retain the captured logical range; changing scenarios also resets the selected portfolio transform.
- Final display correction: candle and net series bind to the visible right scale dynamically (candle precision 2, net precision 4), the legend/readout/neutral state are intentional overlays above the chart canvas with dark backing, and net mode marks the current T0/latest point visibly.
- Existing portfolio net-value, event, comparison, and scenario paths remain present for the later repair slices.

## Files

- `index.html`
- `vendor/lightweight-charts-5.2.0.standalone.production.js`
- `vendor/lightweight-charts-5.2.0.LICENSE`

## Validation

`node` inline script compilation passed:

```text
inline script syntax ok
```

The vendor file is the installed `lightweight-charts` package version 5.2.0 standalone production build. Browser journey, screenshot comparison, and resize/zoom evidence remain coordinator-owned and pending.

## Limitations / phase boundary

- This phase does not implement UR03–08 control wording, navigation cleanup, persistence, production data, or database wiring.
- Net-value and comparison series continue to use the prototype's synthetic portfolio model. Only the security OHLC path is independent from portfolio net value.
- The prototype intentionally resets its in-memory model on refresh, as specified for this design artifact.

## Phase 2 slice report (UR03–08)

- Fixed the visible A workbench shell: semantic rail labels (`工作台` / `策略库` / `实验`), hidden design-only scenario and variant controls, and removed global arrow-key variant switching.
- Renamed mode and detail controls to business language (`回放观察` / `阶段结果` / `组合对比`, `组合详情：概览` / `调仓记录` / `统计指标`), exposed readable replay actions, and disabled replay plus speed controls during results, comparison, loading, failure, review, and end states.
- Chart controls now use visible `组合净值` / `标的 K 线` / `视野说明` labels. Net and K-line modes use isolated inactive scales and bind only the active series to the right axis; per-mode logical ranges are retained. The candle readout uses `开/高/低/收`, and the non-rendered amber range legend was removed.
- Result/compare event navigation is bounded by the effective result/common cutoff. Failure availability no longer depends on compare exclusion. Event source snapshots now retain chart mode, logical viewport, inspection tab, scroll position, and source date; returning restores that context.
- About text now describes synthetic weekday data and in-memory reset without exposing internal V/M/R jargon. Compare defensive series uses the same synthetic transform as its named defensive portfolio.

Validation: `node --check` passed for the inline script; source checks found no legacy SVG renderer, global ArrowLeft/ArrowRight variant handler, amber fake range legend, or exclusion-dependent unavailable predicate. Coordinator browser review remains required for the net↔K-line axis and viewport transitions.

Follow-up UI correction: the replay bar now has two explicit text groups (`查看日期` and `推进`) with labeled date, speed, previous/latest, play, and next-day controls sized for the 1280px layout. Review mode keeps date navigation and return-latest available while advance controls remain blocked. The reachable `原型工具` panel owns scenario selection and identifies the fixed A layout, real Lightweight Charts component, synthetic weekday data, and reset behavior. T0 now states that no trade has occurred on the current date, and an empty next-event state is static text rather than a dead button.
