# Financial projection implementation report

Status: implementation-ready (third-round evidence complete; coordinator acceptance pending)

## Interface

`buildHomepageV25Performance(input: HomepageV25Input)` in `app/lib/reviews/homepage-v25-performance.ts` accepts the existing `TradeExecution[]` ledger records, explicit period boundaries, optional opening positions, and dated valuation records. Execution direction is taken from the source-backed `positionEffect`; generic sells without direction evidence fail closed with `execution-direction-unavailable`. The output contains `periodRealized`, `openingUnrealized`, `closingUnrealized`, `net`, and `currentMarketValue`, each with `value`, availability, coverage, and reasons, plus per-account/instrument results.

Opening fees are included in lot cost basis and closing fees are deducted once at the matching close. FIFO matching supports partial closes and both long/short positions. Period net is `periodRealized + closingUnrealized - openingUnrealized`; current market value selects the latest `current` valuation independently of the selected period. Missing quote or FX data returns `null` with reasons rather than zero.

The page adapter maps real `TradeLibraryEntry.episodes` directly. It groups episodes by account and instrument before replay, uses `replayPositionAtPrice` with a strict pre-period cursor for opening inventory and an end-period cursor for closing inventory, and derives dated valuations from the supplied `DailyCandleRecord[]`. Current quotes are selected only from `kind: "current"` records at or before `asOf` (or the period end when `asOf` is absent). Executions without a source trading date are assigned in `Asia/Shanghai`, so a UTC late-evening execution crosses into the correct business date. `RoomFxSnapshot` is used for source-to-target conversion. No caller-supplied fabricated seed or valuation is required when real entries/candles are provided.

## TDD evidence

- RED: [evidence-F-red.txt](../evidence-F-red.txt) recorded the expected missing-module failure before production code existed.
- GREEN: [evidence-F-green.txt](../evidence-F-green.txt) recorded 5/5 directed tests passing under the pinned Node 26 runtime.

Directed scenarios cover cross-year opening/closing float, partial close, short execution, rejection of ambiguous direction, period-independent current value, missing quote coverage without false FX-missing, the requested opening-mark 200 / sale 250 / zero-close bridge, and Shanghai business-date conversion.

## Round 2 remediation

Added `entries` adapter input. It derives executions from real `TradeLibraryEntry.episodes`, aggregates same-account/instrument episodes before replay, and derives period/current valuations from real `DailyCandleRecord` data. `RoomFxSnapshot` rates are converted from source currency through CNY into the selected target. Current-value coverage is tracked independently from earlier period quote gaps. Invalid settlement fees and opening costs remain unavailable; valuation inventory mismatches fail closed per instrument while aggregate coverage retains available instruments. Period selection uses Shanghai business dates and current/period valuations honor the cutoff.

Normal buys open verified long lots; ordinary sells close an existing long lot. A sell without existing long evidence still fails closed and cannot invent a short. Settlement gross amount and settlement fee records take precedence over display price/fee. Invalid opening positions and invalid settlement fees are reported, and valuation quantity cannot silently clear ledger inventory. Round 2 directed evidence: [evidence-F-green-round2.txt](evidence-F-green-round2.txt), 8/8 passed. Final coordinator suite (round 2 plus round 3): [evidence-F-round3-final-coordinator.txt](evidence-F-round3-final-coordinator.txt), 10/10 passed. Final implementation tests: [evidence-F-round3-final-directed.txt](evidence-F-round3-final-directed.txt), 10/10 passed. Typecheck: [evidence-F-round3-final-typecheck.txt](evidence-F-round3-final-typecheck.txt), passed.

## Scope and unverified items

Changed only `app/lib/reviews/homepage-v25-performance.ts`, its directed test, and this report/evidence. No database, service, UI, or browser checks were run; those remain coordinator integration responsibilities. Full repository tests and whole-page acceptance remain unverified.
