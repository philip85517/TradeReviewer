# Final independent QA coverage matrix

Date: 2026-09-19\
Reviewer: Luna QA\
Scope: final static review of the Trade Library refresh, the owned workspace navigation tests, and the owned import-flow tests. This slice did not edit production code, run a browser session, write to the database, or run the full repository suite.

## Result

The two stale user-path test files are now green after adapting them to the stock-first library and applied advanced-filter drawer:

| Check | Result |
|---|---:|
| `trade-review-workspace.test.tsx` | 65/65 passed (maxWorkers=1, testTimeout=20000; 56.99s) |
| Three repaired real-import cases | 3/3 passed, 62 skipped (36.12s) |
| `trade-review-workspace.import-flow.test.tsx` | 29/29 passed in the earlier scoped run |
| `npx tsc --noEmit` | exit 0 |
| `git diff --check` | clean |

The three initial workspace failures were timing failures in the test locator, not a product failure. Real Futu XLSX parsing and instrument enrichment can take longer than Testing Library's default one-second query timeout. During diagnosis the confirmation dialog was present and the only observed requests were the permitted local `/api/fx` GET and `/api/instruments/resolve?market=US&symbol=XPEV`; no market-data request was introduced. The tests now wait up to ten seconds for the confirmation heading and then the confirmation button. The production path and its financial/replay assertions remain unchanged.

Owned test files:

- [trade-review-workspace.test.tsx](/Users/zhoulin/.codex/worktrees/e7ec/TradeReview/app/components/trade-review-workspace.test.tsx)
- [trade-review-workspace.import-flow.test.tsx](/Users/zhoulin/.codex/worktrees/e7ec/TradeReview/app/components/trade-review-workspace.import-flow.test.tsx)

## R1–R8 coverage

| Requirement | Independent evidence | Boundary / release status |
|---|---|---|
| R1 default scope, reset, persistence, reviewed-local scope | Browse-state and pagination acceptance tests cover stock/round defaults, page reset, full-set counts, return state, and local include-reviewed. Workspace navigation now enters stock view, expands the stock, and opens the exact child round. | Covered by scoped tests. Coordinator owns final browser confirmation of default live/stocks/all/newest and return behavior. |
| R2 nature, market, platform/account, and run identity | Queue/filter/sort tests cover entry-first nature, legacy Futu live fallback, explicit unknown isolation, simulation run fallback, and mixed nature/run restrictions. Workspace account and year paths now use the applied drawer and preserve chips on return. | Covered in module/component tests; coordinator browser evidence covers friendly labels and cross-run UI. |
| R3 draft drawer, Apply/close, chips, keyboard, and network boundary | Drawer tests cover draft versus applied state and exact local FX GET allowance. Workspace tests cover account/year Apply, chips, reopen state, cancel, and no market-data fetch. | Covered by focused tests. Coordinator owns final keyboard, narrow viewport, and fresh-console browser gate. |
| R4 stock parent/round children, exact identity, reviewed-local behavior | Pagination acceptance uses 101 rows to prove page 2, exact child ID, full filtered counts, full Start Review candidate set, and state restoration. Summary/queue tests cover reviewed-local rows outside global totals. | Covered by independent tests; coordinator has final real-data page-2 and review-return evidence. |
| R5 latest execution sort, comparable performance sort, run restrictions | Sorting tests cover invalid timestamps last, Decimal FX-aware values, weighted-return ordering, nature/run restrictions, and reset to newest. Full browse rows remain the sort input while only the current page is rendered. | Covered by independent module/component tests; coordinator owns final simulation sort/reset browser check. |
| R6 filtered counts versus metric samples, fees, shorts, IPO, open rows, progress | Metrics-boundary tests cover differing closed-PnL versus weighted-return sample sets (the return numerator and denominator use identical rows), fee/cost handling, short exposure, IPO allocation once, missing values, open groups, and review progress. Main wiring statically passes full filtered rows to summary and queue. | Covered by focused tests plus coordinator integration evidence; no independent browser claim in this report. |
| R7 CNY conversion, same-sample weighted return, scope separation, missing FX | Financial and metrics boundary tests cover CNY/USD examples, identical FX snapshot for numerator and denominator, missing-FX symmetric exclusion, all-loss/profit-factor boundaries, legacy entry-live versus explicit unknown, and same-currency multi-run separation. | Covered by independent financial tests and current production wiring; coordinator owns final real-page metric display check. |
| R8 manual-only FX, saved cache, atomic refresh, original currency, failure state | FX provider/service/control tests cover mount read, manual POST only, cache/date label, failure retention, invalid calendar dates, and no fabricated zero. Main library passes one snapshot to summary/sort/display and keeps raw currency groups. | Covered by focused tests; coordinator owns final manual refresh/cache/failure browser evidence. |

## Coordinator evidence recorded separately

The coordinator's final browser and performance reports provide release-level evidence outside this independent slice:

- The final desktop production run used a visible 1280×720 tab and 120 events. Event-to-two-`requestAnimationFrame` p95 values were 36.4/49.8/100.1 ms for 766 rounds and 38.2/42.7/121.1 ms for 5000 rounds (drawer/expand/filter). The measurement is a bounded warm production-component interaction, not a cold-start, network, whole-workspace, or INP SLA. Earlier high-load samples remain recorded, including 766 filter p95 386.5 ms and the pre-optimization 5000 filter recovery; they are not silently discarded.
- Coordinator browser checks cover the final 3031 preview, desktop and narrow layout, drawer focus/Escape, FX cache/failure, second-page exact child, review return, simulation-run sort/reset, and final console/source-fingerprint checks. These are coordinator-owned observations rather than independent browser evidence from this report.
- Protected source fingerprints remain unchanged in `source-final-check.json`; the isolated acceptance database contains the review-only writes used by browser QA.

## Remaining release gates

This report does not replace the coordinator's final four-file regression, final browser pass, or full-suite decision. The refresh test file was owned by the UI worker and is outside this slice. Performance numbers are bounded component measurements with warm/cached ranges; they do not establish an application-wide cold-load or arbitrary-query SLA. No unresolved production defect was found in the three repaired import cases; their original failures were test timing only.
