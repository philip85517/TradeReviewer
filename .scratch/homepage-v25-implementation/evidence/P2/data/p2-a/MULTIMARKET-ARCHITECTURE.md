# Read-only architecture decision: complete output within a 64 MiB retained cache

2026-10-23. **Proposal only; no source implementation or further benchmark.** Root stopped after two authorized performance candidates. The frozen numerical implementation is described in `FREEZE-REPORT.md`. The primary single-group3-cold samples pass; the required three-market distribution does not. No UI/series/canonical formulas may be changed under this discussion.

## Decision offered for review

There is a concrete design for immutable sharing without changing public fields or numerical policy. There is **not yet evidence that it will fit 64 MiB or meet either performance limit**. The exact rejected batch estimate was not captured; no defensible remaining-byte headroom can be calculated. Root should choose whether to authorize a bounded sharing experiment, change the engineering budget, or accept the current performance limitation. No further change is authorized by this document.

|Option|Public API / numerical policy|64 MiB feasibility|Repeat ≤200 ms|Cold ≤2 s|
|---|---|---|---|---|
|Exact immutable public-graph sharing|Unchanged fields, semantics and identity on cache hit|Plausible; unmeasured|Conditional on the full graph fitting; measured existing hits are 1–3 ms|Unmeasured; fewer conversions/allocations may help|
|Compact computed batch → full materialization|Fields can remain unchanged; repeat identity guarantee would need explicit review|Unmeasured; all compact tables and retained outputs count|Unknown; allocation/freezing of full output remains|Unknown; extra representation may increase cold work|
|Raise budget, e.g. 128 MiB|Same fields and numbers; changes approved memory policy|Likely more headroom; exact required retained size unknown|Expected to restore hits only if admitted, not yet measured|Does not remove the observed 2.97 s work|

The recommended first option is an engineering hypothesis with a narrow write boundary, not a claim of demonstrated feasibility. Even a memory win alone cannot establish the cold-time target.

## Observed limit and fields responsible

`41-final-multimarket.json`: three groups, total1866 original fills,365points,743quotes,365datedFX observations. Exact canonical work remains only3sweeps/1866transitions and0legacy calls. Cold2972.63ms; repeat about3s with batchCacheHits0. Live cache is emptied because `ProjectionMemo.set` retains an oversized public batch, evicts other entries while trying to get below64MiB, then rejects the candidate. That admission policy amplifies repeat recomputation. No further diagnosis benchmark is needed to establish the missing hit; live counters prove it. The exact candidate byte total is not currently exposed, so this report does not invent it from final cache0.

Actual serialized output is29,038,003bytes, only1,336,902bytes above the single-group27,701,101. Serialized bytes understate JS objects and the conservative graph estimate. The extra group metric/evidence objects matter more than that wire delta. `44-retained-field-model.json` is an offline static allocation/count calculation using the unchanged fixture distribution, not a new projection timing or heap profile:

|Public graph element|One group|Three groups|Implication|
|---|---:|---:|---|
|Point aggregate metrics|4015|4015|11metrics×365|
|Per-instrument metrics including canonicalKnownFees|4380|13140|12×group×365;8760extra metrics|
|Total historical metric calls|8395|17155|Current is additional and small|
|Fresh objects per metric|5 without FX|6 with FX|metric,coverage,reasons array,money,originalByCurrency,optional FX provenance|
|Total selected execution ID slots over365points|341660|341660|Total fills/distribution are unchanged by grouping|
|Endpoint executionIds + actual-fee IDs + current IDs|685186slots|685186slots|~16,444,464 estimated bytes at24/slot before array objects; original string backings already accounted in source/index|
|FX provenance objects created by metric calls|none in primary noFX case|up to17155|Same endpoint id/source/asOf/status allocated repeatedly across metrics|

Other fresh objects include opening/endpoint evidence, quote/FX coverage, lifetime unknown rows, native subtotal maps and reasons. Root/property margins are intentionally conservative:256/node base,96+2×key length/property, primitive string payload40+2×length, array24/slot and graph-child bookkeeping64. The current estimate counts equal-but-new metadata objects separately. This is appropriate until the implementation actually shares those objects; it must not be reduced solely to produce a green number.

For scale only, the frozen estimator charges **256 bytes per empty reasons array** and **508 bytes per `{total,available}` coverage object** (base256 + properties/primitive fields252). Sharing 17,155 identical empty arrays down to one would remove about4.39MB of that estimate; sharing complete coverage objects down to the few exact distinct value pairs could remove about8.71MB. An FX provenance object costs at least676 estimated bytes before its four primitive values, so sharing17,155 instances down to365 endpoint objects could remove at least11.35MB from that component. These are **conditional static component calculations**, not measured savings, not an exact retained-size prediction, and not an assumption that every production reasons/coverage value matches. Extra interner keys/tables and parent reference bookkeeping must also be charged. Full metric sharing could remove additional object graphs, while nonmatching unknown evidence must remain distinct.

Source13,933,098/index37,447,760 estimates are separately reported. They cannot become a home for computed batch results to avoid the memo limit. Post-serialization heap264,773,792 is process/GC dependent and includes materialized batches, input and indices; it does not establish the exact retained batch size or a leak. No claim that the64MiB estimate equals64MiB process heap is made.

## Recommended bounded change: share immutable public metadata before considering compact output

Keep the complete public API and the existing canonical path. Add a **batch-local immutable value interner** in the F file, then admit the resulting public graph to the same budgeted memo. It must not be a permanent source/index cache. All retained interner keys/tables and values count toward the same64MiB while needed, or the construction table must be discarded before admission. When the public object is retained, graph accounting counts each actually shared object identity once. When evicted, every query-only object becomes collectible with no out-of-budget last-result reference.

Exact sharing candidates, in descending clarity:

