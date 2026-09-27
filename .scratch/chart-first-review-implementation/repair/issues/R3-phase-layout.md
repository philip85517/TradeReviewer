# R3 — 三阶段录入与快照比较保持主图优先

ID: chart-first-repair-R3
State: open
Status: integration-pending
Assignee: luna_replay_state (gpt-5.6-luna / max)
集成负责人: root；独立验收 Astra Light

2026-09-27当前：R7 More/布局、R9显式重载及R10辅助按钮已实际复验；旧失败已关闭，必需真机软件键盘仍unverified。 见[最终记录](../../FINAL-ACCEPTANCE.md)、[R10](../reports/R10-integration.md)。下方旧轮次当前/失败描述均保留作历史。


2026-09-27 R7 当前状态：R7 E01顶栏/E10计划布局及手机返回按钮已实际复验并获Astra局部pass；R6桌面More滚轮到底已通过。当前390 More body120.5仍不足，luna_r7_layout正修显式面板互斥及空间分配。真机软件键盘未验，必须保持open。 证据：[R7覆盖审计](../reports/R7-coverage-audit.md)、[R7证据定位](../reports/R7-evidence-gaps.md)、[R6集成](../reports/R6-integration.md)。此前段落为历史。

最新 R5：三阶段代表图选择不推进当前双游标已通过；展开后“全部记录”落到900px视口外不可点击，E22 实际失败，见 [续验记录](../reports/R5-continuation.md)。header/More/窄屏footer修复已由 Luna 冻结，待新构建1440/1280/390/导航展开实测，不以CSS存在滚动属性或单测通过解除失败。

## Scope / What to build

在R1紧凑壳内整合计划/持仓/事后侧栏，统一控件尺度，给三阶段代表图和全部快照提供可读空间与清晰入口。

## Refs

[覆盖矩阵 E01/E03/E05/E09–15/E19/E22](../../DESIGN-COVERAGE.md) · [02](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png) · [04](../../../../docs/designs/2026-09-25-chart-first-review/04-holding-stage.png) · [05](../../../../docs/designs/2026-09-25-chart-first-review/05-final-review.png) · [06](../../../../docs/designs/2026-09-25-chart-first-review/06-export-storyboard.png)

## Blocked by

- [R1 首次集成门槛](R1-core-gate.md)（closed / accepted）；R1整票扩展验收后续集成。

## 验收标准与反例

- [ ] 入场前先价格和三段规模切换，资金/元数据次级，保存重开输入不丢。
- [ ] 持仓只读事实+单独修订入口；事后紧凑摘要后首屏可操作退出评价，有修订草稿/长数据也不挤走评价。
- [ ] 1440/1280/390及导航展开：14px输入、12px以上辅助、36px桌面/44×44触控、300–320侧栏、14px沟槽；窄屏200–240px趋势与字段同时可见。
- [ ] 标的标题恢复规格18px（手机16px），不沿用R1临时14px标题；阶段/侧栏标题16–18px。次要工具进入明确入口腾空间，不继续缩字。
- [ ] 关闭/Esc返回焦点，resize不动双游标或视野；保留既有图表设置。
- [ ] 代表图选择、工作阶段、留存三个动作分明；展开比较脱离96px滚动盒，全部决策/快照可访问，选图不隐式切阶段。
- [ ] 三阶段同状态截图和实际尺寸对照通过，真实手机键盘独立记录，不用桌面代替。

## 派发说明与证据

workspace/recall.css/计划sidebar和revision组件/storyboard及CSS单一owner。R4评价组件由独立owner交付稳定接口后集成。报告 `../reports/R3-layout.md`，初始 unverified。
