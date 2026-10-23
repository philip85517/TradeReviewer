# Historical source coverage and prepared canonical seam

Status: read-only preparation, 2026-10-23 Asia/Shanghai. P2–P4 have not started. F2 had been independently accepted by root when this investigation began; this investigation found three additional current-quote counterexamples and reported them to root for the original F scope. This document does not accept those failures or move them to P2. No product file was changed. No service, provider request or business database was used. Browser/UI journeys remain **NOT VERIFIED** here.

Audited F source SHA256: `1e9757d35b09ade0debdc6ef08c6a49ffa78bb607383ce49d16efd5cbe79abf5`; same-name test: `fabfc2b43e6d57edc52177dcc950b83eaa4e54b5a3424e26de50fbf3ff34a921`. Evidence/source hashes are recorded in `historical-sources-manifest.json`. All API shapes below marked proposed are unimplemented.

The approved contract remains `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`: HP02 lines 193–252 (Shanghai period, three period metrics, independent current fourth metric, daily tooltip, source/FX gaps); HP05 lines 349–394 (closed rounds, fees, win-rate and historical modes); HP09/related contribution requirements and current `DESIGN-COVERAGE.md`. The earlier `P2-P4-DATA-PLAN.md` and `../F-peer-review/P2-P4-DATA-SEAMS.md` are proposals, not replacements for that contract.

## 1. What the repository can actually provide

| Source | Existing implementation | Reliable evidence it supplies | Missing capability / consequence |
| --- | --- | --- | --- |
| Active BOC FX | `app/lib/fx/room-contracts.ts:3`, `fx-service.ts:186`, `boc-parser.ts:111` | Latest parsed positive USD/HKD→CNY rates; source, fetchedAt, per-currency publication timestamps, status. Parser divides BOC quotes per 100 currency units by 100. | `trading-room.fx` is one setting overwritten on refresh. Parser keeps the latest row per currency. There is no dated/range history query or snapshot journal. Cannot reconstruct a year of daily FX. |
| Legacy Frankfurter/ECB FX | `app/lib/fx/provider.ts:8`, `provider.ts:57`, `provider.ts:98`, `contracts.ts:14`, `storage.ts:15/28` | Latest endpoint response with one valid rateDate, fetchedAt, source and validated positive rates; CNY-base response inverted to CNY per source currency. | `fx.rates.snapshot.v1` is also one overwritten setting. No date/range parameter in the existing fetch function, no history store. This code audit does not establish whether the external supplier offers historical endpoints. |
| Raw daily market records | `app/lib/market/contracts.ts:11`; `app/lib/storage/sqlite-repositories.ts:48/87/103`; `sqlite-store.ts:1168` | Instrument, tradingDate label, raw OHLC, currency, provider/symbol, fetchedAt; bounded date reads and combined candles+coverage repository API. | No daily knowledgeAt column and no revision journal. Current row is latest stored revision, not a reconstruction of what the application had stored at every past instant. |
| Intraday / generic market records | `app/lib/market/contracts.ts:26`; `sqlite-store.ts:1178/2012`; `db/sqlite-schema.ts:90/172` | Timestamp and optional knowledgeAt, interval, provider, fetchedAt. | Optional field is not proof that every existing row has correct knowledgeAt. Does not supply historical FX. |
| Coverage records | `app/lib/market/contracts.ts:72/86`; `sqlite-store.ts:1206`; `sync-service.ts:326/590`; `coverage-tail.ts:10/38` | Requested ranges, status, named missing dates, provider/fetchedAt, actualEndDate and error/history-limit reasons. Can distinguish observed missing sessions from a returned range. | A saved complete label alone is insufficient. `reconcileDailyCoverage` checks stored bars but catches calendar exceptions and keeps the old segment. A new valuation adapter must explicitly retain calendar-unknown rather than treating this fallback as proof of completeness. |
| Market trading dates | `app/lib/market/calendar.ts:15`; `app/data/exchange-holidays-2010-2030.json` | Expected weekday sessions excluding bundled closures within supported market/date ranges; throws outside those ranges. | Does not prove an individual instrument traded, was listed, was not suspended, or has a provider bar. The US bundle is one market calendar, not verified per-US-venue sessions. |
| Session completion | `app/lib/market/sync-range.ts:13/37/54/98/187`; `types.ts:26` | Existing regular-close + verified half-day policy, market timezone and DST handling; latest completed session is used by requiredMarketDataRange for an open holding. | latestCompletedSession and marketSessionClose are private to sync-range. Chart daily conversion uses conservative regular close, so the two policies differ on verified early-close days. F quoteFor does not use either policy. |

