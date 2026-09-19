# Ticket 01 — 统一交易库入口与浏览状态

状态：实现完成，等待协调者独立验收。本报告只覆盖 ticket 01 的共享浏览状态切片，不声明交易库刷新需求整体完成。

## 交付范围

新增 `app/components/library/library-browse-state.ts`，作为股票视图和回合队列共用的可序列化状态与筛选管线。公开状态包含：

- `mode`、选中的标的/回合和 `scrollTop`；
- 搜索、市场、账户单选/多选、券商、年份、模拟运行；
- `tradeNature`、`reviewStatus`、排序、持仓状态、行情完整性、标签和高级筛选展开状态。

默认入口是 `live / stocks / all rounds / newest execution first`。旧的 `queueFilter` 状态可迁移到该结构，且会保留既有筛选值。股票行由已匹配的回合先聚合，再计算账户数、成交数、回合数、日期和展示指标；账户或年份命中的同一标的的其他回合不会被带入股票行。回合队列和股票列表都消费同一批已筛选回合，名称 overlay、来源范围和稳定 episode ID 仍由回合数据提供。

重置保留当前视图和交易性质，清空其余范围条件、复盘状态与性能排序并恢复最近成交排序。切换交易性质会清除不兼容的来源、账户和模拟运行，并给出提示。开始复盘候选严格取当前筛选回合中的 pending 项，避免把筛选范围外的回合重新加入候选。混合交易性质或模拟运行的股票聚合不跨范围相加，派生指标保持不可用。

## 变更文件

- `app/components/library/library-browse-state.ts`
- `app/components/library/library-browse-state.test.ts`
- `app/components/library/trade-library.tsx`
- `app/components/library/trade-library.test.tsx`
- `app/components/library/review-queue.tsx`
- `app/components/trade-review-workspace.tsx`

`ReviewQueue` 增加可选的已构建 `rows`/`pendingRows` 输入；它仍保留原有独立调用方式。原始 entries 只用于选项和名称显示，渲染与打开动作使用 canonical rows，因此筛选后的 episode 集不会被选项元数据重新扩展。工作台首次进入交易库使用股票视图，并在统一工作台完成回合后保留已选择的浏览视图。

## TDD 与验证证据

先运行目标测试时，新模块尚不存在，`library-browse-state.test.ts` 按预期在模块解析阶段失败。实现后目标测试通过：

```text
npx vitest run app/components/library/library-browse-state.test.ts
7 tests passed
```

集成初测暴露了三项回归：旧测试假定跨账户切换股票时仍显示未匹配标的，以及队列选项从已筛选 rows 重建后丢失同名账户/不兼容账户选项。修正为保留 canonical rows 负责结果、原始 entries 负责选项元数据，并更新已改变语义的测试后，目标联合套件通过：

```text
npx vitest run app/components/library/library-browse-state.test.ts app/components/library/trade-library.test.tsx
2 files, 33 tests passed
```

其他检查：

```text
npx tsc --noEmit --pretty false       # exit 0
npx eslint <ticket-01 changed files>  # exit 0, warnings only in pre-existing workspace/test hooks
git diff --check                      # exit 0
```

没有写入真实交易数据库，也没有 push、merge 或 commit。尚未在本报告中声明 3031 浏览器预览验收；协调者应在合并其他切片后按 acceptance DB 重跑浏览器检查。

## 后续边界

抽屉 staging、FX 快照、跨币种绩效、股票子回合展开和最终视觉样式不属于本 ticket；它们应通过 `TradeLibraryBrowseState` 的 `onApply`/持久化边界接入，避免重新建立第二套筛选状态。
