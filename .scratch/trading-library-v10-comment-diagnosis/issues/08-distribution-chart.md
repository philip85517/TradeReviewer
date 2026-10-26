# 08 — 用横向条形表达收益分布

ID: TLV10-DIAG-08
State: closed
Status: accepted
Assignee: final_design_impl
集成负责人: /root
Priority: P1

## Scope / What to build
用统一尺度横条表达分布，保留金额/收益率及下钻返回契约。 用户已确认 B 与最差练习回撤，正式同步与独立验收通过。

## Refs
- [本轮复核](../REVIEW-REVISION-10.md)，C09；评论完整ID和版本见快照。
- 原图目录：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/`；distribution-amount.svg；BT05第163–184行；distribution-amount@state-demo-5-1。
- [覆盖矩阵](../DESIGN-COVERAGE.md)最新追加。

## Blocked by
None；06 已采用 B 并通过最终验收。

## 验收标准与反例
- [x] 同范围金额与收益率均有横条、回合数、占比和清晰区间。
- [x] 覆盖零样本、单区间集中、极值、长标签和缺失数据；分母不漂移。
- [x] 区间下钻→复盘→返回保持条件、区间、位置，不把负收益画成负频数。
- [x] 在06选定布局内独立视觉对照，正文与分镜同步。

## 证据与门槛
最终PASS：[独立报告](../evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)、[root验收](../evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md)。用户批准 B 和最差练习回撤；37变动帧、原型及阅读器受影响路径通过。无业务数据库写入，原评论状态保留。此前候选阶段与FAIL记录仍保存。

## 派发说明
已按 [revision 10 计划](../REVISION-10-PLAN.md) 派发，元素归属见 DESIGN-COVERAGE.md；不得修改评论状态或业务数据。独立验收人为 revision10_acceptance。
