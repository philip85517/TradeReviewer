# V2.4.1 C01/C04 table repair report

## Scope

This repair covers the C01 “plus 27 table scan” from the 2026-10-22 comment diagnosis. The repaired source set is the 27 SVGs listed below; each contains the four right-anchored CNY table headers. The additional bounded C04 check covers the four homepage/history SVGs in that same set and records that the redundant `按平仓时间 · 2026` history title is absent from their coordinated current state. Chart/history-only SVGs outside this list were not changed by this repair.

The approved visual reference is D01-A in `.scratch/homepage-v241-repair/visual-options/round2/index.html`, with `source/images/home-1440.svg` shown beside it in the acceptance fixture.

## Static repair and measurement method

SVGs are used as image assets in the page, so an inline SVG script would not run when the asset is loaded through `<img>`. The fix therefore bakes the calibrated `x` values into the four header `<text>` nodes in each source SVG. The values are per table state and per header; there is no universal platform offset.

The calibration follows the approved D01-A glyph-edge algorithm after `document.fonts.ready`: measure the right blank (`measureText(text).width - actualBoundingBoxRight`) for the visible header and its visible row value in the same loaded font, then set `headerX = valueX + headerBlank - valueBlank`. The acceptance page keeps the source font stack and reports the measured header font, value font, fallback state, actual x, target x, and residual. Normal/home rows use the approved 14px regular value contract; option-C rows keep their approved 11px Inter row contract. Empty/loading states use canonical numeric fallback strings only because those states have no visible numeric row glyph to measure.

The independent CUA fixture is:

`http://127.0.0.1:8766/table-calibration-check.html`

It contains a scrollable comparison area with the D01-A iframe and inline `home-1440.svg`, followed by the per-occurrence results. It emits the four header residuals and fallback status for every file.

## Before → after evidence

The initial CUA read of the first bounded pass showed the following visible failures:

| state | header | residual before |
| --- | --- | ---: |
| common/home | `持仓市值(CNY)` | `-0.244339px` |
| extreme | `持仓市值(CNY)` | `-0.235966px` |
| extreme | `持仓浮动盈亏(CNY)` | `-0.244331px` |

The other columns in that first read were zero. These failures came from stale, state-level offsets left by the first bounded measurement pass. The recalibration measures the visible glyphs after the font is ready and accounts for the `万`/signed numeric fallback shape instead of treating the first pass as a generic fixed offset. It also avoids hiding the issue with a broad visual tolerance.

The final CUA read of the generated fixture reports all 27 logical files and all four logical headers as `PASS`. `holding-return--detail.svg` contains two occurrences of each header, so the result is **108 logical header columns / 112 rendered header occurrences**, all with residual `0.000000px` to six decimals and a maximum absolute residual below the fixture’s `0.001px` numeric check. The four D01-A reference entries are measured after `fonts.ready` with the same algorithm and expose these calibrated adjustments:

| header | D01-A anchor | adjustment |
| --- | ---: | ---: |
| `成本价(CNY)` | `791.520px` | `+0.687px` |
| `最新价(CNY)` | `933.200px` | `+0.789px` |
| `持仓市值(CNY)` | `1126.400px` | `+0.550px` |
| `持仓浮动盈亏(CNY)` | `1306.720px` | `+0.769px` |

The final rendered-state result is therefore consistent across all 27 files within the deterministic measurement check. The three no-row states (`empty--zero-holdings.svg`, `empty.svg`, and `loading.svg`) report `fallback=true` for all four columns; their header calibration uses the canonical fallback values. The other 24 files report `fallback=false` for their visible numeric row. This explicitly distinguishes measured numeric rows from fallback-only states.

The final per-state offsets baked by the repair tool are:

| state | 成本价 | 最新价 | 持仓市值 | 持仓浮动盈亏 |
| --- | ---: | ---: | ---: | ---: |
| common | `+0.686523px` | `+0.789063px` | `+0.549969px` | `+0.768555px` |
| extreme | `+0.645508px` | `+0.768555px` | `+0.815968px` | `+0.549965px` |
| option-C | `+0.128906px` | `+0.069824px` | `+0.085938px` | `-1.450195px` |

## C04 history-title cleanup

The coordinated current state of `home-1280.svg`, `home-1440.svg`, `home-history-1280.svg`, and `home-history-1440.svg` contains no redundant `按平仓时间 · 2026` title text node. The approved metric headings and selectors remain present, and a repository scan returns no remaining occurrence in those four files. Broader history content/layout changes in these shared SVGs remain owned by the chart/history work; this report records only the bounded title-presence check and does not attribute that concurrent rewrite to the table repair.

## Exact files changed by this repair

### Source SVGs (27)

- `source/images/50-items--page-7.svg`
- `source/images/50-items.svg`
- `source/images/count-boundaries--nine-items-last-page.svg`
- `source/images/count-boundaries.svg`
- `source/images/count-scales--ten-items.svg`
- `source/images/count-scales--twenty-items.svg`
- `source/images/count-scales.svg`
- `source/images/empty--zero-holdings.svg`
- `source/images/empty.svg`
- `source/images/error--update-failure.svg`
- `source/images/extreme.svg`
- `source/images/holding-option-C-large-1280.svg`
- `source/images/holding-option-C-large-1440.svg`
- `source/images/holding-option-C-normal-1280.svg`
- `source/images/holding-option-C-normal-1440.svg`
- `source/images/holding-return--after.svg`
- `source/images/holding-return--detail.svg`
- `source/images/holding-return.svg`
- `source/images/home-1280.svg`
- `source/images/home-1440.svg`
- `source/images/home-history-1280.svg`
- `source/images/home-history-1440.svg`
- `source/images/loading--stale-data.svg`
- `source/images/loading.svg`
- `source/images/local-search-pages--clear.svg`
- `source/images/local-search-pages--one-match.svg`
- `source/images/local-search-pages.svg`

### Repair tooling and acceptance evidence

- `calibrate-table-headers.mjs`
- `table-calibration-check.html`
- `tables-report.md`

No commit or push was performed. The working tree contains unrelated changes from the other bounded repair owners; this report lists only the files owned by this repair.

## Verification and limitations

- `node --check calibrate-table-headers.mjs` passes.
- The generated fixture script passes an extracted `node --check` syntax check.
- `node calibrate-table-headers.mjs --check` regenerates the fixture from the current SVGs and approved prototype.
- `rg -n '按平仓时间 · 2026'` over the four C04 files returns no match.
- CUA was used for the browser read; no standalone Playwright acceptance was used. The local static server remains available on port `8766` for the URL above.
- The result is tied to the browser’s loaded font stack and its `actualBoundingBoxRight` implementation. A different platform/font substitution can produce different glyph metrics, so the fixture should be rerun in the target browser if that stack changes.
- This repair does not claim acceptance for chart/replay journeys, other history charts, component/build files, manifests, or comments.
