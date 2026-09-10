# 聚焦复盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 让可信交易数据经由三问复盘生成可追踪行动和阶段总结。
**Architecture:** 复用回合、笔记 JSON 与偏好存储；拆出纯统计/队列与共享编辑器。工作台只组合模块。
**Tech Stack:** TypeScript, React, SQLite, Vitest, Vite/vinext。
**Spec:** docs/superpowers/specs/2026-09-10-focused-review-design.md

## Global Constraints

- 保留原始成交、账户隔离、费用/持仓准确性边界、回放未来信息边界和旧笔记。
- 不混算实盘/模拟、不同币种或不同模拟运行；统计必须说明范围和样本。
- 兼容现有 JSON 笔记存储；可选扩展字段，旧数据不要求迁移重填。
- 本地服务使用独立端口和数据库；不修改其他任务的服务。

### Task 1: 指标准入与事实一致性

**Files:** app/lib/insights/episode-facts.ts, insight-engine.ts; app/lib/trades/library.ts, trading-nature.ts; app/components/review/stock-episode-navigation.tsx; app/components/trade-review-workspace.tsx; related tests.
**Interfaces:** Keep buildInsightEpisodeFacts API backwards compatible where practical; change path metrics to nullable and consume per-episode daily coverage rather than global combined status. Add optional coverage input if necessary. Workspace supplies daily coverage, not combined hourly status, for path eligibility. Canonical display nature must not change reconciliation/episode IDs.
- [x] Write regression tests using existing fixture builders: closed buy/sell with source-unavailable and no candles still produces netPnl fact and null path metrics; incomplete accounting is excluded; complete episode daily data survives hourly failure; date-only navigation obeys replayExecutionAt.
- [x] Run `npx vitest run app/lib/insights app/lib/trades/library.test.ts app/components/review/stock-episode-navigation.test.tsx` and verify intended red cases.
- [x] Implement nullable path aggregation (never turn missing into zero), coverage-by-interval and truthful source/time display. Use existing replay precision helper for navigation, not raw Date.parse(executedAt). Add isolated focused regression tests for touched wiring.
- [x] Run same tests plus typecheck; commit scoped changes and record test results.

### Task 2: 兼容三问与统一自动保存

**Files:** app/lib/reviews/types.ts, review-metrics.ts; app/components/review/use-episode-review-autosave.ts, episode-notes-panel.tsx, episode-review-editor.tsx; app/lib/storage/sqlite-store.ts; relevant tests.
**Interfaces:** optional review fields per spec; expose `complete()`/`defer(reason)` returning Promise<boolean> from shared editor save control, callback only after persistence success. `onComplete?: () => void` shared editor prop; compatibility wrapper for old EpisodeReviewEditor props. Rule storage uses optional nested fields.
- [x] Test entering keyDecision/reusableRule, completion persists before callback, save rejection leaves draft and does not navigate, blank completion prompts for a conclusion, old full fields remain editable in details.
- [x] Run focused editor tests to observe missing controls/failing behavior.
- [x] Implement shared editor, extension validation/normalization and atomic save action using autosave revision ordering. Remove duplicate manual editor logic. Preserve legacy plan revisions and saved fields.
- [x] Test actual SQLite round trip of optional review fields, autosave switching/race coverage, and shared editor behavior; commit scoped changes.

### Task 3: 回合队列、聚焦图表与界面减法

**Files:** app/lib/reviews/review-queue.ts (new); app/components/library/trade-library.tsx; app/components/trade-review-workspace.tsx; app/components/review/review-side-panel.tsx; app/components/chart/replay-chart.tsx; app/globals.css; tests.
**Interfaces:** `buildReviewQueue(entries, filter)` returns actual TradeLibraryEpisode + instrument context; pass onComplete to same editor in both contexts; completion chooses next pending within saved filter context after save. Keep state if save fails.
- [x] Test mixed reviewed/unreviewed/deferred entries and account/year filtering at episode level (not only stock); completion continues to correct next episode and has finished state.
- [x] Run queue/component tests to verify red cases.
- [x] Add visible pending/completed/all navigation, stock browsing toggle, compact advanced filters. Collapse import sources into one menu. Add focus-current-episode option through existing chart range props, retaining full history toggle and safe replay.
- [x] Run library/navigation/import/layout tests and inspect responsive webpage; commit scoped changes.

### Task 4: 行动追踪、阶段总结和洞察收敛

**Files:** app/lib/reviews/review-summary.ts (new); app/components/review/rule-checks.tsx (new); app/components/insights/review-summary.tsx (new), pattern-insights.tsx, tag-suggestion-panel.tsx; workspace; tests.
**Interfaces:** derive rules from saved reviews and associate checks by sourceEpisodeId + immutable ruleText/sourceUpdatedAt snapshot. Scope by market/nature/simulation run; summaries additionally separate currencies. Existing storage client UI preferences persists summary notes by selected range.
- [x] Test summary totals without candles; account/nature/currency isolation; original rule edits do not rewrite earlier checks; current episode is not its own evidence; summary draft restores and does not leak ranges.
- [x] Run new tests before implementation.
- [x] Implement light tracking in shared editor, scope selection, three editable summary observations and prior action evidence, collapse tag review/version/evidence details; use neutral sample labels.
- [x] Run related tests and browser workflow; commit scoped changes.

### Task 5: 集成验证与评审

- [ ] Run `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` and runtime checks; fix regressions with focused tests.
- [ ] Use an isolated copy of the current database for browser tests: baseline statistics, three questions → persisted completion → next episode, reload, rule follow-up and range summary. Verify no original execution mutations.
- [ ] Independent review of implemented changes against spec and code quality; resolve material findings, document results and remaining limits.
