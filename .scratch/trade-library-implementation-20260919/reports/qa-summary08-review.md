# QA — ticket 08 绩效摘要组件独立复核

日期：2026-09-19\
审计人：Luna（独立 QA）\
范围：`library-performance-summary.tsx`、对应 CSS 与 5 个组件测试。没有修改生产代码、既有 owner 测试、数据库或浏览器状态；主页面接线仍属于集成验收。

## 结论

组件切片在当前边界内通过独立复核，没有发现 ticket 08 组件级新缺陷。组件测试 5/5 通过，scoped ESLint 通过。四个近期修复均在实际实现中可见，并由测试覆盖：持仓浮盈亏沿用原币、模拟运行使用稳定短标签、缺 FX 明确提示不可用、详情和原币区域默认折叠。

## 修复核对

| 修复 | 实现核对 | 结果 |
| --- | --- | --- |
| open 原币误标 CNY | `openPnlText` 将 `group.currency` 传给 `signedCurrency`，标签也按 CNY/外币分支；USD fixture 渲染 `USD 浮盈亏 +USD 50.00` | 通过 |
| raw run fallback | 无 `groupLabels` 时，simulation 组调用 `formatSimulationRunLabel`，经 `dashboardStableShortId` 生成短号；长 opaque ID 不进入界面文本 | 通过 |
| 缺 FX | 选中组的 `missing-fx`/`invalid-fx` 排除数触发 `role=status`，主指标显示“不可用”，原币仍保留在折叠区 | 通过 |
| 折叠细节 | 统计详情和原币金额均使用原生 `<details>`，没有 `open` 属性，测试确认初始状态关闭 | 通过 |

## 组件行为边界

- 多个 `comparableGroups` 时组件只选择一个组，`metricGroup`、原币列表和持仓组都按同一性质/运行范围过滤；测试确认 run A/B 不显示跨运行合计。
- 胜率显示胜率分母和保本数；净盈亏样本与收益率样本分别展示。空样本使用“不可用”，不会以 `0.00%` 伪造结果。
- 持仓中的净盈亏仍与已平仓指标分开；同一 scope 下的每个 open 原币组按自己的 currency 显示。费用、成本和 FX 排除原因由 metrics 输入透传到详情区。
- 原币列表只展示当前所选 comparable scope；单一 scope 没有 comparable group 时才回退显示全部 raw groups，这是不可用/空范围的展示边界，需由主页面保证传入的 summary 与当前筛选一致。

## 验证

```text
npx vitest run app/components/library/library-performance-summary.test.tsx
1 file, 5 tests passed

npx eslint app/components/library/library-performance-summary.tsx app/components/library/library-performance-summary.test.tsx
exit 0
```

没有运行全量测试、typecheck、浏览器或主页面集成。该结果证明组件在 synthetic `LibraryPerformanceSummary` 输入下的行为；它不证明主页面已把筛选后的 rows、entry-first 交易性质、FX snapshot、`groupLabels`、stock/round/review counts 和 open groups 正确接线。主页面接线完成后仍需独立验收：筛选改变后摘要是否同步、实盘/模拟盘与多 run 是否与列表同 scope，以及真实 legacy source fixture 是否显示为 live。
