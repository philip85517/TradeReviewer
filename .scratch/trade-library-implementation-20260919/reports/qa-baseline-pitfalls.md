# Trade library refresh — baseline pitfalls and proposed rulings

Date: 2026-09-19\
Reviewer: Luna QA\
Baseline: `4df397a`\
Scope: independent preflight for tickets 01–09. These are review gates for the planned implementation, not claims that the baseline should already pass the new product requirements.

## Highest-risk seams

### P0 — A matching child must define the stock row's totals

The current stock path filters `TradeLibraryEntry` objects in `app/components/library/trade-library.tsx:240-290`. Account and year predicates ask whether *any* entry execution matches. The resulting row then renders entry-wide `accountCount`, `tradeCount`, `episodeCount`, `netPnl`, `returnPercent`, and date fields at `:804-895`. By comparison, `buildReviewQueue` expands entries and filters the actual episode at `app/lib/reviews/review-queue.ts:205-227`.

This creates the most dangerous false pass: a stock remains visible for one matching account/year, but its counts and PnL include sibling accounts/years. The implementation needs one canonical effective episode set. Apply all global filters to episodes first, then group that set by `instrument.id` for stock rows. Derive stock counts, latest activity, review progress, closed PnL, weighted return, and child rows from that same set. Do not use a filtered-entry boolean as a substitute.

The acceptance fixture must include one stock with a matching 2026/account-A episode and a nonmatching 2025/account-B episode with a large opposite PnL. Assert that the row's count, latest date, PnL and queue IDs exclude the sibling.

### P0 — Stock grouping and scope identity are separate concerns

`buildTradeLibraryEntries` currently creates one entry per `tradeScopeKey` in `app/lib/trades/library.ts:67-203`, so the same instrument can arrive as separate live/run entries. R4 requires one browsing stock row while preserving child-level nature, account and simulation-run identity. A regrouping that concatenates entries without retaining a child scope key can silently add live and simulation results together.

Use `instrument.id` for the outer browsing identity. Keep each episode's nature and run identity on the child, and group simulation children by run for display. A symbol or display name cannot be the key: a same-name/same-symbol instrument in another market must remain separate. Account labels are display-only; account IDs remain the filter and child identity.

The F2 fixture must assert all of these at once: one live account plus two simulation runs for one instrument yields one stock row with three distinct scope groups; a same-symbol other-market instrument yields another stock row; selecting one run leaves the other two out of counts and totals.

### P0 — Canonical state is currently incomplete

`TradeLibraryBrowseState` in `app/components/library/trade-library.tsx:51-64` omits trade nature, simulation run, source selection, stock expansion and any local include-reviewed override. The component keeps nature/run in independent state at `:190-191`, and emits the old fields from `:173-175`. The parent does preserve the object while switching views (`app/components/trade-review-workspace.tsx:964`, `:4120-4125`), but it cannot restore fields it never receives.

The implementation must define one serializable state shape covering view, nature, status, market, search, source, account, year, run, sort, expanded stock IDs, selected child, and scroll. Draft drawer state must not enter this canonical state until Apply. Reset should write the exact canonical default for the preserved nature/view and clear the rest. Re-entry tests should unmount/remount `TradeLibrary` using the captured state to catch state that only survives one mounted instance.

### P0 — Local “include reviewed” must not mutate global scope

The current queue has only one global `status` predicate (`buildReviewQueue`), so it cannot represent the R4 operation that expands one stock's children while leaving global pending rows, summary, sorting, and Start Review candidates unchanged.

Treat this as a local view parameter: `globalEffectiveEpisodes` remains unchanged, and `stockChildren(stockId, includeReviewed=true)` relaxes only the review-status predicate for that stock. Year, account, source, nature, run, market, query and any other global condition remain applied. Deferred children are included. The global summary and stock rows outside the selected stock must be computed from the original set.

