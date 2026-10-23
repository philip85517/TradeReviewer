# Homepage P2/P4 Financial Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document authorizes no implementation; root must dispatch an approved bounded task after the real P1 journey gate.

**Goal:** Supply one financially consistent daily performance bundle, closed-round history and exclusive contribution data without running the full F builder for every day or creating a second cost ledger.

**Architecture:** Keep canonical `replayPositionAtPrice` as the sole quantity, average-cost and gross-realized authority, and keep the accepted F remaining-fee projection as the sole fee allocation policy. Prepare scoped original source once, reuse canonical/F checkpoints by complete knowledge context, and value requested boundaries with the quotes and FX actually permitted there. History and contribution consume trace/checkpoint facts from that same execution, then perform pure aggregation.

**Tech Stack:** TypeScript, Decimal.js, existing canonical replay and F projection; pinned Node 26.0.0; targeted Vitest; no dependency addition.

**Spec:** `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP02 lines 191–240, HP04 lines 257–309, HP05 lines 349–432; `source/component-manual.html` Metric lines 611–698, ChartTooltip lines 872–959 and boundary notes lines 1135–1138. Read these originals and `F-peer-review/P2-P4-DATA-SEAMS.md` before execution. This plan covers data contracts only; visual, keyboard, touch, persistence and return journeys remain the respective UI owners' independent gates.

## Global Constraints

- “期间净盈亏 = 期间已实现 + 期末浮盈 − 期初浮盈”; partial closing uses its actual closing date and fee-net amount. Current UF is not UF change.
- “按上海时区”; precise executions use Shanghai business dates, while date-only/month-only evidence retains its real knowledge time and ordering limits.
- “当日持仓市值、当日浮盈” use that day's actual data, not current values backfilled into the past; missing values are null with reasons and gaps.
- “做多／做空／IPO三类互斥”; acquisition provenance, rather than instrument label or today's direction, owns attribution.
- Historical results count completed rounds by actual closing business date, with all completed rounds including breakeven in the win-rate denominator.
- One year produces 12 monthly buckets; multiple years produce annual buckets; no-rounds, true zero, source missing, future and request failure remain distinct.
- Prepare full results before 8-row pagination. Local filters and open-only totals must not replace the full scope total.
- A request commits its range label and complete related data atomically. Failure/cancellation retains the last valid complete bundle.
- Preserve original F acceptance and all historical FAIL evidence. F current additive fields are separately awaiting restored round 2/3. No task renaming resets acceptance counts.
- No business DB, service, UI, shared-ledger modification, new dependency or commit is authorized by this plan. Any shared canonical extraction requires a separately explicit scope approval.

## Review Focus

- Quiet days with no new fills can still have a new quote, cash refund, statement coverage or month-only knowledge; Task 1 tests each dependency independently.
- A future carrier can contain earlier statement evidence; a current-only episode reconstruction cannot become the source of historical truth. Task 1 uses original entries/evidence and independent cutoff selection.
- IPO/manual mixed inventory and reversals can duplicate fee/settlement attribution even while the total net identity holds. Task 3 checks quantity, cost, realized fees, open fees and each financial component separately.
- History may have known completed quantity but unknown net/fees. Task 4 keeps total rounds and coverage, and never silently drops unknown results from a purported full win rate.
- A displayed historical converted curve can appear valid while using today's FX or current quote. Task 2 checks exact source provenance and per-day cutoffs and never relabels a current snapshot as historical.

---

## Findings and bounded measurements

The current F source collects/normalizes and reconstructs each group for each builder call. Within a boundary, `replay()` obtains a canonical before-step state for every selected fill/allocation, then the final canonical state. Its local map avoids identical opening/end/current boundaries inside that one invocation; it does not share work across days. Canonical itself rebuilds, deduplicates, matches evidence, sorts and replays its complete input timeline. Thus even a single boundary has at least quadratic prefix preparation work in the number of fills; no constant-time query claim is justified.

The limited call-through probe, with all fills already visible and four requested ends, observed:

| Fills | Full builder calls | Canonical calls | Distinct complete canonical input hashes | Sum of selected prefix sizes | Latest local elapsed |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 4 | 151 | 25 | 1470 | 78.60 ms |
| 100 | 4 | 711 | 105 | 35350 | 582.59 ms |

The earlier run was 37.07/428.57 ms; timing changed while call counts and amounts remained identical. Both logs are retained. These synthetic probes are evidence for duplicated work, not a throughput guarantee. The previously frozen single-projection scaling measured 20/100/200 fills at approximately 15/98/197 ms in its separate run. The peer's earlier 200-fill timing predates that final source and is not the current single-projection measurement.

For an analytic 1866-fill/365-day case with fills evenly distributed, a fixed current `asOf` at year end and the same starting boundary, calling today's full builder 365 times entails roughly 1.02 million canonical calls (daily selected prefixes plus all 1866 current prefixes on nearly every call), and roughly 847 million selected-prefix members before timeline construction/matching/sorting. These are estimates under the stated distribution, not timings. Even perfect canonical memoization leaves repeated F fee loops unless F checkpoint state is shared as well.

`read-only-probes.test.ts` also demonstrates identical selected IDs `[sale]` with different knowledge: before the IPO refund the cost/net are unavailable; after the refund realized is 18, current net UF 9, total 27. Cache keys made only from selected IDs, raw fill count, instrument, period or entries object identity are unsound.

## File ownership and exact proposed seams

| File | Proposed change | Reason and owner |
| --- | --- | --- |
| `app/lib/reviews/homepage-v25-performance.ts` and test | Add opaque preparation/boundary interfaces, reuse its collect/replay/fee/amount/metric internals; preserve existing entry wrappers | F owner must keep one policy. An external module cannot reuse private normalized source, before-step states or fee checkpoints without copying a ledger. Current additive API is already implemented; daily extensions are not. |
| `app/lib/reviews/homepage-v25-series.ts` and test (new) | Build ordered day requests and one current/period bundle from prepared F snapshots | P2 data owner; no inventory/cost/fee transitions here. |
| `app/lib/reviews/homepage-v25-attribution.ts` and test (new) | Consume approved canonical movement trace and provenance; aggregate mutually exclusive contributions | P4 data owner after attribution decision. No independently replayed subsets. |
| `app/lib/reviews/homepage-v25-history.ts` and test (new) | Turn canonical closed-round facts into four cards and monthly/annual buckets | P4 data owner; pure aggregation. |
| `app/components/homepage-v25/holdings-model.ts` | Consume frozen F current metrics, without local fee math | Existing P1 owner, outside this plan's implementation. |
| `app/lib/replay/position-ledger.ts` and neighbor tests | Only if the measured preparation/query budget cannot be met without a prepared canonical timeline/observer | Requires root approval. Extract the existing transition implementation and keep `replayPositionAtPrice` as a wrapper; do not copy its equations into an alternate replay engine. |

### Proposed types

These are proposed names for a subsequent bounded dispatch, not existing exports. No caller should import them before that task is accepted.

```ts
// F file; opaque brand and internals stay private.
prepareHomepageV25Source(input: {
  entries: readonly TradeLibraryEntry[];
  scope?: HomepageV25Scope;
  sourceRevision: string;
}): HomepageV25PreparedSource;

