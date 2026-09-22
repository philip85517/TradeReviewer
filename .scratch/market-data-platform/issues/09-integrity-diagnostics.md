# 确定完整性诊断与补数计划的输出

ID: market-integrity-diagnostics
Labels: wayfinder:grilling
State: open
Status: blocked
Assignee: unassigned
Mode: HITL
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

如何让运维只看模块输出就能定位证券、周期、区间、来源和错误原因，并区分可补缺口与不可获取范围，而不触发隐式全量刷新？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

本票决定诊断/计划能力及证据留存，不在地图阶段构建完整运维界面或持久worker。

证据入口：[相关规格或证据](../../../app/lib/market/intraday-sync-service.ts)。入口是调查依据，不是预定答案。

## Blocked by

- [确定标准行情与完整性判定口径](05-canonical-semantics.md)
- [确定独立行情模块的职责与测试入口](07-module-seam.md)
- [确定请求预算与失败降级契约](08-failure-budget.md)

## Acceptance

- [ ] 确定正常、缺失、冲突、未知、过期及来源失败的诊断分类
- [ ] 确定计划与执行分离、预估请求数量及明确不支持的范围
- [ ] 确定attempt/来源/转换/coverage证据的最少留存与脱敏规则
- [ ] 确定完整性分母与展示统计含义，避免请求成功率代替有效覆盖率
- [ ] 明确修复验证、取消和已正确记录的保护规则

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
