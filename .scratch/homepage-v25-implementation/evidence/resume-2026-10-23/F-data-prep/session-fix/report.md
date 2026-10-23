# F completed-exchange-session repair

Status: **implementation-ready; coordinator recovery acceptance 3/3 pending**. Source is frozen after the checks below. Recovery rounds are not reset. UI, browser journeys and P1 acceptance are **NOT VERIFIED** by this worker report.

## Frozen implementation

Only `app/lib/reviews/homepage-v25-performance.ts` and its same-name test were changed. Shared calendar, sync range, canonical ledger, provider, import pipeline, P1 product files, dependencies, original evidence and databases were not changed in this repair. No service, full test suite, commit or push was run.

| File | Before SHA-256 (accepted F2) | Frozen SHA-256 |
|---|---|---|
| homepage-v25-performance.ts | 1e9757d35b09ade0debdc6ef08c6a49ffa78bb607383ce49d16efd5cbe79abf5 | e91dce9cdddf83137370ef44647dda260336b03bd49b5082d201352664f762b0 |
| homepage-v25-performance.test.ts | fabfc2b43e6d57edc52177dcc950b83eaa4e54b5a3424e26de50fbf3ff34a921 | cbe5cb601126413a11183ff5af265f94f620e9b3acec19cc01144e0f92195cf7 |

The before source/test are preserved as `before-source.ts.txt` and `before-test.ts.txt`. Exact product changes are `product-source.patch` and `product-test.patch`. `INTERFACES.md` defines quote eligibility, unavailable classifications and the unchanged independent current quantity/cost/fees contract. `freeze-manifest.json` pins this evidence and relevant original read-only dependencies.

## Confirmed cause and correction

F2 filtered raw daily close rows by Shanghai date. That allowed an unfinished US session's full daily close when Shanghai had advanced to the following day, and discarded already completed CN/HK same-day closes. A simple date cutoff would also admit an older fabricated weekend/holiday row.

F now asks the existing `requiredMarketDataRange(open: true, now: boundary.cursor)` for the latest completed exchange session separately at the opening, closing and current cursors. It then checks the candidate itself with existing `expectedTradingDates`. It returns a classified null quote when the market or completion calendar cannot be confirmed. No cost/realized/fee ledger algorithm changed. The explicit caller-boundary compatibility path remains unchanged.

The original three real probes use one live buy of 1 at 100 with fee 2 and raw October 20/21/22 closes 100/110/999, through `buildInstrumentTradeSummaries → buildTradeLibraryEntries → F → P1 holdings model`:

| Market / current cutoff | F2 selected quote / MV / net UF | Frozen selected quote / MV / net UF |
|---|---|---|
| US, 2026-10-22T17:30Z (NY 13:30, Shanghai October 23) | Oct22 / 999 / 897 | Oct21 / 110 / 8 |
| CN-SH, 2026-10-22T08:30Z (after close) | Oct21 / 110 / 8 | Oct22 / 999 / 897 |
| HK, 2026-10-22T08:30Z (after completion) | Oct21 / 110 / 8 | Oct22 / 999 / 897 |

Original `../session-cutoff.log` and its three original JSON traces remain 3/3 RED, pinned by `../historical-sources-manifest.json`. The copied `session-cutoff.test.ts` is 3/3 GREEN in the new labeled run and writes only `traces/session-cutoff-*.json`. Root separately reproduced the original RED before authorization. A passing copied probe does not rewrite or cancel the original evidence.

## TDD and regression evidence

The same-name F test retains its original 75 cases and adds 25. Twenty table cases exercise real-entry US summer/winter pre/post close, US half-day, HK regular/half-day, CN-SH/CN-SZ pre/post close, date-only cutoffs, weekend fallback, stale weekend rejection and CN holiday rejection. Three cases verify unsupported market/unconfirmed session classifications with quantity/cost/open-fee evidence kept. A weekend-only case requires unknown value; one historical period case separately asserts opening Oct20, closing Oct21 and current Oct23, including independent financial values.

