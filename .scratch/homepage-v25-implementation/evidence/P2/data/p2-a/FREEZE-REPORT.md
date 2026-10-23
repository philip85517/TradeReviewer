# P2-A frozen numerical implementation; multi-market performance discussion required

2026-10-23 03:19 CST. **Not implementation-ready. Not accepted. P2 remains 0/3.** Root requested a stop after the two authorized performance candidates. The four allowed product files are frozen. This report supplements, and does not replace, the original F-only miss report, `PERF-V3-MISS.md`, any RED, or the accepted F3 evidence. No series/UI/database/service/provider implementation, browser run, commit, or delegation occurred in P2-A.

## Frozen files and compatibility

|File|SHA256|
|---|---|
|`app/lib/reviews/homepage-v25-performance.ts`|`637f07933247a6d4dbcea5336e946e68b98e3ff5fe7ddc39e24ff194d79e8c4b`|
|same-name F test|`f6d26840afd1a5bbc3dacf1151a05c6e947b14e20df4ffd31c8b91c95f04e683`|
|`app/lib/replay/position-ledger.ts`|`f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126`|
|same-name canonical test|`21ed853ab8f64526c8faea4b369eda2f70328fb805bdea98fa87e8f801732ea9`|

The original F3 100-test prefix is **50,705 bytes unchanged**, SHA `cbe5cb601126413a11183ff5af265f94f620e9b3acec19cc01144e0f92195cf7`. The original canonical 33-test prefix is **32,966 bytes unchanged**, SHA `67d6d0c33d741398bfa070f69dca5ec829833452edf14e21d1a792ec804d6aef`. The separate new `vi` import appears after that original F prefix. Frozen baseline source/test copies and the original numerical oracle output remain in this directory. `freeze-manifest.json` supplies byte hashes, exact commands, log exits, fixtures and evidence hashes.

Canonical extraction was explicitly authorized in `ROOT-CANONICAL-AUTHORIZATION.md` after the F-only >15s miss. One evaluator now backs both the legacy `replayPositionAtPrice` and the prepared ordinary checkpoints. Cost, quantity, gross realized, uncertainty flags, fees and finalization formulas remain canonical. Checkpoints retain private full-precision Decimals. The additive observer exposes only serialized before/after quantity facts to the existing F fee pool. F does not implement another cost ledger.

Only complete original-lineage evidence-free uniquely timed sources take the one-sweep path. Attached statements/opening/position events, including future carrier evidence, duplicate IDs/ties and nonprefix selections use the same exact evaluator. Legacy explicit `visibleExecutionIds` that select after cursor remain supported exactly. Ordinary unknowns preserve legacy flags and placeholder behavior; they are not repaired by fabricated zero profit.

## Verification evidence

Fixed runtime: `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`, Node `v26.0.0`. Commands are targeted and run without any service or database.

|Evidence|Result and scope|
|---|---|
|`01-api-red.log`|Initial additive API RED: 10 new failures, original 100 F tests PASS|
|`12-canonical-original-oracles.json/log`|Original canonical full numerical snapshots captured before extraction|
|`13-canonical-seam-red.log` → later canonical GREEN|Traversal/API RED preserved; additive canonical suite now 39 tests|
|`15-fast-current-lru-red.log`, `18-complete-equivalence.log`, `22-fee-fx-source-red.log`|Original failures retained; current/complete endpoint/evidence/FX cases covered by final GREEN|
|`32-shared-memo-red.log`|Observable repeated state serialization: 21 occurrences versus budget0|
|`35-fee-index-red.log`|Repeated exact fee knowledge timestamp parsing: 103 versus bounded endpoint-independent budget|
|`37-fee-boundaries-green.log`|F source suite **138/138 PASS**, exit0, 2.17s|
|`38-final-tsc.log`|Strict targeted tsc on all four allowed source/test files, exit0|
|`39-final-lint.log`|eslint on all four allowed files, exit0|
|`40-final-regressions.log` + `final-regressions.vitest.config.ts`|**20 files, 403 tests PASS**, exit0, 10.55s; F3 accepted probes, original ledger, IPO-cost, episodes/library, statement evidence, scope, calendar/trading-date/sync-range and holdings model|
|`43-final-variants.log`|Two finite measurement/correctness probes PASS; this is **not** a pass of their performance target (multi-market MISS below)|

