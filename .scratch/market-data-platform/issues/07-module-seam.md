# 确定独立行情模块的职责与测试入口

ID: market-module-seam
Labels: wayfinder:grilling
State: open
Status: awaiting-discussion
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

已选定独立行情数据 module 后，读取、补数、质量诊断和原子提交分别由谁负责，调用方需要掌握什么，才能复用已有 seam 而不再扩散 provider 知识？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

用户已确认先深化行情数据 module，主验收 seam 在此。不重新询问候选选择；本票进一步确定实际职责、依赖方向和独立消费方式。

证据入口：[相关规格或证据](../../../app/lib/market/contracts.ts)。入口是调查依据，不是预定答案。

## Blocked by

无。

## Acceptance

- [ ] 比较复用现有同步入口、集中读取/补数、独立进程调用的取舍
- [ ] 选定一个主要外部测试 seam 并明确内部adapter依赖
- [ ] 明确调用方、模块、存储和provider各自职责及禁止依赖
- [ ] 确定对现有1D/1H调用方和15m兼容路径的迁移策略
- [ ] 进行deletion test，排除仅转发的浅module

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