projectHomepageV25Boundaries(source: HomepageV25PreparedSource, input: {
  asOf: string;
  boundaries: readonly { key: string; at: string }[]; // validated day or ISO instant
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  targetCurrency?: string;
  fxByBoundary: Readonly<Record<string, RoomFxSnapshot | undefined>>;
}): HomepageV25BoundaryBatch;
```

`HomepageV25BoundaryBatch` must carry sourceRevision, policy version, scope/coverage, asOf, and ordered points. Each point carries key, requested/effective boundary, business date, knowledge cursor, state (`value | source-missing | future`), per-group evidence, and metrics `marketValue`, `unrealizedNet`, `cumulativeRealizedNet`, `cumulativeFeesIncurred`, `openFees`. Use the existing `HomepageV25Metric` with original money and provenance. A known subset never becomes a complete total. Duplicate request keys are rejected. Day requests use Shanghai end-of-day, clamped to an earlier same-day ISO `asOf`; an entirely future day returns future without replaying future information. Existing pure compatibility seeds remain on the legacy wrapper because they depend on its supplied period start; the prepared production seam accepts original entries only.

`cumulativeFeesIncurred` comes from canonical fees; `openFees` is the F retained pool. Their difference is realized fees only where both are known. Do not use open fees as the date tooltip's total fees. The date tooltip should initially label the supported period-incurred fee amount explicitly; the required final label/policy is a root decision below.

Prepared source identity is immutable and revision-bound. In-place mutations must produce a new sourceRevision; object identity is not a revision. Source/FX/quote revisions and scope are carried into the final request generation, and stale generation results cannot commit to S.

### Cache correctness and work budget

Preparation groups, preserves original lineage, scope-checks, validates and normalizes once; deduplicates/indexes attached statement positions/events/cash once; sorts original execution and evidence timelines once. A boundary still selects exact source knowledge using existing predicates. Inventory/cost/fee caches do not depend on quote or FX, while valuation caches include quote and FX provenance. Metadata changes that affect identity/currency invalidate relevant prepared state.

Start with memoizing the **exact** canonical input used by the accepted F replay and reuse a F fee checkpoint only when that canonical context and the F movement-prefix context are identical. Precomputed hashes/rolling prefix IDs may optimize keys only after equivalence tests prove that no evidence field is omitted. Keys include original normalized source revision, scope identity, complete selected prefix, known statement/cash/coverage context, execution-backed IPO suppression context, cursor/precision and policy version. A distinct cursor can share a snapshot only after proving that no source knowledge changed between them. No application-wide unbounded Map: prepared handles own bounded request caches and can be released after the committed revision is replaced.

A new knowledge epoch is created when cash/refund/fees, statements/coverage, bonus ambiguity or execution-backed allocation matching changes. Such evidence can change the meaning of an earlier allocation, so its dependent prefix and fee checkpoints must be recomputed under **that epoch's** known context. Never propagate a later refund backwards into an earlier point. Ordinary quiet days reuse inventory/fee checkpoints but revalue permitted quotes/FX. The same daily request made in a batch and alone must have identical full metrics/evidence.

For stable evidence context, aim for one prepared original timeline plus O(N) distinct canonical-prefix requests/F fee steps and O(D × G) value queries, rather than O(D × N) prefix replays. Memoizing today's monolithic canonical calls still has O(N² log N) preparation in the worst case and is not yet a full linear sweep. With K evidence epochs, conservative invalidation may require O(sum of dependent epoch prefixes); worst case remains O(K × N) transitions after a true prepared-canonical seam. State this worst case instead of claiming every refund query is constant time.

The following are **proposed acceptance budgets**, to confirm before implementation: synthetic 1866 original fills across 365 days, one account/instrument, ordinary and mixed-evidence variants; cold data preparation plus all day points ≤2 seconds on the pinned local runtime, identical-revision query ≤200 ms, no 365-fold full replay, bounded cache size recorded. Record warm-up, three raw samples, output equality and canonical call/transition counts separately. The spec does not provide a latency number, so do not present these proposed limits as already approved or passing. If the smallest F-only memoization misses the budget, report the measured result and request the canonical extraction scope. Do not keep optimizing indefinitely or claim current F is fast enough from 100-fill tests.

## Task 1: Prepared original source and reusable F boundaries

**Files:** modify F source/test only; new task evidence under its approved directory. Shared ledger remains read-only unless root approves the conditional seam.

**Interfaces:** produce the two proposed F functions/types above; consume unchanged canonical replay and the accepted F fee projection. Existing builder outputs remain the comparison oracle for each individual legal boundary, including reasons, coverage and money.

- [ ] Write `batch_boundaries_equal_individual_projections` using true summaries→entries, independent literals for average-cost/fee parts, and full per-boundary output comparison. Include Shanghai midnight, same-day ISO, date-only/month-only, statement position, conflicting duplicate quantity, scope/run, cross-period fees, IPO short-cover/reversal and execution-backed allocation.
- [ ] Run the targeted new test and preserve RED for missing batch API.
- [ ] Implement preparation, exact canonical memoization and fee-checkpoint sharing in F. The current API and old wrapper call the same kernel. Add no cost or gross-realized equations.
- [ ] Write/run `same_fill_ids_late_refund_changes_knowledge`, `quiet_day_new_statement_changes_inventory`, `future_carrier_does_not_leak_future_evidence`, and `quote_change_revalues_without_inventory_replay`. Before-refund net remains null; after-refund literal R18/UF9/net27. Preserve original early snapshot after the later query.
- [ ] Run the new targeted file plus the frozen F/IPO/diagnostic contracts, F typecheck and lint; save raw logs/commands/hashes. Record 200/1866-fill ×365-day cold/warm measurements and counts before claiming the seam sufficient.
- [ ] Freeze for independent coordinator acceptance. If performance fails, obtain explicit canonical extraction scope before touching `position-ledger.ts`; use characterization parity of all canonical neighbor cases and retain one transition implementation.

## Task 2: Daily and period bundle

**Files:** create `homepage-v25-series.ts` / `.test.ts`; consume the accepted Task 1 boundary batch. Page/S integration belongs to the P2 owner after P1 real journey acceptance.

**Interfaces:** `buildHomepageV25Series(source, input: { period; asOf; candlesByInstrument; targetCurrency?; fxByBoundary }): { sourceRevision; boundary; period: HomepageV25Performance; current; points: HomepageV25DailyPoint[] }`. `HomepageV25DailyPoint` adds date/state, period-cumulative realized/net, UF, MV, period-incurred fees, coverage/reasons/money. Its closing point and period KPIs use the same end snapshot and FX policy. Current remains separately projected once.

- [ ] Write RED for opening cost100/period-start mark120/close130: closing-day cumulative R30, UF0, net10; historical round remains30 in Task 4. Add early/late quotes so substituting current UF/MV fails.
- [ ] Implement only snapshot differences and aggregation. Calculate the period net in original currency from same-context R and UF components, then convert with that point's declared FX policy; do not subtract separately converted opening/end UF at different exchange rates. Final point equals first-three KPIs and all components match independently.
- [ ] Write/run precise current ISO, first-day mark, future day, missing expected raw quote, holiday/last permitted completed session, missing/partial/malformed FX and different market calendars. Output priceDate/provider and FX id/source/asOf/status. A same-day complete daily candle is unavailable to an earlier ISO instant. Preserve unknown gaps and true zeros distinctly.
- [ ] Adopt one explicit FX policy per bundle. Recommended: source-backed per-boundary FX known at that cursor, and summary uses the effective endpoint snapshot; current uses its independent current snapshot. If only latest FX exists, historical converted points are unavailable while original subtotals survive. An explicitly approved fixed reporting-asOf FX mode may be added only with its true fixed-source label; it cannot be called historical FX or implemented by changing snapshot.asOf strings.
- [ ] Freeze data tests and full-bundle generation contract for P2 owner. Verify request failure/cancel preserves the previous range label, metrics, curve and current contribution together; no per-point UI commits. UI chart tooltip/keyboard/visual acceptance remains a separate P2 gate.

## Task 3: Canonical movement trace and exclusive attribution

**Files:** F source/test for a read-only movement trace from its existing canonical prefixes; new `homepage-v25-attribution.ts` / `.test.ts` for provenance classification and aggregation. If canonical extraction was approved in Task 1, its observer emits the identical facts instead of replaying another engine.

**Interfaces:** trace carries scope identity, original execution/event IDs, movement boundary/precision, trusted before/after quantity, canonical gross-realized delta, total-fee delta, F released/retained fees, acquisition provenance and uncertainty. `buildHomepageV25Contribution(trace, {domain: current | history; range; category; openOnly})` returns full rows plus scopeTotal/categoryTotal/filteredTotal, per-metric coverage and navigation source IDs. Sorting/drilldown/page selection is applied after full totals.

- [ ] Obtain the mixed-source disposal decision below before writing expected category literals; this task is not executable without it.
- [ ] Write RED for IPO1@100 + manual1@200 + partial sale, then full close; acquired manual shares stay long, allocation shares stay IPO, and class sums separately match quantity, cost, gross R, realized fees, retained fees, opening UF, closing UF and net. Add same instrument long→short and execution-backed allocation control. A total identity alone does not pass this test.
- [ ] Implement provenance attribution over canonical movement facts. Never run canonical separately on IPO/manual subsets, because that changes average cost. Prioritize trusted disposal/acquisition links; ambiguous classification remains explicit coverage unless root approves a deterministic allocation policy.
- [ ] Write/run buy1 then sell2 with whole source settlement: one original gross/fee amount, close/open quantity and fees conserved. Add non-execution IPO that closes a short or reverses to long, late refund and later partial/full sale. Attribution reuses accepted F fee movements rather than a new fee engine.
- [ ] Write/run full 50-security/7-page rows and market drilldown: pagination/sort cannot alter scopeTotal, openOnly gets a separate filteredTotal, unknown classification/FX cannot be summed as a complete result. Preserve exact source IDs for detail return; classification never comes from today's quantity or an instrument IPO label.
- [ ] Freeze data contracts for independent coordinator review before P4 UI consumes them.

## Task 4: Closed-round facts and historical aggregates

**Files:** F trace contract from Task 3; new `homepage-v25-history.ts` / `.test.ts`. Do not use `episode.metrics` or `summarizeTradeEpisode` as a parallel money authority. Existing episode IDs may provide navigation identity only when actual source lineage matches.

**Interfaces:** `HomepageV25ClosedRound` carries stable group+opening/closing lineage ID, actual closing boundary and Shanghai business date, source time precision, final net/fees as metrics, positive/zero/negative/unknown result, provenance and navigation IDs. `buildHomepageV25History(rounds, {startYear; endYear; asOf; sourceRevision})` returns four cards and all four chart modes on the same complete monthly/annual buckets, plus full historical contribution facts.

- [ ] Write RED for UTC12/31 crossing into Shanghai1/1, date-only close, partial close without flat inventory, reversal closing one round/opening another, cross-year cost100/mark120/close130 and non-execution inventory close. Full-round net30 belongs to actual close year; partial realized does not create a completed round.
- [ ] Derive flat-to-flat completed facts from canonical transitions; quantity/evidence uncertainty cannot manufacture a close. A reversal finalizes the old exposure and starts a new one using the same original settlement and fee split. Stable identity uses lineage, not amount, so later refund/correction changes value without inventing another round.
- [ ] Write/run positive, negative, breakeven and unknown-cost/fee completed rounds: range win rate is total positive / total completed, breakeven in denominator, unknown result keeps coverage and blocks a falsely complete win rate. A range with no rounds has 0 rounds and null win rate, distinct from known completed zero.
- [ ] Produce exactly 12 months for a single year and each year for multi-year ranges; test no-rounds/source-missing/future/true-zero separately in PNL, cumulative, win-rate and round-count modes. Missing financial data propagates to cumulative coverage; no fabricated connecting amount is emitted.
- [ ] Verify revision correction/refund can recompute relevant historical years using evidence known at requested history asOf, while already emitted earlier daily knowledge points stay unchanged. Annual/monthly totals, historical contribution and four cards use identical closed-row basis and FX policy.
- [ ] Freeze data and independent request-generation contract. History update commits label/four cards/all buckets/history contribution together and leaves current performance/current holdings unchanged. Actual P4 browser/return/persistence/visual tests are separate required gates.

## Decisions required before those tasks execute

| Decision | Evidence and proposed boundary |
| --- | --- |
| Mixed IPO/manual disposal without source links | Design requires exclusivity but does not choose FIFO or proportional provenance allocation. Proposed: source links first; otherwise root explicitly approves a deterministic pro-rata attribution policy over canonical average-cost movement, with class component conservation. If not approved, keep category unavailable and do not claim complete P4 delivery for known mixed data. |
| Historical FX basis | Design requires actual-day provenance, but no historical snapshot collection is supplied by current single-snapshot F input. Recommended historical-per-day snapshots; fixed reporting FX only if expressly approved/labeled. Current/endpoint/round conversion cannot silently use different policies. |
| Tooltip “费用” | Main/manual require fees but do not state all-history incurred vs period-incurred vs closed fees. Recommended explicit period-incurred label with source detail; expose canonical cumulative incurred and F open/released components so UI cannot infer it incorrectly. |
| Latest quote freshness vs daily actual marks | Existing F selects latest permitted raw candle. Daily missing expected session vs legitimate holiday carry needs the project's market calendar and provider session policy. Record actual priceDate/freshness; never manufacture a candle or fill a missing session silently. |
| Performance budget / canonical scope | Proposed 2s cold/200ms repeated 1866×365 limits need root agreement and actual measurement. F-only memoization may remain quadratic; shared canonical preparation/observer extraction is conditional explicit scope, not assumed authority. |

## Self-review and current status

All in-scope HP02 data fields map to Tasks 1–2; HP05 current contribution to Task 3; completed history/four modes/history contribution to Task 4; P1 current UF consistency is already supplied by the separately frozen additive API. The five review risks each have concrete tests in the owning task. UI geometry, design image comparison, input/keyboard/touch behavior, persistence and detail-return flows are intentionally assigned to page owners, not marked passed or unnecessary here. No P2/P4 product implementation, acceptance, 1866-fill timing, historical FX availability or attribution-policy approval is claimed by this plan.
