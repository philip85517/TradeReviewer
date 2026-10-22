# Chart / period final supplemental review (V2.4.1)

Date: 2026-10-21 (Asia/Shanghai)  
Reviewer: tables, read-only independent review  
Scope: `chart-gap.svg`, `chart-hover--keyboard.svg`, `chart-hover.svg`, `chart-scale--extreme.svg`, `chart-scale--normal.svg`, `chart-scale--wide.svg`, `chart-scale.svg`, and `period.svg` in the current package `source/images`. These eight files were absent from the earlier 39-image shared list and 51-image shared matrix. Historical `holding-option-A/B` candidates are excluded by scope.

## Evidence and method

The source SVGs were rendered with `sharp` at `density: 72`; each PNG canvas exactly matches its source `viewBox`. This is a static SVG raster review, not a browser interaction review. `cua_repl.getState()` had no browser surfaces, and the fresh Chrome headless attempt exited 134 without a screenshot. No Chrome/CUA/keyboard/hover/runtime claim is made for this batch.

The source and raster SHA-256 values are recorded in [`evidence/chart-review-manifest.md`](./evidence/chart-review-manifest.md) and [`evidence/chart-SHA256SUMS.txt`](./evidence/chart-SHA256SUMS.txt). The checked screenshots are in [`evidence/charts/`](./evidence/charts/).

| Image | Source SHA-256 | Canvas | Static result | Evidence / finding |
|---|---|---:|---|---|
| `chart-gap.svg` | `951e2ce4641f595c744cf6eeb25b805ee865c2f2b1873c4c4728d479dedd94db` | 1100×1000 | PASS geometry; OPEN identity | [PNG](./evidence/charts/chart-gap.png). Broken line, unknown `—`, full-gap preserved space, and tooltip are readable; footer still says V2.3. |
| `chart-hover--keyboard.svg` | `a90ce3547100588eb3a033e46c06f49e414e328828bd3823b9ce029f504624e9` | 1100×350 | PASS static; runtime NOT VERIFIED | [PNG](./evidence/charts/chart-hover--keyboard.png). Focus tooltip/crosshair/complete values are within the chart; keyboard behavior was not exercised. |
| `chart-hover.svg` | `856091744b956f37ab080494c46d5484d03ffa0c2fa91838d3034f0bac100b02` | 1100×350 | PASS static; runtime NOT VERIFIED | [PNG](./evidence/charts/chart-hover.png). Tooltip avoids the curve and edge; hover timing was not exercised. |
| `chart-scale--extreme.svg` | `5a55263f83ded74305163dabe085d007ec5159c5dc373d1608acb6b4b45dfacc` | 1100×380 | PASS | [PNG](./evidence/charts/chart-scale--extreme.png). CNY axis, ending gap, line break, and date labels have no static collision. |
| `chart-scale--normal.svg` | `5d4af3a400cf93317f5f4e9c99c7df245554462ecfd19d44349cc70023bebe35` | 1100×380 | PASS | [PNG](./evidence/charts/chart-scale--normal.png). Normal-range axis, line, ticks, and dates have no static collision or clipping. |
| `chart-scale--wide.svg` | `f56a3becdc0abc70c2022f9cefd02e9703490f49d7cd0e5c1d4198ea92e4cd22` | 1100×380 | PASS | [PNG](./evidence/charts/chart-scale--wide.png). Starting gap and line break are visible without a fabricated connecting segment. |
| `chart-scale.svg` | `5e5e4200cf8733e0c6a8f478bb9f15fb80e5dbdf5e7cfb6f1363493bd651f5b7` | 1100×380 | **FAIL (spec)** | [PNG](./evidence/charts/chart-scale.png). Geometry is clean, but visible ticks are `2亿/1亿/0亿/-1亿/-2亿`; the current chart contract requires two decimal places for 万/亿 abbreviations. Owner should use `2.00亿` etc. or document an exact-integer exception. |
| `period.svg` | `9454786027b6d9c9875b5ee49f503557e58ae77d1c2584e168724c81a77b01f2` | 1100×1100 | PASS geometry; OPEN identity | [PNG](./evidence/charts/period.png). Quick ranges, custom-date validation, KPI cards, CNY chart, and date controls do not overlap; footer still says V2.3. |

## Final disposition

No source image was changed by this review. Return `chart-scale.svg` to its owner for the tick precision decision, and return `chart-gap.svg`/`period.svg` for current V2.4.1 footer identity. Keep tooltip timing, keyboard focus, date Apply/Cancel, and runtime error behavior **NOT VERIFIED** until a real browser surface is available.
