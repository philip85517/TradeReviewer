# 06 — 建立清晰的模式与页面导航

ID: TLV10-DIAG-06
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: /root
Priority: P1

## Scope / What to build
交付3套完整布局方案，供用户选择后形成统一导航契约。 用户已确认 B 与最差练习回撤，正式同步与独立验收通过。

## Refs
- [本轮复核](../REVIEW-REVISION-10.md)，C07；评论完整ID和版本见快照。
- 原图目录：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/`；02-simulation-normal.svg；BT02第75–77行、BT05第173–177行；02-simulation-normal@state-demo-4-1。
- [覆盖矩阵](../DESIGN-COVERAGE.md)最新追加。

## Blocked by
None；2026-10-24 用户直接确认两项决定。

## 验收标准与反例
- [x] 3套方案同数据对比1440/1280，覆盖实盘/模拟×列表/统计。
- [x] 视角使用标题上方的双态滑动开关，列表/统计使用Tab。
- [x] 补齐切换中、空态、错误和长日期状态；可点击原型验证内容同步与独立条件恢复。
- [x] 用户选定方案后再同步共享生成器和全部受影响分镜；独立视觉复验。

## 证据与门槛
最终PASS：[独立报告](../evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)、[root验收](../evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md)。用户批准 B 和最差练习回撤；37变动帧、原型及阅读器受影响路径通过。无业务数据库写入，原评论状态保留。此前候选阶段与FAIL记录仍保存。

## 派发说明
已按 [revision 10 计划](../REVISION-10-PLAN.md) 派发，元素归属见 DESIGN-COVERAGE.md；不得修改评论状态或业务数据。独立验收人为 revision10_acceptance。

## Revision 11 复开（2026-10-24）

新增C11确认根页面标题重复、导航分散和“不重复面包屑”契约未落实；旧验收仅保留为历史。见 [分析报告](../REVIEW-REVISION-11.md)。本轮只诊断，未修复；两套新的布局思路与模式切换页面规则待比较确认，不能继续声称当前导航已最终通过。原指标与分布验收不受此轮分析推翻。

- [ ] 信息去重、日期标签归位、返回来源动作保留。
- [ ] 两组导航集中且位置稳定；列表/统计跨模式策略明确。
- [ ] 新方案确定后同步正文、原型与全部受影响图；重新独立验收。
