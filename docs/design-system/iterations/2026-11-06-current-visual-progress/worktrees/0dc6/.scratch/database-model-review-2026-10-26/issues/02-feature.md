# 网页功能与数据生命周期

State: closed
Status: accepted
Assignee: feature
集成负责人: root

## Scope / What to build
覆盖首页、交易库、导入、复盘/回放、策略、行情及设置；核对需要的数据、实际供数、模型缺口和完整性，保留暂停任务边界。

## Refs
- 用户2026-10-26数据库建模审查要求。
- docs/backend-design/current-state.md、target-design.candidate.md；实际源码和网页规格。
- docs/agents/development-workflow.md、task-decomposition.md、issue-tracker.md。

## Blocked by
None

## 验收标准与反例
- [x] 结论、术语及引用核对，见[报告](../../../docs/backend-design/database-review/feature-review.md)与[验收](../FINAL-ACCEPTANCE.md)。
- [x] 事实、推断和未验证项已区分，保留竞争解释，见[验收边界](../FINAL-ACCEPTANCE.md)。
- [x] 产品源码保持不变、只用内存合成库；暂停范围及文档验收边界见[记录](../FINAL-ACCEPTANCE.md)。
- [x] root独立接受，本轮2/3，见[逐项记录](../FINAL-ACCEPTANCE.md)。

## 派发说明
仅允许写入 docs/backend-design/database-review/feature-review.md；root另拥有现状汇总和本地跟踪。禁止再派 Agent，禁止运行会打开在线业务库的服务或测试。研究可联网只读查证，不上传任何私有源码或数据。

## 验收证据
root签署：accepted，2/3。核对页面功能映射、全局资格传播、历史空输入与范围行情；首轮澄清可空指纹唯一列未被writer填充后通过。

最终证据：[FINAL-ACCEPTANCE](../FINAL-ACCEPTANCE.md)，[文档核验](../evidence/document-verification.json)。
