# Independent shared review record

日期：2026-10-21（Asia/Shanghai）  
范围：V2.4.1 shared 任务的最终独立复核记录。此目录保存当前浏览器证据、历史 FAIL 快照与逐图报告副本，便于 root 独立验收。没有提交、push、merge，也没有修改 `home*.svg`、主 `visual-samples-board.svg` 或 history/contribution 源图。

## 当前结果

- **History/contribution：19/19 当前源图已在真实 Chrome 1440px 直接渲染并逐张目视检查。** 当前 hash 的静态图稿 PASS；`journeys-year.svg` 当前为明确的加载态，D10 指标卡的 `64.3%` 与 `9 / 14 盈利回合` 共基线且完整落在卡内，年度数据态和交互仍为 `NOT VERIFIED`。逐图表、当前源 hash 和截图见 [history-review-source-report.md](history-review-source-report.md)；当前 PNG 在 [evidence/history/](evidence/history/)。
- **Tables/holdings：23/23 当前源图已独立渲染并目视检查，静态 PASS。** 工具栏/表格带区、表头/数据列锚点、数值右缘、空/加载/错误、分页和局部搜索状态均通过。最新 `local-search-pages--clear.svg` 的页脚在卡片底边下方且未裁切；旧碰撞/裁切截图保留。逐图结论见 [tables-review-source-report.md](tables-review-source-report.md)；26 张逐轮 PNG（含旧 FAIL 与最终复验）在 [evidence/tables/](evidence/tables/)。
- **Manual：当前手册已渲染复核。** `component-manual.html` 当前源 hash 为 `3975b7e0206dc4681fc293a80a8f35fa3cdaa7b2deba81fd6e414ee71914aae0`，最终 Chrome 1440×2400 截图在 [evidence/manual/component-manual-final-retest-1440x2400.png](evidence/manual/component-manual-final-retest-1440x2400.png)，截图 hash 为 `2470c0bcf3301d6aa19d363db84ec27db25b41dc477ec05cfbcc1d31935b8e6b`。手册同时写明实心贡献柱/图例正值 `#53D7A0`、负值 `#EF7F89`，普通亏损数字 `#FF8592`，避免将两类色义混用；“仅看未平仓”历史禁用、16px checkbox/36px 命中盒语义也已同步。
- **Sample board：root-owned，当前 1100×1720 全图复核 PASS。** root 已合入并独立查看 atoms sample-board 补丁；当前源 `visual-samples-board.svg` hash 为 `9e44de3e8c22de4d22ee3029f7ea1be21b966e1aa37968866a45eb237ecd2397`，atoms 源 hash 为 `d9218c2a03551b2bdc2c9ab05925f946d74eb093c8fe8c67f595b06c7bda8af8`。当前 Chrome 1100×1720 复核截图为 [visual-samples-board-final-1100x1720-r2.png](evidence/board/visual-samples-board-final-1100x1720-r2.png)，SHA-256 `7e88ec1baec915c7429ddd93ca0909558e89fce9d3b8d99b57cd5fcee849021e`；直接查看确认外层背景已覆盖至画布底部，旧 `F-BOARD-CLIP-01` 左侧白条不再出现。atoms、D14、D15、D16 的局部几何及整张 board 当前均 PASS。旧 hash `b7466204…` 与截图 `9ac66095…` 的 FAIL 证据继续保留为 superseded history；此前上半部、D14–D16 和全图截图也继续保留：[board-atoms-1440.png](evidence/board/board-atoms-1440.png)、[visual-samples-board-d14-d16.png](evidence/board/visual-samples-board-d14-d16.png)、[visual-samples-board-full-1440.png](evidence/board/visual-samples-board-full-1440.png)。本 worker 没有修改主 board 文件。

## History/contribution 19 张覆盖

| 源图 | 状态 | 当前独立证据 |
|---|---|---|
| `contribution-current-a-share.svg` | PASS | [PNG](evidence/history/current-contribution-current-a-share-1440.png) |
| `contribution-empty.svg` | PASS | [PNG](evidence/history/current-contribution-empty-1440.png) |
| `contribution-error.svg` | PASS | [PNG](evidence/history/current-contribution-error-1440.png) |
| `contribution-extreme.svg` | PASS | [PNG](evidence/history/current-contribution-extreme-1440.png) |
| `contribution-historical-a-share.svg` | PASS | [PNG](evidence/history/current-contribution-historical-a-share-1440.png) |
| `contribution-loading.svg` | PASS | [PNG](evidence/history/current-contribution-loading-1440.png) |
| `contribution-mixed-sign-demo.svg` | PASS | [PNG](evidence/history/current-contribution-mixed-sign-demo-1440.png) |
| `contribution-states.svg` | PASS | [PNG](evidence/history/current-contribution-states-1440.png) |
| `contribution.svg` | PASS | [PNG](evidence/history/current-contribution-1440.png) |
| `history-stats-cumulative.svg` | PASS | [PNG](evidence/history/current-history-stats-cumulative-1440.png) |
| `history-stats-empty.svg` | PASS | [PNG](evidence/history/current-history-stats-empty-1440.png) |
| `history-stats-error.svg` | PASS | [PNG](evidence/history/current-history-stats-error-1440.png) |
| `history-stats-extreme.svg` | PASS | [PNG](evidence/history/current-history-stats-extreme-1440.png) |
| `history-stats-rounds.svg` | PASS | [PNG](evidence/history/current-history-stats-rounds-1440.png) |
| `history-stats-source-missing.svg` | PASS | [PNG](evidence/history/current-history-stats-source-missing-1440.png) |
| `history-stats-win.svg` | PASS | [PNG](evidence/history/current-history-stats-win-1440.png) |
| `history.svg` | PASS | [PNG](evidence/history/current-history-1440.png) |
| `home-history-1440.svg` | PASS（静态位置，root 四 home 合入后重新截图） | [PNG](evidence/history/current-home-history-1440-final-1440.png) |
| `journeys-year.svg` | PASS（当前加载态） | [PNG](evidence/history/current-journeys-year-1440.png) |

