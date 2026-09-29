# 06 implementation report — Runtime recovery and expansion wiring

- Ticket: [06 — 快速展开与异常恢复](../issues/06-bulk-reveal-and-recovery.md)
- Assignment: gpt-6-luna / max, runtime integration owner.
- Status: runtime integration is ready for coordinator browser review; ticket 06 is not accepted or closed by this report.
- Runtime file written: [running-prototype.tsx](../../../app/components/strategy-prototype/running-prototype.tsx). The controlled [RecoveryPrototype](../../../app/components/strategy-prototype/recovery-prototype.tsx), model interface in [running-model.ts](../../../app/components/strategy-prototype/running-model.ts), and result consumer in [results-prototype.tsx](../../../app/components/strategy-prototype/results-prototype.tsx) were supplied by their respective owners. No API, database, page, creation component, or shared style was changed in this slice.
- Reviewed sources: [INTEGRATION-06.md](../INTEGRATION-06.md), [06 issue](../issues/06-bulk-reveal-and-recovery.md), DESIGN-COVERAGE C21–C24/C28/C30, approved spec DD06–DD08/DD11/DD12, current project workflow, and direct 03/04 desktop reference screenshots.

## Implemented

- Daily advance, timed playback, and bulk expansion call the same atomic runtime commit. Bulk confirmation does not advance state; each 250 ms expansion tick commits one complete synthetic day, can be stopped between commits, and reaches the existing result view when the selected portfolio has a non-empty interval.
- The runtime tracks global V/M and an individual Mi per portfolio. An injected failure stops the entire date before any participating ledger commits, records the target portfolio/date and last complete date, and blocks progression until retry or explicit exclusion. Retry starts at the last complete M even after V was moved back for review. Excluded portfolios retain their own frozen Mi; the rest can continue. Selecting a frozen portfolio past Mi removes current valuations and clips chart candles, axes, markers, events, and result max to Mi, with an explicit return-to-last-complete action.
- Partial/unfilled outcome arms are bound to the portfolio and its next deterministic execution cursor; switching tabs does not transfer them. The shared ledger receives only the one-shot override on that exact cursor. Event detail distinguishes planned and actual trades and exposes a clickable planned symbol to open its K-line, including when actual trades are empty.
- Checkpoint state contains global and per-portfolio cursors, exclusions, execution overrides, armed fault/outcome, incident, selection, chart mode/symbol/holding, demo portfolios, viewport, and exposure. Reload restores the saved complete state while merging seen-future exposure monotonically; simulated save failure leaves the previous checkpoint intact.
- Results are bounded by the selected portfolio's Mi. The optional `resultBoundary` labels an excluded frozen ledger as partial, while process return retains global M and the previous process context. Hidden runtime and result presentation both stop playback/expansion; global keyboard shortcuts are suppressed during results, recovery dialogs, and unresolved incidents.
- New exposure source `bulk` is reported as “快速展开”. Advancing after checkpoint reload cannot lower the farthest-exposure date or replace its same-day source/time.

## Verification

- `npm run typecheck` — **PASS**, exit code 0.
- `npx eslint app/components/strategy-prototype/running-prototype.tsx` — **PASS**, exit code 0.
- Browser interaction, chart viewport, keyboard, responsive visual comparison at 1440×900 and 1280×800, and the complete failure/retry/exclusion/checkpoint/results path — **NOT VERIFIED by this runtime owner**; root and Astra own these checks. The root has a clean tab for direct acceptance and was notified that runtime/CSS writes are frozen.
- Database persistence — **NOT APPLICABLE**; all added runtime state is synthetic and in memory. No browser reload persistence is claimed.

## Integration boundary

`RunningPrototype` owns M/V/Mi, completion and exposure progress, selected-portfolio result identity, override/fault/checkpoint state, and the commit clock. `RecoveryPrototype` receives controlled state plus callbacks; it owns no ledger or timer. `ResultsPrototype` receives the selected ledger, selected Mi as `maxCursor`, and a `resultBoundary`; its existing result cursor/filter/scroll behavior remains within that ledger.

This report records a worker implementation pass only. It does not replace coordinator browser evidence, independent visual review, or formal ticket acceptance.