An explicit assertion is needed after expansion: global sample count, summary net PnL, order of other stocks, and Start Review target are byte-for-byte unchanged; only the selected stock's child list gains completed/deferred rows.

### P0 — Metrics must share one trusted sample

`buildTradeLibraryEntries` currently calculates `netPnl` by requiring every episode in an entry to have a non-null PnL (`app/lib/trades/library.ts:131-140`), but sums all `grossExposure` values (`:141-148`). This can include open/untrusted exposure even when the displayed PnL is unavailable. `review-queue-summary.ts:105-135` similarly aggregates trusted net PnL but has no opening-exposure-weighted return.

The planned metric layer needs an explicit per-episode eligibility record. For each stock/run/group, select only closed, trusted, finite-net-PnL, positive-finite-opening-exposure episodes with all necessary cost and currency evidence. The same selected IDs must feed both numerator and denominator. Report exclusion counts/reasons. Fees reduce net PnL; opening exposure excludes fees and closing proceeds. A short uses the opening sell not margin; IPO acquisition cash cost enters exposure once, while execution-backed allocation evidence must not be counted twice.

Do not infer eligibility from `netPnl !== null` alone. `summarizeTradeEpisode` already marks unknown fee, incomplete history, settlement-currency mismatch and missing IPO evidence unavailable (`app/lib/trades/episode-metrics.ts:21-39`); the aggregate layer must preserve that fail-closed behavior.

### P0 — FX snapshot writes must be complete and atomic

There is no baseline FX module. Ticket 04 therefore carries a larger state risk than a UI-only change. A refresh response must be validated as one snapshot, including supported rate coverage, direction (`1 unit foreign currency = CNY`), source, and as-of metadata. If any required value is invalid, partial, non-positive, non-finite, or times out, persist nothing from that response and keep the previous complete snapshot.

All rows in a render, including sorting and weighted return, must receive the same immutable snapshot. Reading CNY from a newly written per-currency record while USD still comes from an old record would create a result that is impossible to reproduce. Store/read one versioned snapshot or use an equivalent transaction. Never write rate data into trade facts.

The test sequence must be: no cache + failed refresh; successful snapshot A; failed/partial refresh; successful snapshot B; service reload reading B. Assert old A survives the failure, no foreign row becomes zero, and a failed no-cache render keeps original currency only. Browser verification must prove no request occurs on mount, navigation, drawer changes or filter changes.

### P0 — Performance sorting must not compare the wrong value

The baseline queue sorts net PnL by original currency first and episode return by raw `returnPercent` (`app/lib/reviews/review-queue.ts:148-198`). The target requires latest-activity time, CNY-converted net PnL, and CNY weighted return with unavailable values last. It also requires simulation performance sorting to be blocked until one run is selected.

For time, compute the latest execution in the matched child set, not `startedAt` or an entry-wide `lastTradeAt`. For a stock row, use the maximum latest activity among its matched children. A year filter includes the complete episode when any trade falls in that year, so its latest activity may be outside the selected year; the label should make that rule understandable.

For PnL/return, the comparator should receive precomputed snapshot-aware metrics and a restriction state. It must stable-tie by a deterministic identity, place open/unavailable/missing-rate rows last, and never turn missing into zero. Clearing a run while a performance sort is active must set both the comparator and visible control to latest activity; selecting that run again must not restore the old preference.

### P1 — Scope-level summary needs an explicit top-level rule

The specification permits live cross-currency comparison after CNY conversion but keeps nature and simulation runs isolated. When the current filter is “all nature” or “all runs”, a single top-level amount cannot truthfully represent every row if both live and simulation groups are present. The current summary already returns `null` for multi-group `netPnl` (`app/lib/reviews/review-queue-summary.ts:155-185`), which is safer than adding numbers but needs clear UI wording.

Proposed ruling: performance groups are always displayed separately by nature/run, with a group selector or per-group cards. A top-level aggregate amount/weighted return is available only when all selected rows share a comparable nature/run scope (live may combine currencies through one CNY snapshot; simulation requires exactly one run). Multi-group headers show “按组查看”/unavailable rather than a sum. This avoids implying that selecting “all” created a cross-run result.

