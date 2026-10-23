# Candidate 2 — frozen for independent review

Frozen at 2026-10-23T07:42:33.218702+08:00 by /root/contribution_bars, actual gpt-6.1-sol / ultra. HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. This is the final worker write; no further product/evidence writes follow pending root's ruling.

Same bars leaf: root round 1/3 FAIL remains recorded in ROOT-ACCEPTANCE-1.md. Candidate 2 awaits independent round 2, max 3 formal rounds total. This marker is implementation review readiness, not feature acceptance. P2/P4 financial integration remains BLOCKED by frozen A; P4 formal 0/3 is unchanged.

## Exact product version

- `app/components/homepage-v25/contribution-bars.tsx` — `50bf4799f53f4dbae22c25d9b2d37fb68f144d809c78dd823a25ecd772ca5574`
- `app/components/homepage-v25/contribution-bars.css` — `38fec37c82993b162c9aeebd5763829e9c0cc7b5558e9a24e0a2c79cae346213`
- `app/components/homepage-v25/contribution-bars.test.tsx` — `35ec77854673a9a986eba6926e25c7df39fa9dfcbcb439e1be8b604312ddc198`

`CORRECTIONS.patch` is the complete candidate-1-to-2 correction diff; `NEW-FILES.patch` is the complete three-file addition and `diff-commands.log` preserves exact git output. `PRODUCT-SHA256SUMS` pins the product version, and `READ-SOURCES-SHA256SUMS` pins current workflow, original design/manual/images, root dispatch/acceptance and unchanged independent test. Candidate 1 evidence is preserved: all 36 pinned evidence artifacts matched their original manifest. All original 22 test bodies are unchanged, with six new cases appended.

`SHA256SUMS` pins all three products and all candidate2 evidence present before this final marker, excluding the manifest itself and this marker. Entries: 33. Manifest SHA256: `015bcd58a543027b5cdfb69c21eed90f67668c16f24e01bcf0fa87f06f09d3e6`. Every entry was re-read and matched before this final marker. `freeze-checkpoint.json` records HEAD, scoped status, product/log hashes and preservation checks.

## Separate gates

| Gate | Observed result and limit |
| --- | --- |
| Original consumer regressions + new lifecycle round trips | 28/28 PASS: original 22 + new 6, pinned Node 26.0.0, one worker, GREEN.log. RED-lifecycle.log preserves 22 PASS / 6 FAIL before implementation, including the unwanted reopening and outside-focus counterexamples. |
| Unchanged independent CNY→USD→CNY case | 1/1 PASS, exact original source included by new isolated config with no mergeConfig, one worker, INDEPENDENT.log. RED-independent.log preserves both prior soft failures. Source SHA256 d1d959fa240f5c9702ceebde062e9183d49b9e4d9f124bcf874523b0d380b434 is unchanged. |
| Strict scoped TypeScript / scoped ESLint | PASS, exit 0, typecheck.log / lint.log. |
| Error CSS cascade | Static/jsdom PASS rgb(255, 133, 146), #FF8592; prior neutral failure preserved. Actual browser computed color / visual comparison NOT VERIFIED. |
| Continuous shared desktop zero / narrow fallback | Static declaration checks PASS: one nonempty plot-level line, 36/44px detail exclusion, ≤735px two-line fallback. Actual continuity, x alignment, segment rectangles and reference visual NOT VERIFIED. |
| Original static geometry contract | PASS: 14px solid/hollow outer height, inset hollow, proportional signed widths/no minimum money width, font/pitches/targets/panel declarations retained. No rendered-geometry pass implied. |
| Real mouse / real keyboard / emulated touch / physical touch | NOT VERIFIED separately; worker numerator 0 across CB01–CB15. |
| Responsive overflow / independent visual | NOT VERIFIED. Root owns 1440×1000 / 1280×800 / 390×844, 100% zoom, DPR and container 735/736/737px comparisons, actual scroll sizes/rectangles. Candidate 1 observations stay bound to that version. |
| Actual navigation / complete data / return-reload persistence | NOT VERIFIED, root ownership. Leaf IO/DB writes NOT APPLICABLE because no IO exists. |

CB-M01 is addressed by permanently removing an invalid selection; CB-M02 by sufficient error-selector specificity; CB-M03 by the desktop list-level decorative axis. Scope and limitations are in REPORT.md, SELF-REVIEW.md, DESIGN-COVERAGE.md and CONTROL-STATE-MATRIX.md. The approved ≤735px local two-line strategy remains intact, and ≥736px remains single-line. No new scope, caller API, financial calculation, service, browser, network, DB, dependency, child agent or commit operation occurred. No preview URL, whole-page/100% result or UI delivery is claimed. Root independently reruns and accepts/rejects this candidate.
