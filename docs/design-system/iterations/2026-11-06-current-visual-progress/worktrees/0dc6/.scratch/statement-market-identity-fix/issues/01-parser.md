# 01 — 明确交易所现金事件解析

ID: M01
State: closed
Status: accepted
Assignee: parser worker
集成负责人: root

## Scope / What to build
app/lib/import/statement-evidence.ts（保留已有修改）、新 app/lib/import/statement-cash-identity.ts 及测试。实际模型 gpt-6.1-sol / ultra；不可再派代理。最多 3 轮独立验收，最终第 1/3 轮通过。

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
文件唯一 owner 见 Scope；输入/输出及保护要求见派发消息。报告写 ../evidence/01-worker.md。

## 验收证据
候选 1：root 已独立审查相对 `.before` 的两处生产差异，113/113 解析相关测试通过（[日志](../evidence/01-INDEPENDENT.log)）。两份原始 PDF 指纹与库中一致，基线复现 3 条身份丢失（[原始失败形状](../evidence/ORIGINAL-PDF-BEFORE.json)），新解析均为 HK/01211 且其他事件字段与基线一致（[复验](../evidence/ORIGINAL-PDF-REPLAY.json)）。历史工具集成、191 份原始 PDF 回放及实际持久化链路均通过；本票第 1/3 轮 accepted。全量 215 个失败均在修复前解析器上同名复现，仍保留全项目 FAIL。

## 历史
2026-10-25 创建；用户授权修复市场信息，财务/Bars 暂停保持。

2026-10-25 root 独立验收通过；未触发第 2/3 或第 3/3 轮，未恢复财务/Bars。
