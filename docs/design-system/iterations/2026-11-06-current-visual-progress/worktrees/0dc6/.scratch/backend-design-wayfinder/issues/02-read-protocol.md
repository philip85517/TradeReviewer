# 读取协议与版本

ID: backend-design-read-protocol
Labels: wayfinder:grilling
Mode: HITL
Parent: [后端业务与数据设计审查地图](00-map.md)
State: open
Status: charted
Assignee: unassigned
集成负责人: root（设计协调；非实现领取）

## Question

一致快照向首页和交易库承诺什么？枚举、字段缺失、投影缺口、错误、兼容版本及五类标识如何区分，哪些证明由生产者真实提供？

## Scope

只作业务／模块设计决策，不修改产品、原始数据或恢复暂停任务。候选方向：以事实枚举和内容绑定为读取层责任，历史完整与金额资格由后续模块回答；保留明确缺口，不将 receiptId 当持久 revision。

## Refs

- [目标设计审查稿](../../../docs/backend-design/target-design.candidate.md)：BD04/M02/M03、BD05–BD06；现状 AS03、AS04.3；source-contract 与 snapshot。
- [现状说明](../../../docs/backend-design/current-state.md)
- [诊断依据](../../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)
- [设计覆盖](../DESIGN-COVERAGE.md)

## Blocked by

无。读取层的证明语义可先独立审查，计算资格由后续票决定。

## 验收标准

- [ ] 通过用户真实交流明确问题中的业务取舍，保留原话依据。
- [ ] 覆盖下列反例，写明仍未知／不适用的条件，不由 agent 代替用户决策。
- [ ] 结论写入独立 Resolution 并更新目标稿相应章节；用户未决定则保持 open。
- [ ] 模块 Interface 包含输入输出、不变量、调用顺序、失败影响与版本／时间语义；实现算法留待后续。

## 反例

HTTP 200 但 shape 无效；摘要不符；有效空集合；孤儿成交；月结 JSON 无法投影；同内容重读不同 receipt；服务重启；写入后缓存失效。

## 证据与状态

2026-10-25 建图。事实依据见 Refs；本票没有接受结论或实现证据。本轮不消耗原开发任务验收轮数。UI／数据库验收不适用：文档与设计决策，无运行时更改。

Resolution comment: none
