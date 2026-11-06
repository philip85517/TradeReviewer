# 物理与逻辑模型

State: closed
Status: accepted
Assignee: schema
集成负责人: root

## Scope / What to build
覆盖迁移、表字段、键与索引、事务和修订、金额与时间、JSON边界。证据包含源码行号与反例，区分已确认缺陷和待验证风险。

## Refs
- 用户2026-10-26数据库建模审查要求。
- docs/backend-design/current-state.md、target-design.candidate.md；实际源码和网页规格。
- docs/agents/development-workflow.md、task-decomposition.md、issue-tracker.md。

## Blocked by
None

## 验收标准与反例
- [x] 结论、术语及引用核对，见[报告](../../../docs/backend-design/database-review/schema-review.md)与[验收](../FINAL-ACCEPTANCE.md)。
- [x] 事实、推断和未验证项已区分，保留竞争解释，见[验收边界](../FINAL-ACCEPTANCE.md)。
- [x] 产品源码保持不变、只用内存合成库；暂停范围及文档验收边界见[记录](../FINAL-ACCEPTANCE.md)。
- [x] root独立接受，本轮2/3，见[逐项记录](../FINAL-ACCEPTANCE.md)。

## 派发说明
仅允许写入 docs/backend-design/database-review/schema-review.md；root另拥有现状汇总和本地跟踪。禁止再派 Agent，禁止运行会打开在线业务库的服务或测试。研究可联网只读查证，不上传任何私有源码或数据。

## 验收证据
root签署：accepted，2/3。核对结构报告S01–S04、迁移/约束、真实Store四项内存反例及源码行号；首轮补跨账户反例与引用后通过。

最终证据：[FINAL-ACCEPTANCE](../FINAL-ACCEPTANCE.md)，[文档核验](../evidence/document-verification.json)。
