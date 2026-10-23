# Contribution bars — root acceptance 1/3 FAIL

2026-10-23 CST. Root independently reviewed candidate1; this verdict covers only the readonly controlled bar/list leaf, not P4 financial or whole-page acceptance. GPT-6.1 SOL / ultra implementation and independent review. Frozen product hashes are in PRODUCT-SHA256SUMS and independent-review/SOURCE-SHA256.json. All prior evidence remains valid for that version.

## Consolidated findings

- **CB-M01 Minor — invalidated readout resurrects.** The independently authored literal CNY→USD→CNY counterexample was independently run by root: 1 test FAIL / exit1, both soft assertions executed. A dialog reappears without activation and steals focus from the outside button. Evidence ROOT-independent-currency-context.log and independent-review/REVIEW.md. Do not count unexecuted generation/source variants as independently reproduced.
- **CB-M02 Minor — actual error color is neutral.** Root selected error-with-old-rows in the real IAB caller at1280×800/DPR1. Reason remains visible and old eight rows/full total remain, but actual computed color rgb(167,179,196), matching the generic status selector that overrides error. Screenshot ../../continue-2026-10-23/bars-candidate1-error-1280.jpg was directly viewed. Use approved shared failure color #FF8592 with sufficient selector specificity; no duplicate local retry.
- **CB-M03 Minor — shared zero line is discontinuous.** Root directly compared rendered original current-a-share and mixed-sign references with actual bars-candidate1-mixed-1280.jpg. Original references use one continuous vertical zero line. Actual per-row spans are32px high on43px pitch, leaving11px gaps, all atx621.992. This is a confirmed visual discrepancy. Correct continuous desktop plot zero without changing monetary segment extent or introducing minimum money widths; preserve approved two-line narrow behavior.

## Finite independent coverage

Root new product test22/22 PASS, exit0 (ROOT-candidate1-tests.log). Original independent context counterexample FAIL as above. Tests cannot override the functional/visual findings.

|Scope / journey|Actual result / evidence|Practical limit|
|---|---|---|
|Eight supplied source actions, desktop|PASS finite: root clicked each, exact JSON identity matched original account0–7/instrument0–7/market/nature/run objects|No real host detail or persistence integration|
|Mixed positive/negative14px solid/hollow bars and supplied full total|PASS finite source/visual, except zero continuity FAIL|Literal values, not financial projection/reconciliation|
|Separate detail, exact full R/UF/net/coverage/source, Esc|PASS finite1280: root directly viewed detail screenshot; Esc exact trigger restoration|All states/all input methods not closed|
|Error old values/reason|Functional retention PASS finite; error visual FAIL CB-M02|First-error visual not executed by root|
|Long value/name/source390×844/DPR1|PASS finite: row64px, entire page390px, long value visible; detail264px atx102/y12/h820, no viewport overflow; exact original values/source, scrollTop202 reaches last source atbottom819; Esc exact trigger|Narrow identity ellipsis allowed; this does not accept all breakpoints/states|
|Readout lifetime|FAIL CB-M01 synthetic original literal counterexample|Real currency roundtrip not separately executed|
|Full CB01–CB15 matrix, 1440/boundaries, market actions, history/initial/empty/zero/unknown and all detail permutations|NOT VERIFIED|Must be closed on candidate2; source/tests alone do not count|
|Mouse hover, keyboard full set, touch/reduced motion|NOT VERIFIED except explicitly listed Esc/source clicks|Keep mouse/keyboard/emulated/physical distinct|
|DB leaf writes|NOT APPLICABLE: leaf performs no IO|Feature persistence/return/reload remains required, NOT VERIFIED|

Root caller had an unbroken JSON output line that overflowed390; readonly geometry proved it belonged to caller OUTPUT, not leaf. Only root evidence caller CSS was corrected, then actual page width390 rechecked. Old bars-candidate1-long-390.jpg retained but not used as final visual PASS. Corrected screenshot bars-candidate1-long-caller-corrected-390.jpg and long-detail-390/end-390.jpg plus long-scroll.json are in continue-2026-10-23; first two directly viewed by root. Root's failed stale AX index action made no mutation and is not counted as coverage.

## Disposition

FAIL1/3 for the same bars leaf; candidate2 may repair only the three consolidated findings and add meaningful regression coverage in the same three product files. Original evidence/tests remain. No A/B/F/ledger, host, services, DB, shared config/dependencies or existing tests changes. P4 stays formal0/3; finance remains blocked at the separate three-candidate pause. Known failures/required NV block delivery.
