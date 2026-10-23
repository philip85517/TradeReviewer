# Metric cards candidate 1 — independent spec and quality review

Reviewed 2026-10-23 CST by `/root/series_bundle_review`, actual **gpt-6.1-sol / ultra**, against HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Reviewer did not implement this leaf. **Critical 0 / Important 1 / Minor 1. Candidate has an unresolved visual failure and is not accepted by this report.** Root owns formal acceptance and the existing max-three cap; this scoped review does not create or consume an additional formal round.

## Scope, inputs and evidence provenance

Trigger: independent review of new frontend readouts, detail controls, state wiring and layout. Scope: only `app/components/homepage-v25/metric-cards.{tsx,css,test.tsx}` and their actual readonly B type dependencies. Read AGENTS and the five mandated agent workflow documents; read metrics ROOT-DISPATCH including both display rulings, IMPLEMENTATION-READY, CONTROL-STATE-MAP, REFERENCE-READS, actual new source/tests, actual B and exported financial types. Approved references read directly: visual-design.candidate.md global42–75, HP02 191–252, shared states467–549; component-manual.html Metric611–698. Directly viewed the provided faithful original Metric state-board raster and original home1440 reference raster. The state board is not a browser comparison viewport.

Product SHA256 before/after review matches the dispatched candidate:

| Source | SHA256 |
| --- | --- |
| metric-cards.tsx | `344ee710457cc95f2cf384a882b9c800e84cc5c1ea068216c44cc4e915284bea` |
| metric-cards.css | `5a99e9f9a77cb2e7d20340d9a40e0757cbc7917222e74fbc358646c4c9267194` |
| metric-cards.test.tsx | `4c4aeb1393c09bdc7a81d127002d3a032c2fb5850011cf502117426abf2e3d3a` |
| B homepage-v25-series.ts | `30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6` |
| frozen A/F homepage-v25-performance.ts | `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a` |

Full source/reference/evidence hashes are in SOURCE-SHA256.json. This reviewer wrote only this new independent-review directory, ran exactly one new independent test file once, and did not modify/repeat the existing20 tests. No product/config/dependency/shared tracker edits, service, browser, network, DB, performance, full suite, child agent or commit actions occurred. Root's parallel test/browser work is separately attributed below.

## Important I-01 — focus detail affordance covers the retained amount unit

**Location:** metric-cards.css:20–22 and32–35; metric-cards.tsx:133,140–142. **Root real-browser reproduction, independently inspected screenshot and source:** at390×844, choose the long amount/source scenario, open first card detail, then Esc back to its focus-visible trigger. The detail affordance becomes opaque at right8/bottom8 over the value line. Its background covers the lower part of the retained `亿` suffix. There is no reserved value-line area for the affordance.

Root supplied exact rendered rectangles: suffix `x315.008,y241,w33.992,h34` (bottom275); affordance `x301,y259,w56,h24` (bottom283), opacity1, giving16px vertical overlap. This reviewer directly viewed `.scratch/homepage-v25-implementation/evidence/continue-2026-10-23/metrics-candidate1-long-focus-390.jpg` (SHA256 `69c97b5c37932038ced271b7cef4dcdf3f58d8d09793d41c435f5d87dd79e04d`) and confirmed visible occlusion. Root reports the ordinary state retains the whole suffix. No duplicate browser reproduction was run here; the rectangle measurement is root-owned evidence.

This violates the dispatch's constrained-width ruling requiring visible sign and 万/亿 suffix, and Metric hover/focus rules that keep the amount readable and unchanged while only highlighting the detail action. Accessible exact text and uncut detail content do not repair the visible financial unit. **Important:** the displayed magnitude loses a required unit in an explicitly required narrow/focus journey. Root must resolve/review within the existing leaf cap; this report authorizes no repair or waiver.

## Minor M-01 — invalidated selection can resurrect when currency context returns

**Location:** metric-cards.tsx:69,74–85,139. `active` masks a stored selection when generation/source/currency differs, but the old selection itself remains. A later matching context turns it active again without a new activation.

**Independent literal consumer reproduction:** render the same committed B bundle in CNY; activate period net; change only public `reportCurrency` to USD (the expressly supported mismatch/error state from ruling1); confirm detail closes and restores the trigger; move focus to an outside reading position; restore `reportCurrency` to CNY. Expected: the invalidated detail stays closed until another activation. Actual: the old detail automatically reappears. This is a bounded transient-state defect, not a stale financial result or mutation. The same retained-identity mechanism also exists for generation/source, but only the currency sequence was exercised; do not claim separate generation/source reproductions.

`currency-context-detail.test.tsx` imports only the actual component and public types, uses independent literal B data, and calls no financial projector or IO. Fixed native Node26.0.0, Vitest4.1.10, jsdom, maxWorkers1, own scoped config, exactly1 test/1 run: **FAIL, exit1**, raw output preserved in COUNTEREXAMPLE.log. The mismatch-close and initial focus restoration assertions passed before the final reopening assertion failed. The final outside-focus assertion was not reached. Focus reentry is independently apparent from TSX:83 (`active` immediately focuses the dialog); it is not reported as a separately completed assertion.

