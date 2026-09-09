# TradingView 模拟交易 CSV 导入与复盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 TradingView 中文模拟交易 CSV 安全导入 TradeReview，并以独立模拟运行显示、分类、持久化和复盘。

**Architecture:** 在现有 statement dispatcher 增加按表头识别的 TradingView CSV parser；parser 将编号配对的报告行转换为带来源证据的标准成交，随后复用现有 instrument enrichment、交易回合、回放和复盘工作区。交易性质与模拟运行 ID 进入标准化来源契约、交易回合键、导入批次和 SQLite 持久化，UI 只在既有导入预览、侧栏、交易库和复盘头部增加隔离与标签能力。

**Tech Stack:** React 19、TypeScript、SQLite/Node API、SheetJS CSV parsing、Decimal.js、Vitest、Testing Library。

**Spec:** GitHub issue [#12 TradingView 模拟交易 CSV 导入与复盘](https://github.com/philip85517/TradeReviewer/issues/12)

## Global Constraints

- CSV 原文只在浏览器解析；确认后的结构化成交和有限来源证据写入本机 SQLite。
- 支持样本共有的中文表头、UTF-8 BOM、引号字段、CRLF/LF 和无末尾换行；不能仅按 `.csv` 扩展名放行。
- TradingView 文件只有日期精度；不得伪造盘中成交时刻，文件名日期不得参与成交时间计算。
- 同一交易编号必须同时拥有一条进场和一条出场；不完整或冲突的配对整组阻断，其他完整配对仍可预览。
- 配对级手续费只计一次；源报告指标与系统账本指标分开保存和展示。
- 模拟运行、证券和回合必须与实盘及其他模拟运行隔离；重复导入同内容不得增加成交或回合。
- SQLite 是唯一业务数据源；旧券商/截图导入和旧记录必须保持可读。
- 不新增 TradingView 登录、API 同步、实时行情、撮合引擎或行情供应商。

---

### Task 1: TradingView CSV parser contract and source evidence

**Files:**
- Create: `app/lib/import/tradingview-simulation.ts`
- Create: `app/lib/import/tradingview-simulation.test.ts`
- Modify: `app/lib/import/contracts.ts`
- Modify: `app/lib/import/dispatcher.ts`
- Modify: `app/lib/import/import-result.ts`

**Interfaces:**
- `TradingViewSimulationContext = { market: "CN-SH" | "CN-SZ"; symbol: string }`.
- `detectTradingViewSimulationCsv(input: ArrayBuffer | Uint8Array): DetectionResult`.
- `parseTradingViewSimulationCsv(input: ArrayBuffer | Uint8Array, options: { fileName: string; sourceFileId: string; context?: TradingViewSimulationContext }): StatementParseResult`.
- Extend `StatementBroker` with `"tradingview"` and `StatementParseResult` with optional `simulationRunId`, `tradeNature`, and `report` evidence carried through enrichment.
- Extend `TradeExecution.source` with `inputKind: "tradingview"` and optional `simulationRunId`, `sourceTradeId`, and `sourceReport` fields; keep current statement/screenshot values valid.

- [ ] **Step 1: Write the failing parser tests**

  Use a literal CSV fixture in the test, not the private user file. Assert detection requires all TradingView headers, accepts BOM/quoted fields/CRLF/no final newline, extracts `SSE_600330` from the filename, and returns 34 source rows as 34 normalized executions grouped by 17 source trade IDs. Assert the parser maps long entry/exit to buy/sell, short entry/exit to sell/buy, uses `date-only` with `Asia/Shanghai`, preserves source row and signal, and does not use the filename date as a timestamp.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- app/lib/import/tradingview-simulation.test.ts`

  Expected: FAIL because the TradingView detector/parser and source contract do not exist.

- [ ] **Step 3: Implement minimal robust CSV detection and parsing**

  Use SheetJS to parse CSV rows after stripping only the optional BOM. Require the exact normalized header names from the sample. Parse filename market prefixes `SSE`/`SHSE` as `CN-SH` and `SZSE`/`SZE` as `CN-SZ`, and require a six-digit symbol unless an explicit context is passed. Parse dates as midnight `+08:00` ISO strings and mark all records `timePrecision: "date-only"`. Convert directions using the paired role: `多头进场`/`空头出场` → `buy`, `多头出场`/`空头进场` → `sell`. Create stable IDs from file fingerprint, source trade ID and source row so same-day same-price rows remain distinct.

  Pair rows by source trade ID before creating records. Reject missing entry/exit, duplicate role, invalid direction, invalid date, non-positive quantity/price, mismatched instrument context, or conflicting repeated report values for that pair. Store one copy of the pair fee on the exit execution and zero on entry; preserve source report values only once in `sourceReport`. Report diagnostics with source row and trade ID. Return complete pairs even when other pairs are blocked, and set `blocked` only when no valid pair remains or context is missing.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `npm run test:unit -- app/lib/import/tradingview-simulation.test.ts app/lib/import/dispatcher.test.ts`

  Expected: PASS, including existing unsupported-format dispatch behavior and TradingView CSV dispatch.

- [ ] **Step 5: Commit the parser slice**

  Run: `git add app/lib/import app/lib/trades/types.ts && git commit -m "feat: parse TradingView simulation CSV trades"`.

### Task 2: Simulation run identity, report metrics, and episode isolation

**Files:**
- Modify: `app/lib/trades/types.ts`
- Modify: `app/lib/trades/episodes.ts`
- Modify: `app/lib/trades/library.ts`
- Modify: `app/lib/storage/import-history.ts`
- Modify: `app/lib/import/import-preview.ts`
- Modify: `app/lib/import/execution-reconciliation.ts`
- Create or modify focused tests beside each affected module.

**Interfaces:**
- `TradeNature = "live" | "simulation" | "unknown"`.
- `TradeSource` carries `tradeNature`, optional `simulationRunId`, and optional TradingView report evidence.
- `TradeEpisode` carries the source nature and simulation run ID used to derive its identity.
- `ImportPreview` and `ImportHistoryEntry` carry source kind, trade nature, and simulation run ID.

- [ ] **Step 1: Write failing domain tests**

  Add tests proving identical TradingView executions imported twice reconcile as duplicates; two different simulation run IDs with identical instrument/date/price/quantity remain separate; a TradingView simulation and a live execution never enter one episode; the sample’s paired fee is not doubled; source report P&L is present as evidence while system episode metrics remain independently calculated; and library entries expose nature/run labels without mixing aggregate P&L.

- [ ] **Step 2: Run the domain tests and verify they fail**

  Run: `npm run test:unit -- app/lib/trades/episodes.test.ts app/lib/storage/import-library.test.ts app/lib/import/execution-reconciliation.test.ts`

  Expected: FAIL because the current episode key uses only account and instrument and current source/history types have no simulation scope.

- [ ] **Step 3: Implement scoped identity and compatibility defaults**

  Build the episode key from account, instrument, trade nature, and simulation run ID. For newly imported broker statements use `live`; for newly imported screenshots preserve `unknown` unless source context says otherwise; for legacy records without the field use `unknown` and preserve their current grouping behavior. Generate a deterministic simulation run ID from canonical CSV fingerprint plus normalized instrument context, so filename changes do not create a new run. Make reconciliation compare the scoped source identity before declaring duplicate/conflict. Add report evidence to library episode/entry view models without feeding it into `summarizeTradeEpisode`.

- [ ] **Step 4: Run focused tests and regression tests**

  Run: `npm run test:unit -- app/lib/trades/episodes.test.ts app/lib/trades/library.test.ts app/lib/storage/import-library.test.ts app/lib/import/execution-reconciliation.test.ts app/lib/storage/import-history.test.ts`

  Expected: PASS with existing live/screenshot behavior unchanged and new scope cases covered.

- [ ] **Step 5: Commit the domain slice**

  Run: `git add app/lib/trades app/lib/import/execution-reconciliation.ts app/lib/import/import-preview.ts app/lib/storage/import-history.ts && git commit -m "feat: isolate simulated trade runs"`.

### Task 3: SQLite persistence and API compatibility

**Files:**
- Modify: `db/sqlite-schema.ts`
- Modify: `app/lib/storage/sqlite-contracts.ts`
- Modify: `app/lib/storage/sqlite-store.ts`
- Modify: `app/lib/storage/sqlite-http-client.ts`
- Modify: `app/api/storage/trades/route.ts`
- Modify: related SQLite route/store tests.

**Interfaces:**
- Add nullable `trade_nature` and `simulation_run_id` columns to `import_batches` and `executions`, with migration-safe defaults for existing rows.
- `StorageBootstrap`, `ExecutionMergeReport`, and import history serialization round-trip the new source scope.
- Existing GET/PUT trade API remains backward compatible; new fields are validated as `live | simulation | unknown` and non-empty run IDs.

- [ ] **Step 1: Write failing storage tests**

  Through the public SQLite store/API boundary, merge a simulation batch with two scoped runs, read bootstrap data, and assert the source scope, report evidence, and import history survive. Assert an old payload without the fields still loads, malformed nature/run fields return a 400, transaction failure leaves no partial batch, and a repeated PUT reports duplicates rather than inserting new rows.

- [ ] **Step 2: Run focused storage tests and verify they fail**

  Run: `npm run test:unit -- app/lib/storage/sqlite-store.test.ts app/lib/storage/sqlite-http-client.test.ts app/api/storage/trades/route.test.ts db/sqlite.test.ts`

  Expected: FAIL because the schema and validators do not know the new scope.

- [ ] **Step 3: Add migration and round-trip implementation**

  Add one migration that uses nullable columns for backward compatibility. Map columns into `TradeExecution.source` while retaining the complete serialized source object in evidence JSON. Derive `source_type` labels from the normalized import history, update row validation, and ensure merge/replacement runs in the same transaction as before.

- [ ] **Step 4: Run storage tests and verify they pass**

  Run: `npm run test:unit -- app/lib/storage/sqlite-store.test.ts app/lib/storage/sqlite-http-client.test.ts app/api/storage/trades/route.test.ts db/sqlite.test.ts`

  Expected: PASS with the migration checksum and old-data compatibility assertions.

- [ ] **Step 5: Commit the storage slice**

  Run: `git add db app/api/storage/trades app/lib/storage && git commit -m "feat: persist simulation trade scope in SQLite"`.

### Task 4: TradingView import entry, context selection, preview, and history labels

**Files:**
- Create: `app/components/import/tradingview-context-dialog.tsx`
- Create: `app/components/import/tradingview-context-dialog.test.tsx`
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/components/import/import-confirm-dialog.tsx`
- Modify: `app/components/import/import-history-dialog.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: related CSS and workspace/import tests.

**Interfaces:**
- Sidebar exposes a dedicated `导入 TradingView 模拟 CSV` action while retaining the unified real-trade import and screenshot action.
- Context dialog accepts exchange and six-digit code when filename context is absent; confirmation reparses the same in-memory bytes with that context.
- Import preview visibly shows `TradingView · 模拟盘`, source trade count, normalized execution count, pair/episode counts, date precision, report-P&L note, and diagnostics.

- [ ] **Step 1: Write failing component/integration tests**

  Test the user-visible flow: selecting the CSV opens a TradingView preview, preview shows the simulation badge and date-only notice, source metrics are not treated as final system P&L, confirming saves one import history entry and displays the imported instrument, cancel leaves SQLite unchanged, missing filename context opens the exchange/code dialog, and malformed pairs are listed with trade ID and row location. Test history renders the same source label after bootstrap reload.

- [ ] **Step 2: Run focused UI tests and verify they fail**

  Run: `npm run test:unit -- app/components/trade-review-workspace.import-flow.test.tsx app/components/import/import-confirm-dialog.test.tsx app/components/import/import-history-dialog.test.tsx app/components/import/tradingview-context-dialog.test.tsx`

  Expected: FAIL because no TradingView action, context dialog, or simulation copy exists.

- [ ] **Step 3: Implement the vertical import flow**

  Add a separate hidden CSV input and button in the sidebar. In the workspace, read the selected bytes once, dispatch through the TradingView detector/parser, hold the pending file/context in memory, and only write after confirmation. When context is missing, show the dialog with `CN-SH`/`CN-SZ` and code validation; reuse known imported instruments as quick choices. Extend preview/history copy and counts without changing existing statement/screenshot behavior.

- [ ] **Step 4: Run UI tests and verify they pass**

  Run: `npm run test:unit -- app/components/trade-review-workspace.import-flow.test.tsx app/components/import/import-confirm-dialog.test.tsx app/components/import/import-history-dialog.test.tsx app/components/import/tradingview-context-dialog.test.tsx app/components/review/episode-sidebar.test.tsx`

  Expected: PASS, including existing import flows.

- [ ] **Step 5: Commit the import UI slice**

  Run: `git add app/components app/globals.css && git commit -m "feat: add TradingView simulation import flow"`.

### Task 5: Simulation classification in library and review workspace

**Files:**
- Modify: `app/components/library/trade-library.tsx`
- Modify: `app/components/review/review-chart-workspace.tsx`
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: library/workspace/sidebar tests and CSS.

**Interfaces:**
- Library filter includes `交易性质` with `全部 / 实盘 / 模拟盘 / 未知`; simulation run is a second filter when more than one run exists.
- Instrument and episode rows show a stable `模拟盘` badge and run label; aggregate counts/P&L are scoped by nature/run.
- Review header, episode selector, execution source details, and notes/drawings context retain the simulation label.

- [ ] **Step 1: Write failing library/review tests**

  Render live and simulated entries for the same symbol and assert the filter separates them, summaries do not combine their counts/P&L, each simulated run has its own episode, and opening review from a simulated library row keeps the simulation badge in the chart header and source details.

- [ ] **Step 2: Run focused tests and verify they fail**

  Run: `npm run test:unit -- app/components/library/trade-library.test.tsx app/components/review/review-chart-workspace.test.tsx app/components/review/episode-sidebar.test.tsx app/components/trade-review-workspace.test.tsx`

  Expected: FAIL because current view models and filters do not expose trade nature/run scope.

- [ ] **Step 3: Implement scoped view models and controls**

  Group library entries by instrument plus nature/run scope, preserve instrument search, and add the classification/run filters. Render badges using the same source vocabulary in sidebar, library cards, detail heading, chart header, and execution evidence. Ensure review save keys continue to use the scoped episode ID so notes and drawings cannot cross runs.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `npm run test:unit -- app/components/library/trade-library.test.tsx app/components/review/review-chart-workspace.test.tsx app/components/review/episode-sidebar.test.tsx app/components/trade-review-workspace.test.tsx`

  Expected: PASS with existing demo and live import UI intact.

- [ ] **Step 5: Commit the classification slice**

  Run: `git add app/components app/globals.css && git commit -m "feat: classify simulated trades in library and review"`.

### Task 6: Replay correctness and persistence regression

**Files:**
- Modify: `app/lib/replay/imported-replay.ts`
- Modify: `app/lib/replay/replay-engine.ts`
- Modify: replay/review persistence tests where needed.

**Interfaces:**
- TradingView date-only executions use the existing knowledge cursor without inventing intraday order; same-day ambiguous source pairs remain visible as source evidence and do not reveal later dates early.
- Report metrics are shown only after the cursor reaches the source exit date; system mark-to-market metrics continue to come from cached candles and the ledger.
- Review records, cursor, drawings, and tags remain bound to scoped episode IDs across reload.

- [ ] **Step 1: Write failing replay tests**

  Assert a simulation episode opened before its exit reveals only entry-side information at the initial cursor, reveals the exit and report evidence only at/after its exit date, can step to the next execution, and restores the same cursor/review record after SQLite bootstrap. Assert no same-day synthetic ordering is introduced.

- [ ] **Step 2: Run replay tests and verify they fail**

  Run: `npm run test:unit -- app/lib/replay/imported-replay.test.ts app/lib/replay/replay-engine.test.ts app/components/review/use-episode-review-autosave.test.ts app/components/review/review-chart-workspace.test.ts`

  Expected: FAIL on source report visibility, date-only messaging, or scoped persistence assertions.

- [ ] **Step 3: Implement cursor-safe report visibility and reload behavior**

  Keep report evidence on the execution/episode source object but derive a cursor-filtered presentation model. Do not add report metrics to `ReplaySnapshot.position`; expose them separately to the review view only when the corresponding source exit is visible. Reuse existing imported replay and review repository hydration, changing only the episode identity inputs required for scope.

- [ ] **Step 4: Run replay and integration tests and verify they pass**

  Run: `npm run test:unit -- app/lib/replay app/components/review app/components/trade-review-workspace.import-flow.test.tsx`

  Expected: PASS with future-information isolation and review persistence covered.

- [ ] **Step 5: Commit the replay slice**

  Run: `git add app/lib/replay app/components/review app/components/trade-review-workspace.import-flow.test.tsx && git commit -m "feat: keep simulated report metrics replay-safe"`.

### Task 7: Full verification and requirement audit

**Files:**
- Modify only files needed to fix verified failures in the preceding slices.
- Test: all affected unit, route, integration, typecheck, lint, build, and runtime suites.

- [ ] **Step 1: Run the complete unit suite**

  Run: `npm run test:unit`

  Expected: PASS with zero failures.

- [ ] **Step 2: Run static checks**

  Run: `npm run typecheck && npm run lint`

  Expected: both commands exit 0 with no TypeScript or ESLint errors.

- [ ] **Step 3: Run production build and runtime tests**

  Run: `npm run build && npm test`

  Expected: production build and rendered HTML/local SQLite runtime tests exit 0.

- [ ] **Step 4: Audit the implementation against Issue #12**

  Verify the sample invariants independently: 34 source rows, 17 pairs, 12 closed episodes for `SSE:600330`, 20,580 CNY source P&L total, zero fees, correct 7,000/3,000 short split, and no future report metric before the exit cursor. Verify legacy statement/screenshot/demo paths remain available.

- [ ] **Step 5: Inspect final diff and commit the verified feature**

  Run: `git status --short && git diff --check && git diff --stat`.

  Expected: only the TradingView simulation feature, its plan, and focused tests are present; no private CSV is staged. Commit with `git commit -m "feat: import and review TradingView simulation trades"` only after all prior commands pass.
