# 选择最小来源集合与固定优先级

ID: market-provider-selection
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

在已确认质量、覆盖和备用要求下，选择哪组最少来源，并为各市场股票/ETF的1D/1H固定可执行顺序与禁用条件？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

延续精简来源目标，重新检验“四源最小”说法。每市场数量按所有周期和资产类型的启用来源并集计算；待修复和未配置来源不算可用备用。

证据入口：[相关规格或证据](../../../docs/adr/0005-market-platform-architecture-review.md)。入口是调查依据，不是预定答案。

## Blocked by

- [确定数据质量底线与备用来源要求](03-quality-budget.md)
- [整理口径异常与现有调用链证据](04-evidence-baseline.md)
- [确定标准行情与完整性判定口径](05-canonical-semantics.md)

## Acceptance

- [ ] 给出明确可用性/质量能力矩阵及证据日期
- [ ] 计算候选集合及取舍，说明何种约束使额外来源必要
- [ ] 每市场启用并集≤3；全局集合与最低备用要求一致
- [ ] 明确无合格源的组合和返回行为，不用占位来源假装覆盖
- [ ] 记录Tiger无配置、Yahoo受限和东财异常的准入条件
- [ ] 用本票 resolution 替代ADR原有未经证实结论

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
