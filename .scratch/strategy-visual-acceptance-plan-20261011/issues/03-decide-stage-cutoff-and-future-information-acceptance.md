# 03 — 决定 S0/S1/S2 双截止与未来信息门槛

ID: strategy-visual-acceptance-plan-20261011-03
Labels: wayfinder:grilling
Mode: HITL
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / Decision question

为 S0 入场前、S1 持仓中、S2 退出后的同一复盘工作区建立可执行的状态转移和信息可知契约。按动作逐一决定市场截止、成交截止、可见/不可见字段、阶段来源、视野策略和持久化结果：next bar、play/pause、next decision、阶段推进、查看完整历史、缩放/适应视野、Tooltip、OHLC、持仓/成交列表、摘要、回看早期、刷新和重开。

“按钮存在”“时间游标变化”或“列表更新”不能替代真实主图揭示目标 K 线/成交的证据。

## Refs

- [复盘工作区规则](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [开发工作流状态转移要求](../../../docs/agents/development-workflow.md)
- [图表优先复盘元素规格](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)
- [DESIGN-COVERAGE P04/P05](../DESIGN-COVERAGE.md)
- [01 基线矩阵](01-freeze-baseline-and-comparison-matrix.md)

## Blocked by

- [01 — 冻结 0.7 基线与同状态比较矩阵](01-freeze-baseline-and-comparison-matrix.md)

## 验收标准与反例

- [ ] Resolution 包含完整状态转移表：起始阶段、动作、市场/成交截止、目标阶段、显示/隐藏字段、Text 归属、未来暴露来源、视野和保存/重开。
- [ ] 行情截止与成交截止是独立列；历史回看/未来查看后来源持续存在，切阶段、刷新、关闭重开不能伪装盲态。
- [ ] 双截止覆盖 Tooltip、OHLC、列表、摘要、统计、缩放和适应视野，且明确缺失行情/末尾的原因与下一步。
- [ ] 后续真实主图旅程明确起始数据、目标 K 线/成交和截图位置：隐藏未来→next/play→next decision→Text→早期→保存/重开。
- [ ] 反例：缩放露出截止外最高点；S0 只换阶段标签却出现退出成交/最终盈亏；刷新清掉“已看后续”来源；Text 输入时回放推进。
- [ ] 用户结论保存为独立 Resolution；未完成真实图表验证不写 PASS。

## 验收证据

- 领域转移表和字段来源证据；真实浏览器主图/录制；适用的隔离数据库保存/重开日志。
- 自动化可以作为辅助，但没有真实主图截图、状态安全和来源持久化时为 `NOT VERIFIED`。

## 派发说明

这是状态合同决策票，不修改 ReplayChart、DrawingCanvas 或仓储。允许更新状态转移文档、`visual-contract.md`、覆盖矩阵和 Resolution；禁止用 mock chart 或内存游标替代后续实现验收。

## 历史

- 2026-10-11：创建，等待 01 基线和用户选择。