Persistence evidence: `db/sqlite-schema.ts:78/90/155/163` defines daily/raw keys, market records and key-value app_settings; `sqlite-store.ts:1973/2007/2155` UPSERTs the current candle/setting. Existing IndexedDB market repositories are marked retired/migration-only and are not the active source path. Neither storage system provides an archive of replaced daily quotes or FX snapshots.

The active BOC `createFxService.read` reads existing settings; refresh and ensureDaily can fetch and write (`fx-service.ts:194/207/234`). `app/api/trading-room/fx/route.ts:21` GET calls ensureDaily. This investigation did **not** call that HTTP endpoint. `toRoomFxSnapshot` (`room-contracts.ts:37`) emits production `USD/CNY` and `HKD/CNY` keys and a single asOf (`publishedAt ?? fetchedAt`); it drops per-currency publication timestamps. Future historical-source preparation must retain them separately; max publication time is not a freshness timestamp for every pair.

## 2. Calendar and knowledge limits

Bundled exchange calendar metadata is `exchange-calendars-4.11.2+official-cn-2026`. US and HK expected-date coverage is 2010-01-01 through 2030-12-31; CN-SH/CN-SZ stop at 2026-12-31. `scripts/generate_exchange_holidays.py:28` builds it from XNYS/XHKG/XSHG and the declared 2026 CN holiday update. This is the repository's source declaration; no fresh external calendar verification was performed.

Session schedule coverage is narrower: `sync-range.ts:54` verifies US 2026–2028 and HK/CN 2026. Its early-close table has explicit US and HK dates. Outside a verified year, before regular close it throws rather than guessing whether a half-day has completed; at/after regular close it conservatively knows the session has completed. Calendar coverage and session-schedule coverage are distinct facts. Unknown calendar must produce a source/coverage reason, not zero, an invented open session, or an assertion that the market was closed.

There are three distinct times:

1. The Shanghai reporting boundary used by F for fills/period knowledge.
2. The source market tradingDate and actual/conservative session-completion instant of a quote.
3. The time a supplier published an observation and the application fetched/stored its current revision.

An historical close fetched today can support a retrospective valuation at the original completed session, if the product explicitly presents a retrospective source series. It cannot prove the application knew this exact revision at that old instant. Strict application-point-in-time replay requires a retained publication/revision/ingestion history, which current daily storage lacks. Never rewrite fetchedAt/asOf to manufacture that history. A future source API should state `knowledgeMode: retrospective-session | stored-as-known`, preserve fetchedAt, and refuse the latter when revision evidence is absent; this is a proposal requiring root's policy decision.

## 3. Current F/P1 quote boundary: reproduced failures

Frozen `app/lib/reviews/homepage-v25-performance.ts:261` selects raw candles with date <= Shanghai boundary day; an ISO boundary additionally requires candle date < Shanghai boundary day. It does not compare market session completion, expected session coverage, or fetchedAt. This can both include unfinished US daily data and exclude completed same-day CN/HK data. Merely requiring an ISO asOf does not fix it.

Independent fixture: one explicit-live real TradeExecution, buy 1@100, opening fee 2, passed through `buildInstrumentTradeSummaries → buildTradeLibraryEntries`; raw bars 2026-10-20/21/22 close 100/110/999. No compatibility valuations, quote mocks or financial ledger mocks. Each bar fetchedAt is its conservative exchange close. Same entries+raw records also go directly into the actual P1 `buildHomepageHoldings` model.

| Scenario | Existing requiredMarketDataRange(open, now=asOf) | F current and P1 model actual | Correct boundary mark |
| --- | --- | --- | --- |
| US asOf 2026-10-22T17:30Z, Shanghai 10/23 01:30, New York 10/22 13:30 | Last completed session 10/21. 10/22 daily knowledgeAt is 20:00Z, later than asOf. | Selects 10/22; MV 999; net UF 897. P1 calls it current. | 10/21 close 110; MV 110; net UF 108. |
| CN-SH asOf 2026-10-22T08:30Z, Shanghai 16:30 | Session 10/22 completed at 07:00Z. | Excludes 10/22 and selects 10/21; MV 110; net UF 108. | 10/22 close 999; MV 999; net UF 897. |
| HK at the same 08:30Z instant, Hong Kong 16:30 | Session 10/22 completed by conservative auction cutoff 08:10Z. | Excludes 10/22 and selects 10/21; MV 110; net UF 108. | 10/22 close 999; MV 999; net UF 897. |

