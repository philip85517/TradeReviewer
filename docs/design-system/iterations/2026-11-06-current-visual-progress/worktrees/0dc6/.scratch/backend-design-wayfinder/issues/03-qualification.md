# 资格与历史覆盖

ID: backend-design-qualification
Labels: wayfinder:grilling
Mode: HITL
Parent: [后端业务与数据设计审查地图](00-map.md)
State: open
Status: charted
Assignee: unassigned
集成负责人: root（设计协调；非实现领取）

## Question

成交可读、数量方向、成本费用、行情FX、期间与全历史覆盖应分别需要什么证据？all 的起点／through／knownAt 如何由现有材料真实提供，无法提供时承诺什么？

## Scope

只作业务／模块设计决策，不修改产品、原始数据或恢复暂停任务。候选方向：按结论和范围评估资格，不把载体承载等同于金额可信；零期初、非零未知期初、已知区间和全历史分别审查，不伪造 complete。

## Refs

- [目标设计审查稿](../../../docs/backend-design/target-design.candidate.md)：BD04/M04/M06/M07、BD05–BD06；现状 AS04.4/4.5；Q02 新旧依赖对照。
- [现状说明](../../../docs/backend-design/current-state.md)
- [诊断依据](../../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)
- [设计覆盖](../DESIGN-COVERAGE.md)

## Blocked by

- [辅助证据的业务范围](01-evidence-scope.md)

## 验收标准

- [ ] 通过用户真实交流明确问题中的业务取舍，保留原话依据。
- [ ] 覆盖下列反例，写明仍未知／不适用的条件，不由 agent 代替用户决策。
- [ ] 结论写入独立 Resolution 并更新目标稿相应章节；用户未决定则保持 open。
- [ ] 模块 Interface 包含输入输出、不变量、调用顺序、失败影响与版本／时间语义；实现算法留待后续。

## 反例

生产 lifetimeSourceCoverage=[]；零 opening；非零未知成本；有数量无价格；当前 FX 不证明历史；未来证据；日期级顺序歧义；无成交月持仓快照。

## 证据与状态

2026-10-25 建图。事实依据见 Refs；本票没有接受结论或实现证据。本轮不消耗原开发任务验收轮数。UI／数据库验收不适用：文档与设计决策，无运行时更改。

Resolution comment: none
