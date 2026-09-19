# 06 成本收益率：独立 QA 成本证据核查

核查范围：现有 `TradeEpisode` / `summarizeTradeEpisode` / statement evidence；只为 06 实现提供成本、费用和空头的可验收口径。未修改产品，也未运行全量测试。

## 结论

`metrics.grossExposure` 只能在完整、可信、已平仓的多头回合中作为“买入成交成本”候选分母，不能单独证明成本完整。06 的实现应先做证据门槛，再把同一批回合的 `metrics.netPnl` 与买入成本一起聚合：

- `episode.status === "closed"`、`episode.direction === "long"`，并且 `episode.directionKnown !== false`；做空即使有正的 `grossExposure` 也不适用。
- `metrics.pnlAvailable !== false`、`metrics.netPnl !== null`，且 `metrics.grossExposure` 为有限且严格大于 0。`accuracy`、历史不完整、未知费用、结算币种不一致或不完整 IPO 证据都会使指标不可用。
- 选中期间按回合平仓日取样，但成本必须来自整个回合；期前买入、期内平仓仍纳入全部 opening buys，部分平仓仍是 open，不能纳入。
- 分母口径是买入成交金额/现金 acquisition cost；`metrics.fees` 已从 `netPnl` 中扣除，不能再把费用从分子扣一次。费用应作为已知性和排除原因展示，而不是用 0 填补未知费用。

## 可用字段与证据

### 普通执行型多头

`summarizeTradeEpisode` 对多头只把 `execution.side === "buy"` 计入 `grossExposure`；有同币种 settlement 时使用 `source.settlement.grossAmount / settlement.quantity`，否则使用成交 `price * quantity`。因此普通 execution-backed 完整回合的可用成本证据是：所有 opening buy execution 的正数量和正成交/结算金额，且数量、币种、费用和历史均可核验。现有输出没有独立 `buyCost` 或证据等级字段，06 若复用 `grossExposure` 必须同时保留这些门槛，不能把任意非零 grossExposure 直接当成本。

费用证据在原始成交的 `source.feeStatus`：实盘导入器以 `reported` 表示包括明确的 0 费用，以 `allocated` 表示已分摊；空白费用会是 `unknown`。`summarizeTradeEpisode` 遇到 unknown fee 会给 `pnlAvailable: false`、`netPnl: null`、`returnPercent: null`。TradingView 模拟 CSV 的费用列是显式数值（进场 0、出场读取 CSV），其 parser 没有设置 `feeStatus`；因此不能把“模拟源缺少该可选键”机械地等同于实盘未知费用，必须结合 `tradeNature === "simulation"` 和模拟源的费用字段处理。

`grossExposure` 不包含 execution fee，`fees` 单独累计，`netPnl` 已扣全部费用。settlement 的币种若与 instrument 币种不一致，metrics 会标记不可用，即使原始 price 看起来可算，也不能拿 raw price 继续做成本收益率。

### IPO/申购型多头

不能把 IPO allocation event 的 `amount` 单独当最终成本。非 execution-backed allocation 只有在 `resolveIpoAcquisitionCost` 成功且 `episode.ipoCostEvidence` 的 allocation/evidence IDs 全部仍在 `episode.positionEvents` 时可用。该解析器要求：

- allocation 为同账户、同市场、同 canonical symbol 的正数量，币种与 instrument 一致；
- 现金申请和退款各恰好一笔，事件在 allocation 前后且距其不超过 45 天；所有现金事件能唯一归属该 allocation；
- scoped IPO fee 可纳入费用；同账户/市场/币种、但未标的 unscoped IPO fee 会令解析失败，不能假定费用为 0；
- 输出的 `cashCost` 是申请减退款后的现金 acquisition cost，`feeCost` 是 IPO 费用，`totalCost = cashCost + feeCost`，`unitCost = totalCost / quantity`。

当前 metrics 将已知 IPO 的 `cashCost` 加入 `grossExposure`，把 `feeCost` 加入 `fees`；所以 06 若遵守“买入成交金额作分母、净盈亏已扣费”的 brief，应使用现金 acquisition cost 口径并把 feeCost 作为已知费用，不要用 `totalCost` 后又重复扣费用。execution-backed IPO allocation 由匹配的普通 buy execution 计入，不能再把 allocation/cash chain 加一次。