Evidence: `session-cutoff.test.ts`, exact config `session-cutoff.vitest.config.ts`, `session-cutoff.log` (**3 tests, 3 FAIL, exit 1**), and `session-cutoff-US.json`, `session-cutoff-CN-SH.json`, `session-cutoff-HK.json`. JSON contains only synthetic inputs. All three completed-session controls passed before the failing F assertion. The saved outputs show the P1 model mismatch even though the first assertion ends each test before later P1 assertions.

**Actual P1 relevance, with limits:** `app/components/homepage-v25/holdings-model.ts:94/99/117` directly consumes F current results and forwards its selected quote. `trade-review-workspace.tsx:2173/2188/2190/2212` passes raw state.daily into that model. The upstream `marketRanges:531` uses requiredMarketDataRange, and `readInstrumentMarketState:552` date-bounds the daily read. For a normal genuinely open US summary, that upstream range excludes the unfinished 10/22 bar at the probe instant; therefore the US synthetic model failure alone is **not** proof that the normal live host currently supplies that bar. The F entries API remains vulnerable to a wider cached/historical bundle or a read boundary not matching asOf. For CN/HK, that upstream completed range legitimately contains 10/22 after close, and F then wrongly removes it. This directly affects the existing P1 data path when those same-day records are present. A browser render was not tested and is not claimed.

The source fix belongs to original F current-quote scope under root review. It must reuse a common exchange session rule rather than making P1 add a local correction. New historical batch work must inherit the corrected rule, including period-start marks, date-only Shanghai boundaries, ISO boundaries, weekends, verified early closes, DST and calendar-unknown classifications. No product fix is included in this read-only preparation.

## 4. Coverage strategy using existing suppliers and records

Quotes can use existing raw daily records and declared source sessions. Index each instrument's raw records once; for each reporting cursor resolve the required latest completed source session first, then select a valid quote for that session. If the market is known closed, its last completed session remains the required mark. If an expected session is complete but its quote is missing, report quote-missing/partial and retain source dates; do not silently carry an older bar and label the new point complete. Any explicitly permitted stale-mark presentation must remain labelled stale with coverage and cannot be presented as a complete fresh series.

`trading-room-history.ts:248/456` contains a private expected-session/quote lookup that distinguishes closures from missing expected bars. Its error fallback and date-only granularity do not make it an ISO-cutoff resolver. `buildHoldingsHistory:820` takes one FX snapshot for the whole series, and its episode/cashflow policy is not F's canonical fee policy. It is neither a daily FX source nor the financial engine for V2.5. Reuse of a lookup pattern must not reuse that financial ledger.

`market/providers/router.ts:145` already routes daily history through configured Tiger where available and Tencent/Eastmoney/Yahoo/Baidu fallback; `daily-fallback.ts:7`, `sync-service.ts:326`, `coverage-planner.ts:44` already plan and classify bounded missing/history-limited ranges. After a separately authorized implementation/update, these existing sources can attempt absent raw ranges without adding a supplier. Availability is not guaranteed; forbidden, rate-limited, unsupported, calendar-out-of-range, history-limit and no-data remain explicit results. This preparation made no request and filled no storage.

Historical FX has no equivalent complete local source. The conservative usable coverage is:

- Same settlement/report currency: no FX needed; retain original currency and complete source/quote evidence.
- True dated positive source-backed snapshots, if later supplied: use the latest permissible observation for each requested pair/cursor under a declared publication/closure/freshness policy. Preserve pair timestamps, original currency, snapshot identity/source/publication/fetchedAt/status. USD/HKD cross-conversion needs both valid CNY legs. There is no existing FX publication calendar authorizing an unlimited carry.
- A current saved snapshot cannot fill earlier days whose cursor predates its evidence. Keep target amounts null and original-currency subtotals available; gaps remain gaps. Do not blindly add CNY/HKD/USD. A valid single-currency metric remains valid without FX even while a mixed target total is unavailable.
- A root-approved fixed-reporting-FX analysis could deliberately apply one identified snapshot throughout a retrospective range, but must be labelled fixed FX and never “daily historical FX.” Approval/design policy is still required; this document does not choose that alternative for HP02/HP05.
- Reusing an existing supplier's actual historical endpoint could avoid adding a vendor, but requires verifying its official capability, licensing/response semantics and implementing dated storage/coverage. That work is not present, not authorized here and not counted as covered by the current snapshot endpoint.

