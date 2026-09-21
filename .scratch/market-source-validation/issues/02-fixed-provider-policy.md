# 固定行情源优先级与时间口径

## What to build

把市场/资产/周期的 provider 顺序固定为 ADR-0004 的矩阵，每个键最多三个来源；生产核心来源收敛为 Eastmoney、Tencent、Baidu、BaoStock 四个。定义统一的 `bar-start-v1` UTC 起点、`knowledgeAt`、原始时间和转换元数据，消除 BaoStock、Tencent、Eastmoney、Baidu 的 1H 标签差异。

## Blocked by

依赖 ADR-0003 的实测证据。Eastmoney SPY 解析修复和 Tiger 真实账户 canary 是后续验收项，不阻塞策略文档。

## Status

ready-for-implementation

## Acceptance

- [x] 每个市场/资产/周期最多三个固定候选
- [x] 全局核心来源数量及删减理由明确
- [x] 1D raw 口径、1H bar-start 口径明确
- [x] BaoStock/Tencent/Eastmoney/Baidu 的转换规则明确
- [x] fallback、熔断、并发和 canary 条件明确
- [ ] 实现 `ProviderPolicy`
- [ ] 增加 1H 时间标签和 session fixture
- [ ] 修复 Eastmoney SPY 并通过美股 ETF canary
