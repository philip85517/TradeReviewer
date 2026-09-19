# QA — 交易库分页集成独立验收准备

日期：2026-09-19\
审计人：Luna（独立 QA）\
范围：真实公开 `TradeLibrary` 组件与当前 stock/queue 分页接线。没有修改生产代码或既有 owner 测试，没有浏览器、全量 suite 或数据库写入。

## 结论

当前分页接口已具备可验收形态；新增 101 条轻量真实 library fixture 的集成测试全部通过。分页只裁剪列表 DOM，筛选后的全量 rows 仍用于顶部计数、绩效样本、排序和 Start Review 候选。stock/round page state 在筛选、性质 scope、排序和 reset 变化时归 1；打开回合、返回列表以及父级卸载重挂载都会保留已保存页码。

新增测试：[trade-library.acceptance.test.tsx](/Users/zhoulin/.codex/worktrees/e7ec/TradeReview/app/components/library/trade-library.acceptance.test.tsx)

## 覆盖结果

测试 fixture 使用 101 个独立实盘证券、每个 1 个已平仓回合，所有回合净盈亏为 1 CNY。它足以触发两视图的第二页，同时保持 DOM 规模很小。

- 股票视图第 2 页只渲染第 101 个证券；顶部仍显示 `101 个标的 · 101 个回合`，摘要仍显示 101 个净盈亏样本、101 个收益率样本和 `+¥101.00`。展开后点击的是该页准确的 child episode ID。
- 回合视图第 2 页只显示第 101 个回合；顶部摘要仍使用完整 101 条 filtered set。此时点击全局“开始复盘”仍打开排序后第一条 pending 回合，并传递完整 101 条 queue IDs，没有被当前页截断。
- 性质 scope、排序和“重置筛选”均把 page cursor 重置为 1；reset 同时恢复 `newest` 排序。测试通过 `onBrowseStateChange` 观察 canonical `roundPage`。
- 打开第 2 页回合后返回列表保留第 2 页；将捕获的 canonical state 传给父级重新挂载后仍恢复第 2 页，证明状态不是只存在于一次 mounted instance。

## 验证命令

```text
npx vitest run app/components/library/trade-library.acceptance.test.tsx
1 file, 4 tests passed

npx eslint app/components/library/trade-library.acceptance.test.tsx
exit 0

npx tsc --noEmit
exit 0
```

## 当前仍未闭合的最终 spec gates

这些事项超出本次分页单测，需由协调者在最终 UI handoff 后完成：

1. 使用 766 条真实 fixture 和最终生产构建重新测量事件到绘制时间，并用 5000 回合 fixture 复测；已有 1802ms 是分页前/中间 harness 证据，不能作为最终结论。
2. 隔离数据库的真实浏览器流程：首次默认状态、同股多账户/多模拟运行、明确 run 后绩效排序、清除 run 后恢复时间排序、筛选抽屉 Apply/关闭、跨视图切换及排序指示。
3. 真实复盘保存/返回：准确 child ID、展开项、滚动位置、复盘进度和“开始复盘”候选；局部包含已复盘回合必须保持全局统计、排序和候选不变，并明确局部额外行不计入全局统计。
4. 05/06/08 主页面集成：全量 filtered rows 与摘要同 scope，CNY/原币、open、缺 FX、性质/run 分组和 legacy entry-first nature 在真实数据中一致；分页不能改变这些统计样本。
5. FX 手动刷新、缓存失败回退和无缓存不可用状态的最终浏览器验证，确认挂载、筛选、分页和排序不触发网络请求。
6. 桌面与窄屏布局、键盘焦点/抽屉 Escape、最终 fresh reload 控制台检查，以及 typecheck、相关测试、build 和集中 full suite。最终验收后还需复核受保护原始交易表的 fingerprint。
