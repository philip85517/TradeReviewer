# Immutable public graph sharing — bounded candidate stopped

2026-10-23, implementation owner `gpt-6.1-sol / ultra`. Root independently ran the formal benchmark and F141. Correctness has a bounded PASS; performance FAIL remains binding. Formal P2 remains **0/3**. No fourth implementation variant, profile retry, production change after freeze, commit, push, service, browser or database operation was performed by this owner.

## Candidate and freeze

The single hypothesis was that complete immutable public-value sharing could admit the unchanged 365-endpoint graph within the existing conservative 64MiB memo budget, while retaining every financial/public field. A second part of the same admission fix preflights an oversized candidate before evicting the live working set. The financial `metric` oracle and canonical ledger are unchanged.

`ProjectionSharing` interns full public content, including coverage, ordered reasons, native subtotals, FX provenance and clocks. Its same-boundary context key retains exact Decimal input values, reasons and eligibility. The resulting shared graph is recursively frozen. All sharing construction maps are cleared before current-result admission and final batch admission; the memo's temporary shape table is cleared before inserting an admitted value. No computed financial answers were added to source/index storage. The 64MiB estimator, margins, 8192-entry cap, public fields and financial rules were retained.

Only `app/lib/reviews/homepage-v25-performance.ts`, its test file, and new files in this evidence directory were written. The complete candidate patch is in `09-source.patch` and `09-tests.patch`; `14-candidate-freeze.json` records the final freeze, including the last sharing-map clear.

| Frozen file | Bytes | SHA256 |
| --- | ---: | --- |
| `app/lib/reviews/homepage-v25-performance.ts` | 91,696 | `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a` |
| `app/lib/reviews/homepage-v25-performance.test.ts` | 87,824 | `23f73d5a0e7c6758de5ac20f264083562ae41a502e4098b7ee6668e52fab70a8` |
| `app/lib/replay/position-ledger.ts` | 28,876 | `f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126` |
| `app/lib/replay/position-ledger.test.ts` | 43,237 | `21ed853ab8f64526c8faea4b369eda2f70328fb805bdea98fa87e8f801732ea9` |

The original F100 50,705-byte prefix remains `cbe5cb601126413a11183ff5af265f94f620e9b3acec19cc01144e0f92195cf7`; canonical33 32,966-byte prefix remains `67d6d0c33d741398bfa070f69dca5ec829833452edf14e21d1a792ec804d6aef`. The read-only profile analysis rechecked all four frozen files and both prefixes after the diagnostic.

## Correctness evidence

- `02-valid-sharing-admission-red.log`: two expected failures established missing complete-content identity sharing and destructive oversized admission; the separate differentiation test passed. The earlier metadata-fixture error remains in `01-sharing-admission-red.log`.
- `03-sharing-admission-green.log`: all three new tests pass. They cover full-content identity, metadata/FX/coverage separation despite equal displayed numbers, recursive immutability, and non-destructive rejection of an oversized candidate. Existing assertions were retained.
- `11-frozen-F141.log`: 141/141 implementation-owner pass; `root-F141.log`: independent root 141/141 pass on the frozen candidate.
- `12-frozen-equivalence.log`, `07-public-equivalence.json`: six scenarios/twelve queries match every public byte against the frozen pre-candidate implementation, excluding only operational `diagnostics`. Numeric values, currency precision, coverage, reasons, FX clocks, fee facts and complete lineage remain in comparison. Scenarios include complete three-currency/reverse query order, missing/future FX and quotes, unknown fees/date-only/duplicate conflicts/lifetime coverage, simulation scope, later knowledge and empty/future endpoints. The initial invalid period/endpoints fixture is preserved in `07a-initial-invalid-fixture.*`.
- `13-frozen-tsc.log`: targeted source/test and evidence typecheck pass. `05-targeted-eslint.log`: source/test lint pass. After root approval, only the evidence harness's mixed `let` declaration and unused type import were corrected; `16-evidence-lint-corrected.log` passes. Exact measured copies and hashes remain in `15-evidence-lint-before.json`, `benchmark.test.ts.measured.txt`, and `fixtures.ts.measured.txt`. Fixture values, timing, assertions and production code were unchanged.

## Root-independent unchanged-fixture performance

The command root ran was:

```sh
python3 .scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/run-benchmarks.py root-independent
```

This is the historical command, **not an instruction to rerun**. Its output guard prevents silent overwrite. Root owned the quiet CPU window. The worker did not run a competing heavy benchmark. All fixtures retain 1,866 original fills and 365 endpoints; the primary rounds/all-buy long-prefix shapes retain their original 252 quotes, and the three-account/three-market fixture retains 743 quotes and 365 dated FX observations. Entries are constructed through real summaries→entries upstream, timed separately. Cold timing includes both prepare and project. Full-output comparison/serialization occurs afterward. Gates remain cold ≤2000ms, each exact repeat ≤200ms and actual memo admission ≤67,108,864 bytes.

