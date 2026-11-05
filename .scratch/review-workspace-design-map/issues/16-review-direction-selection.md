# 交易方向选中态不可辨识

ID: review-audit-16
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P1
Blocked by: 无

## Scope / What to build

使买入前做多/做空的当前选择能在界面和辅助技术中辨识，同时保持既有计算与错误反馈。此票仅记录审阅发现，不构成修复授权。

## Refs

- [审阅报告与做空截图](../evidence/independent-design-review-20261028/REPORT.md)。
- [用户选定 A 连续表单 R02](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 验收标准与反例

- [ ] 做多与做空有清晰、互斥的选中/未选中视觉状态；焦点、悬停、禁用与错误状态不覆盖选中信息。
- [ ] 鼠标及键盘可切换并读出当前方向；价格顺序、风险与收益计算和所选方向一致。
- [ ] 在 1440 与 1280 的同态截图中独立对照；切换回合与返回后方向不串属。

反例：只依赖红色错误文案推断方向，或只更改 class 而无可见/可访问状态。

## candidate-v37 版本绑定观察（2026-10-29）

按 [v37 冻结清单](../evidence/review-fixes-20261028/candidate-v37/manifest.json)，本记录绑定 candidate-v37。协调者 AX 实操记录 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 的 `direction-short` 与 `direction-long` 分别记录了做空和做多选择状态；对应 AX checkbox 值分别为做空 `1` / 做多 `0`，以及做多 `1` / 做空 `0`。独立审阅报告 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 只从入场截图确认“做多”选中样式和“做空”选项可辨，没有独立切换控件。

这些观察表明协调者操作时能切换并由 AX 暴露当前选择；不等于独立键盘/鼠标复验，也未核实方向切换后的价格排序、风险收益计算、错误状态及跨回合返回后的状态归属。历史 FAIL 保留，本票仍 open / acceptance-failed。