Exact command from repository root:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/metrics/independent-review/vitest.config.mjs --configLoader native
```

stdout/stderr was redirected to COUNTEREXAMPLE.log. The runner emitted DEP0205 module.register deprecation. No test was rerun or enlarged after this failure. **Minor:** automatic reopening/focus disruption is recoverable and does not change financial values; it still contradicts permanent invalidation of a stale detail. A future host's unique generation policy may reduce exposure, but the public currency prop and mismatch path remain real consumer states.

## Spec and quality results from actual source

| Requirement / finite registry | Independent review result |
| --- | --- |
| M01–04 ordered four values | Correct field selection by source: periodSummary.net, periodRealized, unrealizedChange; independent current.currentMarketValue. No substitution from closingUnrealized/latest/earlier point. |
| M05/M06 detail actions, keyboard/outside | Semantic full-card buttons, visual-order DOM, Enter/Space native button action, Esc/outside closure and exact opener restoration paths present; listener cleanup present. Direct switching is protected from outside close. Real input/visual acceptance remains root-owned; M-01 adds an invalidation failure. |
| M07/M08 pending/first load | Leaf has no data cache/fetch callback. Supplied committed values remain during pending/error; null+pending produces four skeletons. Labels/currency/reason/old complete bundle consistency remains the controlled caller's responsibility. |
| M09 empty/missing/future | Explicit empty masks all readouts. Available/value null handling keeps unknown distinct from0. Future masks three period metrics and their raw/source/original numeric evidence while current snapshot remains independently readable. No financial qualification recomputed. |
| M10 errors | Old values are retained, 查看原因 exposes caller reason and old bundle context; null initial error uses unknown. No local retry/repair/next-step action. |
| M11 sign/zero | Supplied decimal strings formatted with Decimal only for two-decimal 万/亿 presentation; positive/negative/true0 tone distinction; market value neutral. Geometry/regular extreme nontruncation remains required. |
| M12 currency, originals, FX, coverage | Exact raw value and currency in trigger/detail; mismatch shows—/币种与报表不一致 and preserves true original source amount/currency, including currentUnrealized. Details read coverage, originalByCurrency, FX source/asOf/id/status and reasons without conversion. |
| M13/M18 current independence/immutability/generation | No writes to B/metric objects. Period and current inputs remain separate. New bundle data rendered directly; selection identity guards immediate replacement but does not clear the old identity (M-01). Actual host same-generation atomic commit remains NOT VERIFIED. |
| M14/M16 long values and narrow provenance | Exact source strings are not truncated in detail; overflow-wrap/width/max-height/internal scroll source rules exist. Primary suffix occlusion FAIL I-01. Actual long source completeness and remaining responsive boundaries remain root-owned. |
| M15/M17 geometry/focus/hover/motion | 88px,14/20 and28/34, four equal columns/12px gaps,996/492 container switches,2px focus,120ms affordance and reduced-motion rules are present. This is source inspection, not a visual pass. I-01 fails the narrow focus state. |

No financial recomputation found: only Decimal scaling/rounding for permitted display, no F/A/B invocation, amount aggregation, eligibility derivation, fee allocation, FX conversion, network or persistence. Only transient detail identity/position state is stored. Type-only imports do not execute the projector.

Root reported an initial-loading fixture with a stale-data sentence. Confirmed actual root caller had passed the same `status.reason` for pending and first load; TSX:147/155 renders this supplied reason. Root confirmed and is correcting its fixture. **Not a leaf product finding.** Required real-host initial-load/error wording remains unverified; this component does not infer or rewrite caller narrative.

## Required NOT VERIFIED and acceptance boundaries

1. Root's complete version-bound rendered inventory, including1440/1280,390 and both sides of996/492 **container** boundaries; reference-matching density/hierarchy/normal/hover/focus/loading/empty/error, normal/reference extreme nonellipsis, pressure-value sign/unit, card action/value nonoverlap, full focus rings and motion. I-01 is a demonstrated failure within this boundary, not an exhaustive visual audit.
2. Actual remaining mouse/keyboard journeys and their focus behavior; emulated touch and physical touch remain distinct and NOT VERIFIED here. The sole jsdom counterexample is synthetic evidence. Root's directly observed examples are not silently promoted to this reviewer's executed coverage.
3. Narrow full detail content, long original amounts/reasons/FX provenance, close-control visibility, actual ≥24px edge budget, viewport-height scroll behavior and resize/scroll placement throughout the real host. CSS and raw DOM text alone do not prove these.
4. Real host source/reportCurrency/date-label/generation atomic replacement and stale/error retention, rapid scope/period/currency changes, late responses, correct first-load/error narrative. This dispatch created a controlled leaf; it did not connect the real page or prove these chains.
5. Actual B→leaf financial integration, all market/source/FX/qualification scenarios, current vs historical independence end to end, return/reload/persistence and HP06 flows. The existing frozen A Important financial eligibility/FX defect still blocks P2/P4 financial hookup. This leaf must not hide, requalify or repair it.
6. Broad build/suite, A/B scale overhead/performance and whole-page visual/end-to-end acceptance. None ran here. A cold2617.548995ms>2000 FAIL after3 candidates remains frozen; no fourth fix, cache workaround, threshold change or new round is authorized. P1 remains2/3 FAIL; P2/P3/P4 formal0/3 as dispatched. Leaf started0/3; only root can record its formal outcome.

DB write acceptance is NOT APPLICABLE only to this no-IO leaf. Future page persistence gates remain required. Readonly controlled preparation can continue under root's existing dependency ruling, but this review grants no candidate acceptance, P2/P4 financial release, performance acceptance, whole-page delivery or visual waiver.

## Freeze

All review writes freeze after SOURCE-SHA256.json and final source/hash verification. Frozen artifacts: this report, source/evidence manifest, one independent literal counterexample, its config and original FAIL log. No repairs were made. Return findings to root and stop writing.
