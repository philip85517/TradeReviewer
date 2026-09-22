# 实现独立行情同步与诊断入口

Status: completed
Assignee: coordinator + Luna

## What to build

按 [首期实施计划](../implementation-plan.md) 提取独立同步模块，统一日线/小时线的失败隔离、覆盖读取和缓存保留，并接入现有刷新流程。

## Blocked by

无。用户“推进开发”授权先实施可逆的模块边界重构；本任务不实现仍未决的来源组合、口径转换与版本迁移。

## 验收标准

- [x] UI 经独立入口同步两个周期，元数据行为不变。
- [x] 部分成功、取消、覆盖读取失败、旧 15m 回退有行为测试。
- [x] 结构化诊断区分刷新结果与保留数据，不把覆盖完整当作质量已核验。
- [x] 协调者审查、类型检查、相关测试与构建有记录。

验收见 [实施验证](../implementation-verification.md)，架构边界见 [ADR 0006](../../../docs/adr/0006-market-data-module-boundary.md)。本任务完成不代表决策地图或整个全市场平台完成。
