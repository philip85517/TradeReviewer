# V2.4.1 board propagation report

日期：2026-10-21

本次只写入 `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images/` 下的 SVG，以及本目录的传播脚本和报告。依据为当前工作流、`DESIGN-COVERAGE.md`、V2.4.1 `DECISIONS.md` / `ISSUE-STATUS.md` / `LOCATIONS.md`，并对照 round4/round5 已批准原型和 round5 history/contribution CSS。执行脚本：

```sh
python3 .scratch/homepage-v241-integration/propagate_board_fixes.py
```

## 已传播

- D01：默认及状态图稿中的 `（CNY）` 表头统一为 `(CNY)`，只改可证明的字形 token，未移动坐标。候选 `holding-option-A/B/C-*` 保留历史选项，不改写。
- D03：12 个历史图表角色标题统一为 16px/600（含四张整页内嵌历史板及 `journeys-year.svg`）。
- D11：四张整页图中的 `分类` / `排序` 标签改为 14px；控制的可见外壳统一为 y=134、h=28，原 36px 行位保留为版面参考。静态 SVG 不表达真实命中区或交互状态。
- D12/D13：贡献数据条的可见高度统一为 14px；空心条与同一行实心条对齐，边框 2px；正向使用 `#53D7A0`，负向使用 `#EF7F89`。结构回读共识别 33 个实心条、20 个空心条，20/20 个空心条均能按 y 坐标配对；零、空、错误、加载等状态未伪造为数据条。

实际触及的 43 个 source SVG：

```text
01-live-normal.svg
02-simulation-normal.svg
03-distribution-selected.svg
04-return.svg
08-extreme.svg
50-items--page-7.svg
50-items.svg
atom-datatable.svg
contribution-current-a-share.svg
contribution-extreme.svg
contribution-mixed-sign-demo.svg
contribution-states.svg
contribution.svg
count-boundaries--nine-items-last-page.svg
count-boundaries.svg
count-scales--ten-items.svg
count-scales--twenty-items.svg
count-scales.svg
empty--zero-holdings.svg
empty.svg
error--update-failure.svg
extreme.svg
history-stats-empty.svg
history-stats-error.svg
history-stats-extreme.svg
history-stats-rounds.svg
history-stats-source-missing.svg
history-stats-win.svg
history.svg
holding-return--after.svg
holding-return--detail.svg
holding-return.svg
home-1280.svg
home-1440.svg
home-history-1280.svg
home-history-1440.svg
journeys-year.svg
loading--stale-data.svg
loading.svg
local-search-pages--clear.svg
local-search-pages--one-match.svg
local-search-pages.svg
period.svg
```

## 结构验证

- source 目录扫描 123 个 SVG，Python XML 解析错误为 0。
- D03 角色标题扫描 12 个，字体异常为 0。
- source 中剩余 48 个全角 `（CNY）` 全部来自保留的 holding-option 历史候选图；它们没有被传播脚本改写。
- 传播脚本再次 dry-run 时 source 改动数为 0，说明当前结果可重复。

## 明确未完成 / 未验证

- D02：四张整页 source 图已有 C 摘要结构，未声称其它历史 package 副本已迁移；全视觉验收仍由整合方负责。
- D04：标题与边界的整页视觉对比未在本次静态 SVG 任务中完成。
- D05/D06：历史曲线完整重绘、未来/缺失/空状态的全页面传播没有完成。round5 完整曲线仍是整合方后续集成的权威参考图。
- D10：当前宽卡可见比例和回合支持文案已保留；278×104 窄卡、标签上移 4px 的跨图稿传播没有静态证据，不能声称完成。
- D11：只传播了可见标签和外壳，分类/排序/仅看未平仓的独立状态、hover/focus、键盘和触摸命中区均未验证。
- D12/D13：本次只修正静态贡献条；产品数据绑定、真实零线、跨页全部状态及 hover/触摸未验证。round5 中纯 hover 和实体触屏也保持 NOT VERIFIED。
- D14–D16：本任务没有新增公共图稿，不能在正文中声称这些决策已有完整公共板支持。
- 不运行浏览器服务、不连接数据库，也没有把静态 SVG 结构检查当作产品验收。

`images/` 目录扫描到 52 个旧 package SVG，但本次保持字节不变：它们是 V2.3 兼容/回溯副本，仍含 142 个全角单位 token 和旧的 9/10/11/12/16px 条形高度；当前文档 manifest 指向 `source/images`，而 `original-images` 明确是历史回溯。若整合方要刷新 package，应在最终资源确认后一起重建 manifest、source hashes 和证据哈希；本次没有改这些冻结元数据。

## 整合收尾补充

公共样例板新增历史图线／点／零线／缺口／未来灰区、表头与数值共享右缘、胜率宽窄卡共同基线。去掉无依据的工具栏占位，轴标签包含月份单位；辅助对齐线明确只用于文档说明。普通亏损数值沿用 #FF8592。样例没有宣称覆盖所有表格工具栏和交互状态，完整交互以正文和已确认原型为准。真实浏览器截图见 `evidence/shared-board.png`。
