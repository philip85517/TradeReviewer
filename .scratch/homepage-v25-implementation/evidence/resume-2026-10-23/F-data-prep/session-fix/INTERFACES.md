# F exchange-session quote contract

Status: implementation-ready, frozen for coordinator recovery acceptance 3/3. Recovery 1/3 and 2/3 refer to their preserved earlier versions. This report does not accept F or P1. UI NOT VERIFIED.

## API and independent financial state

The production entry remains `buildHomepageV25PerformanceFromEntries(input)` in `app/lib/reviews/homepage-v25-performance.ts`. No field was removed or added in this session repair. Its `asOf` remains required; an ISO instant is recommended for the actual current view. A date-only `asOf` means the end of that Shanghai natural day (`15:59:59.999Z`), not the end of every exchange's trading session.

The established output remains global and per account/instrument/nature/run: `currentMarketValue`, `currentUnrealized`, `currentOpenFees`, and `evidence.current`. Current net UF is canonical gross UF minus the F fee pool retained by open exposure. The current fee pool is not cumulative fees. The current projection is independent of a selected historical period. Opening/closing/current retain their separate knowledge cursors and quote evidence.

This repair changes quote selection only. Canonical cost, realized PnL, visible original fills, IPO fee allocation and unknown quantity/fee/cost gates retain the accepted F2 implementation. No ledger or second cost/fee engine was introduced. A quote failure must not erase independently trusted `evidence.current.quantity`, `costKnown`, `feesKnown`, or `openFees`; `currentOpenFees` does not depend on a quote. Unknown quantity still blocks market value. Unknown cost or fees still permit market value when quantity and a valid quote are known. True flat exposure remains zero without needing a quote.

## Real-entry daily raw quote selection

For each opening, closing and current boundary independently:

1. The supported market must be `US`, `HK`, `CN-SH` or `CN-SZ`.
2. Resolve the latest completed exchange session through the existing `requiredMarketDataRange(boundary.cursor, boundary.cursor, { market, open: true, now: new Date(boundary.cursor) }).endDate` in `app/lib/market/sync-range.ts`.
3. Keep raw candles for the exact instrument, with a valid `YYYY-MM-DD` and `tradingDate <= completedSession`; consider them newest first.
4. Require the candidate itself to be an actual trading date through `expectedTradingDates(market, date, date)` in `app/lib/market/calendar.ts`. A weekend/holiday row below the completion cutoff is still invalid and is skipped.
5. Use the latest remaining raw row, preserving its date, close, currency and provider in quote evidence. Existing price/currency validation remains in `amount()`.

The existing shared session rules supply US DST and half-day closes, HK regular/half-day completion, CN close time, weekends and holidays. Shanghai natural days still bound the reporting period and execution knowledge; they are not used as a substitute for an exchange's completed close. In particular US October 22 remains in progress at `2026-10-22T17:30Z`, even though Shanghai is already October 23. CN/HK October 22 are complete at `2026-10-22T08:30Z` and can use their same-label daily close.

## Unknown quote classifications

| Condition | Quote evidence | Non-flat MV/net UF reason |
|---|---|---|
| Unsupported market | `null` | `quote-market-unsupported` |
| Shared calendar cannot confirm completion, or only candidate dates outside calendar coverage remain | `null` | `quote-session-unavailable` |
| No eligible raw trading-date row (including weekend-only input) | `null` | `quote-missing` |
| Valid selected row with malformed/negative price or wrong currency | Selected source evidence retained | Existing quote validation reasons |

The selection reason also appears in the corresponding opening/closing/current snapshot evidence. Only `CalendarOutOfRangeError` is classified as unavailable; unexpected errors are not silently converted to missing quotes. A stale but otherwise valid earlier session can still be selected as fallback; the quote date is preserved so the consumer can present freshness.

## Compatibility boundary input

The pure compatibility API `buildHomepageV25Performance()` remains explicitly caller-scoped. Supplied `valuations` are explicit boundary marks with source `caller-boundary`, not raw market daily candles. A period-start valuation on the first day remains a caller-supplied opening mark. This path's contract is unchanged; real raw-candle consumers must use the real-entry API. Missing/invalid `asOf` remains classified and cannot be inferred from `period.end`.

## Consumer and historical limits

P1 should continue consuming the current metrics/evidence directly and must not reimplement fees or cost. Its frozen product test currently supplies US October 23 raw at Shanghai October 23 end, before the US October 23 close. The two affected failures are retained; only a copied test uses October 22 raw to establish F/model closure. P1 changes remain coordinator-gated.

This repair confirms exchange session completion for supplied raw rows; it does not reconstruct original provider publication/revision history from an overwritten daily record, infer per-security suspensions from the exchange calendar, or supply missing historical FX. It does not use a latest/current FX snapshot as historical evidence. The read-only prior `HISTORICAL-SOURCES.md` is pinned to pre-repair F2 and remains unchanged as audit history. No daily prepared timeline or P2–P4 data API was implemented.
