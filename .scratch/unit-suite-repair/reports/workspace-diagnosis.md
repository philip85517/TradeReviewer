# Workspace R01–R03 只读诊断

日期：2026-10-06。范围：`trade-review-workspace.test.tsx`、`trade-review-workspace.import-flow.test.tsx`、`trade-review-workspace.recall-bridge.test.tsx`。本轮没有修改产品代码或测试代码；只新增本报告和三份窄范围运行日志。

## 当前复现证据

三个代表用例均在当前工作树通过：

```text
npm run test:unit -- app/components/trade-review-workspace.import-flow.test.tsx -t 'refreshes metadata without blocking cached candles when metadata is unresolved'
1 passed, 32 skipped; tests 1.06s

npm run test:unit -- app/components/trade-review-workspace.recall-bridge.test.tsx -t 'uses only successful saved status'
1 passed, 2 skipped; tests 1.10s

npm run test:unit -- app/components/trade-review-workspace.test.tsx -t 'keeps imported review actions in the Recall frame without a duplicate page header'
1 passed, 90 skipped; tests 3.22s
```

原始输出分别保存在 `workspace-red-import.log`、`workspace-red-recall.log`、`workspace-red-workspace.log`。文件名沿用任务要求；本次输出实际为绿色，不能把它们当成红色证据。

## 当前入口和规格锚点

正式入口是 `app/page.tsx` 的 `TradeReviewWorkspace(initialFrame, showDemo=false)`。在 `trade-review-workspace.tsx` 的 review 分支，非 demo 回合先经过 `hydratedMarketIds` 和 `selectedIntradayReady` 门槛；满足后挂载 `RecallWorkspace`（约 6099 行），而非旧的 `ReviewChartWorkspace`（约 6182 行，仅 demo 分支）。`图表工具栏` 是 RecallWorkspace 的真实子树中的 `ChartToolbar` aria-label；因此找不到它表示尚未进入真实回合、仍在 loading/空状态、或测试 fixture 的入口动作没有完成，而不是工具栏标签的简单改名。

这与批准规格 `docs/specs/2026-09-25-chart-first-review-ui.md` 的“主图＋按阶段嵌入的右侧栏”、图内紧凑绘图工具栏及“先用真实图表贯通最小旅程”一致。规格同时要求回放依赖行情可知边界；测试不能通过直接把组件替换成旧入口来规避该门槛。

## 可证伪假设及结果

### H1：测试仍在假设旧 ReviewChartWorkbench/旧 toolbar 入口

证据：当前代码确实把生产非 demo 回合接到 `RecallWorkspace`，并把 `ReviewChartWorkspace` 留在 demo 分支；旧 census 中的错误却是“找不到图表工具栏/recall editor”。

验证：三个用例使用当前入口和当前 mocks 均通过，且 Recall mock 能在 bridge 用例收到 props。结论：H1 不是当前窄用例失败的根因；失败记录更像生成于当前路由接线或 fixture readiness 尚未稳定的历史状态。不要改名/删断言。

### H2：回合 readiness 的异步链（IndexedDB bootstrap → market hydration → intraday ready）在完整运行中竞态，导致测试在 loading 分支超时或看不到 toolbar/editor

证据：非 demo 回合只有在 `hydratedMarketIds.has(selectedInstrumentId)` 且 `selectedIntradayReady` 为真时才挂载 RecallWorkspace；否则渲染 `交易复盘图表工作区` loading。三个目标测试都通过 `createLegacySqliteClient` 与 fake-indexeddb，且 import/workspace 用例显式等待 toolbar，bridge 用例等待 dashboard fetch 后再打开回合。

验证：窄范围通过，未运行全仓以遵守任务边界，因此尚不足以证明“完整运行竞态”或产品回归。结论：这是最强的待验证假设，优先检查测试 helper 是否在每个失败用例完成同一入口动作并等待 readiness；最小修复应限于 helper/fixture 或单测调度，不应弱化 timeout。

### H3：跨测试的 fake-indexeddb、fetch、Recall repository 或 deferred promise 泄漏，首个 workspace 测试失败后级联造成 47 个后续超时

证据：workspace/import-flow/recall-bridge 各自有 cleanup；workspace/import-flow beforeEach 删除 `trade-reviewer` 数据库，reset mock 并清空 Recall map；bridge 也在 beforeEach 删除库、清空 mocks。仍存在每个测试文件各自的 module-level mock/client 与异步任务，完整并发运行时可能留下 late callback。

验证：三个单测隔离运行通过，无法在本轮不跑全量的前提下确认泄漏。结论：不能把它定性为产品问题；如复现，应先在允许文件内修复未等待的 deferred/cleanup，保留实际用户断言。

## 根因判定和允许范围

当前证据支持的准确判定是：先前 census 的 R01–R03 失败在当前工作树的三个代表路径不可复现；没有证据证明 `RecallWorkspace` 或 chart toolbar 的生产接线现在损坏。最可能的真实问题是 readiness 异步入口在完整套件下的 fixture/隔离竞态，或 census 对应的旧状态，而不是“把旧测试入口恢复回来”。

在协调者冻结任务前，建议的最小允许文件集为：

* `app/components/trade-review-workspace.test.tsx`
* `app/components/trade-review-workspace.import-flow.test.tsx`
* `app/components/trade-review-workspace.recall-bridge.test.tsx`
* 如需共享测试辅助，限于 `app/components/test-support/legacy-sqlite-client.ts`；只有出现明确跨文件竞态证据才准改 `tests/setup.ts` 或 `vitest.config.ts`。

暂不允许修改 `app/components/trade-review-workspace.tsx`、`recall/recall-workspace.tsx` 或 ChartToolbar；它们当前路径与批准规格一致，且代表用例已通过。不得用更长 timeout、skip、删除 toolbar/editor 断言来“修复”。

## 阻塞项

要把 H2/H3 从“最强假设”升级为根因，需要协调者单独安排完整套件或更宽但仍隔离的重现，并记录首个失败用例、是否卡在 loading 分支及其未完成 promise。按本任务要求，本代理没有运行全量，也没有启动服务、读写正式数据库或提交修改。
