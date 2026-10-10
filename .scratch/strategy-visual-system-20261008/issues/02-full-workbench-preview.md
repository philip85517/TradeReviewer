# 02 — 直接打开完整交互 Workbench
ID: visual-full-preview-02
State: closed
Status: accepted
Assignee: full_preview
集成负责人: root

## Scope / Refs
恢复完整桌面原型实际组件，无需重走创建；开发专用入口默认三个月双策略完整已展开预设；保留原创建路由及T0默认。原净值/K线、结果净值/回撤/仓位、损益构成/贡献/费用/事件、比较三图与共同截止全部可操作。参考 ../full-restore-contract.md、DESIGN-COVERAGE F01–F07及原规格/图片。

## Blocked by
None；root已实际接受最小原图推进前置，见contract。

## 验收与反例
- [x] 完整入口实际显示丰富净值曲线，净值/K线/阶段结果/比较可达；[实际观察图](../evidence/full-restore-observe-net-final-1440.png)、[最终硬刷新](../evidence/full-restore-results-reload-final.txt)。
- [x] 结果/比较三图与贡献/费用/事件真实可见，事件返回原截止与页签/筛选；[接受记录与三图](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)、[结果返回](../evidence/full-restore-result-return.txt)、[比较返回](../evidence/full-restore-comparison-return.txt)。
- [x] T0→下一日真实bar/交易；running播放暂停实际推进，重复选择同预设真正重置；[首次bar](../evidence/full-restore-first-bar-after-1280.png)、[播放暂停](../evidence/full-restore-running-play-paused.txt)、[T0重置](../evidence/full-restore-t0-reset.txt)、[运行重置](../evidence/full-restore-running-reset.txt)。
- [x] 两档桌面独立看图无新增遮挡，原创建→T0→列表保留；[独立审查](../reports/full-restore-visual-review.md)、[原创建T0](../evidence/full-restore-original-create-t0.txt)。

## 派发
仅 app/page.tsx 新条件、app/components/strategy-prototype/running-prototype.tsx 的可选预设初始化，以及新 full-workbench-preview.tsx/css；报告 reports/full-preview-implementation.md。不改模型账本/结果/比较组件、生产数据和其他已有改动，不再派agent。完整状态 owner root。

## 验收证据
root于2026-10-08独立接受本票完整桌面入口恢复范围；实际鼠标/键盘旅程、状态截止/来源恢复与独立看图分别有上述证据。[最终版本](../evidence/full-restore-manifest.json)、[根检查](../reports/full-restore-root-verification.txt)。scope lint/typecheck/JS/diff PASS；全仓lint仍FAIL，整体视觉系统01票仍open，原Tooltip/wheel等NOT VERIFIED不覆盖。本票数据库写入与物理触摸NOT APPLICABLE（纯内存桌面演示）；399px当前小面板图仅作服务可访问证据，不作桌面视觉接受。
