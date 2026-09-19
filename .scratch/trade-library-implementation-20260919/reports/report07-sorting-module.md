# Ticket 07 — 交易库排序模块

日期：2026-09-19\
负责人：Luna\
范围：纯排序与模拟运行可比性判断；UI 表头、状态恢复和汇率刷新接线由协调者负责。

## 交付

新增：

- `app/lib/reviews/library-sorting.ts`
- `app/lib/reviews/library-sorting.test.ts`

公开接口：

```ts
sortLibraryItems<T>(
  items: Array<{ id: string; rows: ReviewQueueItem[]; value: T }>,
  sort: ReviewQueueSort,
  fxSnapshot?: FxSnapshot,
): Array<{ id: string; rows: ReviewQueueItem[]; value: T }>

canSortLibraryPerformance(
  rows: ReviewQueueItem[],
  selectedRunId: string,
): { allowed: boolean; reason: string | null }
```

排序模块保持原 item 和 `value` 引用，只返回新数组。时间排序对每个 item 扫描回合中的真实 execution timestamp，取最大合法时间；解析失败或没有 execution 时间的 item 在升序和降序都置后，同值按 `id` 再按输入位置稳定处理。`pending-first`/`completed-first` 先按 `reviewState`，再按最近 execution 时间和 `id`。

净盈亏和收益率排序会在比较前为每个 item 计算一次 `summarizeLibraryPerformance(rows, fxSnapshot).cny`，使用未舍入 Decimal 比较 `netPnl` 或 `weightedReturn`。`net-profit`/`return-high` 降序，`net-loss`/`return-low` 升序；没有可比人民币值的 item 置后，不把缺失值当零。这样跨币种排名同时遵循同一 FX 快照下的人民币净盈亏和按开仓金额加权收益率。

`canSortLibraryPerformance` 拒绝空范围、混合交易性质、混合模拟运行；模拟盘即使当前恰好只有一个运行，也必须传入非空且非 `all` 的匹配 `selectedRunId`，否则返回“请先选择模拟运行”或运行不匹配原因。实盘单一范围可排序。

## TDD 与验证

先运行目标测试时，模块尚不存在，Vitest 报 import resolution failure，测试数为 0。实现后运行：

```bash
npx vitest run app/lib/reviews/library-sorting.test.ts
```

结果：1 个文件、7 个测试通过。覆盖：

- 带时区 execution timestamp 的最新成交排序，以及无效时间在 newest/oldest 两个方向置后；
- CNY/外币使用 1 外币对应多少人民币的快照换算后反转净盈亏排名；
- 加权收益率使用汇总净盈亏/开仓金额，而不是回合收益率等权平均；
- 缺失 FX 的 item 在绩效排序中保持最后；
- 同值按 `id` 稳定排序并透传 value 引用；
- pending/completed 兼容排序；
- 未选择模拟运行、运行不匹配、跨运行、混合性质和空范围的限制。

相关回归与静态检查：

```bash
npx vitest run app/lib/reviews/library-performance.test.ts
npx tsc --noEmit
npx eslint app/lib/reviews/library-sorting.ts app/lib/reviews/library-sorting.test.ts
git diff --check -- app/lib/reviews/library-sorting.ts app/lib/reviews/library-sorting.test.ts
```

结果：绩效模块 9 个测试通过；typecheck、eslint、diff check 均 exit 0。没有运行全量套件、浏览器验收或数据库写入。

## 交接

UI 接线应在股票/回合两种视图共用该接口，把同一 immutable FX snapshot 传给排序与汇总；清除模拟运行且当前为绩效排序时由状态层恢复 `newest`，不会由本模块记忆旧排序。此切片未修改现有生产文件、交易数据或共享 UI。