| Shape | Fresh cold samples, ms | Exact repeat range, ms | Actual memo bytes | Result |
| --- | --- | --- | ---: | --- |
| rounds | 1128.985607 / 1168.610030 / 1139.703609 | 0.863808–5.623950 (nine repeats) | 53,026,188 | three cold/repeat samples PASS |
| all-buy long-prefix | 1080.099637 / 1080.806027 / 1098.117899 | 1.207585–1.991084 (nine repeats) | 53,658,846 | three cold/repeat samples PASS |
| three-account/three-market | **2617.548995** / NOT VERIFIED / NOT VERIFIED | 1.301056 / 0.988668 / 4.642301 | 67,101,836 | **cold FAIL**, repeats/admission PASS; stopped after first miss |

See `root-independent-summary.json` and the seven `root-independent-{shape}-{sample}.json/.log` pairs. Multimarket samples 2 and 3 were not run and remain NOT VERIFIED. No failed sample was retried or replaced.

For the failing multimarket cold, upstream was 53.471865ms separately; prepare was 340.287028ms and project was 2277.258983ms. These totals alone did not establish a CPU cause. Actual post-admission inspection, rather than the batch's pre-admission diagnostic snapshot, showed one batch admitted, 496 total memo entries, 604 evictions and 67,101,836 estimated memo bytes. Only **7,028 bytes** remain under the memo cap. Source and index estimates are separately disclosed as 13,933,098 and 37,447,760 bytes; the memo cap is not a claim that the entire handle/heap fits in 64MiB.

The failing run nevertheless passed all 365 independent net-value oracles and complete public-byte comparison: 29,037,709 bytes, SHA256 `566666fef5e824d5bd304bbb9b42c00644ee7c866c007f3b53f29c623c721f86` for candidate and baseline. All 56,962 unique public objects were frozen; the measured metric fields contained 16,060 occurrences/5,110 distinct metric objects. Each exact repeat returned the same batch with zero additional canonical queries. The final net was `55358`; `currentMarketValue: null` was retained exactly from the baseline. This evidence does not waive the cold failure.

## One authorized diagnostic CPU capture

Root separately approved the prepared `PROFILE-PLAN.md`/harness/config, then opened a quiet CPU window. The single opt-in command ran once and exited 0 (`diagnostic-multimarket.log`, one test passed). That window was released immediately after profile capture, three repeats, frozen full-output comparison and the 365 oracle checks completed. `PROFILE-PLAN.md` retains its historical PREPARED status from before authorization; this report records completion. No profile retry is authorized or needed to read these artifacts.

The exact command executed was:

```sh
P2_ALLOW_DIAGNOSTIC_PROFILE=1 /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/profile.config.ts > .scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/diagnostic-multimarket.log 2>&1
```

Do not rerun: the `.started.json` marker deliberately rejects a second attempt. The worker-local inspector sampled exactly one prepare+project after imports/upstream and stopped before repeats, serialization and baseline work. No source instrumentation or fixture substitution was used. Input SHA256 is `befe3b83a976e5016b0602d475f18980a1d323e9d83316073240943f3e2c490c`; request SHA256 is `7e6b24950ade6eb6b41899df76771ad999bb01bf6712908a276fffa9522285e9`, matching the formal failing fixture.

`diagnostic-multimarket.report.json` records 372.153226ms prepare and 2242.143630ms project, 2614.299908ms instrumented cold. **None is a formal threshold sample.** Actual admission, all 365 numeric oracles and full public bytes/SHA matched the formal run. The unpruned 29,038,003-byte `diagnostic-multimarket.batch.json` retains every field, including diagnostics. Its file SHA256 is `520a61f0f94f0c191554855bad73ac379c24fc2da5b75f17f122e81f525d824f`.

### Sampling method and provenance

`diagnostic-multimarket.cpuprofile` has 366 nodes/1,905 samples at requested 1000μs interval. Its SHA256 is `e56e17c2cd52460351bd4126cea69c7da5be1ff2839220f9c40699177d2b8af7`. The weighted `timeDeltas` total is 2650.948ms; inspector elapsed is 2651.501ms. Inclusive time credits each sample once to each distinct function+URL ancestor, collapsing recursive function frames. Self time credits its leaf. Anonymous closures retain transformed positions. Thus inclusive parent/child rows overlap and must never be added.

Read-only `diagnostic-analysis.py` reads the existing profile and frozen hashes; it executes no fixture/product/test code. Its authoritative output is `diagnostic-analysis-v2.json`. The first `diagnostic-analysis.json` remains preserved: a path classifier initially searched for `retained-digest.ts` under `reviews` instead of its actual `recall` directory, placing 53.354ms digest work under remaining preparation. V2 changes only that analysis classification; the raw capture, function totals, performance files and source are unchanged. Both category partitions sum exactly to all weighted samples. Vite-transformed callFrame positions are **not** original TypeScript line numbers.

