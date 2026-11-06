# 发布单元与失败状态

ID: backend-design-publication
Labels: wayfinder:grilling
Mode: HITL
Parent: [后端业务与数据设计审查地图](00-map.md)
State: open
Status: charted
Assignee: unassigned
集成负责人: root（设计协调；非实现领取）

## Question

首页和交易库应以什么单元读取／发布？哪些内容必须同批切换，哪些字段可在同版本中明确未知？首次失败、更新失败、业务空集合、搜索空和取消如何区分，FX与日线哪些是必需依赖？

## Scope

只作业务／模块设计决策，不修改产品、原始数据或恢复暂停任务。候选方向：先保证范围／事实版本一致与失败不假空；是否分阶段发布由用户审定。完整首屏一秒标准不因先展示部分而降低。

## Refs

- [目标设计审查稿](../../../docs/backend-design/target-design.candidate.md)：BD02/F05/F06、BD04/M05/M08、BD06–BD07；现状 AS04.5/4.6；V2.5 HP09 与 entry-contract。
- [现状说明](../../../docs/backend-design/current-state.md)
- [诊断依据](../../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)
- [设计覆盖](../DESIGN-COVERAGE.md)

## Blocked by

- [资格与历史覆盖](03-qualification.md)

## 验收标准

- [ ] 通过用户真实交流明确问题中的业务取舍，保留原话依据。
- [ ] 覆盖下列反例，写明仍未知／不适用的条件，不由 agent 代替用户决策。
- [ ] 结论写入独立 Resolution 并更新目标稿相应章节；用户未决定则保持 open。
- [ ] 模块 Interface 包含输入输出、不变量、调用顺序、失败影响与版本／时间语义；实现算法留待后续。

## 反例

首次15秒无包；更新失败有旧包；某证券缺价；FX失败；切账户后旧请求迟到；只有标题／骨架；无已平仓回合；持仓为零但交易非零。

## 证据与状态

2026-10-25 建图。事实依据见 Refs；本票没有接受结论或实现证据。本轮不消耗原开发任务验收轮数。UI／数据库验收不适用：文档与设计决策，无运行时更改。

Resolution comment: none
