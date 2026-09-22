# 确定标准行情与完整性判定口径

ID: market-canonical-semantics
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

标准行情应怎样表达交易日、实际桶起止、量价单位、复权及可知时间，并怎样区分缺失、停牌、未上市、未收盘和未知，才能允许两个来源替换？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

不能将小时桶一律当作60分钟；不能把源结束时间、发布时间和抓取时间混为一谈。缺少来源证据时先定义未知和隔离行为，不猜测修正值。

证据入口：[相关规格或证据](../../../docs/adr/0004-fixed-provider-priority-and-bar-normalization.md)。入口是调查依据，不是预定答案。

## Blocked by

- [整理口径异常与现有调用链证据](04-evidence-baseline.md)
- [确定数据质量底线与备用来源要求](03-quality-budget.md)

## Acceptance

- [ ] 定下1D与1H时间规范，覆盖午休、DST、短尾桶及半日市
- [ ] 定下已归一化来源禁止二次平移规则和转换版本要求
- [ ] 定下成交量单位、精度、未知值和价格差异容忍依据
- [ ] 定下raw/复权/未知的接纳规则及企业行为证据要求
- [ ] 完整性分母纳入交易日历和证券有效期，未知不冒充停牌
- [ ] 区分数据版本复现与严格历史可知能力

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
