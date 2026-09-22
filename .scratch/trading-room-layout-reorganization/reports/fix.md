# Final review fixes

## P2 — 洞察来源返回

- `ReviewReturnView` 增加 `insights`。
- 模式分析中的回合入口以 `insights` 作为来源写入 workspace 状态。
- 复盘返回时恢复模式洞察，导航按钮显示“返回模式洞察”；原交易室/交易库返回路径保持不变。

## P3 — 模式分析嵌入间距

- 将失效的 `.review-summary-patterns .pattern-insights` 规则改为实际 DOM 关系 `.review-summary > .pattern-insights`，保留 `padding: 20px 0`。

## 测试

- `app/components/trade-review-workspace.import-flow.test.tsx` TradingView case：1 passed（28 skipped）。
- TradingView 测试保留卸载/重挂载后再进入交易库并选择“模拟盘”筛选，实际断言导入标的“天通股份”和模拟盘身份徽标可见，同时继续断言 `source.tradeNature === "simulation"` 与 `TradingView · 模拟盘` sourceLabel，未削弱身份隔离验证。
- 阶段总结入口同样显式传入 `insights` 返回来源；行为测试覆盖“总结证据 → 查看回合 → 返回模式洞察”，并继续通过后续模式分析建议流程。
- 模式分析测试改用真实 `.module-tabs` 的“模式分析”按钮，并覆盖从复盘返回模式洞察。