Thus a truthful first historical adapter can provide original-currency daily points and target points only where matching history is evidenced. It cannot promise a complete converted 365-day curve from the two current single-snapshot settings.

## 5. Read-only isolated backup: current market/fee coverage and cost

Only `.data/tradereview-test.sqlite` was opened, directly with `new DatabaseSync(path, { readOnly: true })`; `SqliteStore` read methods were used without the migration/open helper, provider or service. Original source nature was neither inferred nor rewritten. The combined backup contains **1949 fills = original 1866 non-live + 83 explicit live seed fills**: unknown 1784, simulation 82, live 83. This is not a measurement of F replaying 1866 live fills. The earlier single-projection JSON note calling it “not the separate 83-fill browser seed” should be read with this correction: it is the combined backup, and F default-live actually admits those 83 only.

Raw probe: `isolated-single-projection.test.ts`; exact config `isolated-single-projection.vitest.config.ts`. Initial import attempt `isolated-single-projection.log` failed with missing server-only before any test; preserved. Alias correction in the evidence config only produced `isolated-single-projection-retry.log`: **1 test PASS, exit 0**. `isolated-single-projection.json` records the original raw measurement and DB fingerprint.

| One request, pinned Node 26.0.0 | Observed |
| --- | --- |
| Read bootstrap + 154462 daily records | 1512.24 ms |
| summaries → entries preparation, all source natures | 472.37 ms, canonical replay calls 0 |
| One F default-live projection | 71.99 ms, 78 groups |
| Canonical replay call-through count inside that F call | 239 calls, sum of selected visible-prefix members 88 |
| Request | 2026-01-01..10-23, current asOf 2026-10-23T05:00Z, no FX supplied |

Counters wrap and call the original canonical function, never substitute its financial result. This is one sample including neither browser rendering nor provider cost. It establishes call multiplicity on this distribution, not a universal latency or 365-day bound. Many seed groups have one fill, so it does not expose the long single-instrument prefix worst case.

Additional aggregate-only probe `market-fee-coverage.test.ts`, config `market-fee-coverage.vitest.config.ts`, `.log` and `.json`: **1 test PASS, exit 0**. Same request/source pipeline and no FX. No symbols, accounts, raw executions or financial amounts exported from the real backup.

| Market | Live fills | Financial groups | Current eligible groups | Current MV and net UF available | Current retained-fee amount available | feesKnown evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CN-SH | 80 | 75 | 74 | 67/74 | 70/74 | 74/74 |
| HK | 1 | 1 | 1 | 1/1 | 1/1 | 1/1 |
| US | 2 | 2 | 2 | 2/2 | 2/2 | 2/2 |
| Total | 83 | 78 | 77 | 70/77 | 73/77 | 77/77 |

One closed group is in the 78 full groups but not the 77 current-eligible denominator. Four CN current groups have quantity/history/cost unavailable; their known fee observations do not make the open retained-fee amount assignable. Three CN current groups have quote-missing. These are reason counts with possible dependency overlap, not additive loss categories. All 83 source top-level fee fields are valid positive values; F's lineage-aware feesKnown/amount result, rather than that simple top-level check, remains authoritative. Selected available quotes in this request are all 10/22, already completed at asOf for these markets. This **availability count does not validate** the selector at the different intraday counterexample times above. Mixed-currency top-level totals remain unavailable without an explicit target/FX; per-instrument and original-currency coverage must be retained.

## 6. Minimal prepared canonical seam: proposed, not implemented

The present F `replay` (`homepage-v25-performance.ts:176`) asks `replayPositionAtPrice` for before/after movement prefixes and its final boundary, then maintains a retained-fee pool over those canonical facts. Canonical quantity, average cost and gross realized have a single owner in `app/lib/replay/position-ledger.ts:83`. The shared function currently assembles/sorts the source timeline, selects known events/positions and runs the transition loop per call (`:107/135/153/160/168`). F's local same-boundary reuse does not survive a public-builder call. Calling it once per day would multiply those prefix scans by 365.

**Recommended smallest ownership boundary:** extract preparation and an internal common transition evaluator inside the canonical module, retaining `replayPositionAtPrice` as a wrapper over exactly the same evaluator. Do not copy its average-cost/IPO/position math into F, a worker, chart, or prepared-source module. Indexing and immutable observations are the only new responsibilities.

