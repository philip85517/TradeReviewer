# Metrics leaf — root acceptance 1/3 FAIL

2026-10-23 07:23 CST. Scope: controlled four-card readout only, not P2/page/financial integration. Root is independent of the implementer. Actual worker model gpt-6.1-sol / ultra. Original dispatch, spec/image coverage and constrained-width/currency rulings remain authoritative.

Frozen candidate1 SHA256: TSX `344ee710457cc95f2cf384a882b9c800e84cc5c1ea068216c44cc4e915284bea`; CSS `5a99e9f9a77cb2e7d20340d9a40e0757cbc7917222e74fbc358646c4c9267194`; test `4c4aeb1393c09bdc7a81d127002d3a032c2fb5850011cf502117426abf2e3d3a`. Root independently ran the new file:20/20 PASS (`ROOT-candidate1-tests.log`). Tests do not override this visual FAIL.

## M-01 Important: detail affordance covers the amount suffix

Real IAB 390×844 DPR1, root independent literal caller at `http://127.0.0.1:3334/metrics.html`, select 极长金额与来源, open period-net detail, press Escape. Exact trigger receives focus; focus-visible affordance then obscures the lower half of the unit 亿. Evidence `../../continue-2026-10-23/metrics-candidate1-long-focus-390.jpg`, directly viewed by root. Ordinary long state screenshot `metrics-candidate1-long-390.jpg` shows the suffix before focus. The approved fallback permits ellipsizing magnitude only while retaining sign/unit and keeping the amount stable across focus/hover.

Read-only rendered geometry: card x24/y204/w342/h88; unit x315.008/y241/w33.992/h34 (bottom275); affordance x301/y259/w56/h24 (bottom283), opacity1. Vertical intersection16px. Source CSS absolute right8/bottom8 plus opaque background creates the overlap; amount has no space reservation. A same-state DOM assertion alone cannot prove this visually safe. Candidate2 must keep ordinary values untruncated, sign/suffix visible in default/focus/error/hover, existing88px height and28/34 typography, complete exact detail, and proper 120ms/reduced-motion behavior. Do not shrink all content or introduce scientific notation.

## Finite independently checked coverage

|Registry / actual instances|Result|Evidence and boundary|
|---|---|---|
|M01–04 standard four cards; M05 all4 Tab-order/Enter or Space/open/Esc/exact restoration|PASS finite|Root actual mouse and keyboard, full exact values; default/detail/current-detail1440 screenshots in continue directory|
|M06 outside close|PASS finite|Actual external-action click closes and restores period-net trigger|
|M07 pending; M10 failed update|PASS finite|Previously committed generation2 values retained; failure has 查看原因 and original context in real opened detail; `metrics-candidate1-error-detail-1440.jpg`|
|M08 first load; M09 empty/missing/future|PASS finite|4 skeletons/no invented0; empty4—; missing net alone—; future3 period— and numeric detail suppressed while current260102.123400 remains|
|M11 signs/zero|PASS finite|Positive green, realized neutral0.00, UF negative red; actual `metrics-candidate1-signs-1440.jpg` directly viewed|
|M12 long precision/original currency/source; currency mismatch|PASS finite|Long negative full exact string, USD/HKD originals and full FX source readable in390 detail (`metrics-candidate1-long-detail-390.jpg`); mismatch—+reason, real originalUSD retained, no conversion/relabel|
|M13 period/current independence|PASS finite|Actual version1→2 changes18420.567800→30000.432100 and realized, current market260102.123400/UF23153.2500 unchanged|
|M14 primary long/focus|FAIL|M-01 above|
|M15 desktop1280/1440|PASS finite standard|4 equal279×88 cards,12px gaps in1152px root-caller content; this is not whole-page layout acceptance|
|M16 narrow390 + local breakpoint sides|PASS finite geometry, visual FAIL focus|390 one342×88 column. Viewport1044/1043 gives container996/995:4×240→2×491.5; viewport540/539 gives492/491:2×240→1×491. No horizontal overflow. Screenshot review covers390/1280/1440; each boundary-state visual remains NV|
|M17 real hover/reduced motion/touch|NOT VERIFIED|No documented mouse-move/hover input; no physical/emulated touch or reduced-motion real execution. CSS/tests cannot replace actual evidence|
|M18 frozen input/generation replacement|PARTIAL|20 tests PASS; independent review underway, exact identity-return behavior not yet accepted|

Root caller initially supplied incorrect first-load text saying old data retained; this was caller fixture error, not product bug. Root corrected only caller status.reason and actually rechecked null+pending and null+error: 正在首次读取指标 / 首次读取指标超时，尚无已提交数据. Original screenshots retained with this correction documented. Real host wording remains NV.

Every four-card × applicable-state interaction/visual permutation is not yet closed. Page atomic B/host integration, current/historical data truth, real persistence and whole-page visual are NOT VERIFIED/BLOCKED. DB writes are NOT APPLICABLE only for this no-IO leaf.

## Disposition

FAIL1/3. Keep original sources and evidence. Wait for independent review to consolidate findings, then return a bounded candidate2 to original owner. Do not change A/B/F, caller/host, old tests or any performance task. P1 remains2/3 FAIL; P2/P3/P4 formal0/3; this leaf verdict neither resets nor accepts those tasks.

## Consolidated independent review and root reproduction — 07:29 CST

Independent reviewer GPT-6.1 SOL / ultra: Critical0 / Important1 / Minor1; full report `independent-review/REVIEW.md`. Important I-01 corroborates root M-01 above. Minor M-01: currency-context invalidation masks but retains old detail selection; same immutable bundle CNY→USD closes, then CNY reopens without activation. Root independently ran exactly the reviewer's one literal consumer counterexample: 1/1 FAIL, exit1, 1.97s (`ROOT-independent-currency-context.log`). Initial mismatch close/restoration passed; final reopen assertion failed and outside-focus assertion was not reached. Do not report generation/source variants as independently reproduced. Both issues consolidate into this same formal FAIL1/3, not another round.

Authorize bounded candidate2 in the same three product files only, plus new candidate2 evidence. Preserve existing tests and old evidence; add the permanent invalidation regression and fix amount/action non-overlap without changing approved typography, height, value/currency semantics or host/financial code. Root will independently rerun old counterexample and actual narrow default/focus detail journey before any next verdict.
