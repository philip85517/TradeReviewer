# 确定数据版本与旧行情迁移回滚策略

ID: market-versioned-migration
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

新口径怎样与现有行情键、coverage和数据库共存，并在不改原始成交的条件下完成影子验证、切换及回滚，同时为研究版本保留演进空间？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

本票决定版本标识、存储所有权与原子性，不直接批量改写旧时间戳。没有可验证历史可知时间时不能补造。

证据入口：[相关规格或证据](../../../db/sqlite-schema.ts)。入口是调查依据，不是预定答案。

## Blocked by

- [确定标准行情与完整性判定口径](05-canonical-semantics.md)
- [确定独立行情模块的职责与测试入口](07-module-seam.md)

## Acceptance

- [ ] 确定新旧口径记录与coverage的身份隔离方式
- [ ] 确定数据版本、转换版本、日历版本与来源证据的关系
- [ ] 决定本期沿用存储还是独立行情文件及理由
- [ ] 定义幂等提交、并发写入、迁移中断与回滚行为
- [ ] 确定影子比较报告和原始成交不变验收方法

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