Proposed files/APIs, conditional on root authorizing shared canonical changes:

| File | Minimal future change |
| --- | --- |
| `app/lib/replay/position-ledger.ts` and its test | `preparePositionLedger(source)` returns an opaque immutable prepared handle; `replayPreparedPositionBoundaries(handle, boundaryRequests)` returns snapshots and optional readonly transition facts. Existing single API delegates to the same private evaluator. Keep types here initially; a separate contracts file is unnecessary unless another consumer needs it. |
| `app/lib/reviews/homepage-v25-performance.ts` and its test | One `prepareHomepageV25Projection` + batch-boundary query seam over the same collect/normalization/fee-pool/amount/metric kernel. Current accepted entry remains a wrapper. Reuse existing fee allocation over canonical before/after facts; do not implement another cost or gross-realized ledger. |
| `app/lib/market/session-boundary.ts` and test | Extract the existing session-close/completion rule to one pure source resolver used by sync-range and the F quote adapter. Return reason/coverage for unsupported/out-of-range/unverified schedule. This may be required earlier by the reopened current-quote fix. Avoid divergent chart/F close rules. |
| `app/lib/reviews/homepage-v25-history-sources.ts` and test | A pure index of supplied raw candles, calendar coverage and supplied dated FX facts. Resolve each permitted mark/FX with source timestamps/reasons. No provider fetch, DB writes or financial equations. Existing current single FX adapter is not converted into fabricated history. |

Proposed canonical requests include knowledge cursor, explicit visible execution IDs and source-precision policy. Observations expose readonly before/after **strings**, trustworthy quantity/cost flags, canonical cumulative fees and gross realized, movement identity/kind/ordering and known-context revision. Do not expose mutable Decimal/Map/internal state. Prefer returning a read-only collected trace over invoking arbitrary callbacks inside mutable transition code. The observer must observe the sole transition implementation, not recompute what the transition should have done. Its trace can then feed the same F fee-pool transition and later provenance classification without any second inventory ledger.

Preparation normalizes identity and scope once, deduplicates raw lineage once, indexes attached statement/position/cash and sorts quote/source timelines once. It can prepare indexes of all supplied evidence but a boundary must **select only what its cursor knows**. Request caches are owned by the prepared handle and released with the source revision; no global unbounded Map.

Cache identity must include normalized source revision, account/instrument/nature/run, actual raw execution lineage and settlement contents, visible IDs/precision, statement positions/coverage/event/cash, bonus/IPO execution-backed suppression context, boundary knowledge policy, canonical/F policy versions. Quote/FX changes invalidate valuations separately from canonical inventory only when they do not change source identity/currency. Input reference equality or fill-ID lists alone do not establish equivalence.

### Late refund is a knowledge epoch, not a new sale

Canonical `position-ledger.ts:153/296` resolves an IPO acquisition using events known at **the queried cursor**, including a later refund. Thus an allocation on Jan10 can have unknown cost at Jan18 and known acquisition cost at Jan31 without any visible execution IDs changing. A naive chronological sweep that permanently finalizes cost at Jan10 would disagree with the canonical single-boundary function; a cache keyed only by fills would do the same.

Create a knowledge-context epoch whenever newly visible statement/cash/refund/fee/coverage/bonus evidence or execution-backed IPO matching changes an earlier movement's meaning. Conservatively replay that epoch's affected canonical prefix with its own known context, then run the existing F fee observation over that same context. Keep Jan18 immutable and unknown after querying Jan31. Quiet days within one epoch reuse canonical/F checkpoints and only revalue permissible quotes/FX. If dependence cannot be bounded safely, invalidate the whole affected group; incorrect cheap reuse is unacceptable.

Existing `read-only-probes.test.ts` / `01-probes.log` / `probe-results.json` provide the concrete causal probe: same fill IDs, before late refund unavailable, after refund R18/UF9/net27. They also preserve opening fee grossUF20 vs netUF18 and partial-close grossUF10 vs netUF9/open fee1/R18. These literal component expectations, not merely the net identity, are required in future batch parity tests.

### Preparation and query cost

Let N be original fills, E attached evidence events, C raw candles, G financial groups, D requested days, K distinct meaningful knowledge epochs. Source/index preparation is O((N+E) log(N+E) + C log C); source session/quote lookup can be batched or binary searched. For one stable context, the target is one ordered canonical transition pass plus the same F fee observations, then O(D×G) valuations/aggregation. Quote and FX resolution must use each point's cursor and cannot substitute today's mark/FX.

