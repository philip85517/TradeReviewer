# 依据验证证据选择正式优化迭代

ID: homepage-one-second-iteration-choice
Labels: wayfinder:grilling
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

基于最小实验的正确性、冷路径、写入成本及独立验收，正式采用A/B/C或怎样的组合、按什么顺序和范围迭代？如果证据不支持一秒门槛，应继续验证、改变投入，还是由用户明确修订目标或停止？

## Scope

- 比较实测收益、冷重建/更新成本、一致性与维护复杂度；用户真实决策，不能由代理替用户选择架构或放宽目标。
- 形成下一步实现计划的输入：批准的模块合同/依赖、完整用户旅程、范围扩展顺序、整页视觉/数据责任、并行所有权、独立接受证据、每票最多3轮及旧任务恢复边界。
- 未验证的任意账户/期间/附件组合、长历史、缺失/恢复、算法升级等，列为后续明确关卡；如实验失败而新问题尚不够明确，返回地图新增问题，不强行关闭地图。
- 只有具体实施方案另获批准，才推进产品代码；实验授权与本次架构/范围批准分别保留。规划完成不等于整页通过。
- 前置原型票可以接受充分的反证；若候选实现已暂停，本票仍只讨论停止、投入或路线取舍。关闭决策票不恢复任何实现任务，恢复须用户明确指定范围及轮次，不能借负面Resolution绕过三轮上限。

## Refs

- [优化候选及原始研究](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:50)、[验证路线](../VALIDATION-ROUTE.md)。
- [拆票与设计覆盖标准](../../../docs/agents/task-decomposition.md)、[当前开发流程](../../../docs/agents/development-workflow.md)、[UI任务与接受模板](../../../docs/agents/ui-task-templates.md)。
- [必须继承的产品未通过项](../../homepage-v25-implementation/FINAL-ACCEPTANCE.md)。

## Blocked by

- [最小真实纵向实验能否支持扩展优化](06-vertical-prototype.md)

## 验收标准

- [ ] 用户实际选择、取舍理由、证据支持范围与剩余风险保存在独立Resolution；未测候选不得标为已达标。
- [ ] 若用户选择继续实施，能据此编写有原始设计元素映射、完整旅程和独立接受标准的实施票，不以文件拆分代替功能合同；若选择停止，则明确停止范围、理由及保留的失败/暂停状态，无需编造实施计划。
- [ ] 旧暂停任务、恢复授权与最多3轮约束清楚，历史FAIL/NOT VERIFIED保留。
- [ ] 协调者核对是否仍有在范围内的未决问题；有则补票，全部路线问题解决后才判断地图可结束。

## 反例与证据

以研究推荐直接批准C、以热读数据承诺重建速度、由性能PASS抵消错误金额/历史未接线/Bars视觉FAIL，或未授权就恢复产品开发，均不接受。
