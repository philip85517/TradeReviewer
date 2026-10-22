# Chart / period supplemental review manifest

Date: 2026-10-21 (Asia/Shanghai)  
Reviewer: tables (read-only independent review)  
Scope: the eight current `source/images` references that were absent from the prior 39-image shared list and the 51-image shared coverage matrix: seven chart states plus `period.svg`. The eight historical `holding-option-A/B` candidates remain out of scope.

## Render evidence

Each PNG below was rendered from the current source SVG with `sharp` at `density: 72`, preserving the SVG `viewBox` dimensions exactly. The raster canvas dimensions in the table are the review canvas, not a browser viewport. This is a static SVG raster check; it is not a CUA interaction check. `cua_repl.getState()` returned no browser surfaces, and a fresh local Chrome headless attempt exited with status 134 without producing a screenshot, so no Chrome or real-browser claim is made for this supplemental batch.

The source hash binds each visual conclusion to the current source at review time. PNG hashes bind the checked raster evidence.

Reference contract: `source/visual-design.candidate.md`, section “曲线应让用户注意到什么” and the `chart-*`/`period.svg` state-demo references (current package source; lines 218–246 in this revision). The contract requires a single 2px curve, at most seven y ticks, explicit market currency, two-decimal 万/亿 axis abbreviations, complete tooltip/accessibility amounts, zero-line/grid colors, edge-avoiding tooltip placement, and a broken line with `—` for unknown gaps. The period reference also requires the quick range/custom-date draft and validation states to keep the current data unchanged until Apply succeeds.

| Source image | Source SHA-256 | SVG viewBox / raster canvas | PNG evidence | PNG SHA-256 | Static result |
|---|---|---:|---|---|---|
| `chart-gap.svg` | `951e2ce4641f595c744cf6eeb25b805ee865c2f2b1873c4c4728d479dedd94db` | `0 0 1100 1000` / `1100×1000` | [chart-gap.png](./charts/chart-gap.png) | `8f030c5a5056dddfa6801488df81265b6666465a79299006930ea4a157874ed6` | PASS geometry; **OPEN** current footer still says V2.3 |
| `chart-hover--keyboard.svg` | `a90ce3547100588eb3a033e46c06f49e414e328828bd3823b9ce029f504624e9` | `0 0 1100 350` / `1100×350` | [chart-hover--keyboard.png](./charts/chart-hover--keyboard.png) | `c1cd05cd0d25551c92fb6b36df5fdb18dec0e8a114c98ef480829c3327438aaf` | PASS static tooltip/focus geometry; runtime keyboard **NOT VERIFIED** |
| `chart-hover.svg` | `856091744b956f37ab080494c46d5484d03ffa0c2fa91838d3034f0bac100b02` | `0 0 1100 350` / `1100×350` | [chart-hover.png](./charts/chart-hover.png) | `c58e0a4fb7ddbfdfbf70ab4fa339d071cff9f67be0589744bd9fe26cc0570ba9` | PASS static tooltip/hover geometry; runtime hover **NOT VERIFIED** |
| `chart-scale--extreme.svg` | `5a55263f83ded74305163dabe085d007ec5159c5dc373d1608acb6b4b45dfacc` | `0 0 1100 380` / `1100×380` | [chart-scale--extreme.png](./charts/chart-scale--extreme.png) | `6106646dbae05e789c5a64438ccb8e48ba763b66a1bb899b03cd72f31e919723` | PASS static gap/axis geometry |
| `chart-scale--normal.svg` | `5d4af3a400cf93317f5f4e9c99c7df245554462ecfd19d44349cc70023bebe35` | `0 0 1100 380` / `1100×380` | [chart-scale--normal.png](./charts/chart-scale--normal.png) | `b4cd700056817b3283f1a5ec1db854432be9283de33bc803d023531fe335d772` | PASS static axis/line geometry |
| `chart-scale--wide.svg` | `f56a3becdc0abc70c2022f9cefd02e9703490f49d7cd0e5c1d4198ea92e4cd22` | `0 0 1100 380` / `1100×380` | [chart-scale--wide.png](./charts/chart-scale--wide.png) | `6ba2200b162e9afa82252982d42dc95ae4ae75b259daa964683e32ae2bb3c591` | PASS static gap/axis geometry |
| `chart-scale.svg` | `5e5e4200cf8733e0c6a8f478bb9f15fb80e5dbdf5e7cfb6f1363493bd651f5b7` | `0 0 1100 380` / `1100×380` | [chart-scale.png](./charts/chart-scale.png) | `4a0ef4db9e3c7bcbb3a8aa8b3ffbd5274c89ff015886e8a35bf34f98edec9509` | **OPEN SPEC**: labels are `2亿/1亿/0亿/-1亿/-2亿`, while the current chart contract requires two decimal places for 万/亿 abbreviations |
| `period.svg` | `9454786027b6d9c9875b5ee49f503557e58ae77d1c2584e168724c81a77b01f2` | `0 0 1100 1100` / `1100×1100` | [period.png](./charts/period.png) | `a14b26a8ba807b2899d47f2a977bc354c3ab323ab3b1b9b8c86e8a543ef67bef` | PASS geometry; **OPEN** current footer still says V2.3 |

## Review notes

- `chart-gap.svg` preserves the missing-data contract: the line is broken, the tooltip exposes `金额 —`, and the full-gap panel keeps space without inventing a zero. No overlap or clipping was visible in the raster.
- `chart-hover.svg` and `chart-hover--keyboard.svg` keep the 264×112-style detail content inside the chart, with the tooltip placed away from the curve/edge. Static focus/hover marks are visible; hover timing, keyboard focus, arrow/Home/End/Enter/Esc behavior remain **NOT VERIFIED**.
- `chart-scale--normal.svg`, `chart-scale--wide.svg`, and `chart-scale--extreme.svg` keep the CNY axis and missing-start/missing-end semantics without a fake connecting line. No static text or plot collision was visible.
- `chart-scale.svg` has no geometry collision, but its compact axis labels are integer 亿 labels. `source/visual-design.candidate.md` states that 万/亿 axis abbreviations retain two decimals. This is an owner follow-up (`2.00亿`, `1.00亿`, `0.00亿`, `-1.00亿`, `-2.00亿`, or an explicitly documented exact-integer exception), not a source edit by this reviewer.
- `chart-gap.svg` and `period.svg` visibly retain the legacy `V2.3 · 设计状态图，非产品运行截图` footer. The current package is V2.4.1; the footer is recorded as an open identity issue and was not changed in this read-only review.
- These eight images are supplemental to the earlier 51 shared images. They were not previously covered by `work/shared/REPORT.md`, `independent-shared-review.md`, or the archived 51-image matrix.
