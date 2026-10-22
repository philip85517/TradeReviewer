# Tables / holdings independent visual review

日期：2026-10-21（Asia/Shanghai）  
执行者：shared（Luna 5.6 MAX）  
对象：`source/images/` 表格、持仓、分页、局部搜索和数据表原子图 23 张  
参考：`source/visual-design.candidate.md` §HP04、§HP11；`prototypes/round4/index.html` D01；round4 D10 统计卡；当前 source 图稿

## 结论

我将当前 23 张源 SVG 逐一用本地 Chrome headless 按 SVG 固有尺寸渲染为 PNG，并直接查看了每张图；截图和当前源图 SHA-256 绑定在 [`SHA256SUMS.txt`](./SHA256SUMS.txt)，截图在 [`browser/`](./browser/)。静态 XML/设计守卫由 `python3 .scratch/homepage-v241-repair/work/tables/verify_tables.py` 复核，结果为 `PASS all table/holding static checks`。

23 张图的表格带区、工具栏、表头/数据列锚点、金额右缘、分页结构和状态几何通过本次静态视觉复核。`local-search-pages--clear.svg` 的历史页脚压边已被 owner 移到卡片底边下方；owner 随后将可见 clip 高度扩展到画布高度，最新 Chrome 复验确认页脚可见且与卡片底边留有间距。本报告保留前两轮失败截图与哈希作为历史证据，当前版本通过。

### 逐图清单

