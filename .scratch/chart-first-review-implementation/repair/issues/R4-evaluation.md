# R4 — 按实际退出和回合记录可追溯的执行评价

ID: chart-first-repair-R4
State: open
Status: integration-pending
Assignee: luna_frame_contract (gpt-5.6-luna / max)
集成负责人: root；独立验收 Astra Light

2026-09-27当前：R8旧missing Text提示及R10真实PDF重导→待确认→确认→重开已由root/Astra限定通过；旧浏览器缺口已关闭。整体设备门槛仍未接受。 见[最终记录](../../FINAL-ACCEPTANCE.md)、[R10](../reports/R10-integration.md)。下方旧轮次当前/失败描述均保留作历史。


2026-09-27 R7 当前状态：R5/R6真实逐次评价、未知费用、未平仓、无退出人工标签及冻结导出通过；R7-evidence-gaps定位了R4域/服务/组件62项与独立10项，不再混称仅源码。重导确认和旧missing Text浏览器完整链尚未记录；metric混run边界定向验收追加中。 证据：[R7覆盖审计](../reports/R7-coverage-audit.md)、[R7证据定位](../reports/R7-evidence-gaps.md)、[R6集成](../reports/R6-integration.md)。此前段落为历史。

## Scope / What to build

修复事后输入尺寸、退出量价/动作、未平仓指标及无退出回合不能标记仓位/入场/判断的问题。评价仍为人工判断，结构化版本/关联/冻结与现有事务一致。

## Refs

[覆盖矩阵 E13/E15–18/US20–28/US37–39](../../DESIGN-COVERAGE.md) · [设计05](../../../../docs/designs/2026-09-25-chart-first-review/05-final-review.png) · [功能缺口F5/F6](../../reports/design-conformance-review.md) · 主规格§5/6。

## Blocked by

- [R1 首次集成门槛](R1-core-gate.md)（closed / accepted）；R1整票扩展验收后续集成。

## 验收标准与反例

- [ ] 每次退出可由日期+减仓/清仓+数量+均价识别；提前/符合度用紧凑选择，14px输入/44px触控；切换不串值。
- [ ] 未平仓事后显示部分已实现净额与浮动，最终R不可用；费用未知不变0；底栏同口径。
- [ ] 仅买入/无退出可标回合或建仓的仓位/入场/判断标签，关联Text/快照证据；退出专属字段不造假。
- [ ] 数据经原保存事务、验证、版本与查询投影，重开恢复；留存后编辑不污染冻结导出，旧文档兼容。
- [ ] 已有6760/1.69R例、多次退出、做空、未知费用、无原计划、实盘模拟隔离仍通过。
- [ ] 领域/保存查询与真实浏览器分别有证据；Astra逐项验收。

## 派发说明与证据

评价/指标组件和CSS、评价领域模型/文档验证/服务端投影及必要数据库迁移独立owner；不得修改R3 workspace。需要集成通过组件props接口通知R3。报告 `../reports/R4-evaluation.md`，初始 unverified。

19:54：owner返修冻结，8文件62tests；root独立领域/服务器/留存/导出子集48tests通过，见 [日志](../reports/R4-coordinator-tests.txt)。当前typecheck通过，Astra正在独立审查。R3接线、实际浏览器保存重开与新PPTX尚待，不关闭本票。