The complete-current compatibility matrix compares every existing metric and `evidence.current`, including invalid/negative prices, currency mismatch, first duplicate-day selection, wrong instrument ID, future and weekend rows, in-progress session, unsupported market and calendar range. The current money FX metadata is compared against the legacy wrapper without substituting a manufactured snapshot id/source/asOf.

The complete endpoint matrix compares full existing metric structures and opening/closing evidence to F3 for partial long, average cost, short, reversal, unknown fee/history, malformed price/fee, identical and conflicting duplicate lineage, ties and a date-only nonprefix case. F3 parity is asserted for complete/legal carry cases; P2 strict-gap nulls are intentionally tested separately rather than represented as F3 parity.

Additional assertions cover selected-period10 versus lifetime30; native difference then one endpoint FX80 rather than mixing two FX conversions; missing/future/conflicting historical FX with native subtotals retained; strict per-market gaps without erasing independent realized/fees/other native evidence; legitimate unfinished/closed carry; future endpoints; independent current; caller-input and returned-result mutation; content changes despite unchanged caller revision; whole-request validation; actual-fee month/day/unknown/start/precise-knowledge edges; four-batch LRU promotion/eviction; live cache diagnostics distinct from frozen construction diagnostics. These are worker numerical/regression results, not root acceptance or UI evidence.

## Two authorized performance candidates

All old failures remain. `PERF-V3-MISS.md` records the original canonical-sweep three samples at cold2945.84/2938.31/2913.29ms (all MISS), with 365 numerical oracles correct and no repeated legacy replay. The profile identified repeated whole-state JSON size computation and repeated fee knowledge parsing, rather than canonical cost equations, as avoidable work.

Candidate1 changes retained-memory accounting only: object-identity/refcount sharing, conservative object/property/array/bookkeeping margins, a separate captured-source/index estimate and a reserve for private canonical checkpoints. It eliminates whole-state JSON serialization on memo admission. Its first array model overcounted packed array slots as individual named properties and rejected the whole batch; that raw failed measurement is retained. Correcting that accounting model is recorded as `candidate1-packed-array`, cold3644.12ms, repeat1.36ms: still a cold MISS.

Candidate2 adds an ordinary incurred-fee prefix index only when every fact is an exact, complete, reason-free execution fee, with equal amount/attribution/availability times and monotonic actual day/knowledge. Monthly/coarse-day/statement/unknown/late-knowledge sources keep the original exact path. No canonical/fee-pool equations, public fields, endpoints, evidence or session policy were removed. The fixture budget was corrected explicitly from2 to3 because the one final visible-fee evidence pass legitimately calls `Date.parse` three times; twenty historical endpoints add none. The earlier invalid RED variants (`vi` missing and a nonnormalized timestamp comparison), and the intermediate incorrect2 assertion, are retained and do not stand as valid causal RED.

## Single-group engineering target: three consecutive clean passes

Root and integration paused heavy work for this window. Notification began 03:11:41 CST; actual first fixture began **03:11:59.153**, final window ended **03:12:29**. Each sample is a new Node/Vitest process and handle, with the same frozen four product files. They are not retries replacing a failed sample. Original candidate and failed formal samples remain distinct.

Real pipeline: `buildInstrumentTradeSummaries → buildTradeLibraryEntries → prepareHomepageV25Source → projectHomepageV25Boundaries`. Controlled explicit-live, unique original lineage, 1866 fills, one US instrument, 365 endpoint days, 252 valid raw session quotes; no database. The old production/isolated 1866 unknown-scope records were not relabeled. Alternating buy1@100/sell1@101, fee0, mark110: independent oracle for each visible-prefix length n is `floor(n/2)+(n%2?10:0)`, finalnet933/currentMV0.

|Fresh sample|upstream ms|prepare ms|batch ms|cold ms ≤2000|repeat ms ≤200|365 oracles|
|---|---:|---:|---:|---:|---:|---|
|`final-1`|94.57|366.46|865.36|1232.22 PASS|1.89 PASS|PASS|
|`final-2`|92.56|358.74|845.65|1204.75 PASS|2.24 PASS|PASS|
|`final-3`|94.61|367.60|864.84|1232.80 PASS|1.29 PASS|PASS|

Maximum cold1232.80ms, median1232.22ms; maximum repeat2.24ms. Cold includes prepare+all365 endpoints+independent current from already resident entries, excluding upstream and JSON serialization, which are reported separately. Each sample: prepare1, sweep1, **1866 canonical transitions, 366 prepared queries, 0 legacy evaluations**; repeat adds0 canonical queries and live batch hit increments1.