| 图稿 | 状态 | 实际渲染观察与参考 | 证据 | 未验 |
|---|---|---|---|---|
| `holding-option-C-normal-1280.svg` | PASS visual | 1280 画布中标题摘要、搜索/导出工具和表头/数据均分带；4 张 C 图的 `(CNY)` 表头为半角，数值列右缘一致。对照 HP11/D01。 | [PNG](./browser/holding-option-C-normal-1280.png) | 仅静态图稿；未验产品运行时交互/持久化 |
| `holding-option-C-normal-1440.svg` | PASS visual | 1440 原尺寸直接渲染；标题摘要与表格带不重叠，长表头仍落在各自列。对照 HP11/D01。 | [PNG](./browser/holding-option-C-normal-1440.png) | 未验 1440 产品 viewport 响应 |
| `holding-option-C-large-1280.svg` | PASS visual | 大数值/长名称未侵入搜索、导出和动作列；列右缘稳定。对照 HP11。 | [PNG](./browser/holding-option-C-large-1280.png) | 仅静态图稿 |
| `holding-option-C-large-1440.svg` | PASS visual | 1440 大版状态保持标题、工具栏、表头和数据的独立带区；无数值碰撞。对照 HP11。 | [PNG](./browser/holding-option-C-large-1440.png) | 未验产品运行时交互 |
| `holding-return.svg` | PASS visual | 返回后的持仓列表保留表头/数据对齐、固定操作列和分页区；与 HP04/HP11 一致。 | [PNG](./browser/holding-return.png) | 真实返回、刷新、过滤/排序恢复未验；root 已另行直接复验 |
| `holding-return--detail.svg` | PASS visual | 详情卡与表格 fixture 的 `182.00` 数量、`125,337.94 CNY` 市值和 `9,431.24 CNY` 浮盈可对应；标题摘要在同一基线。 | [PNG](./browser/holding-return--detail.png) | 真实详情导航/持久化未验；root 已另行直接复验 |
| `holding-return--after.svg` | PASS visual | 返回后表格列、操作 hit box 和分页保持稳定，没有标题/工具栏覆盖。 | [PNG](./browser/holding-return--after.png) | 真实返回刷新未验；root 已另行直接复验 |
| `count-boundaries.svg` | PASS visual | 5/9 边界的分页和行槽位稳定，表头与数据列共用锚点；没有空槽位挤压工具栏。对照 HP04。 | [PNG](./browser/count-boundaries.png) | 运行时分页切换未验 |
| `count-boundaries--nine-items-last-page.svg` | PASS visual | 最后一页显示 `9–9 / 9` 与单行，其余固定行槽位保留；底部分页带不跳动。对照 HP04。 | [PNG](./browser/count-boundaries--nine-items-last-page.png) | 运行时页码/键盘分页未验 |
| `count-scales.svg` | PASS visual | 5 项状态的固定行高和分页区域稳定；标题摘要与搜索工具不重叠。 | [PNG](./browser/count-scales.png) | 运行时分页未验 |
| `count-scales--ten-items.svg` | PASS visual | 10 项状态显示跨页结构，表格底部和控制区保持原几何。对照 HP04。 | [PNG](./browser/count-scales--ten-items.png) | 运行时分页未验 |
| `count-scales--twenty-items.svg` | PASS visual | 20 项状态保持同一列锚点和多页分页；长列表没有侵入底部控制带。 | [PNG](./browser/count-scales--twenty-items.png) | 运行时分页未验 |
| `50-items.svg` | PASS visual | `1–8 / 50`、`1 / 7` 分页和 8 行结构稳定；数字列右对齐。对照 HP04/HP11。 | [PNG](./browser/50-items.png) | 运行时分页/搜索未验 |
| `50-items--page-7.svg` | PASS visual | `49–50 / 50`、`7 / 7` 最后一页保留固定分页带和列位置；无底部重排。 | [PNG](./browser/50-items--page-7.png) | 运行时页码切换未验 |
| `local-search-pages.svg` | PASS visual | 局部搜索在表内工具栏，结果区和全局搜索遮罩语义分离；第 3 页 `17–24 / 50` 的分页与表格对齐。对照 HP04。 | [PNG](./browser/local-search-pages.png) | 真实输入、清空后回到第 1 页未验 |
| `local-search-pages--one-match.svg` | PASS visual | 单结果显示 `1–1 / 1`，没有伪造多页分页；表头/数据不因过滤改变列锚点。 | [PNG](./browser/local-search-pages--one-match.png) | 运行时过滤语义未验 |
| `local-search-pages--clear.svg` | PASS visual (current) | 历史版本把页脚基线放在变换后 `y=518`，与卡片底边 `y=520` 相撞（历史证据保留在 [`local-search-pages--clear-retest.png`](browser/local-search-pages--clear-retest.png)）。中间版本虽将页脚移到变换后 `y=544`，但 `clipPath#frame-clip height=520` 将其裁掉（中间证据保留在 [`local-search-pages--clear-current-retest.png`](browser/local-search-pages--clear-current-retest.png)）。当前 owner 版本把 clip 高度扩至 `560`，Chrome 中页脚位于画布底部、卡片底边 `y=520` 下方，未见重叠或裁切。 | 当前证据 [`local-search-pages--clear-final-retest.png`](browser/local-search-pages--clear-final-retest.png)；当前源 hash 与截图 hash 在 `SHA256SUMS.txt` | 仅静态图稿；清空动作和回到第 1 页未验 |
| `empty.svg` | PASS visual | 零行空态保留表头、固定行槽位和卡片几何；空态不显示虚假的 `1 / 1` 交互分页，符合 HP04。 | [PNG](./browser/empty.png) | 运行时空态触发未验 |
| `empty--zero-holdings.svg` | PASS visual | `暂无持仓` 状态保留 0 值列和空态结构；无分页控件挤入空态。 | [PNG](./browser/empty--zero-holdings.png) | 运行时数据/权限语义未验 |
| `loading.svg` | PASS visual | 加载骨架保留标题、表头、列锚点、行槽位和分页区；加载状态没有覆盖搜索工具。 | [PNG](./browser/loading.png) | 请求时序和焦点/键盘未验 |
| `loading--stale-data.svg` | PASS visual | 旧的完整有效数据仍在加载态中保留，列锚点和动作区不跳动；符合状态表“保留旧数据”的视觉合同。 | [PNG](./browser/loading--stale-data.png) | 更新提示语义、请求/重试时序未验 |
| `extreme.svg` | PASS visual | `12.35 亿`、`+3456.80 万`、`−9.88 亿` 与未知值 `—` 均落在既定数值列内；长值没有撞动作列。对照 HP11。 | [PNG](./browser/extreme.png) | 运行时格式化/排序未验；root 已另行直接复验 |
| `atom-datatable.svg` | PASS visual | 默认、悬停、聚焦、按下、禁用、加载、空、错误八态在双列面板中保留同一表头/数据锚点、操作区与摘要基线；无状态层重叠。 | [PNG](./browser/atom-datatable.png) | 真正 hover/focus/keyboard 状态未验；静态状态已直接查看 |

