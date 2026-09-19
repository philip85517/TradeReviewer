# 交易库筛选派生缓存与轻量股票模板

日期：2026-09-19

## 根因

清空搜索会回到已经访问过的完整筛选范围，但主页面此前仍重新执行完整派生链：`buildTradeLibraryBrowseRows` 之后，`aggregateTradeLibraryStocks` 为每个匹配标的重新计算 legacy net PnL、gross exposure、return 和 R 汇总，随后重新建立股票分组与全量绩效摘要。当前股票组件的财务展示来自 `library-performance`，主页面只需要股票模板的身份、计数、日期、状态、标签和累计 R。

## 调整

- `aggregateTradeLibraryStockDisplayEntries` 复用原有分组语义，跳过 legacy net/return/曝光额计算，保留股票行仍展示的累计 R。
- 主页面为筛选范围建立容量为 8 的 LRU。缓存键覆盖搜索、市场、账户、来源、年份、交易性质、模拟运行、复盘状态、排序、持仓/行情/标签等筛选维度，不包含选中回合、展开、滚动和分页。
- 缓存值包含当前 rows、无状态 rows、轻量股票模板、原始股票组、完整绩效摘要、排序可用性和复盘进度。缓存边界绑定 `entries`、`reviewsHydrated`、行情状态和 FX snapshot 的对象身份；这些来源变化会整体失效，避免复用旧 review、行情或汇率结果。

## 验证

```text
npx vitest run app/components/library/trade-library.test.tsx --reporter=dot --maxWorkers=1
1 file, 29 tests passed

npx vitest run app/components/library/library-browse-state.test.ts --reporter=dot --maxWorkers=1
1 file, 12 tests passed

npx eslint app/components/library/trade-library.tsx \
  app/components/library/trade-library.test.tsx \
  app/components/library/library-browse-state.ts \
  app/components/library/library-browse-state.test.ts
exit 0

git diff --check -- app/components/library/trade-library.tsx \
  app/components/library/trade-library.test.tsx \
  app/components/library/library-browse-state.ts \
  app/components/library/library-browse-state.test.ts
exit 0
```

新增组件回归覆盖 A→B→A 后 entries/review 更新必须刷新复盘进度，而不是返回旧缓存；helper 测试覆盖轻量模板不带 legacy 财务总额、保留累计 R，以及范围键忽略导航状态和 LRU 淘汰。5000 回合浏览器双计时由协调者在最新构建中执行；本切片未改变全量统计、排序公式或分页数据。