Weighted samples attribute 346.328ms to prepare, 2201.516ms to project and 103.104ms outside those stacks. The outside total comprises 54.185ms GC (2.04% of all samples), 36.493ms inspector-start overhead (1.38%), and 12.426ms runtime/harness/incomplete stacks (0.47%). GC is not assigned to a phase or allocation owner.

### Quote/session/calendar/timezone inclusive and self

All rows below are inside project. Percentages use the **2201.516ms project sampled weight**, not formal wall time. These are nested inclusive rows, not separate costs.

| Function | Inclusive ms | Self ms | Inclusive % project | Self % project |
| --- | ---: | ---: | ---: | ---: |
| `indexedQuote` | 1424.133 | 185.438 | 64.69% | 8.42% |
| `requiredMarketDataRange` | 1228.700 | 0 sampled | 55.81% | 0 sampled |
| `latestCompletedSession` | 1214.549 | 31.702 | 55.17% | 1.44% |
| `marketLocalTimestampToIso` | 1047.457 | 30.325 | 47.58% | 1.38% |
| `marketTimeParts` | 1017.132 | 1017.132 | 46.20% | 46.20% |
| `marketTradingDate` | 36.241 | 36.241 | 1.65% | 1.65% |
| `expectedTradingDates` (project only) | 70.283 | 70.283 | 3.19% | 3.19% |

`indexedQuote` is 53.72% of the complete capture; `marketTimeParts` is 38.37%. An additional 3.083ms `expectedTradingDates` weight belongs to prepare. Zero sampled self time for `requiredMarketDataRange` means no leaf sample was attributed there, not that the function takes zero time.

Read-only source corroborates the path: `homepage-v25-performance.ts:727` calls `requiredMarketDataRange` for every group/opening/endpoint quote. `sync-range.ts:98` computes completed sessions and converts regular/session close times through `marketLocalTimestampToIso`; `providers/errors.ts:21` constructs an `Intl.DateTimeFormat`, formats to parts and builds the parts record on each `marketTimeParts` call. `indexedQuote` itself also constructs an `Intl.DateTimeFormat` for local day selection. Native Intl work may be charged to these JS caller frames. The profile does **not** separate formatter construction, native formatting, `Object.fromEntries` or native allocation cost.

Actual counters show 2,193 quote lookups and 366 FX lookups. Source loop structure explains the quote count for this exact nonfuture fixture: 365 endpoints × three groups × opening/endpoint calls, plus three current calls. The same three opening group/cursor lookups are therefore requested 365 times each. The counter proves quote requests; sample counts do not prove formatter/session function invocation counts or per-opening versus per-endpoint CPU shares.

### Disjoint projection and preparation attribution

For these tables each sample is assigned to its deepest recognized owning path once. Unlike inclusive rows, each phase table sums to 100% (rounding aside).

| Project category | Weighted ms | % project |
| --- | ---: | ---: |
| Quote selection/session calendar/timezone | 1424.133 | 64.69% |
| Memo/preflight/retained graph accounting | 186.356 | 8.46% |
| Sharing keys/probes/content interning, excluding metric/freezing | 117.311 | 5.33% |
| State/prefix-key assembly outside ledger and graph | 101.262 | 4.60% |
| Unchanged `metric` money/FX oracle | 92.179 | 4.19% |
| Prepared canonical ledger queries | 90.414 | 4.11% |
| Execution prefix selection | 47.927 | 2.18% |
| Fee facts/selection/assembly | 40.234 | 1.83% |
| Remaining endpoint/current assembly | 31.164 | 1.42% |
| Public graph freezing | 30.329 | 1.38% |
| Dated FX selection/provenance | 13.590 | 0.62% |
| Native amount construction | 12.368 | 0.56% |
| Lifetime coverage assembly | 8.147 | 0.37% |
| Public evidence assembly | 6.102 | 0.28% |

Useful overlapping function totals: sharing closure inclusive 217.743ms/self 32.361ms; `exact` inclusive 88.482ms/self 80.229ms; `metric` inclusive 92.179ms/self 22.783ms; `fxFor` inclusive 13.590ms/self 5.748ms. `ProjectionMemo.set` inclusive 159.374ms/self 28.667ms, `get` 24.324ms/self 24.324ms, `retain` 24.052ms/self 22.543ms, `release` 2.161ms/self 2.161ms. Projection `shape` inclusive is 104.494ms. Preflight, retain and eviction work are included where their stacks are visible, but the capture does not distinguish preflight Map probes from other `set` self/native work. Likewise sharing self/native work includes JSON key construction and Map probes; 117.311ms is not a proven standalone `JSON.stringify` measurement.

