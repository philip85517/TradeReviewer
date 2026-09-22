# 确定请求预算与失败降级契约

ID: market-failure-budget
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

一次补数从排队到返回有多少总预算，取消怎样贯穿HTTP/TCP/子进程，何种失败可以重试、降级或返回部分数据，谁唯一持有这些决定？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

当前浏览器队列、fetch wrapper、route和子进程各有预算；叠加重试可能放大请求。单进程配额不等于全局分布式配额。

证据入口：[相关规格或证据](../../../docs/adr/0002-market-data-flow.md)。入口是调查依据，不是预定答案。

## Blocked by

- [确定数据质量底线与备用来源要求](03-quality-budget.md)
- [选择最小来源集合与固定优先级](06-provider-selection.md)
- [确定独立行情模块的职责与测试入口](07-module-seam.md)

## Acceptance

- [ ] 固定排队、单源和总预算的关系，不重复乘法式重试
- [ ] 区分429、403、5xx、timeout、unsupported、history-limit和contract error
- [ ] 明确部分结果、缓存保留和错误归因行为
- [ ] 明确限流器作用域、交互优先、取消及恢复条件
- [ ] 识别哪些持久熔断/worker能力需要交给后续阶段

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
