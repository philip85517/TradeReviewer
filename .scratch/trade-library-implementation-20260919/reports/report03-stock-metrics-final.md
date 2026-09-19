# 股票视图与绩效收口报告

日期：2026-09-19\
实现范围：`LibraryStockRounds` 股票主行、回合展开、绩效展示、表头排序入口和分页展示。

## 已完成

- 股票分组继续以 `instrument.id` 为外层身份，子回合保留账户、性质和模拟运行边界；同股多运行在展开区分组展示，并显示运行数量和“展开查看”提示。
- 股票行和运行组只读取 `performanceByInstrument` / `performanceByEpisode` 与 `summarizeLibraryPerformance`。旧的 `entry.netPnl`、`entry.returnPercent` 以及子回合旧指标不会作为新绩效缺失时的回退值。
- 可信已平仓净盈亏和“加权收益率（按开仓金额）”分别显示净盈亏样本、收益率样本。收益率为不可用时保留不可用文案，不用旧收益率或零值填充。
- 外币缺少 FX 时保留可信原币金额，并明确“人民币暂无法折算”；CNY 已折算的行同时提供原币金额详情。不同性质或模拟运行的顶层统计不相加，展开后的组各自显示金额和收益率。
- 持仓回合的浮盈亏单独显示；`pnlAvailable: false` 的持仓值不会被展示为可信浮盈亏，也不会出现在最终收益率位置。
- 保留已有稳定回合序号、局部包含已复盘的 extra badge、精确 episode ID 和每个回合的进入复盘按钮。
- 表头提供最近成交、净盈亏和收益率的升降序按钮；模拟运行未选定时绩效排序按钮禁用并显示原因。排序方向通过 accessible name 和 `aria-pressed` 暴露。
- 股票列表增加每页 100 行的分页，页码越界时回调收口到最后一页；页内只渲染当前页，展开时才计算当前运行组的展示汇总。主页面通过 `page` / `onPageChange` 传入 canonical page state。

## 接口交接

`LibraryStockRoundsProps` 新增：

```ts
fxSnapshot?: FxSnapshot | null;
sort?: ReviewQueueSort;
onSort?: (sort: ReviewQueueSort) => void;
performanceSortAvailability?: { allowed: boolean; reason: string | null };
page?: number;
onPageChange?: (page: number) => void;
```

主页面应传入当前不可变 FX 快照、有效排序和排序 gating；股票页码由 canonical browse state 保存，并在筛选范围变化时重置。组件不发起网络请求，也不修改交易数据。

## 验证

```text
npx vitest run app/components/library/library-stock-rounds.test.tsx
1 file, 9 tests passed

npm run typecheck
exit 0

npx eslint app/components/library/library-stock-rounds.tsx app/components/library/library-stock-rounds.test.tsx
exit 0

git diff --check -- app/components/library/library-stock-rounds.tsx \
  app/components/library/library-stock-rounds.module.css \
  app/components/library/library-stock-rounds.test.tsx
exit 0
```

测试覆盖旧绩效回退、CNY 折算后的原币金额、缺 FX 原币金额、多模拟运行分组与不相加、持仓浮盈亏、排序 gating、稳定回合序号/局部 extra badge，以及 101 行分页越界收口。未运行全量套件、浏览器验收或数据库写入。
