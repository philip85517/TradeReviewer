# 03 — 工作台全部视图导览
ID: visual-view-guide-03
State: closed
Status: accepted
Assignee: view_guide
集成负责人: root

## Scope / Refs
当前A预览的完整视图与七状态可发现、可直达；顶部添加“全部视图”，目录区分“紧凑视觉样板”和“完整交互版（历史布局）”，明确结果/比较回撤仓位未迁入A。默认无query时complete；保留scenario旧链接。参考 ../full-restore-contract.md、DESIGN-COVERAGE G01–G04与STYLE04。

## Blocked by
None；完整入口URL契约已定义；集成接受须等02可用。

## 验收与反例
- [x] 顶部全部视图可見且九切面/七状态实际可选；[九切面DOM](../evidence/full-restore-a-presets-final.json)、[七场景DOM](../evidence/full-restore-a-scenes-final.json)、[逐图独立审查](../reports/full-restore-visual-review.md)。
- [x] 三个完整入口与原创建实际可达，未承诺旧B/C；[完整入口/原创建接受](02-full-workbench-preview.md)、[目录](../evidence/full-restore-guide-final-1440.png)。
- [x] 旧scenario=running、新preview=event实际刷新保持预设，边界可读；[旧running](../evidence/full-restore-a-legacy-running.txt)、[九预设证据](../evidence/full-restore-a-presets.json)、[接受记录](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)。
- [x] 两档目录/38px范围栏保持预算，Tab链接与Escape返回焦点实测；[1280目录](../evidence/full-restore-guide-final-1280.png)、[两档及键盘接受](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)、[独立视觉审查](../reports/full-restore-visual-review.md)。

## 派发
仅 public/design-system-20261008/workbench/index.html 与 reports/view-guide-implementation.md；调用既有setScenario/setTab/switchChartMode/enterEvent，不重写数据/截止/回放。保持当前A预算/盈亏/推荐主题和appearance基线。不得再派agent。

## 验收证据
root于2026-10-08独立接受本票导览范围。[Resolution与实际接受](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)已保存；目录隐藏层FAIL/字号FAIL保留在独立报告，终版4ff8a337经重新看图与实际动作接受。两档桌面及1280九切面/七状态矩阵通过，不称1440全矩阵或移动通过；无DB写入。全仓lint FAIL与整体01票NOT VERIFIED保持。
