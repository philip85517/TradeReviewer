# 原生复盘样板实现记录

## 范围

本 bounded task 只增加 `?prototype=review-design&mode=baseline|recommended` 开发路由、样板 fixture/repository、样板 scoped CSS，以及 RecallWorkspace、ReplayChart、DrawingCanvas 的 opt-in seam。业务默认工作区、全局主题和 SQL repository 未改动。

样板使用 `CN-SH`（显示时区 `Asia/Shanghai`）的 100 根完整日线和三笔合成成交：D60 买入 1000 股 @ 56，D68 卖出 600 股 @ 64，D74 卖出 400 股 @ 61。计划输入保留 56 / 52 / 68 / 1000 股 / ¥200,000，初始计划 `source=retrospective`，且完整判断文本保存在真实 Text drawing 中：买入前判断从 S0 可见；D60 后的持仓注释随真实 `createdAtCursor` 揭示。

## 安全 stage projection

`projectRecallPrototypeStage` 复用 `revealableCandlesThroughCursor` 与 `executionsThroughCursor`，只返回当前 market cutoff、execution cutoff、已揭示 candles 和 executions。它不计算未来数量、未来列表或未来统计。RecallWorkspace 自身继续负责实际阶段切换和 chart replay；样板 seam 只通过 `data-safe-stage-projection=true` 标记 opt-in 路径。

S0 的初始 cursor 是 D60 execution 前一毫秒，execution cursor 为 `NO_REVEALED_EXECUTIONS`。推进真实 next bar/next decision 后，ReplayChart 收到相应的已揭示 candle/成交；S1/S2 的阶段行为仍由原生 RecallWorkspace 处理。任何绘图 anchor 都不早于其形成时的 cutoff。

样板在图表顶部 opt-in 渲染 `.recall-stage-context`，直接显示 S0/S1/S2 阶段、完整 `Asia/Shanghai` 行情截止、成交截止或“成交尚未揭示”和“复盘补记”；原生工作区继续保留原阶段提示与底部短截止摘要。

## 本地保存

样板 repository 只使用一个浏览器 localStorage key：`trade-review:prototype:recall:v1`。`save` 校验完整 RecallDocument 后写入，重新读取会恢复 draft、phase、cursor、drawings 和 plan；`reset` 清除此 key，下一次 load 重新 seed 完整样板。不会写业务交易表或 SQL。无法使用 localStorage 的环境显式显示“当前环境仅内存，刷新不会保留”。样板加载时只读项目已有 chart settings 作为初始盈亏配色与开关值，随后由样板 React state 驱动 grid、volume、execution 与三种配色；样板交互不调用业务 settings 保存接口。

推荐模式的轻量图表真实设置 `layout.fontFamily` 与 `layout.fontSize: 12`，正文 Canvas 真实使用 `400 14px`（由 drawing font size 决定）及中文回退链；baseline/default 保持原字体路径。样板 wrapper 的数组、配置对象和回调保持稳定，避免保存状态触发 RecallWorkspace 重建。推荐模式只对 fixture 的 `prototype-*` 多行 Text drawing 在各阶段首次可见时展开一次，以 seen-id 集合保留用户手动收起状态；生产路径与用户新建文字不受影响。

## 验证

- PASS `vitest run app/components/design-prototype/recall-design-prototype.test.ts`（4 tests：repository save→load、reset 重新 seed 完整 fixture；safe projection 不返回 future list/count/stats；真实首笔推进同时揭示 D60 K 线与成交；blocked localStorage 明确回退内存提示）。
- PASS `tsc --noEmit --pretty false`。
- PASS `vitest run app/components/design-prototype/recall-design-prototype.test.ts app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/replay-chart.recall-review.test.tsx`（44 tests）。
- PASS `curl -I http://localhost:3069/?prototype=review-design&mode=recommended` 返回 200；HTML 包含“原生复盘样板”和“复盘样板”。
- NOT VERIFIED 浏览器截图、鼠标/键盘/触控证据和最终视觉对照由 coordinator/root 完成；本报告不将 HTTP 200 或 worker 测试标记为 UI acceptance。