当前 `home-history-1440.svg` 在 root 四 home 合入后重新渲染，当前源 hash 为 `1d6dc464ffb34dfb02f92687929c8763d4279279c887884eae195cedb52a0e3c`，最终 Chrome 1440×2346 截图 hash 为 `d6a1f7187ee7b38d19833b40e3e94a39f7607b0daf5abb0cbdf6d5856fbdb25e`；旧 `32075a69…` 截图仍保留为 superseded evidence。

当前 `journeys-year.svg` hash 为 `3c4ef7647ecd9aaac3c446f190ac625b823b6d08b672cdb2f8d7426a5628677d`。旧年度选择器越界和 D10 右缘截断分别保存在 [evidence/history-history-failures/journeys-year-selector-crop.png](evidence/history-history-failures/journeys-year-selector-crop.png) 与 [evidence/history-history-failures/journeys-year-latest-retest.png](evidence/history-history-failures/journeys-year-latest-retest.png)，对应旧 hash；旧 FAIL 不被删除或改写。

## Sample board 当前独立交叉复核

本 worker 没有修改 root-owned 的 `visual-samples-board.svg`。root 将外层背景高度从 1060 修至 1720 后，当前源 hash 为 `9e44de3e8c22de4d22ee3029f7ea1be21b966e1aa37968866a45eb237ecd2397`，atoms 源 hash 为 `d9218c2a03551b2bdc2c9ab05925f946d74eb093c8fe8c67f595b06c7bda8af8`；同视口 Chrome 1100×1720 最终截图为 [visual-samples-board-final-1100x1720-r2.png](evidence/board/visual-samples-board-final-1100x1720-r2.png)，SHA-256 `7e88ec1baec915c7429ddd93ca0909558e89fce9d3b8d99b57cd5fcee849021e`。直接查看确认左侧白条已消失，atoms、D14、D15、D16 和整图当前 PASS。旧源 `b7466204…` 与旧截图 `9ac66095…` 的 `F-BOARD-CLIP-01` 保留为 superseded failure evidence。

## Tables/holdings 23 张覆盖

当前 23 张源图均为 PASS visual：

`holding-option-C-normal-1280.svg`, `holding-option-C-normal-1440.svg`, `holding-option-C-large-1280.svg`, `holding-option-C-large-1440.svg`, `holding-return.svg`, `holding-return--detail.svg`, `holding-return--after.svg`, `count-boundaries.svg`, `count-boundaries--nine-items-last-page.svg`, `count-scales.svg`, `count-scales--ten-items.svg`, `count-scales--twenty-items.svg`, `50-items.svg`, `50-items--page-7.svg`, `local-search-pages.svg`, `local-search-pages--one-match.svg`, `local-search-pages--clear.svg`, `empty.svg`, `empty--zero-holdings.svg`, `loading.svg`, `loading--stale-data.svg`, `extreme.svg`, `atom-datatable.svg`.

关键最终复验是 [local-search-pages--clear-final-retest.png](evidence/tables/local-search-pages--clear-final-retest.png)，当前 owner 源 hash `e10217122ce59480b8ca24f8c43390448afdc469d8a55d054b8a9fe51e28a7ec`，截图 hash `e369c4c8fb81e70527497c5a9d36ed1a0ee8f8ff90e6be73dc7bc8e2f575523e`。历史压边与中间裁切证据仍在 [local-search-pages--clear-retest.png](evidence/tables/local-search-pages--clear-retest.png) 和 [local-search-pages--clear-current-retest.png](evidence/tables/local-search-pages--clear-current-retest.png)。

## 交叉规则与剩余门

当前手册与图稿交叉核对了以下共享规则：全局标的搜索使用全屏遮罩与独立结果滚动，交易库/持仓搜索使用表内局部过滤；工具栏、表头、数据行分带；表头/数据共享列锚点、金额共享右缘、动作控件保持 36px 命中盒；日期字段使用日历图标，年份使用下箭头，“全部”保持静态条件；实盘列表按成交日，统计按回合平仓日；模拟盘一项练习承载一个标的的多个回合，同标的再次练习身份独立；返回来源恢复过滤、排序、页码、滚动和焦点语境。

以下均明确为 **NOT VERIFIED**：真实产品中的鼠标/键盘输入与焦点环、全局遮罩 Esc/外部点击/滚动锁定、局部筛选和分页状态转换、自然本周/本月/本年计算、年度数据请求/重试、回放推进、详情下钻、返回后刷新与上下文恢复、运行时错误恢复、数据库持久化，以及 sample-board 主文件的后续 gallery 集成验收。旧 `F-BOARD-CLIP-01` 已由当前 1720px 背景修复并经同视口浏览器复核关闭；旧 FAIL 证据保留，不能改写为当前状态。静态 1440 图稿按原尺寸查看；1280 文档容器的横向滚动是交付路径，不能将静态裁切当作响应式 FAIL。

Root 仍需独立重建 `review-records/follow-up/build-gallery.py` 生成的 gallery.html，对正文引用的 106 图完成最终集成验收。此目录的报告和证据不代替 root 的整体接受结论。
