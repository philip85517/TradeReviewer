# QA — ticket 07 排序模块独立复核

日期：2026-09-19\
审计人：Luna（独立 QA）\
范围：`app/lib/reviews/library-sorting.ts` 纯排序模块，以及当前 03/07 UI 接线状态。没有修改生产代码或既有 owner 测试；只新增一个独立 acceptance 文件。

## 结论

纯排序模块通过本次边界复核，没有发现需要修改模块本身的新缺陷。原有 7 个测试加新增 2 个 acceptance tests 共 9 个 focused tests 通过。新增测试锁定了真实 legacy entry 的性质优先级，以及同一 FX snapshot 下跨币种净盈亏/加权收益率和高精度 Decimal 排序。

## 纯模块检查

| 边界 | 结果 |
| --- | --- |
| 无效/未知成交时间在 newest 与 oldest 两个方向置后 | 通过；`Date.parse` 失败值不会被当成 epoch 或 0。 |
| 带时区时间 | 通过；按绝对 timestamp 比较，`2026-01-02T00:00:00+08:00` 与对应 UTC 时刻一致。 |
| Decimal 净盈亏与加权收益率 | 通过；排序前由 `summarizeLibraryPerformance(rows, fxSnapshot).cny` 取未舍入 Decimal 值，同一 snapshot 同时换算分子和分母。高精度差值不会落到 id tie-break。 |
| 缺 FX / 不可比值 | 通过；`null` 值在升降序均置后，不以零参与排名。 |
| 明确模拟运行限制 | 通过；`canSortLibraryPerformance` 拒绝空范围、混合性质、混合 run，以及未选择或不匹配的模拟 run。 |
| entry-first 性质 | 通过；真实 `buildTradeLibraryEntries` 的历史 Futu entry 为 `live`，旧 episode 为 `unknown`，排序可比性按 entry 性质隔离；显式 unknown 与其混合时拒绝绩效排序。 |
| 同值稳定性/引用 | 通过；id 再输入位置作为确定性 tie-break，item/value 引用保持不变。 |

新增文件：[library-sorting.acceptance.test.ts](/Users/zhoulin/.codex/worktrees/e7ec/TradeReview/app/lib/reviews/library-sorting.acceptance.test.ts)

## 当前 UI 接线待验收项

这些是 03/07 集成边界，不能归因于纯排序模块，也不把尚未接线的 05/06/08 计为新缺陷：

1. `canSortLibraryPerformance` 当前只被导入，没有在 `buildTradeLibraryBrowseRows` 或排序控件路径调用。`buildTradeLibraryBrowseRows` 会在 `simulationRunId="all"` 时仍按每个回合的 CNY 值排序，且 `trade-library.tsx` 的排序选择器始终提供绩效选项。最终 UI 验收必须确认模拟盘未选定 run 时显示“请先选择模拟运行”并按时间浏览，不能跨 run 排名；混合性质/运行也必须保持不可比。
2. `changeTradeNature` 清除不兼容模拟 run 时没有同步把绩效排序恢复为 `newest`。移除 run chip 的路径已有恢复逻辑，但交易性质切换及高级抽屉应用路径仍需覆盖“清除 run + 当前绩效排序”的 R5 场景。
3. 股票视图当前先在 `buildTradeLibraryBrowseRows` 对回合排序，再由 `aggregateTradeLibraryStocks` 按首次出现顺序建股票组。`newest` 下首回合恰好是该股票最新成交；`oldest` 下首回合会是最早回合，可能使股票行按最早回合而非股票最近成交排序。最终验收需用“两只股票各含多个时间跨度回合”的 fixture 检查两个方向，或在接线时对聚合股票重新调用相同排序接口。
4. `tradeNatureForReviewRow` 已是 entry-first，stock rounds 的真实 legacy-source fixture 仍需浏览器/集成验收，确保历史 Futu 回合显示实盘而非来源未知；该项不影响本次纯模块结论。

## 验证命令

```text
npx vitest run app/lib/reviews/library-sorting.acceptance.test.ts
1 file, 2 tests passed

npx vitest run app/lib/reviews/library-sorting.test.ts app/lib/reviews/library-sorting.acceptance.test.ts
2 files, 9 tests passed

npx eslint app/lib/reviews/library-sorting.acceptance.test.ts
exit 0

npx tsc --noEmit
exit 0
```

没有运行全量测试、typecheck、浏览器或数据库写入。纯模块通过不代表当前主页面的排序接线已经满足 R5；上述 03/07 场景应在 UI handoff 后完成最终验收。
