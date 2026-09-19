# Trade library refresh — independent QA coverage matrix

Date: 2026-09-19\
Reviewer: Luna QA\
Baseline: `4df397a`\
Scope: specification and implementation-preflight only; no browser run and no production edits in this report.

## How to use this matrix

Each row is an observable acceptance gate. The expected result is the ruling to use during implementation review. A passing unit test is evidence for the named slice only; it does not replace the browser checks in ticket 09. The matrix deliberately distinguishes the episode set used for a result from the stock row used to display it.

Suggested fixture set:

- **F1 — filtered child set:** one instrument with two accounts and three episodes (pending, completed, deferred), plus a fourth episode in another year and a fifth episode in another account. The matching account/year case must expose only the intended episodes.
- **F2 — run identity:** one instrument with two TradingView simulation runs and one live account; each run has at least two episodes and a distinct result. Add a same-symbol instrument in another market to prove identity is `instrument.id`, not name or symbol.
- **F3 — financial edge cases:** closed episodes at `+1000 / 10000` and `-900 / 90000`, one open episode, one unknown-fee/cost episode, one short episode, and one IPO allocation with both execution-backed and non-execution-backed evidence.
- **F4 — currency snapshot:** CNY and USD rows with USD/CNY `7.00`, then `7.10`; include a missing-rate row. Use the same snapshot object for row amounts, weighted returns, and sorting.
- **F5 — latest activity:** an older episode with a later add-on or close and a second episode whose only trade is earlier. The older-started episode must sort first by latest activity.

## Coverage by requirement

