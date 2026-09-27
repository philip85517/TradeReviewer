# R7 fault acceptance preparation

本目录只准备真实浏览器故障验收所需的本机代理和只读研究。没有启动 3049、代理或浏览器，没有修改业务 SQLite、产品代码或测试；代理也不记录请求体和 URL。代理入口是 [recall-fault-proxy.mjs](./recall-fault-proxy.mjs)，控制文件是 [fault-mode.json](./fault-mode.json)。

## A. Recall 保存失败/冲突

当前保存契约已核对：`app/lib/recall/repository.ts` 对 `PUT /api/storage/recall` 发送 JSON `{ document, expectedRevision, finalize? }`；`app/api/storage/recall/route.ts` 将存储失败返回 500 `storage-unavailable`，CAS 版本冲突返回 409 `conflict`。代理只对这个 method/path 合成响应；Recall GET、静态资源和其他 API 都转发到 3049。

在 3049 已由 root 启动后，另开终端运行：

```sh
cd /Users/zhoulin/.codex/worktrees/f7a5/TradeReview
PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
  node .scratch/chart-first-review-implementation/repair/fault-acceptance/recall-fault-proxy.mjs
```

浏览器打开 `http://127.0.0.1:3051`。模式文件应在触发一次写入前原子替换；`remaining: 1` 是唯一被接受的故障预算，代理响应一次后自动写回 pass。HTTP 500 示例：

```sh
mode_file=.scratch/chart-first-review-implementation/repair/fault-acceptance/fault-mode.json
printf '%s\n' '{"mode":"http500","remaining":1}' > "${mode_file}.next"
mv "${mode_file}.next" "$mode_file"
```

HTTP 409 只需把 `http500` 换成 `http409`。恢复正常模式：

```sh
printf '%s\n' '{"mode":"pass","remaining":0}' > "${mode_file}.next"
mv "${mode_file}.next" "$mode_file"
```

root 的最小点击序列：

1. 经 3051 正常打开隔离库里的 999996 Recall，确认 GET 和静态资源正常。
2. 先在一个可见的计划、Text 或人工标签输入中做一项易识别的本地修改，并等待之前的保存请求结束。
3. 设置 `http500`，立即执行一个明确的保存/完成动作。记录错误提示、输入仍可见且值未回退；将模式恢复 pass 后再次保存，并刷新确认值仍在。
4. 对同一干净状态重复一次 `http409`。记录冲突提示、当前输入仍可编辑；恢复 pass 后重试，确认保存成功并刷新复核。

只需保存浏览器截图和动作顺序；代理本身不产生业务日志。若模式文件无法自动复位，代理会放行而不合成故障，避免重复注入。

## B. 重导 `needs-confirmation` 与旧 Text 指针

### 只读检查结果

对 `.scratch/chart-first-review-implementation/repair/acceptance.sqlite` 使用 SQLite `mode=ro` 检查到：

- `executions` 共 25 行，其中 999996 的 3 行是 live：`synthetic-repair-fresh-replay-entry`（buy 1000 @ 56，2026-08-10）、`...-partial`（sell 600 @ 64，2026-08-14）、`...-close`（sell 400 @ 61，2026-08-20）；三行的 `source.fileFingerprint` 都是 `synthetic-repair-fresh-replay`。
- `import_batches` 为 0，备份没有可供导入流程复用的原始月结单批次或原始 PDF/XLSX 身份。
- 999996 当前 draft revision 33、formal revision 24 都是 `completed`；manual association 是 `linked`，执行集合仍是上述三行。
- `recall_manual_evaluation_evidence` 的 999996 指针仍是 `drawing-1790426055724-hn3sy`, `textRevision=1`, owner `synthetic-repair-fresh-replay-partial`，且 draft/formal 文档都保留该 Text。因此当前备份没有可直接显示的旧 missing Text revision。

这些查询只读完成，没有改写现有数据库。

### 为什么合成 CSV 不能触发 live 999996 重导

当前 dispatcher 只把 TradingView 中文 CSV 识别为模拟盘；文件名需要 `SSE/SZSE` 加六位代码，表头必须包含以下 17 列：

```text
交易编号, 类型, 日期和时间, 信号, 价格 CNY, 大小（数量）, 大小（价值）, 净损益 CNY, 回报 %, 手续费 CNY, 有利波动 CNY, 有利波动 %, 不利波动 CNY, 不利波动 %, 累计损益 CNY, 累计损益 %, 持续时间（K线）
```

上传例如 `回放交易_SSE_999996_r7.csv`，每个交易编号提供一行 `多头进场` 和一行 `多头出场`，再在上下文对话框选择沪市/999996，可以验证导入预览和配对字段。但解析器明确写入 `tradeNature=simulation`、`simulationRunId=tradingview:<fingerprint>:CN-SH:999996`、账户 `tradingview:<fingerprint>`；它会创建独立模拟回合，不会触碰 `SYNTHETIC-REPAIR-fresh-replay` 的 live 回合，也不会使该回合的 manual association 变成 `needs-confirmation`。因此本任务不应上传这种 CSV 来冒充 E18 重导验收。

真实 live 重导需要原始 PDF/XLSX（或已有相同 statement identity 的批次），保持相同账户、标的和 live 来源身份，同时让成交集合发生变化，例如删掉一个既有成交或加入一笔真实的新成交。`app/lib/recall/document.ts` 的 `reconcileRecallDocument` 会据此产生 `addedExecutionIds`/`removedExecutionIds`，并由 `reconcileRecallManualEvaluationAssociations` 把 `linked` 改为 `needs-confirmation`。随后浏览器应看到“成交集合已变化，当前标签需要确认归属”和“确认使用当前回合成交”，点击后 association 才回到 `linked`，再保存并刷新确认。

备份没有原始批次，且任务禁止伪造原 25 笔变化，所以这条真实重导链当前只能标为待补输入，不能通过合成 CSV 或直接改 SQLite 补齐。

### 旧 missing Text revision 的边界

组件只有在 manual evidence 指针的 `drawingId`、`textRevision` 或 `ownerId` 在当前文档中找不到匹配时，才显示“关联证据已缺失或修订变化，原引用保留：Text …”。当前 999996 指针和 Text revision 1 均存在；CSV 重导只改变成交集合，不改变 drawing 指针，不能制造这个 UI 状态。

要真实验收该提示，必须使用已有历史文档中“保留指针但当前 Text 缺失/修订不匹配”的状态，或另行批准一个隔离文档 fixture（例如将旧指针保留为 revision 1、当前同 ID Text 改为 revision 2）。两者都不应在本任务中改现有 DB；通过 UI 删除当前 Text 也不能据此推断 formal bundle 的历史指针会失效。若 root 找到已有 missing 指针备份，可在隔离库只读启动后记录提示文本和原指针；否则 E18 的 missing-Text 浏览器证据仍保持 unverified。

## 证据记录

故障验收至少记录：代理端口、控制模式、一次性响应类型、错误提示截图、本地输入值、pass 重试结果和刷新后的值。重导验收若未来取得真实原始 statement，再记录导入预览中的成交集合变化、`needs-confirmation` 提示、确认按钮后的执行 ID 集合、保存 revision 和刷新结果。不要把单独的 TradingView simulation import 或组件/领域测试当作 live 重导或旧 missing Text 的真实浏览器证据。

本准备内容的静态验证：`node --check recall-fault-proxy.mjs` 与 `git diff --check` 均通过；没有启动服务、浏览器或写入业务库。