| Run / log | Result | Exit |
|---|---|---:|
| Old F2 source with new tests, `red.log` | 100 tests: 17 FAIL / 83 PASS | 1 |
| Minimal source repair before invalid old fixture correction, `first-implementation.log` | 100 tests: 39 FAIL / 61 PASS; all 25 new cases pass | 1 |
| Same-name corrected valid-session fixtures, `fixtures-corrected.log` | 100/100 PASS | 0 |
| 18 files with copied historical fixtures still uncorrected and original frozen P1, `original-evidence-fixtures.log` | 349 tests: 14 FAIL / 335 PASS | 1 |
| Historical evidence copies corrected, original frozen P1 unchanged, `regressions-corrected-evidence.log` | 349 tests: 2 FAIL / 347 PASS | 1 |
| Corrected evidence copies including copied P1, `green.log` | 18 files, 349/349 PASS; 9.38 s total, 1.37 s test time | 0 |
| F targeted TypeScript, `types.log` | PASS | 0 |
| F two-file ESLint, `lint.log` | PASS | 0 |

`FIXTURE-CORRECTIONS.md` and `failure-classification.json` enumerate all 14 failures, their actual output, invalid old input and corrected counterpart. Invalid old US Saturday Jan31 closes now use Jan30 in positive fixtures; unsupported generic CN uses a real CN-SH pipeline; four unconfirmed 2025 pre-period sessions use a valid opening boundary. Explicit invalid weekend/holiday and unsupported calendar cases remain negative controls. Dates and markets are corrected with financial assertions retained; original evidence tests are untouched. Per-copy before files and `*.fixture.patch` record every correction and import/output relocation.

The final 18-file `green.vitest.config.ts` includes the F product test; copies of interface, IPO fees, invariants, FX/unknown contracts, original four pipeline boundaries, peer and current contracts; the copied three session probes; unchanged position-ledger, episodes, library, scope, statement-evidence, sync-range, calendar and trading-date neighbor tests; and the corrected copied P1 holdings-model test. `regressions.vitest.config.ts` retains the original frozen P1 test and its two failures. The final 349 PASS are scoped F/model closure, not a claim that frozen P1 passed unchanged.

## Exact commands and environment

Working directory: `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`; timezone `Asia/Shanghai`; Node `v26.0.0` from the pinned runtime. `verification.json` records commands, versions, exits and test counts.

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/focused.vitest.config.ts
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/green.vitest.config.ts
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --noEmit -p .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-fix/tsconfig.f.json
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/lib/reviews/homepage-v25-performance.ts app/lib/reviews/homepage-v25-performance.test.ts
```

## Remaining consumption and measurement boundaries

The frozen P1 product test still has two failures: both default US raw October 23 closes at Shanghai October 23 end, before that US session finishes. Its evidence copy changes only that US default raw date to October 22; CN same-day, explicitly stale US October 15, asOf and FX snapshots remain unchanged. Product P1 files were not edited; integration is waiting for root's coordinated acceptance feedback.

This repair adds calendar lookups, not canonical replay calls. It does not make the current full builder a prepared daily timeline. The earlier read-only isolated measurement (pre-repair F2 source) remains historical: 83 live fills, 77 eligible groups, a single F projection 71.99 ms and 239 canonical calls; the 1866 unknown/simulation rows were distinct and not relabeled. Root's earlier finite synthetic scale evidence was approximately 30/265/2069 ms for 20/100/200 fills. Neither measurement proves 1866 fills × 365 days acceptable. No 365-run loop was executed and no post-repair performance claim is made. The prepared canonical seam remains a proposal in the prior read-only report and needs its own approved implementation scope.

Latest valid raw fallback preserves its source date but can be stale. Shared exchange calendars do not by themselves prove per-instrument halts or historical vendor revisions. Missing historical FX is not replaced with current FX. `../HISTORICAL-SOURCES.md` (SHA-256 `302a8dc3cfe54162c2f5eb0ee319808e012605d3e7c0fa6e6455f6726d9cbf66`) remains the unchanged pre-repair audit; this report and manifest identify the corrected quote contract.