1. Empty frozen reasons arrays and identical `{total,available}` coverage objects. Distinct total/available must remain distinct; an incomplete group never shares the complete coverage value accidentally.
2. One frozen FX **provenance** `{id,source,asOf,status}` per actual endpoint/current snapshot, shared by money fields. Do not merge across endpoint dates or different evidence clocks. FX coverage/pairKnowledge remains its full original structure; no substitution of latest history.
3. Identical frozen native subtotal objects and money metadata **only with exact complete content equality**, including target/conversion/FX provenance. Zero with coverage0 and known zero with eligible exposure can share the primitive value, but not an entire metric unless coverage/reasons also match.
4. Entire metrics for exact identical amount/dependency context. ClosingUnrealized and unrealizedNet derive from the same `cuf` Amount; they can reuse one complete immutable metric instead of recomputing it. Other sharing must include value, available, coverage, reasons/order, native currency subtotals, target, conversion and full FX metadata. Never deduplicate merely by numeric value or display label.
5. Truly identical opening/endpoint coverage and evidence only when all knowledge cursor/lineage/source fields match. A stable opening context across365 endpoints is a useful exact object, but late knowledge/cursor-sensitive statement contexts must not be merged. Evidence executionIds and feeFactIds remain complete public arrays; no lazy getter that drops serializable data.

The existing metric function can remain the policy oracle; a projection-only factory can reuse its complete result or skip duplicate calls on the exact same Amount object/FX context. Quantity/cost/fee math and strict coverage remain untouched. This may reduce cold allocation/conversion and graph-accounting work as well as retained size. If the complete shared batch fits64MiB, repeats return the same frozen graph with no materialization, so the already measured1–3ms hit behavior makes≤200ms plausible. **This is a conditional engineering hypothesis, not a measured guarantee**; the cold2s target also remains unproven until the three-market cold work is remeasured after root authorizes a change.

Separate admission correction: measure candidate incremental retention before evicting unrelated entries; if the candidate alone cannot fit, reject it without destroying the working set. It is a finite memo policy change, not sufficient by itself for≤200ms when the full requested graph remains oversized. Keep all measurement counters honest and preserve the oversized case. It should not be bundled as a reason to hide the original miss.

Proposed write boundary if authorized: F source/test and new P2 data evidence only. No new canonical seam, no series/UI/provider/FX storage changes, no shared formula changes. One task remains P2-A0/3; this is not a new ticket or a third speculative candidate under current authorization. Root must explicitly choose the follow-up scope and budget.

## Alternative: compact internal batch with repeat materialization

Keep a compact immutable table of group numeric states, policy/coverage/reason dictionaries, per-endpoint indices, native amounts and original lineage selection ranges. All computed tables and interned strings/indices count toward the same memo budget. Source/index may only provide the captured original evidence and prepared canonical checkpoints already justified; no query answer can be relabeled source data.

A repeat would materialize the complete current public field graph from that compact table without canonical replay, Decimal conversion, calendar or knowledge scans. All685186 ID slots must still be emitted, every metric/native subtotal/coverage/FX source must still exist, and all returned objects must be frozen. It cannot return a promise, drop evidence, use lazy nonserializable vectors, or silently mutate an earlier result. The repeated object need not have identical identity if the contract is explicitly adjusted to immutable content equality, but existing identity tests and diagnostics semantics would need root review.

This is riskier than sharing the public graph: it adds a second representation, a materializer and more equivalence surface (unknown/null/coverage/order/source fidelity). It is **not** another financial ledger if it only stores immutable results of canonical/F calculations; it must never evolve quantity/cost/fee state. There is no present evidence that full allocation/freezing of~17k metric roots plus~685k ID slots can complete within200ms on this runtime. Serialization alone took168.74ms (a different operation and not a lower bound on materialization), so≤200ms should not be promised without an isolated authorized experiment. A compressed core may fit but fail repeat latency.

If selected, keep the materializer private in the F module initially; avoid a new consumer-facing API or a separate series ledger. Verify full field-by-field equality to the frozen numerical batch in both query orders and unknown scenarios before considering performance. Count core, dictionaries, tables, retained outputs and construction metadata together; do not retain both a large public graph and the compact table out of budget.

## Alternative: raise the retained budget

An explicit128MiB (or measured required value plus margin) budget could retain the current three-market graph without restructuring, preserving the API and numerical policy. It would likely restore batch hits but does not itself reduce first cold2972.63ms. Larger heaps, multiple prepared handles and up to4 ranges multiply process retention; actualheap exceeds the cache estimate because sources, indices, caller inputs and temporary serializations are separate. It also changes the frozen engineering contract, so root/user approval is required before implementation. **No budget increase was executed or recommended as an implicit workaround.**

## Oracle and measurement plan after an explicit decision

Preserve all frozen4file hashes and every old RED/MISS. First RED the chosen exact behavior: object identity sharing with full content equality and an oversized admission preserving prior live entries, or compact materialization complete equality. Verify originalF100/canonical33 bytes, complete wrapper and current matrices, strict per-instrument gap policy, all six tooltip fields, actualfee Jan8/10/20 clocks, month/date/unknown fees, historical FX missing/conflict/future/current independence, caller/returned mutation and LRU/bytes.

Then use the same unmodified1866×365 fixture distributions. Coordinate a quiet CPU window for fresh-handle3cold samples and3same-context repeats, report all work/counts, retained/source/index and actualheap/serialization separately. Main single group and all-buy long prefix must remain green; the exact three-account/market failing fixture must satisfy the chosen contract rather than be shrunk. Attached late-refund remains exact and order-safe, with its actual count/timing and no claim of ordinary-sweep complexity. If the authorized hypothesis fails, stop with the measurement; do not continue random sharing variants to find a lucky green sample.
