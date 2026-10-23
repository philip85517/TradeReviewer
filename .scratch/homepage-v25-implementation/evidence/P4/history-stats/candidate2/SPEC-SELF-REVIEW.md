# Specification self-review — candidate2

Reviewer is the implementer, not an independent acceptor. Scope and exact reference mapping were recorded in DESIGN-COVERAGE.md before the test edit. This is candidate2 of the same history leaf; formal1/3 FAIL remains historical and unresolved by this self-review.

## Finding and bounded correction

Confirmed the actual source rather than patching only the report: the primary percentage branch used `Decimal(read.raw).toFixed()` with no decimal limit. The exact/detail branches independently used the original `read.raw` string. Therefore the correct boundary is the primary display expression only. The product diff is one line: `toFixed(1).replace(/\.0$/, "")`, followed by `%`. This rounds only presentation and keeps the existing0%/100% main-value contract. No count or monetary input is used to derive the rate.

Real RED was run against the exact candidate1 TSX/CSS hashes:39 collected,3 failed/36 passed. Failures showed64.285714285714285714%,33.333333333333333333%,66.666666666666666666% rather than64.3%,33.3%,66.7%. All original29 test cases were preserved byte for byte and passed in RED. After the one-line product edit,39/39 passed with exit0. Complete logs:01-real-red.log and02-green.log.

| Contract | Self-review result and evidence | Limit |
| --- | --- | --- |
| Approved normal64.3% from committed high precision | PASS at synthetic text level; exact root counterexample added, expected64.3% | Actual visible `%`/reference comparison NOT VERIFIED |
| Original raw precision in AX and details | PASS synthetic:64.285714285714285714% and two further fractional rates retained exactly | Actual browser detail measurement NOT VERIFIED |
| Raw endpoint precision | PASS synthetic:0.000000000000000000% and100.000000000000000000% retained in detail/AX while primary0%/100% | Actual browser endpoint layout NOT VERIFIED |
| Independent percentage/count semantics | PASS synthetic: winningRounds0 with supplied nonzero rates and100%; ratio remains0/14 | Upstream financial calculations are outside this leaf |
| Invalid/unavailable percentage remains unknown | PASS synthetic:NaN, just-above100, tiny negative, null, stale available:false; unrelated amount/count/fee remain | No additional data inference introduced |
| Existing money, coverage, FX, denominator, status and context contracts | Original29 preserved and passed; only rate display expression changed | Full range/chart/contribution/IO chain NOT VERIFIED |
|88px cards,28px main type, fixed order, A/B layout,120/150/160ms and reduced motion | CSS byte-identical; existing synthetic lifetime/group/focus tests passed | Matching actual width states, native interactions and motion frames NOT VERIFIED |

No further in-scope specification defect was demonstrated by this bounded source/diff review. This statement does not remove the candidate1 root visual FAIL or predict root acceptance. Root must run matching rendered normal/error/empty/extreme states at1440×1000,1280×800,390×1000, card-width boundary sides, exact detail precision, native mouse/key/Esc/focus and motion. Existing old independent evidence remains version-bound to candidate1.
