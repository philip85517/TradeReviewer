# 任务 04 + 06：收益卡片与期间视图修复报告

日期：2026-09-21
工作树：`/Users/zhoulin/.codex/worktrees/ccc5/TradeReview`

## 修改路径

- `app/components/dashboard/review-dashboard.tsx`
  - 净盈亏卡片保留四卡与现有金额口径，辅助文本改为期间 + 简短状态。
  - 原币小计、汇率快照/说明放入原生 `details/summary` 详情入口；入口可聚焦，点击/触屏可展开，键盘语义由原生 `summary` 提供。
  - 移除不必要的 `RoomPerformance` 重建 key。
  - 范围同步只更新生效范围和草稿值，不因日历下钻自动展开自定义编辑器；更多期间仍仅由用户主动打开。
  - 应用、取消、快捷期间和其他范围切换清理编辑器/错误状态；快捷期间或筛选变化保留趋势/日历视图。
  - `onRetryDataQuality` 返回类型扩展为 `void | Promise<void>`，并将 `qualityInput` 的 `marketDataStatuses`、`marketDataDailyStatuses`、`marketDataLabels`、`marketDataJobs` 同时传入 `buildTradingRoomHoldings` 与 `RoomHoldingsPanel`。
  - `roomHoldingsModel` 的 `useMemo` 依赖补齐上述 4 个行情输入，确保行情重试/状态变化后质量模型重建。
- `app/components/dashboard/review-dashboard.module.css`
  - 增加详情入口的触屏尺寸、焦点样式与不截断详情内容；保留卡片原有紧凑对齐和辅助文本两行约束。
- `app/components/dashboard/review-dashboard.test.tsx`
  - 将旧缺陷期望改为回归断言，并覆盖详情折叠/展开、聚焦、原币汇率信息、视图保持、下钻不展开编辑器及快捷切换清理状态。
  - 增加四字段行情诊断转发、rerender 状态变化和异步 holdings 重试回调集成断言。

## 复现与验证

- 基线：
  - `npx vitest run app/components/dashboard/review-dashboard.test.tsx --reporter=verbose`
  - 现状基线 `1 file / 17 tests passed`；原有测试未覆盖可操作详情，且旧测试把“快捷期间回到趋势”和“下钻自动打开编辑器”当作通过条件。
- 红灯复现：加入任务 04/06 回归断言后，同一命令出现 `6 failed | 11 passed`，失败集中在详情入口缺失、编辑器状态清理和趋势/日历视图被重建。
- C 接口红灯复验：临时移除 `roomHoldingsModel` 的 4 个行情输入依赖后，rerender 集成测试 `forwards market-data diagnostics to holdings and its quality model` 失败；恢复依赖后通过。
- 最终定向测试：
  - `npx vitest run app/components/dashboard/review-dashboard.test.tsx --reporter=verbose`
  - `1 file / 20 tests passed`，退出码 0。
- 格式检查：
  - `git diff --check`
  - 通过，退出码 0。

## 独立审查修复：R9、R2 与指定旧断言

- `app/components/dashboard/review-dashboard.tsx`
  - `roomMoneySummary` 先识别 `same-currency`；纯 CNY 汇总显示 `CNY 原币`，不再误称“已按汇率快照换算”。
- `app/components/data-management/quality-details.tsx`
  - `onRetryDataQuality` 保留同步 `void` 兼容，同时接受 `Promise<void>`。
  - 维度级与问题级重试都在消费者处等待并捕获 Promise；进行中禁用当前按钮，失败显示可见 `role=alert`，成功清理状态。
- `app/components/data-management/quality-details.test.tsx`、`app/components/data-management/quality-details.module.css`
  - 增加异步进行中/禁用、拒绝失败反馈回归；补充禁用态、进行中和失败反馈样式。
- `app/components/trade-review-workspace.test.tsx`
  - 仅将指定旧断言的 combobox 名称更新为 `交易室市场分类筛选`；未改 workspace 生产代码及其他 workspace 测试。

## 本轮定向验证

- `npx vitest run app/components/data-management/quality-details.test.tsx --reporter=verbose`
  - `1 file / 5 tests passed`，退出码 0。
- `npx vitest run app/components/dashboard/review-dashboard.test.tsx --reporter=verbose`
  - `1 file / 20 tests passed`，退出码 0。
- `npx vitest run app/components/trade-review-workspace.test.tsx -t "passes stored instrument metadata into the trading room scope" --reporter=verbose`
  - `1 passed / 71 skipped`，退出码 0。
- `git diff --check`
  - 通过，退出码 0。

## 未运行与问题

- 按任务要求未运行 typecheck/build，由主协调者集中执行。
- 未运行浏览器验收；桌面/窄屏、触屏真实事件、服务与预览 URL由主协调者按独立浏览器清单验收。
- 已按 C 正式接口扩展 `onRetryDataQuality` 返回类型并接入四个 qualityInput 行情字段；未猜测其他字段。
- 未触碰 performance、holdings、workspace 生产代码、行情源或原始交易数据；workspace 仅改动上面指定的一条旧测试定位；未提交、push、merge 或重置已有改动。
