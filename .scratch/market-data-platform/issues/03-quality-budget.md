# 确定数据质量底线与备用来源要求

ID: market-quality-budget
Labels: wayfinder:grilling
State: open
Status: awaiting-discussion
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

首期哪些市场、股票/ETF、1D/1H组合必须达到怎样的质量和覆盖？在来源质量不合格或只有单源时，应接受显式降级，还是阻止使用；减少来源和独立备用哪个优先？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

用户已要求每市场最多三个来源且全局尽可能少；尚未承诺每个组合至少两个来源。单源可用、可独立校验、容灾可用是不同目标，不能用同一个“可用”代替。

证据入口：[相关规格或证据](../../../docs/adr/0003-market-source-validation-and-priority.md)。入口是调查依据，不是预定答案。

## Blocked by

无。

## Acceptance

- [ ] 明确首期市场/资产/周期矩阵和常规交易时段范围
- [ ] 确定可降级与不可降级的口径、完整性要求
- [ ] 确定每个组合所需最少独立来源数或明确例外
- [ ] 明确延迟、覆盖和来源数量冲突时的排序，不凭空承诺 SLA

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
