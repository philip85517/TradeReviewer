# 辅助证据的业务范围

ID: backend-design-evidence-scope
Labels: wayfinder:grilling
Mode: HITL
Parent: [后端业务与数据设计审查地图](00-map.md)
State: open
Status: charted
Assignee: unassigned
集成负责人: root（设计协调；非实现领取）

## Question

账户现金、证券库存／成本辅助项、未归属公司行动分别属于什么业务范围？辅助证据是否允许独立于成交存在，无法归属时影响哪类账户／证券／期间结论？

## Scope

只作业务／模块设计决策，不修改产品、原始数据或恢复暂停任务。候选方向：先把业务相关性、身份归属和应用关系拆开；必要证券风险保留，账户级合法无证券信息不等同于成交身份丢失。该建议尚未批准。

## Refs

- [目标设计审查稿](../../../docs/backend-design/target-design.candidate.md)：BD01、BD04/M01/M04、BD05–BD06；现状 AS04.1/4.4、AS06。
- [现状说明](../../../docs/backend-design/current-state.md)
- [诊断依据](../../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)
- [设计覆盖](../DESIGN-COVERAGE.md)

## Blocked by

无。先审业务范围，不以实现细节代替业务判断。

## 验收标准

- [ ] 通过用户真实交流明确问题中的业务取舍，保留原话依据。
- [ ] 覆盖下列反例，写明仍未知／不适用的条件，不由 agent 代替用户决策。
- [ ] 结论写入独立 Resolution 并更新目标稿相应章节；用户未决定则保持 open。
- [ ] 模块 Interface 包含输入输出、不变量、调用顺序、失败影响与版本／时间语义；实现算法留待后续。

## 反例

无成交月；无市场代码的账户 fee／other；证券转入后卖出；未归属且可能影响数量的公司行动；同账户多市场，另一账户数据齐全。

## 证据与状态

2026-10-25 建图。事实依据见 Refs；本票没有接受结论或实现证据。本轮不消耗原开发任务验收轮数。UI／数据库验收不适用：文档与设计决策，无运行时更改。

Resolution comment: none
