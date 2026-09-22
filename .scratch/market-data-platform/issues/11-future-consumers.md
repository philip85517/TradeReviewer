# 确定采集诊断与量化研究的接入约束

ID: market-future-consumers
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

本期模块应给未来持久采集与只读研究消费保留哪些必要契约，哪些属于后续地图，才能避免过度设计又不让插件直连来源或业务表？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

后台worker和完整研究快照的实现已作为后续阶段。本票只确定本期必须稳定的依赖方向、版本语义与读写权限。

证据入口：[相关规格或证据](../../../CONTEXT.md)。入口是调查依据，不是预定答案。

## Blocked by

- [确定独立行情模块的职责与测试入口](07-module-seam.md)
- [确定数据版本与旧行情迁移回滚策略](10-versioned-migration.md)

## Acceptance

- [ ] 明确批量读取、分页、质量要求与数据版本的消费者语义
- [ ] 明确申请补数与只读研究消费的授权差异
- [ ] 定义一个可用于验收的无UI研究消费场景
- [ ] 明确研究快照复现不自动等于历史无前视偏差
- [ ] 列出后续阶段交接约束，不设计插件运行时或交易执行

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