| Requirement / ticket | Acceptance scenario | Expected observable result | Current evidence / gap | Priority |
| --- | --- | --- | --- | --- |
| R1 / 01 | Fresh entry | Defaults are live + stock view + all rounds + latest activity first. Unknown nature remains reachable through an explicit option. | Current `TradeLibrary` defaults `defaultMode` from the caller and stock filters to `all` nature; this is a planned change, not baseline evidence. | P0 |
| R1 / 01 | View switch | Stock ↔ round view keeps one canonical effective filter set. Counts and rows change view only; nature, market, query, review status, source, account, year, run and sort stay applied. | `TradeLibrary` already has separate modes, but its stock controls and queue controls are separate state paths. Need a canonical-state test. | P0 |
| R1 / 01 | Restore after re-entry | Re-entering the library restores view, filters, sort, expanded stocks, and scroll. Restore works through the parent `initialBrowseState`, not only within one mounted component. | Existing UI test covers queue scroll return; no full unmount/re-entry coverage for nature/run/sort/expanded stock. | P0 |
| R1 / 01 | Reset | Reset leaves the current nature and view. It clears market, search, source, account, year, run and other advanced filters; status becomes all rounds; sort becomes latest activity first. In simulation, it does not jump to live. | No test covers the complete reset contract or the sort indicator after reset. | P0 |
| R1 / 01 | Nature switch | Switching live/simulation clears only incompatible source/account/run values, preserves market/search/review status and normally preserves sort; if a performance sort becomes invalid because run was cleared, it resets to latest activity and shows why. | Current queue has no coordinated compatibility-clear behavior. | P0 |
| R1 / 01 | Review state vs position state | Completing a review does not remove the episode from all-round browsing; open/closed is independent of pending/completed/deferred. | `review-queue.test.ts` covers state classification; browser-level list persistence after save is still needed. | P1 |
| R2 / 02 | Source multi-select | Source options are readable (富途, Tiger, 招商证券, TradingView); same-dimension selection is OR and source + account/year/run are AND. Active tags can be removed one by one. | `review-queue.test.ts` covers broker OR plus account AND at pure-function level; UI staged apply and source labels need coverage. | P0 |
| R2 / 02 | TradingView/run separation | Exactly one TradingView source option. Two runs of the same instrument remain independently selectable and independently counted. No run hash is presented as a broker. | Existing model carries `simulationRunId`; current UI exposes raw/sliced run IDs and creates scope entries per run. | P0 |
| R2 / 02 | Compatible clear | Selecting a simulation run then switching to live removes the run and only incompatible source/account options. Compatible multi-select values remain. A visible notice names what was cleared. | No existing acceptance test for partial compatibility clearing. | P0 |
| R2 / 02 | Labels | Same run names are stable across row, filter, summary and child group. Same-name accounts receive stable disambiguation without changing aggregation identity. | `stableAccountDisplayLabels` has unit coverage; run-label consistency/collision coverage is missing. | P1 |
| R3 / 02 | Drawer staging | Editing year/account/run/source in the drawer does not change rows, counts, tags or sort until Apply. Closing/Escape discards draft values. Reopening shows the last applied values. | Existing UI tests exercise an inline advanced panel and persistence while collapsed; they do not prove staged draft isolation or a right-side drawer. | P0 |
| R3 / 02 | Keyboard/narrow view | Drawer has a labelled boundary, initial focus, Escape close, focus return, and reachable Apply/Cancel at narrow width. | No browser evidence yet; coordinator owns final browser check. | P1 |
| R3 / 02 | Side-effect guard | Opening/closing/drafting/applying filters does not request market data or exchange rates. | No network-spy acceptance test in current library tests. | P0 |
| R4 / 03 | Stock grouping identity | One stock row per `instrument.id` under the current non-status filters; same name/symbol in another market is a separate row. Live accounts merge for browsing, with account count shown. | Current `buildTradeLibraryEntries` creates scope entries and current stock filtering is entry-level; this is a high-risk integration seam. | P0 |
| R4 / 03 | Episode child identity | Each child row is exactly one episode, with account/source, start/end, trade count, position status, trusted PnL/return, review status, and an action targeting that exact episode. | Queue has episode-level rows; stock child layout and exact target are missing from baseline. | P0 |
| R4 / 03 | Simulation child groups | Same stock with two runs has one stock row, then two named run groups. PnL/return stay per run; no cross-run sum appears. | Current entries are split by run, which can prevent the target stock-level grouping. | P0 |
| R4 / 03 | Local include-reviewed | Under pending-only global state, a stock shows only pending children. “Include reviewed rounds” expands only that stock and preserves year/account/nature/source/run filters. It does not change global rows, summary, sample count, sort, or Start Review candidates. Deferred rounds appear in the expanded local list. | No local-scope override exists in current `ReviewQueueFilter`; this needs an explicit acceptance test. | P0 |
| R4 / 03 | Return context | Opening a child enters the exact episode. Returning restores the stock expansion and scroll. Saving updates that stock’s progress without changing trade facts. | Existing tests cover queue scroll and exact target separately; combined stock expansion + save + return is missing. | P0 |
| R5 / 07 | Time sort | Stock uses the latest activity among matched episodes; child/round uses latest execution in that episode. Default is descending; ascending is available. Same timestamps are deterministic; unknown times go last. | Current queue sort uses `startedAt`; this is a direct planned-regression check. | P0 |
| R5 / 07 | CNY PnL/return sort | Live rows may compare currencies only after converting both net PnL and opening exposure with one rate snapshot. Original amounts remain visible. Missing conversion is last and marked incomparable. | Current queue sorts by original currency for net sort and raw episode return for return sort; no FX exists in baseline. | P0 |
| R5 / 07 | Simulation restriction | Without one selected simulation run, PnL/return sort is disabled or clearly says “请先选择模拟运行”; it never chooses best/latest or sums runs. Selecting a run enables sort. Clearing it resets to latest activity and does not restore old performance sort. | No current restriction test. Mixed live + simulation behavior needs the ruling in the companion risk report. | P0 |
| R5 / 07 | Stable refresh | FX refresh reuses the selected sort and reorders from the new snapshot atomically. It does not change the sample set, review state or episode ownership. | No FX/sort integration evidence. | P0 |
| R6 / 08 | Scope labels/counts | Summary separates current filtered securities/rounds/review progress from performance groups (market, nature, run, currency). Text makes clear that group PnL is not all-round count. | Current queue summary has group counts but no weighted return/CNY layer and can show a generic top-level count beside group metrics. | P0 |
| R6 / 08 | Main metrics | Main metrics are CNY closed net PnL, weighted return by opening amount, win rate with numerator/denominator, and review progress. Secondary metrics and exclusion reasons remain available. | Current summary has net PnL and win rate but no weighted return and no CNY conversion. | P0 |
| R6 / 08 | Missing samples | No trusted closed sample shows unavailable, never `0%` or zero money. Open, fee/cost-unknown and unconvertible rows show exclusion reasons; break-even is separate. | Existing dashboard tests cover exclusion reasons and untrusted rows; UI/main-summary coverage is missing. | P0 |
| R6 / 08 | Start Review | Start Review chooses the first pending episode in the active filter/sort range. With no match it stays in range and explains that there is no target. | Existing queue starts from pending rows; no no-target/out-of-range browser test. | P1 |
| R7 / 05 | Weighted formula | For closed, trusted, comparable sample: `sum(netPnl) / sum(opening exposure) * 100`. The 10,000/+1,000 plus 90,000/-900 fixture is +0.10%, not +4.50%. No final rounding before aggregation. | `episode-metrics.test.ts` covers episode return; no aggregate weighted sample test. | P0 |
| R7 / 05 | Fees/costs/direction | Fees reduce net PnL; opening exposure excludes fees and closing proceeds; adds count once; short uses opening sell not margin; IPO acquisition cost is included once and execution-backed IPO cash is not duplicated. | Fee, settlement mismatch and IPO unit tests exist; no combined short + IPO + aggregate test. | P0 |
| R7 / 05 | Shared sample | A row cannot contribute to only numerator or denominator. Open, unknown cost/fee, non-positive/non-finite exposure and unavailable evidence are excluded from the weighted-return sample and explained. Net PnL may have a different coverage count only when the UI says so. | Current `buildTradeLibraryEntries` sums all episode exposures and nulls the aggregate if any net PnL is missing; it is not the target sample model. | P0 |
| R8 / 04,06 | Manual-only | Mount, re-entry, filter changes, drawer changes and sorting read the last saved snapshot but do not fetch. Only Refresh Rates performs network I/O. | No FX module or test in baseline. | P0 |
| R8 / 04,06 | Atomic snapshot | A successful refresh persists one complete, validated snapshot (CNY/HKD/USD coverage and source/as-of metadata). Invalid, partial or timed-out responses leave the prior complete snapshot untouched; no mixed old/new rates appear in one render. | No baseline evidence; require repository/API test plus browser failure path. | P0 |
| R8 / 04,06 | Cache fallback | With a cache, failed refresh uses the complete prior snapshot and labels cache date/source. Without a cache, foreign rows keep original amounts and are unavailable for CNY amount/ranking; no zero fill. | No baseline evidence. | P0 |
| R8 / 04,06 | Same-snapshot metrics | CNY row amounts, stock totals, weighted return numerator/denominator and ranking all derive from the same immutable snapshot. After 7.00 → 7.10, USD 100 changes 700 → 710 while original 100 remains. | No baseline evidence. | P0 |

