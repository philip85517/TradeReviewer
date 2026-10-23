# Contribution bars candidate 2 — bounded correction report

This is the same bars leaf after root formal FAIL 1/3. Candidate 2 is prepared for the second independent review, not accepted. Actual worker model: gpt-6.1-sol / ultra. Root remains the whole-page visual and full data/persistence owner. P2/P4 financial integration remains BLOCKED by A's frozen future-HKD / valid-USD FX counterexample; P4 formal 0/3 is unchanged.

Only the original contribution-bars.tsx, contribution-bars.css and contribution-bars.test.tsx were changed. All new evidence is under candidate2/. Candidate 1 files and the root's independent test are preserved. No host, tracker, financial projection, routing, service, DB, browser, network, dependency, configuration, child agent or commit operation was used.

## Root findings and bounded implementation

| Finding | Change | Verification and limit |
| --- | --- | --- |
| CB-M01: invalidated details revive when their old context returns | An invalid selection is synchronously cleared during the component's own render. The existing rows/fullTotal/mode/currency reference guard now terminates the old selection; restoring those same references requires a fresh activation. Closing still restores the connected opener, then later restoration preserves the reader's outside focus. No financial data is cached or recomputed. | Six new literal consumer cases cover currency, immutable row generation, source identity context, total generation, current/history mode, and total readout currency. All six failed before implementation and pass afterward. The unchanged independent CNY→USD→CNY test also failed before and passes after. Real input remains NV. |
| CB-M02: generic status color wins the CSS cascade | The scoped error selector has three classes, outranking the two-class generic status, and uses shared failure color #FF8592. Retained rows, reason and supplied total are unchanged; no retry action added. | The static/jsdom CSS cascade check first produced rgb(167, 179, 196), then rgb(255, 133, 146). This is not a real-browser computed-style or reference-visual pass. |
| CB-M03: desktop common zero line has row gaps | A single non-empty list pseudo-element spans top:0 to bottom:0. Its x position is `(list width − detail column width) / 2`, exactly the center of the existing symmetric 24/52/24 action grid. Detail column remains 36px, or 44px for coarse pointer. Desktop per-row zero marks are hidden; no monetary width/scale calculation changed. | Static structure checks confirm one continuous desktop declaration, no empty-list axis and correct narrow fallback. Real line continuity, pixel alignment, segment rectangles and visual comparison are NV for root. |

The render-phase reset is conditional on a non-null invalid selection. The next render has selection null and does not repeat the reset. It does not schedule an effect that could later clear a newly opened detail. All current rendered financial facts continue to come directly from current props. The caller contract remains immutable rows, exact supplied net/fullTotal/closed results and unchanged original activation objects.

## Reference and responsive contract

Original visual-design.candidate.md lines 395–431 and 467–549, original IconButton/DataTable/ChartTooltip manual sections, and all nine contribution SVG references remain authoritative. Current-a-share, mixed-sign and error faithful reference renders were directly reviewed again. READ-SOURCES-SHA256SUMS pins the current workflow, original spec/manual/images, root dispatch/acceptance and unchanged independent test.

Root explicitly approved the local narrow strategy: available component container width ≤735px uses identity/action and net on the first line, common 50% track zero on the second. At ≥736px, desktop remains the reference single line. Candidate 2 disables the new list axis within the ≤735px container rule and re-enables the existing per-row second-line zero, avoiding a line through identity text. The original 14px font and solid/hollow outer bar height, inset hollow stroke, display precision, identity object and information hierarchy remain unchanged. Positive #53D7A0 / negative #EF7F89, 43px instrument / 70px market pitches, 36px desktop / 44px coarse targets and 264px/12px floating panel remain declared.

Actual non-overflow, responsive rectangles and final line geometry are NOT VERIFIED by this worker: browser numerator is 0. Root's previous candidate-1 observations remain version-bound to ROOT-ACCEPTANCE-1.md and cannot be promoted to a candidate-2 pass. Root must compare 1440×1000, 1280×800 and 390×844 at 100% zoom with recorded DPR, plus actual container widths 735/736/737px. Record clientWidth/scrollWidth, common-axis x/vertical continuity, solid/hollow rectangles and readout bounds/end scrolling. Static CSS checks and jsdom cannot prove those results.

## Evidence and exact verification

All execution logs preserve the command as a JSON argv array, stdout, stderr and the subprocess exit code. Pinned runtime is Node 26.0.0 with built-in SQLite 3.53.0; runtime.log records the exact executable. No database was opened by the worker.

| Evidence | Observed result |
| --- | --- |
| RED-lifecycle.log | 22 existing pass; 6 new fail, including both soft assertions for unwanted reopening and stolen outside focus. |
| RED-independent.log | Original unchanged exact-include independent test fails; both soft assertions execute. |
| RED-styles.log | Both static correction checks fail before implementation. |
| styles-after-M02.log | Error cascade passes; continuous desktop zero check still fails before its fix. |
| GREEN.log | Final original 22 + new 6 = 28/28 pass, pinned Node, one worker, exact product test only. |
| INDEPENDENT.log | Final original independent test 1/1 passes, new exact-include config without mergeConfig, one worker, exit 0. |
| typecheck.log / lint.log | Strict scoped TypeScript and scoped ESLint exit 0. |
| GREEN-styles.log / style-baseline-contract.log | New static correction checks and unchanged original static contract checks exit 0; no visual pass implied. |
| CORRECTIONS.patch / NEW-FILES.patch / diff-commands.log | Complete candidate-1-to-2 correction diff and complete three-file additions, with raw git diff command output (expected exit 1 for additions). |

Vitest emits the pre-existing module.register DEP0205 deprecation warning; the passing run exits 0. No broad suite or mergeConfig was used. Original independent source SHA256 remains d1d959fa240f5c9702ceebde062e9183d49b9e4d9f124bcf874523b0d380b434, matching INPUT-SHA256.json.

CONTROL-STATE-MATRIX.md records the full CB01–CB15 finite leaf inventory and all separate real-input/visual gates as NV. Leaf IO/DB writes are N/A because this component performs no IO. Actual source navigation, complete page data chain, return/reload and persistence are NV under root ownership. No preview URL or completed UI delivery is claimed. Root independently accepts or rejects candidate 2; the prior FAIL 1/3 is retained.
