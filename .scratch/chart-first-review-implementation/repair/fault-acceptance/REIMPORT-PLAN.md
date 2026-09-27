# 合成月结单重导可行性（R7 fault acceptance）

## 结论

完整的“文件导入 → 月结单核对 → 分类/确认 → 同账户同月份修订文件 → 成交冲突选择 → Recall 成交集合重新确认”链路可以用仓库现有 Futu F4 PDF 解析器验收，不需要真实用户月结单，也不需要伪造原 `acceptance.sqlite` 的 25 笔成交。

Futu XLSX 测试夹具可以快速生成工作簿，但它走的是普通交易流水解析：`parseFutuWorkbook` 的返回值没有 `monthly` 字段（[futu.ts](../../../../app/lib/import/futu.ts#L209-L217)、[futu.ts](../../../../app/lib/import/futu.ts#L436-L443)），因此不会进入 `MonthlyStatementReview` 或月结单重导分支。已有 XLSX 生成器只证明表头和逐行成交字段（[futu.test.ts](../../../../app/lib/import/futu.test.ts#L7-L32)）。本验收使用 PDF，因为 dispatcher 将 Futu PDF 接到 `futu/pdf/monthly-v1`（[statement-adapters.ts](../../../../app/lib/import/statement-adapters.ts#L60-L78)）。

## 已生成的输入

文件和生成器均在本目录；没有写入业务数据库、产品代码或测试文件。

| 文件 | 合成身份和变化 |
| --- | --- |
| [futu-synthetic-monthly-v1.pdf](./futu-synthetic-monthly-v1.pdf) | F4 月结单；账户 `futu:900001`；账期 `2020-01`；`US:FB`；买入 100 股 @ 10（09:30）后卖出 100 股 @ 10（10:00），各费用 1，构成可完成的合成长回合。 |
| [futu-synthetic-monthly-v2-corrected.pdf](./futu-synthetic-monthly-v2-corrected.pdf) | 完全相同的账户、账期、标的和买入；卖出修订为 80 股、成交金额 800、变动金额 799，仍是有效 F4 数据。文件指纹不同，故在导入时形成同一成交时刻的明确数量冲突。 |

`FB` 和 `2020-01` 是有意选择的离线身份：项目的历史证券身份规则会把 2025-06-24 之前的 FB 成交解析为 `Meta Platforms, Inc. (historical FB)`，所以分类验证不依赖外部证券目录（[historical-instrument-identity.ts](../../../../app/lib/instruments/historical-instrument-identity.ts#L1-L49)）。PDF 内的账户、成交、金额和文本都是合成值，与原 25 笔执行无关。生成脚本是 [generate-reimport-fixtures.py](./generate-reimport-fixtures.py)。

## 已完成的离线核对

命令：

```sh
cd /Users/zhoulin/.codex/worktrees/f7a5/TradeReview
python3 .scratch/chart-first-review-implementation/repair/fault-acceptance/generate-reimport-fixtures.py
node --import tsx/esm .scratch/chart-first-review-implementation/repair/fault-acceptance/verify-reimport-fixtures.mts
```

[verify-reimport-fixtures.mts](./verify-reimport-fixtures.mts) 使用仓库的 `pdfjs-dist`、`extractPdfPages` 和 `parseBrokerStatement`，再调用 `enrichStatementImport` 与 `reconcileExecutions`。结果如下：

- v1 和 v2 均 `broker: futu`、`blocked: false`、`diagnostics: []`、模板 `F4`，各 2 笔成交。
- 两版均解析为 `month: 2020-01`、`accountId: futu:900001`、`instrument: US:FB`；两版 `enriched.importable: 2`、`unresolved: 0`。
- v1 成交数量为 `100 + 100`；v2 为 `100 + 80`。两版指纹分别为 `6b7c31c834445e40` 和 `583d57e98d25cad1`（每次重新生成 PDF 时指纹会因 PDF 元数据改变，验证只要求两版不同）。
- `reconcileExecutions(v1, v2)` 产生 1 个冲突：`conflict:US:FB|2020-01-27T15:00:00Z|account:futu:900001`，已存 100、 incoming 80；该冲突应选择“使用本次，替换已存”。

没有启动服务或浏览器；验证只读仓库源码和本目录合成 PDF。

## 最短真实浏览器步骤

root 先用 SQLite backup API 从一个隔离源建立新的可写库，例如 `reimport-acceptance.sqlite`，不要把浏览器写入原 `acceptance.sqlite`。然后在本工作树用端口 3052 启动：

```sh
cd /Users/zhoulin/.codex/worktrees/f7a5/TradeReview
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/fault-acceptance/reimport-acceptance.sqlite \
  npm run dev -- --hostname 127.0.0.1 --port 3052
```

1. 进入“数据管理”，点击“导入交易记录”，选择 `futu-synthetic-monthly-v1.pdf`。
2. 在“核对月结单与时间口径”确认 `2020-01 · F4`、2 笔成交、无诊断问题，点击“继续核对并导入”；在“确认导入交易记录”确认 `FB` 的 2 笔成交。
3. 打开生成的 `US:FB` 交易回合。在“回合人工标签”勾选任一标签并等待自动保存；若行情和回合状态允许，再点击“保存并完成回合复盘”。即使只保留草稿，也已建立人工标签关联供下一步重导核对。
4. 再次通过“导入交易记录”选择 `futu-synthetic-monthly-v2-corrected.pdf`，按同样的月结单核对流程继续。
5. 确认框会显示“相同时刻的不同成交，请逐组核对”，将该组选择为“使用本次，替换已存”，点击“确认导入并开始更新行情”。workspace 会先构造 monthly reconciliation，再按显式决定合并并替换（[trade-review-workspace.tsx](../../../../app/components/trade-review-workspace.tsx#L3529-L3556)、[trade-review-workspace.tsx](../../../../app/components/trade-review-workspace.tsx#L3764-L3804)）。
6. 回到同一 `US:FB` 回合，预期状态为“待重新确认”，人工标签区出现“成交集合已变化，当前标签需要确认归属。”和“确认使用当前回合成交”。点击确认，保存后刷新；预期旧卖出执行 ID 被移除、新 v2 卖出执行 ID 被加入，关联恢复 `linked`。`reconcileRecallDocument` 对新增/移除执行会标记 `needs-confirmation`（[document.ts](../../../../app/lib/recall/document.ts#L502-L560)），人工标签区的可见提示和确认按钮由 [recall-manual-evaluations.tsx](../../../../app/components/recall/recall-manual-evaluations.tsx#L97-L103) 提供。

## 身份边界

v2 是“同账户、同账期、同标的的修订文件”，不是同一字节文件重试。月结单 `documentId` 由 `futu:${fileFingerprint}` 生成（[futu-pdf.ts](../../../../app/lib/import/futu-pdf.ts#L43-L60)），`belongsToMonthlyDocument` 只按该指纹归属（[statement-identity.ts](../../../../app/lib/import/statement-identity.ts#L4-L8)）。所以不同文件指纹不会被静默当作同一文档；数量变化会进入显式冲突选择，正好覆盖本验收需要的真实修订路径。`assessMonthlyReimport` 也只对同一指纹且执行 ID/内容完全一致的集合返回 `idempotent: true`（[monthly-reimport.ts](../../../../app/lib/import/monthly-reimport.ts#L59-L99)）。

该夹具证明的是产品真实 PDF 导入和成交集合变更后的 Recall 消费链；它不声称模拟真实用户原始月结单，也不声称 XLSX 能进入月结单重导。若需要验证“同一原始文件完全重试”的幂等路径，应重复 v1 文件本身；若需要验证 v2 修订后的冲突处理，应保留上面的“使用本次，替换已存”决定。
