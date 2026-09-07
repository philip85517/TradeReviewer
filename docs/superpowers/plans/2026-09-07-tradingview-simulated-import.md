# TradingView 模拟交易导入 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 实现 Issue #12 的本地 CSV 导入、模拟盘隔离与完整复盘。
**Architecture:** 新增 TradingView 适配器，复用导入预览和证券补全。交易性质、运行和配对证据保存在成交 source 的现有 SQLite JSON 中；隔离发生在对账和回合边界，行情仍按证券共用。
**Tech Stack:** TypeScript, React, Decimal, SQLite, Vitest/Testing Library。
**Spec:** docs/specs/2026-09-07-tradingview-simulated-trade-import.md

## Global Constraints

- 原始 CSV 仅在浏览器解析；SQLite 是唯一业务数据源。
- 已有实盘回合 ID 保持不变；不同模拟运行不合并、不去重。
- date-only 不伪造精确成交时间；配对手续费只在出场时计入一次。
- 仅本地实现验证，不部署，不上传样本原文。

### Task 1: 解析与领域隔离
Files: app/lib/import/tradingview.ts, tradingview.test.ts, contracts.ts, dispatcher.ts; app/lib/trades/types.ts, trading-nature.ts, episodes.ts; app/lib/import/execution-reconciliation.ts.
Interface: parseTradingViewCsv(input: StatementInput, instrument?: {market: 'CN-SH'; symbol: string}): StatementParseResult. source 保存 tradingNature、simulationRunId、simulationTradeId、simulationRole、simulationReport。
- [x] 写真实 CSV 字符串测试，覆盖多空、分批份额、费用、错误组、日期/BOM、重导和独立运行。运行 `npm run test:unit -- app/lib/import/tradingview.test.ts`，确认 unsupported-format 失败。
- [x] 实现适配器与显式性质工具；按照日期与配对依赖排序。按运行和配对隔离候选 key，保留实盘旧 key。
- [x] 相同测试转绿，并运行 episodes / execution-reconciliation 既有测试。

### Task 2: 存储与预览契约
Files: app/lib/storage/sqlite-store.ts, sqlite-store.test.ts; app/lib/import/import-preview.ts; app/components/import/import-confirm-dialog.tsx.
Interface: 复用 mergeExecutions 和 bootstrap；新增 source JSON 字段校验，preview 加入模拟计数和诊断。
- [x] 添加真实 SQLite roundtrip、非法来源、重复导入、旧回合/笔记稳定测试，运行确认红灯。
- [x] 校验模拟字段，明确预览配对计数、运行、费用规则、源报告差异与阻断错误。
- [x] 验证 SQLite 保存与回读，预览取消不保存，失败保持可重试。

### Task 3: 导入入口和复盘界面
Files: app/components/review/episode-sidebar.tsx; app/components/import/tradingview-import-dialog.tsx; app/components/trade-review-workspace.tsx; app/components/library/trade-library.tsx; app/lib/trades/library.ts.
Interface: 独立入口选择 CSV 后先核对 SSE 证券，调用已适配 parseImport；交易库按性质和运行过滤成交后重算。
- [x] 工作区真实 CSV 流程测试覆盖选择、核对证券、预览、确认、重载与模拟标识；只替换外部元数据/行情/存储传输。
- [x] 接入文件上下文核对界面与现有 parseImport。交易库增加性质筛选、分区标识和完整结果的源报告；逐笔复盘持续显示当前模拟运行。
- [x] 历史模式仅显示当前模拟运行，回放模式沿用当前回合及隐藏未来规则。
- [x] 运行工作区、交易库、导入预览及复盘相关测试。

### Task 4: 回归与交付
Files: README.md; docs/specs/2026-09-07-tradingview-simulated-trade-import.md.
- [x] 使用本地两份样本验证 34/24 行、17/12 配对、12/10 回合和费用 0/9.60，原文不进入版本控制。
- [x] 执行完整 unit suite、typecheck、lint、build 和 runtime checks。
- [x] 独立审查改动，修复重要问题，复跑受影响验证。
- [x] 更新 README/执行记录，报告本地实现和实际验证结果。


## Execution evidence

- Parser/reconciliation regression: 47 tests passed in first green run. Local CSV acceptance: both originals passed, 12/10 closed episodes, fees 0/9.60.
- Full suite with bounded concurrency: `npm run test:unit -- --maxWorkers=4` — 121 files passed, 1 opt-in sample file skipped; 1035 tests passed, 2 skipped.
- Default-concurrency full run had two 5-second deployment-test timeouts; both passed separately at unchanged timeout, then the full bounded-concurrency run passed.
- Typecheck passed; lint has 0 errors and 3 pre-existing warnings outside this change.
- SQLite reopening preserves exact simulation episode notes and drawings. Real dispatcher/enrichment workspace import, confirmation and reload tested with frozen external metadata.
- Independent review: fixed exact simulation episode navigation, transactional fingerprint/security conflict rejection, and visible retryable persistence errors. Scoped re-review found no remaining high/medium issues.
- Runtime checks: 4 passed (SQLite API, server rendering, future-demo bundle boundary, OCR module).
- No original CSV copied, no dependencies or lockfile changed, no deployment performed. Implementation remains in the existing worktree for review.