With late revisions, conservative work is the sum of affected epoch prefixes; worst case after a true shared transition seam is O(K×N), not always O(N). Memoizing the current monolithic prefix calls is a useful finite first optimization but can still cost O(N² log N) preparation for a long group; it does not prove a linear prepared sweep. The direct per-day full-builder approach adds a D multiplier and is rejected for 1866×365.

The parent observed 20/100/200-fill probes at roughly 30/265/2069 ms in `../coordinator/F-scaling.test.ts/.json`; these are finite samples, not a universal model. The 83-live real-backup sample above is a different shape and must not be reported as the original 1866 workload. Future synthetic explicit-live 1866-fill fixtures must preserve original backup nature unchanged. The earlier proposal of ≤2s cold/≤200ms repeat for all 365 points remains an **unapproved budget**, not an achieved result. Before implementation root must agree a measurable budget; report preparation/query/memory and canonical transition count separately and stop at that bounded scope.

The reason a F-file change is required is reuse of its accepted collect/dependency gates/fee-pool/metric policy; a standalone UI batch loop cannot access or safely duplicate them. The reason a shared canonical-file change may be required is eliminating repeated construction/execution of canonical prefixes without copying canonical financial transitions. Any such change requires a distinct authorized implementation scope after the P1 journey gate; this report authorizes none.

## 7. Validation before accepting the proposed seam

1. Preserve the accepted single-current/period outputs and all reopened quote reds. Each batch boundary must equal an independent single-boundary call in value, money, coverage, reasons, knowledge cursor and inventory/fee evidence. Also assert literal average-cost, gross-realized, retained fee and realized fee parts so two equally wrong paths cannot satisfy only the net identity.
2. Vary query order (late then early; early then late), mutate returned readonly copies in a negative isolation test, and change source revision/settlement/metadata/known statement cash while retaining fill IDs. No later evidence may change an earlier result or stale cache.
3. Real entries/raw tests: US midnight-before-close, CN/HK same day after close, DST, verified half days, weekend/holiday, unknown schedule/year, calendar out of range, required session missing, a source returning a wider future range, raw vs adjusted, invalid price and currency mismatch. Verify start/end/current cutoffs independently.
4. FX fixtures: real pair-key shape and positive complete provenance; missing/partial/future snapshots; one pair older than another; a later fetched revision; same-currency no FX; original-currency subtotals survive target gaps. No fixture changes asOf to masquerade current FX as historical.
5. Late-refund IPO and all existing canonical/F fee boundaries: allocation only, execution-backed dedup, covering short, reverse, partial/full disposal, later autonomous buy/sell, unknown fee/cost/quantity and statement knowledge. Fee-pool reuse must match independent components at each epoch.
6. Closed rounds and exclusive long/short/IPO are subsequent projections of the same trace, not additional ledgers. Keep P4's closed-round net/fees separate from HP02 period mark-to-market net. Mixed IPO/manual partial disposal still needs an explicit attribution policy and trustworthy provenance; the classifier may not change canonical cost. Source paths and pending policy are detailed in `P2-P4-DATA-PLAN.md`.
7. Measure explicit-live synthetic 1866×365 plus a bounded mixed-knowledge fixture, one build and repeated queries. Save three raw timing samples, peak/bounded cache counts, canonical preparation/transitions, source query counts and full equality. Do not run 365 full builders as a benchmark or falsify legacy live nature. Then root separately accepts finance, actual UI journey and visual fidelity; these gates do not substitute for each other.

## 8. Reproduction commands and remaining decisions

All commands ran from `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview` using the pinned native Node, no full suite:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/isolated-single-projection.vitest.config.ts
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/market-fee-coverage.vitest.config.ts
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-cutoff.vitest.config.ts
```

First two configurations serialize passing measurement probes; third intentionally preserves 3 current-quote REDs. Rerunning an evidence probe writes its same named generated JSON, so retain this version/manifest before any authorized future retest. No product typecheck/lint was necessary for this documentation/diagnostic-only change, and none is claimed.

Pending root decisions for later implementation: resolve current F quote reds first; choose historical FX availability/freshness and retrospective-vs-application-known semantics; authorize the minimal shared canonical seam and performance budget; define mixed acquisition attribution where source links are absent. The lack of a full daily FX archive is a coverage limitation to expose, not permission to silently change approved missing-data behavior. P2–P4 and the browser acceptance gates remain unimplemented/unverified by this preparation.
