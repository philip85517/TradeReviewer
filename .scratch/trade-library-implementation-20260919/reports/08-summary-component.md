# Ticket 08 — 复盘库绩效摘要组件

日期：2026-09-19\
负责人：Luna\
范围：新增绩效摘要展示组件；主页面接线、筛选状态和浏览器验收由协调者负责。

## 交付

新增：

- `app/components/library/library-performance-summary.tsx`
- `app/components/library/library-performance-summary.module.css`
- `app/components/library/library-performance-summary.test.tsx`

公开组件入口为：

```tsx
<LibraryPerformanceSummaryView
  summary={summary}
  stockCount={stockCount}
  roundCount={roundCount}
  reviewedCount={reviewedCount}
  progressTotal={progressTotal}
  groupLabels={groupLabels}
/>
```

组件只消费调用方传入的 `LibraryPerformanceSummary`，不请求网络、不读取 FX 状态，也不修改筛选或复盘状态。单一性质/运行范围使用顶层 CNY 指标；存在多个 `comparableGroups` 时提供本地统计范围选择器，每次只展示一个性质/模拟运行组，避免把不同运行相加。未传自定义组名时，模拟运行使用稳定短号，不把长运行 ID直接放进界面。

界面包含四个主指标：已平仓净盈亏、按开仓金额加权收益率、带胜率分母和保本数的胜率、复盘进度。详情区域默认折叠，区分净盈亏样本和收益率样本，展示平均盈利/亏损、盈亏比、利润因子、持仓回合、排除回合和可读的排除原因；持仓浮盈亏单独显示并按各原币标识，避免把 USD 等金额标成 CNY。原币组保留币种、已平仓净盈亏、开仓金额和加权收益率，缺失指标显示“不可用”而不填零。暗色主题使用现有 `positive`/`negative` 颜色类，并通过 CSS module 提供窄屏卡片布局。复盘进度卡片明确注明其分母不受复盘状态筛选影响；费用金额不在 05/06 指标接口中，组件展示已知费用已扣除的口径和费用未知排除原因。

## 验证

按 TDD 先运行目标测试，组件尚不存在时导入失败；实现后运行：

```bash
npx vitest run app/components/library/library-performance-summary.test.tsx
```

结果：1 个文件、5 个测试通过。覆盖：

- 四个主指标、不同样本覆盖、费用/开仓金额排除原因、原币金额和独立浮盈亏；
- 多模拟运行只能选择一个组，界面不显示跨运行合计；
- 默认运行标签隐藏长 ID，选中组缺少 FX 时仍显示明确原因；
- 没有有效指标时显示“不可用”，不显示零占位；详情和原币区域默认折叠。

同时验证绩效计算模块及本切片的跨边界类型：

```bash
npx vitest run app/lib/reviews/library-performance.test.ts
npx tsc --noEmit
npx eslint app/components/library/library-performance-summary.tsx app/components/library/library-performance-summary.test.tsx app/lib/reviews/library-performance.ts app/lib/reviews/library-performance.test.ts
```

结果：绩效模块 9 个测试通过；typecheck exit 0；eslint exit 0。

## 交接

绩效模块的窄修复让交易性质优先取 `ReviewQueueItem.entry.tradeNature`，避免旧 episode 上的 `unknown` 覆盖入口记录的 `live`；对应隔离 `live` 与显式 `unknown` 的回归测试已通过。股票/回合 UI 中同一性质解析的对应修复仍由 UI 负责人接入。

本切片没有修改既有交易数据、FX 持久化或主页面文件，没有启动服务，也没有进行浏览器预览验收；不能单独视为 ticket 08 的整体 UI 交付完成。