Live retained memo estimate **67,096,768 bytes** ≤67,108,864 (64MiB), 140entries, 228evictions, 1 full batch; source17,165,242 and index37,246,434 bytes separately. Baseline heap31.17–31.25MB, after prepare49.54–57.92MB, cold64.34–69.97MB, after repeat plus JSON serialization100.73–107.71MB. The last field named `heapAfterRepeat` is captured **after serialization** in the runner, not an isolated repeat heap. JSON is27,701,101bytes and takes121.33–130.69ms. Heap is process/GC dependent and includes caller inputs/output/source/index; it is not the memo estimate or a proof that total process memory is bounded64MiB.

Additional single-group all-buy long-prefix probe `benchmark-v3-long-prefix-final-long-prefix.*`: cold1191.67ms/repeat1.49ms, 1866transitions/366queries/0legacy, all365 independent `10*n` oracles correct, finalnet18660/currentMV205260, memo67,047,492/source11,209,606/index37,321,748 bytes. This finite extra probe does not replace the three preceding samples.

## Required multi-market distribution: explicit MISS

`41-final-multimarket.json`, `final-variants.test.ts`, `43-final-variants.log`: same total1866 explicit-live original fills, three accounts/instruments/markets (US/HK/CN-SH, 622fills each), all-buy1@100, 365 endpoints, 743 valid session quotes and365 controlled historical FX observations with explicit publication/knowledge/fetch evidence. These FX rows are synthetic benchmark evidence, not claims about real archived FX availability. Every one of365 converted net values matches independent visible native counts (`USDcount*70 + HKDcount*9 + CNYcount*10`), finalnet55358.

Cold **2972.63ms MISS** (prepare379.39/batch2592.13); three same-request repeats **2951.56/3016.77/3024.79ms MISS**, returning newly materialized objects. These repeats were one predeclared finite probe, not further optimization candidates. The numerical test passes because it asserts all365 values and bounds; it does not assert or imply the performance target.

The complete three-group public result exceeds the conservative64MiB retained estimate, so it is not admitted. Current admission also evicts prior memo entries while determining that oversized candidate cannot be retained: live cache0/batch0 after each query, evictions1099 after first and4396 after three repeats. This explains the absence of a batch hit. Canonical remains exactly3 sweeps/1866transitions/0legacy; source13,933,098/index37,447,760 bytes. JSON29,038,003bytes/168.74ms; post-serialization heap264,773,792bytes includes multiple materializations and uncollected garbage, not a retained-cache leak measurement. The single-group target passes **do not** satisfy this broader required distribution. No budget increase, field deletion, source/index relocation, fourth performance candidate or ledger expansion was made.

## Attached late-refund correctness and finite measurement

`42-final-late-refund.json`: one fill, four original statement events, three quotes, two endpoints, no historical FX. Prepare6.23ms/firstbatch11.61ms; three exact batch repeats0.235/0.062/0.035ms. Exact fallback has0sweeps/0ordinarytransitions,10 actual canonical contexts, source41,586/index33,290/memo504,654bytes. Late→early and early→late results agree:

|Endpoint|actual periodFees|net realized|net UF|net|openFees|canonicalKnownFees|
|---|---:|---:|---:|---:|---:|---:|
|Jan18|3|unknown|unknown|unknown|unknown|1|
|Jan22|3|18|9|27|1|3|

The Jan8 fee remains incurred Jan8; the Jan20 refund is principal and does not become a fee credit. Existing source tests separately verify a Jan12 selected start yields actual periodFees1. This tiny attached fixture is not a scalability guarantee; attached contexts still require the exact evaluator and may cost O(prefix work) per distinct context.

## Stop and next decision

Root instructed: freeze and submit one architecture discussion, not a new repair. `MULTIMARKET-ARCHITECTURE.md` compares immutable public-object sharing, a budgeted compact cache with repeat materialization, and increasing budget. It identifies fields/object counts and risks without claiming unmeasured≤200ms feasibility. No additional benchmark is authorized or run after root's stop.

Numerical/compatibility verification is GREEN at this freeze, but **required multi-market performance remains FAIL**. Root independent acceptance is pending; the worker has not read or changed root's literal oracle file. Real historical FX archival coverage, suspension/provider revision evidence, data fetching, series/UI integration, visual checks, browser journeys and persistence are **NOT VERIFIED / outside this data-only implementation**. No complete P2-A acceptance is requested.
