# Revision 10 repair and recheck log

All findings below were preserved rather than overwritten by a later pass. Final hashes and acceptance are recorded separately.

| ID | Observed failure | Evidence / discoverer | Repair owner | Final recheck |
|---|---|---|---|---|
| R01 | 1280-wide prototype scrollWidth1337 | root actual browser, first prototype | navigation_impl | pending |
| R02 | list date mislabeled closing date; stats title remains list title; fake links/pagination | root AX first prototype | navigation_impl | labels corrected in second AX, remaining suite pending |
| R03 | gap statistics direction denominator computed before missing-day exclusion | root source review | design_impl | new regression test PASS, 5/5 |
| R04 | distribution count-axis title overlaps zero tick | root simulation-candidate.png | design_impl | regenerated, screenshot pending |
| R05 | scheme C selected background in right half but label on left | root navigation-C-1440.png + independent source review | navigation_impl | pending |
| R06 | trend SVG shrunk to narrow center | root navigation-B-1440.png | navigation_impl | pending |
| R07 | amount distribution control does not update interval data; inline bars may not render | independent source review | navigation_impl | pending |
| R08 | mode render destroys slider and keyboard focus, defeating actual motion | independent source review | navigation_impl | pending |
| R09 | homepage module does not consume real valuation API shape/timestamp | independent direct module call | home_impl | actual generator call +5 tests PASS; visual pending |
| R10 | homepage history empty/future zones use point boundary instead of half-month boundary and exceed plot | independent direct rendered XML | home_impl | static geometry PASS, end1296; visual pending |
| R11 | homepage trend emphasized zero line remains at negative lower bound | independent source review | home_impl | static scale/zero464.571 PASS; visual pending |

Raw early screenshots navigation-{A,B,C}-1440.png and simulation-candidate.png are preliminary evidence, not final acceptance. No original comments or statuses changed.

| Additional ID | Observed failure | Repair / recheck |
|---|---|---|
| R12 | Return home removed HOME selected state instead of focusing original library entry | template keeps active home, independent library focus ring; static PASS, visual pending |
| R13 | delegated mode selector catches root ancestor and intercepts tab/measure | buttons scoped; root fresh browser mode/tab PASS, full suite pending |
| R14 | simulation amount bin put +98 in >100 bucket | corrected [1,1,0,1,4]; independent source PASS |
| R15 | trend zero outside positive domain; points stretched; frequency minimum width distorted ratios | domain includes0, non-scaling rounded point strokes, exact count/max width; visual pending |

Implementation repairs all returned; browser-loaded old script verified before reload then final selector verified after reload. No server-root mismatch observed.

## Independent browser wave 2

- R16: 1280 toolbar longer simulation status squeezes scheme controls and increases height while sidebar starts at58px; TR is obscured. Evidence independent/nav-a-simulation-stats-1280.jpg and nav-c-simulation-stats-1280.jpg. Fixed single-row toolbar with measured height via ResizeObserver; independent recheck pending.
- R17: canonical8-row holdings template retains6 blue detail glyphs on empty bound rows. Evidence independent/handoff-1440.jpg. Remove unused-row actions while retaining full panel dimensions; home_impl fixing.
- R18: main home trend x positions use sample index while six date labels use rounded selected indexes at fixed axis positions. Actual fixture dates irregular; source+root screenshot confirm unreliable date-to-point alignment. Unify elapsed-day x scale for points, labels and vertical grids; home_impl fixing.

Other prototype controls: independent completed24 normal combinations across2widths, per-mode dates, amount/rate, normal/loading/empty/error and arrow/Home/End keyboard checks; prototype cannot PASS untilR16 geometry recheck.

## 最后一轮阅读器回归与收敛

- R19：R16第一次修复后C方案按钮仍被状态选择器覆盖；独立实际点击发现。scheme-field改220px、preview148px、间距18px；最终1280与1440逐点切换通过，旧失败截图保留。
- R20：BT02候选链接段落插在尺寸表中间，生成阅读器只剩第一行表格，其余管道文本。root发现，design_impl仅移该段至表后；重新构建后8数据行完整。root-reader-table-before.png与final/lower.png保留前后。
- R01–R19：最终候选范围修复通过，逐项依据见INDEPENDENT-ACCEPTANCE.md，包含完整正常组合、最终工具栏复验、首页对照、数据与费用核算。上方pending是当时历史状态。R20由ROOT-READER-ACCEPTANCE.md记录，独立视觉结论另见独立报告。
