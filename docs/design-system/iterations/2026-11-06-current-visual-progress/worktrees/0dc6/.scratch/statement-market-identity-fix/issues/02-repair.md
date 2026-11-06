# 02 — 历史辅助事件市场身份修复

ID: M02
State: closed
Status: accepted
Assignee: repair worker
集成负责人: root

## Scope / What to build
新 app/lib/storage/statement-market-repair.ts 及测试、scripts/repair-statement-market.ts。实际模型 gpt-6.1-sol / ultra；不可再派代理。最多 3 轮独立验收，最终第 1/3 轮通过。

## Refs
- [范围契约](../DESIGN-COVERAGE.md)
- [根因核查](../evidence/MARKET-CENSUS.json)
- [生命周期诊断](../../homepage-design-logic-review-2026-10-24/questions/Q02-RECORD-LIFECYCLE.md)
- 项目 docs/agents/development-workflow.md 数据安全及证据批量更新规则。

## Blocked by
None：解析共享纯函数接口已约定，历史工具执行依赖该实现通过。

## 验收标准与反例
- [x] 确定性 RED 后 GREEN；不覆盖既有工作。
- [x] 仅恢复原文明示的证券身份，账户级现金和歧义保持未知。
- [x] 现有字段冲突拒绝或跳过，不改金额/日期/性质/来源/成交。
- [x] 协调者独立审查与隔离数据库验证。
- UI：无控件/布局更改；无需完整首页视觉验收，数据读取影响另由 root 核查。

## 派发说明
文件唯一 owner 见 Scope；输入/输出及保护要求见派发消息。报告写 ../evidence/02-worker.md。

## 验收证据
root 独立审查完整工具实现，19/19 隔离 SQLite 测试通过，覆盖并发/过期计划、金额及手工修订不变、短写与 fsync/rename 失败、审计损坏、提交后中断恢复和幂等。备份副本预检、实际主库/预览库精确快照比对后，均成功应用 3 条身份修复。重开实际库、生产 mapper、JSON 协议摘要校验与领域投影通过；全部成交与其他表保持原摘要。第 1/3 轮 accepted。证据见 [最终验收](../FINAL-ACCEPTANCE.md) 与 evidence/02-INDEPENDENT.log、ACTUAL-PERSISTED-CHAIN.json。

## 历史
2026-10-25 创建；用户授权修复市场信息，财务/Bars 暂停保持。

2026-10-25 root 独立验收通过；未触发第 2/3 或第 3/3 轮，未恢复财务/Bars。
