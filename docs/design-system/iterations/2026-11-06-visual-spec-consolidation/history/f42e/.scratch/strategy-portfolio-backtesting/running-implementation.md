# Running integration implementation handoff

Date: 2026-09-29. Owner: `running_integration`, inherited coordinator model; explicit exception following two rejected Luna implementation attempts. Scope: W01–W06 first in-memory running slice. This report is implementation evidence, **not feature acceptance**. Prior failed drafts remain documented in `running-visual-contract.md`.

## Changes

- Replaced `running-prototype.tsx` with readable calendar, independent portfolio ledger, chart lifecycle, and user controls.
- Shanghai wall-time calendar: 20 context bars including the last complete weekday, cutoffIndex 19. Intraday/weekend cutoff rolls back; executions strictly follow the selected T0 calendar date. Calendar horizons clamp month ends and filter weekends, giving five days for a week and about 260 for a year. Nominal and actual synthetic endpoints are separate.
- T0 is cash only. First opening allocates A/B/cash 45/45/10 (EMA) or 40/40/20 (quality). Every fifth/twentieth day uses a fixed pre-known synthetic target template, revaluing existing holdings at the opening before rebalancing; does not reset principal. Hold presets never rebalance, empty scenario never creates trades. Each event explains old/target/actual weights and individual A/B buy/sell deltas; fractional shares and zero fees are explicitly disclosed.
- Real lightweight-charts 5.2 candlesticks for A or B and net-value line starting at 1. Only the viewing projection enters series data and axis determination. Advancing scrolls the revealed last bar into the current range. ResizeObserver reads width and CSS height (360/280), disconnects before removal, and ignores queued callbacks after dispose.
- Atomic max/view cursor pair. Backward viewing stops playback, clips chart/holdings/events, and preserves known progress. A separate restore action is required before advancing. Dropdown contains only known dates plus T0. Event cards navigate to their dates. Active endpoint reveal records Shanghai timestamp/source and remains visible on historical review/reopen.
- `creation-prototype.tsx`: primary start/continue entry; secondary edit entry; return-to-ready callback. Running component stays mounted while hidden and pauses, preserving cursors/selection and remounting the chart when reopened. Every configuration mutation, new experiment, and reset invalidates the run. Navigation alone retains it. Experiment list reflects paused/playing/endpoint status.
- Config summary carries capital, date, horizon, selected strategies/presets, collection, blind intent, and partial/missing scenario disclosures.

## Verification performed

- `npm run typecheck`: PASS after integration and status wiring.
- Temporary in-process pure-function assertions (no new test files): PASS for 25 date/horizon combinations × both strategy ledgers. Included weekday close, intraday, weekend, month-end dates; all five horizons; 20-context cutoff; unique strictly future dates; five-day week/260–262-day year; leap-month clamp; T0 cash; first allocation; cash+holdings=equity; net value; event visibility; EMA fifth-day buy+sell; hold and empty-cash behavior.
- No business database, API, persistence, build, or browser writes used. New files and existing unrelated work preserved.

## Still NOT VERIFIED by implementer

- Actual browser W01–W06 journey, rendered last-bar visibility at long horizons, navigation/reopen, console, and responsive visual comparison: coordinator owns these independent gates.
- Production build: coordinator requested exclusive ownership.
- Physical touch: outside this observer prototype slice.
- Real exchange holidays, real strategy engine, real fees/lot sizes, persistence/save failure/results comparison: excluded from this slice; do not close the broader ticket.

CSS remains owned by `creation_visual`. Requested scoped additions: running-history, running-config, running-warning, running-header-actions, running-event-trades and chart-switch select, retaining existing approved chart dimensions.
