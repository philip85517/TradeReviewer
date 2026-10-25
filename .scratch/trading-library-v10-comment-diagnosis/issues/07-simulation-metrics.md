# 07 — 明确模拟盘风险与方向指标

ID: TLV10-DIAG-07
State: closed
Status: accepted
Assignee: final_design_impl
集成负责人: /root
Priority: P1

## Scope / What to build
先定义回撤及多空胜率口径，再提供可信样例和易懂的费用说明。 用户已确认 B 与最差练习回撤，正式同步与独立验收通过。

## Refs
- [本轮复核](../REVIEW-REVISION-10.md)，C08；评论完整ID和版本见快照。
- 原图目录：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/`；02-simulation-normal.svg；BT05第149–163行；02-simulation-normal@state-demo-4-1。
- [覆盖矩阵](../DESIGN-COVERAGE.md)最新追加。

## Blocked by
None；2026-10-24 用户直接确认两项决定。

## 验收标准与反例
- [x] 确定回撤对象、权益数据、跨练习聚合规则，未确定前不虚构百分比。
- [x] 多空/持平/无样本/缺失输入/部分平仓样例可独立手算。
- [x] 费用说明已扣除、配对分摊和未平仓排除，正文与卡片一致。
- [x] 选定布局内完成指标层级；未实现者复核数据与文案。

## 证据与门槛
最终PASS：[独立报告](../evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)、[root验收](../evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md)。用户批准 B 和最差练习回撤；37变动帧、原型及阅读器受影响路径通过。无业务数据库写入，原评论状态保留。此前候选阶段与FAIL记录仍保存。

## 派发说明
已按 [revision 10 计划](../REVISION-10-PLAN.md) 派发，元素归属见 DESIGN-COVERAGE.md；不得修改评论状态或业务数据。独立验收人为 revision10_acceptance。
