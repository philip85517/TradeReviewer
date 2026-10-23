# Conditional canonical seam, following the F-only performance miss

This is a proposal only. `app/lib/replay/position-ledger.ts` remains unchanged. Root authorization is required before touching it or its tests. P2 unified acceptance remains 0/3. This proposal does not authorize series/UI or P4 attribution.

## Observed reason

The ordered 1866-fill/365-endpoint probe enters one batch API call, not 365 public F builder calls. Upstream real summaries/library cost 100.62ms; content capture/index preparation costs 227.02ms. Batch exceeds the independent 15s wall bound. At its last progress write it has attempted 1100 canonical invocations, with 604450 selected-prefix members and 13.28s elapsed. The spy calls through to real `replayPositionAtPrice`; counts increment before invocation. The watchdog stops the whole child process group at 16.69s total. No final amount or repeat duration exists for this run.

F exact-context memo eliminates repeated *identical* ordinary prefixes and fee checkpoints. It cannot eliminate the different prefix required before each next fill. At canonical `position-ledger.ts:100–159`, every invocation re-collects attached events/positions, builds/sorts the whole timeline and selects context; at :181–439 the same evaluator replays each requested prefix. Thus even an ordinary source with no statement evidence retains approximately O(N²) prefix work plus N repeated timeline constructions. Memo hits are not linear transition counts. The observed budget miss is much larger than timing instrumentation overhead, but it is a bounded diagnostic lower bound, not a completed benchmark.

## Smallest safe extraction

Keep one canonical evaluator in `app/lib/replay/position-ledger.ts`. Extract its existing preparation, transition and finalization blocks without changing formulas or gates. The legacy `replayPositionAtPrice` must delegate to those same blocks. Do not create `ledger-fast.ts`, copy average-cost equations into F, or use separate long/short/IPO ledgers.

Proposed additive API in that same file:

```ts
type PreparedPositionLedger = opaque; // immutable source/timeline/identity
preparePositionLedger(source): PreparedPositionLedger;
replayPreparedPositionBoundaries(prepared, requests): CanonicalBoundaryResult[];
// Read-only observation of an actual canonical transition:
// request context, movement identity, before/after quantity and knowledge,
// cumulative gross realized/canonical fees, and evidence references.
```

First bounded optimization: sources with **no attached statement position/event/opening evidence anywhere in original lineage** can use one canonical sweep over ordered fills. Record boundary checkpoints and the before/after transition facts in that same sweep. F retains its existing fee-pool equation but consumes canonical before-quantity facts instead of making one canonical call per prefix. Costs and gross realized continue to come exclusively from the evaluator. This exact guard matters: a future carrier can contain already-known early evidence; checking only currently selected fills is unsafe.

For attached sources, keep the existing exact-context path initially. A prepared timeline alone can remove collection/sort work but must not imply a reusable financial state. Knowledge cursor, selected actual fills and their original lineage, execution-backed IPO suppression, actual instrument currencies, same-day/month ambiguity, positions/coverage and cash/refund visibility all affect canonical meaning. Late refund can change the evaluation of a historical allocation in a later request. A forward-only latest-state sweep must not backfill that result into earlier endpoints. Extend an observer fast path to these sources only after exact-context oracle tests prove equivalence; report its slower complexity separately if it remains a fallback.

The attached fee path is especially sensitive: F currently computes its before-step snapshot with a precise event/position prefix and late cash knowledge. A generic final-request transition observer is not automatically equivalent to that before-step input. Do not substitute it until matching context has been proved. No new lot/disposal links exist; `sourceTradeId` does not justify P4 provenance allocation.

## Files and validation

If separately authorized, minimal additional files are canonical source and its same-name test. F source/test already own the prepared API, fee pool, strict quotes, FX, actual fees and public output. No shared calendar/provider/import/storage changes are needed. No series/UI work is needed to measure the seam.

Before extraction, save explicit RED spy/counter tests: one ordinary source requires a bounded number of evaluator sweeps and no per-fill public canonical replay, while numerical snapshots equal the existing wrapper at selected prefixes and day/instant boundaries. Then retain all prior F3 tests plus new batch tests. Include average-cost/reverse/partial/unknown/duplicate/simulation scope, date-only selections, statement opening/closing/transfer/bonus, IPO cover-short/reverse/partial/full sale, execution-backed allocation, and Jan8/10/20 late knowledge in both query orders. Never assert only net conservation; compare quantity, known-cost/known-fee flags, grossR, canonical fees, netR/openFees/netUF and reasons/evidence separately.

Measure ordinary 1866×365 cold/repeat with three clean new handles; real pipeline upstream separately. Report true transition count, canonical context count, source/index bytes, retained cache bytes/entries/eviction, heap delta, serialization and final oracle933/currentMV0. Then measure a bounded attached late-refund variant and multiple markets/accounts. Root target remains cold≤2s/repeat≤200ms; no promise that an unmeasured extraction achieves it.

Ordinary-path complexity aim: O(N logN + Q logQ + X logX) prepare, O(N) shared canonical/fee sweep, O(D×G×logQ) quote/endpoint assembly, O(1) same complete-batch lookup. Attached epochs retain conservative affected-prefix replay until proven safe. The current FX scanner, fee-fact per-point scans and unbounded context diagnostic set also need finite retention/indexing before delivery; canonical optimization must not hide these unfinished draft items.