### 期初持仓、转入、拆股和未知成本

`StatementPosition` 的 `quantity` 只证明期初库存；可选的 `cost` 也没有被现有 episode metrics 用来建立 acquisition basis，并且类型注释明确 closing/mark price 不是 acquisition cost。sale-only 加 `openingPosition` 会产生 `initial-position`/`unknown-cost`，metrics 保留原始 exposure 但不给可信 PnL。transfer-in、corporate-action/拆股或数量无法唯一归属的 position event 同样应排除；不能以“后来有一笔卖出”或“买入成交简单相加”补造成本。

## 06 实现应显示的排除证据

建议每个排除样本保留可读原因，并能由 row/episode 追溯：

| 排除条件 | 原始证据 | 不能做的推断 |
| --- | --- | --- |
| open/partial close | `episode.status`, `remainingQuantity` | 不能用已实现部分代替完整回合成本 |
| short 或方向未知 | `episode.direction`, `directionKnown`, `positionEffect` | 不能把 short opening sell 的 `grossExposure` 当买入成本 |
| unknown fee | `source.feeStatus === "unknown"`，或实盘缺失费用字段 | 不能把 `fee: "0"` 当已知零费 |
| history/ordering/currency 不完整 | `historyIncomplete`, `accuracy.reasons`, settlement mismatch | 不能由行情完整或 raw price 补齐交易成本 |
| initial/transfer/split/unknown cost | `initialPosition`, `positionEvents`, `accuracy` 中 `initial-position`/`unknown-cost`/`position-event` | 不能使用 `StatementPosition.cost` 或卖出金额推回成本 |
| IPO chain 不可唯一归属 | `resolveIpoAcquisitionCost === undefined` 或 `ipoCostEvidence` IDs 缺失 | 不能使用 allocation.amount、邻近现金、未标的 fee 猜成本 |

## 关键反例（建议直接加入 06 定向测试）

1. **跨期完整回合**：买入成本 10,000、净赚 100，买入在日期窗口前、卖出在窗口内；成本收益率仍应把完整 10,000 放入同一分母。两轮各 10,000/100 时应为 `200 / 20,000 = 1%`，不能平均两次回合百分比。
2. **费用空白伪零**：buy/sell 的 `fee` 都是 `"0"`，但任一实盘 source 为 `feeStatus: "unknown"`；metrics 应不可用，该回合的净盈亏和成本同时排除，不能显示 0 费用或纳入分母。
3. **期初库存 sale-only**：只有卖出 100 股，`openingPosition.quantity = 100`（即使 statement position 带 `cost`）；episode 会有 `initial-position`/`unknown-cost`，应排除，不能把卖出 1,200 当利润，也不能把持仓表成本字段直接当本回合买入成本。
4. **short/reversal**：明确 `open-short` 的卖出再买入平仓，或 long 买 100 后卖 150 形成新的 short；short episode 的 `grossExposure` 可能为正，但成本收益率必须排除 short，只保留可信的 long closed episode，且不得把 reversal 的两段合并。
5. **IPO/币种质量**：IPO allocation 只有 allocation.amount，缺 application/refund，或同一 symbol 有两笔可匹配 allocation、unscoped IPO fee、跨币种 settlement；`resolveIpoAcquisitionCost`/metrics 应不可用。已知完整现金链才可用 `cashCost`，不应拿 allocation.amount 或邻近现金猜测。普通 HKD quote + CNY settlement 也应排除而非按 raw price 计算。

## 自动化验收建议

06 定向测试至少断言：上述 5 个反例的适用/排除计数和原因、跨期 1% 样例、IPO `cashCost` 与 fee 不重复扣、same row set 的合计分子分母、不同币种缺 FX 时分币种小计而不拼全局。浏览器验收再核对成本口径文案、排除样本详情和切换 live/simulation run 后样本不串；本报告不替代最终真实浏览器 QA。