### P1 — Review progress and status-filtered metrics have different purposes

The spec asks for stock progress such as `x/y` while also allowing a global pending/completed/all status filter. A literal status-filtered denominator makes a pending-only stock appear `0/3` or `3/3` depending on the label, which is misleading progress.

Proposed ruling: the child list obeys the global review-status filter; stock progress uses all episodes matching the other active filters and labels the denominator as the stock's matching episode count. Current summary/sample/financial metrics obey the global status filter. “Include reviewed” only changes the selected stock's child list. If product wording chooses a different denominator, encode it in the label and acceptance test rather than leaving it implicit.

### P1 — Source labels and run labels need one formatter

`reviewQueueBrokerOptions` currently falls back to raw platform values and the current simulation dropdown exposes raw IDs/slices (`app/components/library/review-queue.tsx:145-153`, `:200-208`; `trade-library.tsx:222-235`, `:736-749`). This can make TradingView runs look like four brokers or make two run IDs collide after shortening.

Use a single formatter with platform label, instrument name/code, and a stable short run suffix; disambiguate collisions without hiding the underlying stable ID from an accessible detail/title. The same formatter must feed source filter, run filter, stock child group, summary label and accessible names. Do not use a display label as a filter key.

### P1 — Refresh and navigation can race without a snapshot boundary

The parent recomputes entries from `episodeReviews`, market data and statuses (`app/components/trade-review-workspace.tsx:1355-1369`). An FX refresh or review save can trigger a new render while a list action is in flight. Keep the selected episode and queue IDs keyed by stable episode ID; recompute presentation from the new immutable data without allowing old metadata or a stale FX object to overwrite newer values.

The browser check should save a review, refresh the rates, return from the child, and verify the episode ID, review record and trade facts remain the same while only the derived display values change.

## Proposed rulings for ambiguities

These rulings make the already-confirmed requirements executable without expanding scope:

1. **One pipeline:** `effectiveEpisodes = filter(entries, all global filters)`; stock grouping, child rows, queue IDs, counts, metrics and sort all derive from that result. Local include-reviewed is a child-render override only.
2. **Stock grouping:** group by `instrument.id`; merge live accounts for browsing; group simulation children by `simulationRunId`; retain all episode/account/run identities underneath.
3. **Performance scope:** live can compare currencies after one CNY snapshot; simulation requires one selected run; a mixed nature/run result is shown as separate groups and cannot be silently combined.
4. **Status/progress:** global status filters rows and metrics; progress denominator uses all non-status-matching episodes and is labelled as such; local include-reviewed relaxes status only for one stock.
5. **Year semantics:** if any execution of an episode falls in the selected market-local year, include the complete episode and use its actual latest execution for time sorting. Do not clip financial facts to the calendar year.
6. **Missing values:** unknown, open, non-positive exposure and missing FX remain unavailable and sort last. They never become numeric zero.
7. **FX source:** implementation must record the chosen public source, terms/coverage and as-of interpretation in the ticket/report; tests must mock the boundary and must not depend on live network availability.
8. **Snapshot identity:** one successful versioned snapshot supplies all conversions in a render; failed/partial refresh leaves the previous complete version untouched.

## Baseline data and verification guardrails

The prepared isolated DB is `.data/library-ux/acceptance.sqlite` with 1,857 executions, 236 instruments, 130 reviews, 208 import batches and 6 trade revisions. The stored fingerprints are in `reports/source-fingerprint.json`. Browser writes must use this copy, and final QA must compare the same tables/fingerprints afterward. The current baseline service at `127.0.0.1:3031` was not used for this preflight; no browser claim is made here.

The coordinator should keep the baseline typecheck and selected unit-test results as the starting evidence, then run the centralized full checks after all implementation slices land. This report intentionally does not run the full suite or alter production files.
