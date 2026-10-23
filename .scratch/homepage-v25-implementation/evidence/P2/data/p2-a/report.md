# P2-A F-only checkpoint: performance gate not met

2026-10-23. **Not implementation-ready. Not root accepted. P2 remains 0/3.** Product expansion stops here pending root's decision about the proposed canonical seam. Current changes are confined to the authorized F source/test and new P2 data evidence. Canonical, old F evidence, contract baseline, UI, services and databases were not modified by this worker.

## Verified numerical scope

First RED `01-api-red.log`: the ten new API contract tests fail while the original 100 F tests pass. `02-batch-first.log` and `03-fees-checkpoint-red-green.log` preserve intermediate failures. `05-basic-green.log`: 113/113 PASS, including unchanged original F3 100 tests and 13 new prepared/batch/actual-fee tests. The newly added opening fixture was corrected explicitly: a 2025-12-31 US intraday calendar lookup cannot verify pre-2026 half-day hours. The test now opens the selected period on 2026-01-06, with Jan5's completed-session boundary and Jan2 raw120. Canonical calendar unknown behavior remains. The original failing probe and `04-opening-trace.json` are retained; no original F test was changed.

New green assertions cover lifetime30 versus period10, native endpoint-FX80 rather than FX-mixed100, missing historical FX despite current latest, future pair knowledge, strict completed-session gaps with retained fallback/current independence, valid in-progress/weekend carry, future points, immutable captured content/version hashes, whole-request validation, actual Jan8 fees independent of Jan20 knowledge, narrow Jan12 period fee1, unassigned-fee unknown, and ordinary prefix/current reuse.

Independent inherited-neighborhood configuration `09-F3-regression.log`: **19 files, 365 tests PASS**, exit0, 10.65s. This is the previous 352-test configuration plus the 13 new tests. It is worker regression evidence, not root P2 acceptance. `10-typecheck.log` strict targeted source/test tsc exit0; `11-lint.log` the two allowed files eslint exit0. Earlier typecheck failure `07-typecheck.log` is retained; its typed record initializer was fixed before the successful run.

## Performance: explicit bounded miss

The first probe had invalid within-day i%6 timestamp wrap; it was stopped with Ctrl-C exit130. `06-*` source/script/log/notes remain and supply no valid performance/correctness result. Vitest's timeout cannot interrupt synchronous work; the correction is recorded separately in `06-stop-record.md`.

The valid second fixture uses 1866 strictly increasing original explicit-live fills, one real summaries→library pipeline group, 365 endpoint dates and 252 valid US-session raw quotes. It performs no DB access and does not relabel the old 1866 unknown records. `performance-v2.test.ts` asserts strict input order before the real pipeline; `run-performance-v2.mjs` owns an independent watchdog process.

`08-performance-v2.json` / `08-watchdog.json` show:

|Measurement|Observed|
|---|---:|
|summaries→library upstream|100.62ms|
|prepare|227.02ms|
|batch|incomplete; **exceeded15s**|
|last sampled batch elapsed|13281.59ms|
|last attempted real canonical calls|1100|
|selected-prefix member sum at that sample|604450|
|watchdog total wall at termination|16686ms|
|process exit|124 (watchdog)|

This conclusively misses the cold2s target. It does not provide an exact full duration, final933 correctness assertion, repeat200ms, three clean samples, memory completion or multi-market performance. They remain NOT VERIFIED. No second full benchmark was launched after the miss. See `CANONICAL-EXTRACTION-PROPOSAL.md` for the input/output cause and minimal extraction for root review.

## Unfinished draft requirements

The numerical tests are an initial matrix, not all PRE contract oracles. Additional pending work includes independent single-point F3 comparisons, attached early↔late order stress, separate per-market/native evidence tests, fee month/date/attribution/duplicate variants, and cache pressure/retention tests. No root acceptance request is made while these and the performance gate are open.

Source review also identifies finite-draft limitations to resolve before delivery: canonical diagnostic `contexts` retains full unique keys outside the memo budget; the four-batch cap is FIFO rather than access-promoted LRU; fee checkpoint string concatenation needs collision-safe sequence encoding; FX observations are scanned rather than indexed; fee facts are rescanned by each group/point; source/index versus retained-cache memory is not yet measured separately. These are recorded rather than represented as bounded-cache completion. Their fix remains within F scope, but this checkpoint stops at the contract's mandatory performance escalation before spending more implementation work.

Current exposed draft interfaces are described in `INTERFACES.md`. No series/UI consumer should adapt to this draft yet. Functional browser journeys, visual verification, historical production-source FX coverage and real DB timings are NOT VERIFIED and outside P2-A's present scope. The proposed canonical seam preserves one evaluator and the F3 wrapper; it requires explicit root authorization before implementation.