| Prepare category | Weighted ms | % prepare |
| --- | ---: | ---: |
| Stable source/group serialization | 76.902 | 22.20% |
| Source/index permanent graph accounting | 61.913 | 17.88% |
| Source/group digest hashing | 53.354 | 15.41% |
| Remaining group/index/preparation work | 45.699 | 13.20% |
| Canonical checkpoint construction, excluding nested assigned work | 42.149 | 12.17% |
| Source snapshot clone | 26.546 | 7.66% |
| Fee fact/index construction | 25.093 | 7.25% |
| Ordinary fee checkpoints | 14.672 | 4.24% |

`preparePositionLedger` inclusive is 50.686ms/self 4.099ms; 42.149ms in the partition excludes nested work assigned to another category. `accountPermanent` inclusive is 61.913ms/self 17.957ms, with 43.723ms `shape` inside prepare. `shape` across all phases totals 149.611ms inclusive/146.957ms self; 1.394ms has an incomplete owning stack and stays unallocated. Source/index grouping and some native/Decimal work remain within the 45.699ms remainder. The capture does not resolve every allocation or native operation into a unique implementation statement.

## Architecture evidence and remaining limits

The capture establishes that quote/session/timezone work is the largest observed projection branch. It does not support blaming the batch total on sharing serialization, financial conversion, or graph accounting. Each of those now has a measured, smaller category; none can simply be removed without preserving its semantics.

A future separately authorized design can first examine reuse of identical opening quote/session calculations within a request. The source and the 2,193 lookup counter establish repeated identical opening group/cursor inputs. Any such design must preserve the exact market/cursor, captured quote revision, completed-session/early-close/calendar policy, stale/missing-session coverage and errors, and every returned public field. A request-local immutable context must either count retained tables in the same budget or discard them before admission; it must not store financial answers in source/index. Formatter reuse is another hypothesis suggested by source/native caller time, not a measured split or an implemented fix. The present capture cannot predict saved milliseconds or guarantee the ≤2s gate.

The legal key depends on the proposed shared value, and remains a design constraint rather than implemented code:

- A completed-session/local-calendar context must identify the supported market, resolved market timezone, **full effective cursor/instant and effective `now`**, `open`/range mode, and calendar/session-schedule/early-close/timezone-conversion policy revision. If the entire `requiredMarketDataRange` result is reused, its complete first/last-trade arguments must also match; reusing only its session end is a narrower contract. Within a single request, a lexically closed immutable calendar/policy snapshot can supply the revision scope, but that does not justify reuse across requests or revisions. In today's calls `now = new Date(boundary.cursor)`; that equality must be proved by the caller, not assumed for a generalized helper. Preserve whether a cursor was resolved from a day boundary or supplied as an instant when that distinction changes the effective arguments.
- A date-only key is insufficient. US DST changes UTC offsets, and instants on the same market-local date can fall before or after regular/early close. Do not merge a previous-day opening cursor, endpoint cursor, clamped `asOf`, or current cursor merely because their displayed business dates match. HK/CN and US contexts cannot be merged by the current offset or an apparent calendar-date coincidence. Future endpoints must retain their existing future handling and visibility cutoff.
- Supported/unsupported market and calendar outcomes are part of the result. Preserve out-of-range calendars, missing verified session schedules before close, no completed session, and `CalendarOutOfRangeError` mapping to `calendar-unavailable`/`quote-session-unavailable`; do not reuse a supported-market success for an unsupported market or turn an unavailable-calendar result into complete coverage. Error behavior must remain tied to the identical effective inputs and policy scope.
- A session context may share the required completed-session date and market-local day. It does **not** alone authorize sharing a selected quote or full `QuoteCoverage`. Those additionally depend on the exact group/instrument, currency validation, immutable captured quote/index identity or revision, raw adjustment eligibility, duplicate-date ordering, selected quote/provider/content and relevant quote-selection policy. `missingSessions` depends on **that selected quote's trading date**, the required completed session and calendar policy. Instruments with different latest available quote dates must retain different missing-session arrays, stale/invalid/missing states and ordered reasons even when market/cursor are identical. Financial values, fees, FX clocks, execution evidence and lifetime coverage cannot be inferred from a shared session context.

No further candidate is implemented or proposed for immediate execution. A later architecture decision would require root authorization, focused boundary tests (DST, verified/unverified early close, before/after session close, unavailable calendar, stale/duplicate/missing quotes), full public equality and the unchanged fresh 3-cold/3-repeat matrix. The 64MiB/2s/200ms gates, historical failures and remaining multimarket samples remain unchanged. Root retains independent acceptance; this report does not accept P2 or dependent UI/series delivery.