## Existing baseline evidence to retain

These tests are useful supporting evidence but do not close the acceptance rows above:

- `app/lib/reviews/review-queue.test.ts`: episode-level account/year filtering, account OR + broker AND, stable account labels, review-state separation, scope separation by currency/nature/run, and unavailable values last for the legacy queue.
- `app/lib/trades/episode-metrics.test.ts`: fee-unknown exclusion, settlement mismatch exclusion, rounded settlement amounts, open marks, and IPO cost evidence/double-count protection.
- `app/lib/trades/library.test.ts`: live/simulation separation, open-mark requirements, review facts and run separation.
- `app/components/library/trade-library.test.tsx`: queue scroll return, exact episode target, keyboard open, advanced-filter labels, pending/completed state, and neutral open/untrusted display.
- `app/lib/reviews/dashboard.test.ts`: exclusion reasons and market/nature/run/currency grouping.

The baseline suite does not prove the new stock-level effective set, local include-reviewed scope, manual FX behavior, CNY weighted return, latest-execution sorting, or canonical state restoration.

## Required evidence before acceptance

1. Targeted unit tests for the effective episode-set builder, weighted sample builder, CNY snapshot conversion, and sorting restrictions.
2. Component tests for reset/restore, staged drawer, local include-reviewed expansion, exact child navigation, and same-stock multi-run grouping.
3. Browser checks on the isolated database for the core path, a failure/cached-FX path, keyboard operation, desktop and narrow layout.
4. A before/after source fingerprint proving executions, instruments, reviews, import batches and revisions are unchanged.
5. The final report must identify the exact worktree, DB, port, running preview URL, commands, and any unrun or blocked checks.
