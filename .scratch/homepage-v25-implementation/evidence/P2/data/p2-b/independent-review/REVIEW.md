# P2-B independent read-only data review — Important finding preserved

2026-10-23. Reviewer `/root/series_bundle_review`, actual **gpt-6.1-sol / ultra**. Reviewed HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344` plus the version-bound uncommitted candidate. This review does not authorize implementation, reopen A, consume an acceptance round, or accept P2/P4.

**Result: Critical 0 / Important 1 / Minor 0.** No new defect was found in B's calendar-only composition during source review. A confirmed qualification/FX defect in frozen A propagates through B and blocks P2/P4 financial integration. Controlled, read-only component preparation can continue against B's stable shape; financial acceptance and release cannot.

## Scope, authority, and versions

Trigger: root requested independent review of B's actual bundle contract and its F/A/canonical-ledger data flow, preserving A's three-candidate freeze and all FAIL/NOT VERIFIED gates. Read AGENTS, development-workflow, task-decomposition, frontend-control-audit, ui-task-templates, issue-tracker; P2-B ROOT-DISPATCH, PREPARATION, implementation-ready and input/output manifests; current B and its 18 tests; PRE-DISPATCH-CONTRACT and coordinator decisions; approved HP02 lines193–252 and HP06; actual called F/A/ledger and summaries/library lineage.

This is a scoped data audit. No rendered UI or all-controls inventory is claimed. Browser, service, network, DB, performance, full-suite and existing-18 reruns were excluded by dispatch. No product/config/dependency/shared-tracker file was edited. Only this directory contains new reviewer artifacts. Existing dirty files were preserved. The test runner uses a new evidence-local config with caches disabled and any Vite cache path constrained to this directory.

|Role / source|Pre-review frozen SHA-256|Post-counterexample SHA-256|
|---|---|---|
|B `app/lib/reviews/homepage-v25-series.ts`|`30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6`|same|
|B frozen18 `app/lib/reviews/homepage-v25-series.test.ts`|`49b799ab415c20898d71c1d29a426ba2d10ff0052ec3defa6f329c224f5474ff`|same|
|A **and F3** `app/lib/reviews/homepage-v25-performance.ts`|`094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a`|same|
|A/F frozen tests `app/lib/reviews/homepage-v25-performance.test.ts`|`23f73d5a0e7c6758de5ac20f264083562ae41a502e4098b7ee6668e52fab70a8`|same|
|Summaries `app/lib/trades/instruments.ts`|`4cc93e949b7d7bceff751e9154376281ca6dacaaf5159ba644aaa7921e33cc23`|same|
|Library `app/lib/trades/library.ts`|`e02ef93ec0866b349d693f412335b41589ac1e180d84a87e7c7895d5b83f3e83`|same|

A's prepared API and the legacy F3 finance functions share one physical file; their whole-file SHA is recorded once, not presented as two independently versioned files. Before values above come from the frozen worker input/output manifests read before the new run. All 19 frozen input-manifest entries were independently rehashed after it and match. Current canonical ledger SHA is `f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126`; its test SHA is `21ed853ab8f64526c8faea4b369eda2f70328fb805bdea98fa87e8f801732ea9`. Ledger hashes were first explicitly recorded after the counterexample; no pre-run ledger-hash comparison is asserted. `SOURCE-MANIFEST.json` records exact paths, inputs, provenance and final hashes.

## Important I-01 — future-only currency invalidates already qualified historical/current FX

**Owner/location:** frozen A, `homepage-v25-performance.ts:888`, `:933`, `:761`, `:791`; propagated unchanged by B `homepage-v25-series.ts:52` and `:64`. This is an inherited financial-data dependency defect, not new B arithmetic.

**Reproduction:** [`future-currency-isolation.test.ts`](future-currency-isolation.test.ts), raw [`COUNTEREXAMPLE.log`](COUNTEREXAMPLE.log). Exactly one new test ran once under pinned native Node `v26.0.0` and Vitest `4.1.10`, exit **1**, **1 failed / 0 passed**. Its control and setup/native-money assertions pass; the final isolation assertion fails. It uses real `buildInstrumentTradeSummaries → buildTradeLibraryEntries → prepareHomepageV25Source → buildHomepageV25Series → projectHomepageV25Boundaries`, with no financial mocks or DB.

Literal source: one live USD buy1@100 on Jan5, raw US quotes Jan28=110, Jan29=110, Jan30=120; selected period Jan30 only, asOf Feb2 10:00Z, target CNY. Historical Jan30 USD/CNY7 has publication, known/fetched times and source evidence before the cursor. The independent current USD/CNY7 snapshot has real Feb2 publication/fetch evidence before asOf. All required quotes and the actually exposed USD pair are available. Jan30 Shanghai day-end precedes the US Jan30 close; opening and endpoint both mark110.

|Value|USD-only control / independent literal oracle|Same input plus one future HKD buy on **Mar5**|
|---|---|---|
|Jan30 period net|`0`|`null`|
|Jan30 market value|`770` =110×7|`null`|
|Feb2 current market value|`840` =120×7|`null`|
|Feb2 current net unrealized|`140` =(120−100)×7|`null`|

The added HKD group has **no visible endpoint executions**, as independently asserted; it creates no Jan30/Feb2 exposure. The source still must preserve it because future carriers can carry legitimate earlier evidence. Native USD endpoint/current market values remain110/120. Both FX coverages incorrectly require `HKD/CNY` in addition to the complete USD pair and become `partial`. The otherwise usable USD conversion context is dropped.

**Exact data flow:**

1. Real entries preserve both original fills; `collect` filters live/account/market/run scope without incorrectly deleting future carriers (`performance.ts:122–175`). `prepareHomepageV25Source` captures their complete evidence (`:631–675`).
2. Historical point `:933` and independent current `:888` call `fxFor(...data.groups.map(currency)...)` **before** endpoint/current eligibility is established (`:940` / `:892`). Thus a future-only HKD group's currency participates in required FX pairs despite empty visible executions/zero known exposure.
3. `fxFor:761` requires both HKD/CNY and USD/CNY. USD evidence passes all knowledge/source checks, HKD has no required source because no exposed HKD amount exists yet. Aggregate coverage is partial (`:789`).
4. `:791` returns **no snapshot at all** unless every source-group pair is complete. The valid USD pair is no longer available to F's conversion function.
5. F `metric:350` correctly filters amounts by `eligible`, but at this later stage its entire `input.fxSnapshot` is already absent. The eligible USD amount reaches `metric:366` (`!snapshot`) and becomes `null`/`fx-missing`. Filtering the HKD amount now cannot restore the lost USD context.
6. B performs no financial calculation; it forwards A's null point/current and chooses the real last nonfuture point as summary. Therefore a genuine zero becomes an artificial data gap, and current availability changes when a future unrelated currency is added.

**Requirement conflict:** PRE-DISPATCH-CONTRACT requires boundary-specific actual knowledge, no future state contamination, complete eligibility inputs, truthful dependency coverage, and independent current using F3 policy (`:140`, `:257–269`, `:297`, `:309`, `:451–466`). Approved HP02 requires actual historical values, true zero versus unknown, and independent current (`:195–208`, `:224–241`). This failure is not legitimate missing FX for an actually eligible HKD amount; there is no such visible exposure in the counterexample.

**Disposition:** unresolved **Important**. Blocks treating frozen A/B as financially correct for the general P2/P4 source. A remains frozen after its three candidates. No repair, new cache, threshold adjustment, qualification workaround or fourth candidate was attempted. UI must not prefilter future carriers as a workaround: that would discard required evidence and alter the approved input contract. Root retains the reauthorization/round decision.

## B contract and canonical-chain observations

The following are version-bound source-review observations, qualified by I-01. They are not a new 18-test execution or an overall data acceptance.

|Requirement / elements|Current source and evidence|Independent observation|
|---|---|---|
|HP02 period cards/curve; HV25-14..19; S01/S02/T01|B:37–55; A:906–944|B validates normalized Gregorian bounds, emits inclusive ascending natural-day keys, retains date-only precision, calls public batch once and forwards actual asOf. A owns strict opening, same-day instant clamp and native period differences. No new B finance equation, Date.now, preset interpretation or cache found.|
|Future/missing/true-zero; HV25-16/19/22; X01/X02|B:56–64; A:930–963; new I-01|B selects last nonfuture even when missing; allfuture has null summary/effectiveEnd. It does not backfill a missing summary from a prior plottable point. A future point has no instrument replay/quote amount. **Qualification-driven zero/gap isolation FAILS I-01.**|
|Six tooltip fields; HV25-20/21; L01|B:11–13; A:945–949, lifetimeFor:876|Order exactly marketValue/unrealizedNet/lifetimeRealizedNet/lifetimeNet/net/periodFees. Cumulative fields use full-source lifetime coverage rather than the selected start; unknown lifetime is retained. Current is only batch.current, never summary. No field aliasing of period realized into lifetime realized found.|
|Fees and knowledge; X01/L01|A:794–881; canonical ledger:186–440|Actual incurred fee facts are separate from canonical known fees/open fee allocation. Day/month/attribution uncertainty preserves reasons; statement-backed duplication requires lineage. Native amounts/fee facts stay in the bundle. No new B fee authority found. This static trace does not exhaustively reverify every statement fixture.|
|Original money / historical FX; X01/X02|F metric:349–380; A fxFor:758–793, amounts:941–949|Differences are native before one endpoint FX; historical pair knowledge is separate from current latest and missing target retains native money. Valid pair qualification across groups **FAILS I-01**. No additional FX tests were run.|
|Immutable source / generation / lineage; S01/S02/C02|A:631–675, freezeProjection:584, result:964; B:61–65; ledger:457–511|prepare clones raw source and digests content+policies; private ledger uses canonical evaluator/checkpoints; ambiguous contexts fall back to the same evaluator. Batch graphs are frozen, B frozen wrapper passes source/version/scope/point/current/feeFacts identities through and owns generation without mutation. No second B cost/quantity/PnL ledger found.|
|Eligibility input completeness; S02/T01|Real library:132–305; A collect:122–175; I-01|Original entry.executions, account/instrument/nature/run and attached episode evidence are retained. Simulation needs explicit run; default real scope is live. Host must not feed only active episodes. Complete source retention is correct, but FX qualification incorrectly uses retained future groups before boundary eligibility.|
|HP06 return / actual host consumption|Product-source search for prepare/project/buildSeries|Only definitions and B→A call exist; no real UI consumer/wiring was found. Return navigation, fresh read, atomic generation commit and persistence remain NOT VERIFIED; B intentionally does not implement them.|

`periodSummary` exposes the complete A point (including evidence) rather than a smaller six-audit-field pick. This is additive and preserves source/coverage. Consumers must handle null/allfuture explicitly and must not mistake `effectiveEnd` (business date) for the exact cutoff; `boundary.asOf` and the point's `effectiveCursor` carry the instant. `point.state/plottable` follows period net completeness; aggregate `point.reasons` may include an unavailable lifetime tooltip field and must not by itself force a trustworthy main net into a gap.

## Technical judgment for root

B's existing synchronous signature, full metric objects, null summary, generation wrapper and distinct current seam are sufficient for **read-only controlled-component preparation**. No B interface change is necessary to prepare props, six-row rendering, future/unknown/zero states, keyboard selection contracts or source/generation rejection wiring. Such preparation must remain explicit preparation; the synchronous function does not itself prove cancellation, stale-response rejection or atomic application.

**Frozen B cannot presently be used as an accepted financial integration base for P2/P4.** I-01 gives a concrete semantic blocker, independently of A's already failing cold performance. It must remain visible when planning later integration. Root may continue controlled read-only component work under the existing authorized sequencing; this review neither authorizes nor implements financial hookup, source filtering, UI release or another A repair. No alternative number or client-side FX recalculation may be substituted in UI.

## Preserved gates / required boundaries

|Gate|Current disposition|
|---|---|
|This independent new counterexample|**FAIL**, 1/1, one execution, original log preserved|
|B composition source review|No additional B-specific defect found; **scoped observation only**, dependent A Important unresolved|
|Root's existing B18 execution|Root previously reported pass; not repeated or counted as this review's execution|
|A multiple-market cold|Inherited **FAIL 2617.548995ms >2000ms**, three candidates frozen; no new measurement or fourth repair|
|B full-scale incremental overhead / complete serialization footprint|**NOT VERIFIED / NOT MEASURED** here; no benchmark authorized|
|P1 / P2 / P3 / P4 formal counters|Inherited P1 **2/3 FAIL**; P2/P3/P4 **0/3** unchanged; no formal acceptance round consumed|
|UI financial integration / P4|**BLOCKED** by unresolved I-01 plus existing gates; controlled read-only component preparation is a separate scope|
|Rendered visual reference comparison / responsive boundaries / control inventory|**NOT VERIFIED**; this is no visual or whole-page pass|
|Actual data persistence, navigation/return/reload, generation/cancel/failure retention|**NOT VERIFIED**; no browser/service/DB used|
|Mouse / keyboard / emulated touch / physical touch|**NOT VERIFIED** as real interactions; no input-mode evidence inferred from pure data|
|Whole feature / page delivery / preview|**NOT ACCEPTED**; no delivery/preview assertion|

Only command executed for the counterexample (no existing suite rerun):

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/p2-b/independent-review/vitest.config.mjs --configLoader native > .scratch/homepage-v25-implementation/evidence/P2/data/p2-b/independent-review/COUNTEREXAMPLE.log 2>&1
```

Artifacts are frozen after the final source/evidence manifest check. No further tests, repairs or writing are planned by this reviewer.
