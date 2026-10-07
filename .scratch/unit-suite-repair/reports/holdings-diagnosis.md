# R08 holdings date fallback diagnosis

Date: 2026-10-06
Owner: holdings (read-only diagnosis)

## Reproduction

The exact prior failure reproduces with:

```text
npm run test:unit -- app/lib/reviews/trading-room-holdings.test.ts -t "falls through invalid source dates before applying the market calendar fallback"
```

Captured output: `holdings-red-20261006.log`.

Result: 1 failed, 29 skipped. The assertion expected `quoteStatus: "available"` and `unrealizedPnlStatus: "available"`; the implementation returned both statuses as `"stale"`.

## Root cause evidence

This is a time-sensitive fixture failure, not evidence of a holdings date-fallback regression.

The test supplies `quoteDate: "2026-09-02"`, `staleAfterDays: 30`, and omits `asOf`. `buildTradingRoomHoldings` therefore uses the live clock (`new Date().toISOString()`). The current clock is 2026-10-06 (UTC and Shanghai local date), making the quote 34 calendar days old. `quoteFreshness` consequently returns `"stale"` before the final status calculation.

The source-date path itself is ordered and validated as intended in `latestSourceTradingDate`: `dateOnly(tradingDate)`, then `dateOnly(marketCalendarDate)`, then `marketTradingDate(executedAt, market)`. The fixture sets `tradingDate` to `"not-a-date"` and `marketCalendarDate` to `"2026-09-01"`; the invalid first value is rejected and the valid market-calendar date is selected. A quote dated 2026-09-02 is after that execution date, so this path does not explain the observed `stale` result. The observed result is the freshness branch.

The test was introduced on 2026-09-19 and its neighboring tests generally pin `asOf` to a 2026-09 date. At the authored time, 2026-09-02 was within the 30-day freshness window. As the current date moved past 2026-10-02, the omitted clock input made the expectation invalid.

## Ranked falsifiable hypotheses and probes

1. **Fixture has an unpinned as-of date (highest confidence).** If this is the cause, pinning `asOf` to `2026-09-19T00:00:00.000Z` while keeping all other inputs unchanged should make the test return `available`. Evidence: current date is 2026-10-06; the returned status is exactly `stale`, the expected status produced by the freshness calculation.
2. **`dateOnly` rejects a valid market-calendar date.** If this were the cause, the row's `latestTradeDate` would fall back to the execution-derived date rather than `2026-09-01`, and a quote dated `2026-09-02` could become pre-trade/unavailable. The implementation's `dateOnly("2026-09-01")` accepts ISO dates, and the observed result is `stale` rather than `unavailable`, which falsifies this as the immediate cause.
3. **Market timezone conversion changes the execution date.** If this were the cause, the US execution at `2026-09-10T01:00:00.000Z` would produce a date after the quote date and the status would be `unavailable` (`pre-trade-quote`), not `stale`. The valid `marketCalendarDate` is selected before this fallback, so this is not reached for the fixture.
4. **Quote normalization/currency/price validation rejects the quote.** If this were the cause, the status would be `unavailable` or `missing`, not `stale`; the fixture quote has positive price and matching USD currency. Falsified by the branch result.

## Recommended minimum repair

Treat this as a test-fixture repair. Add an explicit `asOf: "2026-09-19T00:00:00.000Z"` (or another fixed date within the intended 30-day window) to the options in the one failing test. The minimal authorized file scope is:

```text
app/lib/reviews/trading-room-holdings.test.ts
```

No product implementation change is indicated. Do not increase `staleAfterDays`, remove the freshness assertion, or alter source-date ordering; those would weaken the domain contract. After coordinator authorization, rerun the exact test and the complete holdings test file, then let the coordinator perform the full suite.

## Scope and safety

No product/test files were modified during diagnosis. The only new artifact is this report plus the captured red log. No service, database, browser, remote, commit, or deployment action was used.
