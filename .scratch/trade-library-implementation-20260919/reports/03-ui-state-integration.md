# Ticket 03/01 UI state integration progress

状态：主交易库接线与列表分页已实现，等待协调者合并其他切片后的独立浏览器验收。本报告只记录本 agent 负责的状态、队列和主壳接线，不声明交易库整体功能完成。

## 共享状态与分页

`TradeLibraryBrowseState` 现在持久化 `stockPage` 与 `roundPage`，默认和非法值都归到第 1 页。搜索、市场、账户、来源平台、年份、性质、模拟运行、复盘状态、排序、持仓状态、行情状态和标签等范围变化会把两种列表恢复到第 1 页；展开、滚动、选中回合和从工作台返回会保留页码。过滤和绩效排序仍在完整匹配集合上计算，列表只渲染当前页的 100 个元素。

`ReviewQueue` 新增可选的 `page`/`onPageChange`，保留完整 rows 计算摘要、排序和复盘队列 ID，再渲染 100 行并显示当前区间、总数及前后页按钮。主交易库把 canonical `roundPage` 接入队列；按标的视图把 `stockPage` 接到 stock/round 组件已确认的 `page`/`onPageChange` 接口。

## 变更路径

- `app/components/library/library-browse-state.ts`
- `app/components/library/library-browse-state.test.ts`
- `app/components/library/trade-library.tsx`
- `app/components/library/trade-library.test.tsx`
- `app/components/library/review-queue.tsx`
- `app/components/library/review-queue.coverage.test.tsx`
- `app/components/library/library-filter-drawer.test.tsx`（补全新增持久化页码字段）

## 验证

- `npx vitest run app/components/library/review-queue.coverage.test.tsx --reporter=dot`：4/4 通过，包含 205 回合只渲染 100 行的分页行为。
- `npx vitest run app/components/library/trade-library.test.tsx --reporter=dot`：27/27 通过。
- `npx vitest run app/components/library/library-filter-drawer.test.tsx app/components/library/library-browse-state.test.ts app/components/library/review-queue.coverage.test.tsx --reporter=dot`：19/19 通过。
- `npx vitest run app/components/library/library-stock-rounds.test.tsx --reporter=dot`：9/9 通过（并行 metrics agent 负责的组件）。
- `npx tsc --noEmit`：exit 0。
- 负责路径 `eslint`：exit 0；`git diff --check`：exit 0。

尚未在本报告中声明真实浏览器预览验收；协调者应在当前工作树本地服务仍运行时复核跨页打开回合、返回保留页码、筛选/排序回到第 1 页，以及全量统计不被分页截断。

## 5000 回合显示指标优化

分页后的生产夹具仍在清空搜索时为全量股票组和全量回合建立显示用财务摘要。主组件现在把这类计算限制为当前 100 条回合页，或当前股票页中已展开股票的回合；局部“包含已复盘回合”会使用该股票的 `allRows`，因此额外子回合仍能显示完整指标。股票页只建立当前页的股票摘要。全量筛选集合、绩效排序输入、筛选绩效汇总和开始复盘候选没有缩减。

回归测试先验证了显示行选择会排除未展开股票和隐藏页，随后接入主组件：

- `npx vitest run app/components/library/trade-library.test.tsx --reporter=dot`：28/28 通过。
- `npx eslint app/components/library/trade-library.tsx app/components/library/trade-library.test.tsx`：exit 0。
- `npx tsc --noEmit`：exit 0。
- 性能夹具重新构建：`npx vite build --config .scratch/trade-library-implementation-20260919/performance/vite.config.ts`，1836 modules，exit 0。

协调者仍需在安静机器上运行最终 5000 回合浏览器测量，记录搜索收窄和清空恢复的 20 次样本及 p95；本 agent 未将构建耗时当作 UI 性能结论。
