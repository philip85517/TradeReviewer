# R1 首帧摘要可见性修复

日期：2026-09-26  
实现模型：Luna 5.6 max  
范围：仅回放主条的紧凑阶段摘要；R3 侧栏、阶段布局和其他 frame 结构未改动。

## 修复

- `RecallWorkspace` 将 `compactReplaySummary` 从通用 `recall-replay-cutoff` 文本槽位拆成 `recall-replay-summary`，并保留同样的阶段数据来源：持仓显示当前已知数量，买入前显示计划预期 R 与初始风险。
- `recall.css` 给摘要槽位 `flex: 0 0 auto`、`min-width: max-content`、`overflow: visible`，让上下文标题/截止时间先让出空间，主条仍保持既有 48px 和按钮字号。
- 回归测试覆盖 holding 的 `持仓 1000` 以及 pre-entry 的 `计划 · 3R / 风险 4000 CNY`，同时确认摘要不再使用会触发省略的 cutoff 类。

## 验证

- `npm run test:unit -- --run app/components/recall/recall-workspace.test.tsx`：41/41 通过。
- `npm run test:unit -- --run app/components/recall/recall-integration.recall-review.test.tsx`：30/30 通过。
- `npm run typecheck`：通过。
- `npx eslint app/components/recall/recall-workspace.tsx app/components/recall/recall-workspace.test.tsx`：通过。
- `git diff --check`：通过。

一次完整 workspace 重跑曾命中既有异步捕获用例的时序抖动；该用例单独重跑及随后完整 41/41 重跑均通过，未改动其逻辑。

## 待集成证据

CSS 的真实 1440/1280 视口效果仍需 root 在 A 的连续图表修复冻结后复验；本轮没有启动浏览器，也没有修改 R3 owned files。无提交、无代理。
