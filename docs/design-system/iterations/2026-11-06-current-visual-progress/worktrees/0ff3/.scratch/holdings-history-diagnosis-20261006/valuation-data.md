# 持仓历史与当前估值只读诊断（2026-10-06）

## 范围与证据

- 只读打开 `.scratch/local-review-20261006/review.sqlite`（SQLite URI `mode=ro`）；没有打开或写入正式库 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`，没有抓取外部行情，也没有操控服务/浏览器。
- 数据库快照：`daily_candles` 153,425 行、`instruments` 236 行、`executions` 1,866 行。模型复现证据见 [model-evidence.json](model-evidence.json)，运行截点 `asOf=2026-10-06`。
- 代码规则依据：[trading-room-history.ts](../../app/lib/reviews/trading-room-history.ts)、[trading-room-portfolio.ts](../../app/lib/reviews/trading-room-portfolio.ts)、[trading-room-holdings.ts](../../app/lib/reviews/trading-room-holdings.ts)。

## 结论

今年历史图为空的主因不是单一“今天报价过期”。历史模型在 2026 年产生 279 个日点，2026-09-14 及 2026-10-06 各包含 15 个历史持仓行（持仓行数随日期变化；2026-01-01 为 10）；只要任一行的市值或浮盈亏不可用，该点就不能标记完整。模型证据显示：市值完整点 `0/279`、浮盈亏完整点 `0/279`，但仍有 `271/279` 个点存在可聚合的已知金额。阻断完整性的长期行是 2026-01-01 起持续存在的七个 `ambiguous-opening` 美股行（UVXY/QID/NVDA/ROKU/SQ/ABNB/AFRM）和 `CN-SH:513010`；另有当前/近期行 `CN-SH:516780` 在历史回放遇到未支持公司行动后失去数量与成本。

当前组合是另一层问题：8 个当前行的数量与成本只有 `7/8` 可信，CNY 成本合计 `227896.421332`（显示为 227896.42），USD 成本 `1363`；但市值/浮盈亏是 `0/8`，因为 8/8 行情都被判为 stale（默认过期阈值 3 个自然日），且 513010 的数量/空头证据本身仍未核验。用户给出的报价与库中记录一致，说明当前价格不是“没有缓存”，而是“缓存存在但相对 2026-10-06 已过期”。

## 代码中的精确可用条件

### 历史逐日估值

1. `markFor()` 先将点日期映射到该市场最后一个交易日（[trading-room-history.ts:456-477](../../app/lib/reviews/trading-room-history.ts:456)），再要求最新 raw candle 的交易日 `>= requiredSession`；缺少该交易日时返回 `undefined`，不会用更早的 candle 跨过缺失交易日。
2. `computeHoldingAt()` 只有在持仓回放数量已核验、报价价格为正、报价币种等于结算币种、且报价交易日不早于当日最后成交日时，才设置 `marketValue`（[trading-room-history.ts:643-721](../../app/lib/reviews/trading-room-history.ts:643)）。因此 `validQuote=false` 会同时加入“缺少截至当日有效原始行情，或报价币种/成交日期不匹配”。
3. 历史点的 `marketValueAvailable` 与 `unrealizedPnlAvailable` 都要求 `hasHistory && holdings.every(...)`（[trading-room-history.ts:833-852](../../app/lib/reviews/trading-room-history.ts:833)）；点级 `available` 又要求两者都为真（[trading-room-history.ts:937-947](../../app/lib/reviews/trading-room-history.ts:937)）。所以“有若干可估值行”不等于“点完整”：一个未知行即可让整点为 false。
4. 历史回放会在 `firstCorporateActionDate <= date` 时把该持仓标为不支持的公司行动，并使 `verified=false`（[trading-room-history.ts:678-699](../../app/lib/reviews/trading-room-history.ts:678)）。`CN-SH:516780` 的证据含 2026-05-22 红股入账，因此 2026-05-22 后历史行持续缺数量/成本；当前持仓投影的规则不同，不能用当前行可用推断历史行可用。

### 当前组合估值

- 当前组合只保留数量非零（或数量未知）的 active 行（[trading-room-portfolio.ts:24-32](../../app/lib/reviews/trading-room-portfolio.ts:24)）。市值需要方向已知、数量非空、`quoteStatus === "available"` 且价格存在；成本还需要成本状态可用（[trading-room-portfolio.ts:33-40](../../app/lib/reviews/trading-room-portfolio.ts:33)）。
- `quoteFreshness()` 用自然日差 `age > staleAfterDays` 判 stale，默认阈值为 3（[trading-room-holdings.ts:226-245](../../app/lib/reviews/trading-room-holdings.ts:226)）。它没有按交易日历扣除周末/节假日。
- 当前 coverage 的 `complete` 是 `rows.every(row => row[key] !== null)`（[trading-room-portfolio.ts:50-68](../../app/lib/reviews/trading-room-portfolio.ts:50)），因此 513010 一行的未知成本也足以使总成本不完整；8 行全部 stale 则直接使市值和浮盈亏为 0/8。

## 当前 8 行与 raw daily_candles 覆盖

以下均为库内 raw daily candle 的只读统计；“年内缺口”按项目交易日历从 2026-01-01 到 2026-10-06 计算。

| 标的 | 当前 quote（模型） | daily_candles 最后日期 | 年内已存/应有 | 直接诊断 |
|---|---:|---:|---:|---|
| 518880 | 2026-09-28 8.568 CNY | 2026-09-28 | 179/181，缺 9/29–9/30 | price 有缓存；截至点 stale |
| 603087 | 2026-09-15 68.880 CNY | 2026-09-15 | 171/181，缺 9/16–9/24、9/28–9/30 | stale，历史尾部也缺 10 个 session |
| 512480 | 2026-09-28 0.980 CNY | 2026-09-28 | 179/181，缺 9/29–9/30 | stale |
| 516780 | 2026-09-15 0.804 CNY | 2026-09-15 | 171/181，缺 9/16–9/24、9/28–9/30 | 当前数量/成本可用；历史受红股公司行动阻断；quote stale |
| SNDK | 2026-09-15 1530.900 USD | 2026-09-15 | 176/191，缺 9/16–10/06 | stale |
| 159813 | 2026-09-28 0.692 CNY | 2026-09-28 | 179/181，缺 9/29–9/30 | stale |
| 588080 | 2026-09-15 1.589 CNY | 2026-09-15 | 171/181，缺 9/16–9/24、9/28–9/30 | stale |
| 513010 | 2024-04-02 0.492 CNY | 2024-04-02 | 0/181（年内全缺） | stale、负仓证据未核验；不是当前有效行情 |

其中 513010 当前数量为 `-92400`，模型理由是“负仓差额待核对：成交证据未证明开空或可信期初负仓”；其缓存报价距截点两年多，不能作为当前估值。其余 7 行的数量和成本已由模型恢复，但 quoteStatus 全为 `stale`，所以当前组合严格规则下仍是市值 `0/8`、浮盈亏 `0/8`。

## 为什么历史行会比当前 8 行多

历史日期范围按 scope 的 period 生成，但内部会把行筛选范围扩为 all（[trading-room-history.ts:820-832](../../app/lib/reviews/trading-room-history.ts:820)），所以旧行即使不是当前 active portfolio，也会参与每个日期点。模型在 2026-01-01 有 10 行（2 行可估值 + 8 行证据不足），到 2026-09-14 有 15 行（6 行可估值 + 9 行阻断/缺行情），到 2026-10-06 仍有 15 行，其中 6 行数量可用但都没有截至日期的 raw quote，结果市值/浮盈亏为 0 可用行。

“所有点是否不完整”的精确条件不是所有行都无数据，而是每个点的 `holdings.every(h => h.marketValueAvailable)` 与 `holdings.every(h => h.unrealizedPnl !== null)`。因此七个持续 ambiguous-opening 行造成长期全局完整性失败；当前端部又叠加 raw candle 在 9/15 或 9/28 截止，以及 3 自然日 stale 判定，导致 2026-10-06 当前估值全部不可用。

## 七个美股为何当前被排除、却持续出现在历史

对隔离库 `executions` 按标的和账户只读汇总（不展开交易明细）显示：七个标的的买卖数量净额均为 0，因此当前组合的 active 过滤会把它们排除；它们不是当前 8 行中的负仓。历史回放使用全量 scope 行，所以这些已清零的历史 episode 仍进入 2026 点。模型对七者均给出 `ambiguous-opening`、数量缺失 279/279 天；这不是把清零仓直接当成 0，而是无法证明从什么已知期初状态开始回放。

| 标的 | 只读汇总状态 | 最早卖出所在账户的来源证据 | 为什么仍是 ambiguous-opening |
|---|---|---|---|
| UVXY | 净额 0（闭合） | 2015-10-21；无 `positionEffect`、无 `openingPosition`、无 `statementPositions` | 首个卖出没有开空或可信期初证据；后续另一账户 2025-04-09 也以无该证据的卖出开始 |
| QID | 净额 0（闭合） | 2024-07-22；标记 `close-long`，有 closing statement position，但无 `openingPosition` | 另一账户最早 2024-10-30 的卖出三项均缺失；跨账户初始状态不能补成 0 |
| NVDA | 净额 0（闭合） | 2015-07-07；无 `positionEffect`、无 `openingPosition`（虽有后续 statement positions） | 最早成交链没有可接受开仓方向；另一账户 2022-08-11 也以无证据卖出开始；后续 open-short 不能回填最初状态 |
| ROKU | 净额 0（闭合） | 2017-11-15；记录有 `open-short`，但无 `positionEffectEvidence`、无期初仓 | 该账户的开空来源证据不完整；另一账户 2022-01-21 首卖无三项证据 |
| SQ | 净额 0（闭合） | 2018-10-11；记录有 `open-short`，但无 `positionEffectEvidence`、无期初仓 | 同一标的另一个账户 2022-06-13 首卖无三项证据，合并回放无法证明统一期初 |
| ABNB | 净额 0（闭合） | 2022-05-19；无 `positionEffect`、无 `openingPosition`、无 `statementPositions` | 首笔卖出既没有期初负仓也没有明确开空，之后的 close-short 不能倒推 |
| AFRM | 净额 0（闭合） | 2022-06-13；无 `positionEffect`、无 `openingPosition`、无 `statementPositions` | 其余记录虽有 close-short，但没有可验证的开空/期初负仓起点 |

这里的“无证据”是来源 JSON 字段缺失，不是说原始成交不存在。历史持仓回放会在第一次从非负库存跨入负数时，仅接受带非推断 `open-short` 的来源（[trading-room-history.ts:624-630](../../app/lib/reviews/trading-room-history.ts:624)）；当前持仓证据对负数同样只接受明确开空或可信期初负仓（[trading-room-holdings.ts:524-586](../../app/lib/reviews/trading-room-holdings.ts:524)）。因此，这七个已闭合标的当前可排除，但其历史不能安全按 0 清除；根因在最初成交链的期初/方向证据不可信。

模型对照也支持该因果链：仅把 8 个长期 unknown 行从历史 scope 隔离后，完整市值点为 76、浮盈亏点为 52；再隔离 516780 后分别为 126、102。只隔离 QID 仍为市值完整 `0/279`，所以问题是长期 unknown 集合的全局 every 条件，而不是某一个报价。当前只把 stale 阈值放宽到 10000 天（不补行情、不改变数量）时，市值和浮盈亏都恢复到 `7/8`，对应 513010 仍无法估值。

## 可证伪假设与验证方式

1. **假设 A：修复/补齐当日之后的 raw daily candles 就能解决当前 7 行。** 预测：在不改变持仓证据的前提下，若把每行补到 2026-10-06 的市场交易日，7 行 quote freshness 变为 available，当前市值应从 0/8 至少变为 7/8；513010 仍因负仓证据失败而不可估值。可用只读模型重新运行验证，禁止向正式库写入。
2. **假设 B：只补行情不能使今年历史图完整。** 预测：即使 8 个当前标的的 candle 覆盖完整，2026-01-01 至今仍会被 UVXY/QID/NVDA/ROKU/SQ/ABNB/AFRM 的 `ambiguous-opening` 行和 513010 的未核验负仓行卡住；`completeMarketValuePoints` 仍低于 279。验证应先移除/隔离这些旧行做模型对照，或补齐可信期初/开空证据，不应改用 0。
3. **假设 C：516780 的当前/历史差异来自两套不同规则，而不是 DB 数量坏掉。** 预测：当前 holdings projection 可给出数量 30000 与成本 29316.5001，但 history projection 在 2026-05-22 后因 `firstCorporateActionDate` 直接加入公司行动阻断。逐行复现该日期边界即可证伪；若历史仍在 5/22 前缺失，则还需检查其 opening position/cursor。

## 最小后续检查建议

先把“历史全局完整性”与“当前 quote freshness”分成两个验收指标：历史检查应报告有已知小计的点 271/279，完整可估值点仍是 0/279；当前检查应报告 8/8 stale quote、仅 7/8 数量与成本可信（另 1/8 为未核验负仓），而不是只显示一个总的空估值。任何后续修复都应在隔离 DB 上验证，保护正式库和原始交易数据。
