# 模块所有权与对象协作

ID: backend-design-module-ownership
Labels: wayfinder:grilling
Mode: HITL
Parent: [后端业务与数据设计审查地图](00-map.md)
State: open
Status: charted
Assignee: unassigned
集成负责人: root（设计协调；非实现领取）

## Question

八个候选模块的 Interface 与所有权是否足够深且不重复？资格、证据应用、选集、账本、估值、读模型与发布由谁唯一负责；逻辑处理对象和数据对象如何映射现有函数／类型／class？

## Scope

只作业务／模块设计决策，不修改产品、原始数据或恢复暂停任务。候选方向：先审职责和对象关系，再选择复用／整合位置；不按目录机械切分，不预设全部迁到Node，不新建只转发的 wrapper。

## Refs

- [目标设计审查稿](../../../docs/backend-design/target-design.candidate.md)：BD03–BD06；现状 AS02/AS04；codebase-design 的 Interface、深度、seam 与 Adapter。
- [现状说明](../../../docs/backend-design/current-state.md)
- [诊断依据](../../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)
- [设计覆盖](../DESIGN-COVERAGE.md)

## Blocked by

- [读取协议与版本](02-read-protocol.md)
- [发布单元与失败状态](04-publication.md)

## 验收标准

- [ ] 通过用户真实交流明确问题中的业务取舍，保留原话依据。
- [ ] 覆盖下列反例，写明仍未知／不适用的条件，不由 agent 代替用户决策。
- [ ] 结论写入独立 Resolution 并更新目标稿相应章节；用户未决定则保持 open。
- [ ] 模块 Interface 包含输入输出、不变量、调用顺序、失败影响与版本／时间语义；实现算法留待后续。

## 反例

页面重复性质／财务规则；仓储承担业务覆盖；同一证据在不同路径变义；范围选集保留无关全局风险；应用器同时IO和发布；生命周期关闭后复用handle。

## 证据与状态

2026-10-25 建图。事实依据见 Refs；本票没有接受结论或实现证据。本轮不消耗原开发任务验收轮数。UI／数据库验收不适用：文档与设计决策，无运行时更改。

Resolution comment: none