## 方法与边界

- 23 张图均从当前 `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images/` 读取，用真实 Chrome headless 生成 PNG；不以源码解析替代视觉检查。截图尺寸跟随 SVG 固有画布（C 图 1280/1440；其余表格图 1100；atom 2180），不是响应式产品 viewport 断言。
- `verify_tables.py` 通过，且源图/截图哈希已写入 `SHA256SUMS.txt`；后续任何修复必须更新对应截图和哈希。
- 1440 原稿按设计要求以原尺寸检查；在 1280 文档容器中需要横向滚动查看完整画布，不能把裁切当成响应式 FAIL。
- 本次覆盖表格视觉，不替代实际输入、鼠标/键盘焦点、分页/局部过滤、返回上下文、刷新、请求错误恢复或数据库持久化验收。
- root 已独立验收 `holding-return.svg`、`holding-return--detail.svg`、`holding-return--after.svg`、`extreme.svg` 及 home 持仓区域；本清单仍保留这些图的独立截图，以便按同一 hash 复核，不把实施者报告当成接受证据。

## 与 history 复核的交叉提醒

此前 history/contribution 复核报告在 [`../history-review/REPORT.md`](../history-review/REPORT.md)。当前独立复验的 `journeys-year.svg` hash 为 `56b9c578ae05aa6bb7ef6342ee7438ee472de0d3a2dc24d378e15db3700d8bf8`：年度选择器 chevron 已在边框内，旧越界结论仅保留作历史记录；D10 计数已与主值同基线但仍从右缘截断，F-HIST-02 继续 FAIL。该问题不因本表格组 PASS 项而关闭。

## 最新 local-search-pages--clear 独立复验（2026-10-21）

tables owner 修复期间，我再次从当前源图用真实 Chrome headless 1100×560 渲染并直接查看 `local-search-pages--clear.svg`。历史源 hash 为 `2294ed552ce1b67699dcc0c04ace9e0133c9a46e7804e7aaad9702596560cae1`、历史截图 hash 为 `476a3a84c3a0e1b1185c9647b6dbb0cbe3a67d74d849034d53c64cb0d9906098`，该证据保留说明旧页脚压边。中间 owner 源 hash 为 `20da2af79643783873862316a350f89d688e54e44cc18381bc02cfa6380f6bb7`，截图 [`browser/local-search-pages--clear-current-retest.png`](browser/local-search-pages--clear-current-retest.png) 的 hash 为 `76426b3649d851b5c19a6338e68e5c6d778f7ed59ddecbd09246f04c7461fd79`，该轮页脚落在 `y=544` 但被 `height=520` clip 裁掉；这些失败证据保留。最新 owner 源 hash 为 `e10217122ce59480b8ca24f8c43390448afdc469d8a55d054b8a9fe51e28a7ec`，其 `clipPath#frame-clip` 高度为 `560`，页脚源基线 `y=1870` 变换后为 `y=544`。最新截图 [`browser/local-search-pages--clear-final-retest.png`](browser/local-search-pages--clear-final-retest.png) 的 hash 为 `e369c4c8fb81e70527497c5a9d36ed1a0ee8f8ff90e6be73dc7bc8e2f575523e`；直接查看确认页脚可见、在卡片底部下方且未与分页/边界重叠，当前视觉 PASS。此轮仍未修改 owner 源图。

