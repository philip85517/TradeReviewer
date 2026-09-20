# 04 — 分市场表现拆解：实现报告

## 当前状态

已完成 04 的独立报告 seam 和 UI 子组件。实现只写入本任务允许的两个生产文件、两个测试文件和本报告；未修改 `PatternInsights`、`OutcomeStructure`、`OutcomeDiagnostics`、`InsightEpisodeFact`、父任务、03 文件或全局样式。未提交、未推送、未合并，也未派发 agent。

## 交付内容

- `buildMarketBreakdownReport` 保持总体报告，并按固定顺序生成 US、HK、CN-SH、CN-SZ、未知市场五个组。
- 市场字段会将既有标准别名 `SH/SSE` 和 `SZ/SZSE` 归一到 `CN-SH/CN-SZ`；其他值进入未知市场，不被强行猜测。
- 每组通过 01 的 `buildOutcomeStructureReport` 复用收益率分布、五类结果桶、总胜率、非持平胜率、平均/中位盈利与亏损、赔率、利润因子、极值和排除口径。
- 每组样本少于 3 时标记为仅描述统计且不可排名；未知市场始终不参与排名。
- 空值收益率继续进入对应市场组的排除列表，显示未知而不替换为零；跨币种说明只允许比较收益率和比例指标，不合并不可比金额。
- `MarketBreakdown` 提供五个市场卡片、核心指标、结果桶摘要、样本/排除说明、未知市场提示及可访问的市场交易回合打开按钮。

## 测试命令与结果

定向测试：

```text
npx vitest run app/lib/insights/market-breakdown.test.ts app/components/insights/market-breakdown.test.tsx
Test Files 2 passed (2)
Tests 7 passed (7)
```

定向 ESLint：

```text
npx eslint app/lib/insights/market-breakdown.ts app/lib/insights/market-breakdown.test.ts app/components/insights/market-breakdown.tsx app/components/insights/market-breakdown.test.tsx
exit 0
```

`git diff --check`：通过。

全局类型检查：

```text
npm run typecheck
```

仍有范围外既有失败：`app/lib/insights/ipo-breakdown.test.ts:112-113` 将 01 的 `report.histogram` 对象按数组下标访问；当前正确结构是 `report.histogram.bins`。本任务未修改该测试或共享类型。其余本任务新增文件没有 typecheck 错误。

## 未决问题

- 本任务只提供独立的 `MarketBreakdown` seam；页面整合、统一筛选和浏览器验收由 05 负责。
- 本任务未启动真实浏览器服务，符合当前子任务边界；最终 UI 预览和桌面/窄屏验收由协调者在 05 集成阶段完成。
