# 确认首期实施切片与验收门槛

ID: market-implementation-readiness
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

前述决策能否组成独立可验收、可回滚的实施切片，哪些测试和上线门槛必须完成后才允许接替当前读取路径？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

这是地图的终点决策，产出可交给实施计划的范围、先后和门槛，不在本票编写生产功能。

证据入口：[相关规格或证据](01-platform-spec.md)。入口是调查依据，不是预定答案。

## Blocked by

- [选择最小来源集合与固定优先级](06-provider-selection.md)
- [确定请求预算与失败降级契约](08-failure-budget.md)
- [确定完整性诊断与补数计划的输出](09-integrity-diagnostics.md)
- [确定数据版本与旧行情迁移回滚策略](10-versioned-migration.md)
- [确定采集诊断与量化研究的接入约束](11-future-consumers.md)

## Acceptance

- [ ] 每个首期用户故事映射到决策与可观察验收标准
- [ ] 排出口径准入、模块接入、影子验证、切换/回滚的真实依赖
- [ ] 区分fixture、在线canary、隔离存储、性能基线和浏览器验收
- [ ] 列出Luna实施文件所有权与协调者独立验收要求供执行计划使用
- [ ] 核实没有未关闭票或尚未澄清的范围内迷雾，才能完成地图
- [ ] 按结果更新规格状态，不把ready-for-agent当作验收完成

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
