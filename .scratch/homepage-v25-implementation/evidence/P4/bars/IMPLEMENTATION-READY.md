# Candidate 1 — frozen for independent review

Frozen at 2026-10-23T07:26:03.972933+08:00 by /root/contribution_bars, actual gpt-6.1-sol / ultra. HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. This marker is the worker's final write. No product/evidence writes follow pending root's formal ruling. Root acceptance is pending, round0/3; this is review readiness, not feature acceptance.

## Exact product version

- `app/components/homepage-v25/contribution-bars.tsx` — `8e01b337f4d3774e6778683247e0ab3f56c0676485db33065216733d377b3fcc`
- `app/components/homepage-v25/contribution-bars.css` — `67993922cb8f7def8b6693c2bda986ac2fa5edf4d537b850a67d0b44769935c2`
- `app/components/homepage-v25/contribution-bars.test.tsx` — `2cc9f4b7efcc5423cbfc45cab051000aff065b4be83571c1f158c4d32fc8152b`

The complete3file addition is `NEW-FILES.patch`; exact diff commands/stdout offsets/stderr/expected exit1 are in `diff-commands.log`. `PRODUCT-SHA256SUMS` repeats the product hashes. `SHA256SUMS` pins all3product files and all evidence files present before this marker, excluding the manifest itself and this final marker. Manifest SHA256: `38295706a2e82137a59720a514aeb6a3789c3ff0693c72625523ae09d82ce215`. `READ-SOURCES-SHA256SUMS` pins the original design/workflow/image sources. `freeze-checkpoint.json` records HEAD, scoped status and the unchanged final verification logs.

## Separate gates

| Gate | Candidate evidence / status |
| --- | --- |
| Existing synthetic consumer assertions |22/22 PASS, pinned Node26.0.0, single worker, only new test; GREEN.log. Earlier17/21PASS logs and meaningful RED failures retained. |
| Strict scoped types / scoped lint |PASS, typecheck.log / lint.log, exit0. |
| Static style parsing / mocked position |PASS, style-audit.log and literal mocked rect assertions; no real browser geometry claim. |
| Retained-selection restoration |UNRESOLVED root-flagged concern: guard hides selection on CNY→USD, then original CNY/rows/fullTotal may reopen stale detail. Existing tests cover one-way replacement only. Root explicitly requested this candidate frozen without a new test/fix; independent formal round1 reproduction pending. |
| Real mouse / keyboard / emulated touch / physical touch |NOT VERIFIED separately; worker numerator0 for every CB01–CB15 row. |
| Independent reference visual / responsive overflow |NOT VERIFIED. Root owns1440×1000/1280×800/390×844, available-container735/736/737px,100% zoom,DPR, real rects/scroll sizes and screenshot comparison. Approved local two-line strategy is recorded in REPORT.md. |
| Actual navigation / complete page data / return-reload persistence |NOT VERIFIED, root ownership. Leaf IO/DB writes NOT APPLICABLE by no-IO scope; feature persistence still required. |
| Financial integration |BLOCKED by frozen A future-HKD/valid-USD FX counterexample; P2/P4 financial gate and P4 formal0/3 unchanged. |

`REPORT.md`, `CONTROL-STATE-MATRIX.md`, `DESIGN-COVERAGE.md` and `SELF-REVIEW.md` preserve scope, exact references, controls and limitations. No browser/service/network/DB/child agent/commit was used. No preview URL, visual PASS, whole-module/100% result or page delivery is claimed. Root performs independent acceptance before any authorized revision.
