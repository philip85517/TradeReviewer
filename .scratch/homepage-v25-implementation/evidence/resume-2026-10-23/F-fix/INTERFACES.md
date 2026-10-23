# F V2.5 财务接口与字段追踪

状态：供协调者审查的实现合同；不是 accepted。生产页面尚未消费本模块，UI/真实持久化/视觉 NOT VERIFIED。范围仅 `app/lib/reviews/homepage-v25-performance.ts`、同名测试及本目录证据；共享 ledger、导入、页面和依赖未修改。

## 入口

推荐真实入口：

```ts
buildHomepageV25PerformanceFromEntries({
  entries,                  // buildTradeLibraryEntries 的真实结果，含原始 executions
  period: { start, end },    // 含首尾的上海自然日 YYYY-MM-DD
  asOf,                     // required，独立当前截止；日期或带时区 ISO instant
  candlesByInstrument,      // DailyCandleRecord，使用 raw 日线
  scope,                    // 可选，默认 { nature: "live" }
  targetCurrency,           // 可选，本模块局部目标币字符串
  fxSnapshot,               // 现有 RoomFxSnapshot，不改变其共享类型
});
```

`buildHomepageV25Performance` 保留纯兼容输入：`executions/openingPositions/valuations`。调用者须已承担账户/市场/nature/run 的预筛选责任，输出 scope 标为 `caller-scoped`。该入口 `asOf` 在 TypeScript 中可选仅为旧调用返回 `as-of-required`，运行时不可缺省，不再从 `period.end` 推导当前。若传 `entries`，即使通过兼容函数，也严格进入真实 scope 检查。

纯入口的 `openingPositions` 是调用者明确提供的已知数量/单位收购成本边界；不是 statement mark 的自动成本。`period-start` valuation 是调用者显式提供的边界 mark，可用首日作为边界标签；真实 entries/raw 路径没有这个豁免。`current` valuation 是调用者独立提供的数量/价格快照，不能用 period-end 替代。旧 `fxRateToTarget` 不用于转换。

## 原字段 → 归一化 → 运算 → 输出

|输入证据|归一化/使用规则|输出/可审计位置|
|---|---|---|
|`entry.executions` 原成交 id/quantity/price/fee/source.settlement|按账户/证券/nature/run/id 去重；冲突分类；不重播 episode `:close/:reverse` 拆分段的整单 settlement|scope 计数，instrument key/identity，三边界 `executionIds`|
|`source.tradeNature/tradingNature`、simulationRunId|沿用 `tradeNatureOf`；缺失和显式 unknown 均不是 live。默认 live；simulation 必须给 run。账户/市场过滤是显式 scope|`scope.nature/simulationRunId/includedExecutions/excludedExecutions/excludedByReason`|
|episode initialPosition/positionEvents、执行附着 statementPositions/openingPosition/events|保留原知识时间和证据，合并到原成交 carrier，交 canonical ledger 去重和回放；不使用 episode.direction 决定期初方向|三边界 quantity/costKnown/reasons；实际完整输入在 interface-traces.json|
|精确 executedAt|归属上海自然日；忽略市场日标签对精确成交业务日的覆盖|boundary 与三边界 `knowledgeCursor`、各自 executionIds|
|date-only/source timePrecision/tradingDate/marketCalendarDate|沿用 replayExecutionAt 的源日和知识顺序，不捏造盘中时刻；日期截止表示整源日可见，盘中截止仍须真实知识时刻已到|同上；date-only 控制测试|
|canonical quantityKnown/costKnown/accuracy|兼容数值占位 0 不公开为已知量；状态和 reasons 成为依赖门槛|quantity nullable、costKnown、指标 null/coverage/reasons|
|canonical weighted averageCost/realizedPnl/fees|统一平均成本；F 仅投影实际成交及 canonical IPO acquisition 的未平仓费用池，禁止 FIFO 成本重算|periodRealized/openingUnrealized/closingUnrealized/net；openFees/feesKnown|
|raw 日线 instrumentId/tradingDate/close/currency/provider|先过滤 raw、身份、日期，再选最新；盘中不泄露同日完整日线|evidence.quote date/price/currency/source|
|RoomFxSnapshot id/source/asOf/status/rates|正数 `CCY/CNY` 或 `CCY:CNY`；complete；知识截止以内。裸键不兼容|每指标 money 原币小计、targetCurrency、conversion、fx 全来源|

没有原始成交 lineage 但保留了目标 scope 内 episode 的 entries 返回 `execution-lineage-unavailable`，不会把缺失数组变成完整空仓，也不会退回重播拆单。缺失 nature 的行被排除，scope 保留排除数量/原因；这是范围覆盖说明，不是其原始资产为 0 的声明。

相同 scoped execution ID 的完全相同副本去重一次。若数量、买卖方向、时刻/日知识、证券身份或开平方向字段相冲突，数量本身未知，`duplicate-execution-conflict` 进入 quantity/MV 的依赖门槛；不能任取第一条发布市值。纯价格/费用冲突仍阻断 PNL，但不损伤一致的库存数量。

## 三个独立边界

- 开期：上海首日之前，前一日 `15:59:59.999Z`。不把首日成交 seed 后重播。opening raw mark 严格取首日前。
- 期末：`effectiveEnd=min(period.end, asOf 的上海日)`；若 asOf 在该日内，用其精确瞬间。未来期间尚未开始时，四项期间指标均 null/`period-not-started`，即使空集合也如此。
- 当前：始终独立使用 required asOf；选择历史期间不会改变当前库存与当前报价截止。
- 物理日末 cursor 是上海 `23:59:59.999`，即 UTC `15:59:59.999Z`。statement opening/closing/event/cash 的原 canonical 知识时间不平移；例如 source closing `1/31T23:59:59.999Z` 实际在上海 2/1 才可见，不会进入 1/31 当前/期末/开期。
- date-only **成交日粒度选择**与 attached **证据物理知识截止**不同：canonical visible IDs 保留前者，cursor 限制后者。盘中 date-only 不提前可见；全日日粒度成交入口不伪装成精确瞬间。
- 日内 raw 价格只选择此前完整日期的日线，不能泄露当日最终 close。这里没有创建盘中行情接口。

`boundary` 返回业务时区、原始 asOf、effectiveEnd、periodStart、requestedEnd；每个 instrument 的 opening/closing/current 返回实际 `knowledgeCursor`。`executionIds` 是该边界实际选中的原成交，当前总 `executionIds` 只是 current 的合并索引。

## 成本、费用、未知值

数量与成本来自 `replayPositionAtPrice`，使用同一平均成本政策。设 canonical 累计毛实现为 R、累计费用 F、未平仓费用池 U，则累计净实现为 `R-F+U`。实际成交平仓时，按匹配量占平仓前绝对库存的比例从 U 归属到实现；新开部分按其占整笔成交量比例加入该笔费用。跨期净实现取两边界累计净实现差；UF 为 `(mark-averageCost)*signedQuantity-U`。总净额只在各分项均可知时计算 `期间实现+期末UF-期初UF`。

IPO allocation 是 canonical 已支持的非 execution acquisition 边界，同样可能覆盖已有 short 或反转。F 用生产 `resolveIpoAcquisitionCost` 解析本次 boundary **已经知道**的申请/退款/归属费用；不另造 IPO 成本。费用池按 canonical 每个 movement prefix 的库存应用相同比例规则：覆盖部分释放旧开仓费用，IPO fee 的覆盖部分计入实现，仅新开剩余部分进入 U。prefix 保留本次 cursor 内完整现金知识，数量事件/statement position 则按 canonical 时间与 rank 截取，所以晚于 allocation/出售的退款在已知边界能恢复可算分项，在未来边界之前仍不可用。成本、数量、毛实现和最终总费用始终取 canonical。

和真实买入重复的 allocation 按同一 selected original IDs 判为 execution-backed，在所有 fee prefix 中抑制其重复库存；否则买入覆盖 short 前会误看成已平仓。最终投影费用和 canonical 累计费用必须一致；未支持的费用差额返回 `fee-allocation-unavailable`，缺失/歧义 IPO 归属返回 `ipo-fee-allocation-unavailable` 及 canonical 原因，绝不将已知可计算 IPO 永久降为未知。详见 [IPO-ROOT-CAUSE.md](IPO-ROOT-CAUSE.md) 和 `ipo-traces-{red,red-expanded,execution-backed-red,green}.json`。

例：旧仓费2，本期卖出毛利20、平仓费1：本期净实现17，openingUF=-2、closingUF=0，期间净19；扩大期间纳入开仓时，总净17。同一1@100、1@200，期内再买1@300、卖1@400，分别得到 realized200/openingUF100/closingUF300/net400；不是仅靠总额恒等式掩盖 FIFO 分项。

|证据状态|期间 PNL|当前市值/真空仓|
|---|---|---|
|数量未知/无原始lineage/未覆盖的明确平仓|受影响项 null，原理由保留|null，不能将 ledger 占位 0 当空仓|
|数量已知、成本未知/statement mark|受影响项 null，保留 unknown-cost 等|合格同币种报价下可计算|
|feeStatus unknown/费用非法或冲突|受影响净实现/UF/null；openFees=null、feesKnown=false|不伤可信数量；已确认无剩余敞口 UF/MV 可为 0|
|真实已平仓且数量可信|实现仍按自身证据判断；剩余 UF=0|MV=0，不要求不存在仓位的报价|
|报价缺失/币种错配|相关 UF null|有敞口时 null；不回退到未来价|
|FX missing/partial/非法/未来|目标币 null，保留已知原币|同币无需 FX；不同币的 0 也不能冒充已转换|
|已知库存但历史实现不可靠|实现保留 unavailable|只依赖数量/报价的市值可独立可用|
|malformed Decimal evidence|分类 evidence-invalid；其他异常不吞掉|不抛未分类 Decimal 错误、不公开兼容 0|

`costKnown` 表示数量可信、canonical 未标记成本未知且不存在非费用的适配歧义。适配器独立发现 fees-invalid/fees-conflict 时，不能用净 PNL 的 unavailable 清空已证实的成本知识；此时 costKnown=true、feesKnown=false、PNL=null。canonical 自身因 unknown-fees 返回 costKnown=false 的证据仍保持保守 false，本模块没有额外重建成本来提升其可用性。该字段不是对所有税务成本的断言；`feesKnown` 表示未平仓费用归属池可用。`reasons` 是每个指标自己的依赖原因，顶层 reasons 只作索引，不能代替指标状态。

## 金额与覆盖

所有金额为 Decimal 计算、最多8位小数字符串；未知为 null。每个 metric 保留兼容 `value/available/coverage/reasons`，增加 `money`：`originalByCurrency`、`targetCurrency`、`conversion`、`fx:{id,source,asOf,status}|null`。原币小计只汇总确实可算的来源；它不把未知来源补 0。不同币无 target 时总数 null/target-currency-required；有 target 时任一必要转换缺失，总数 null，已知原币和覆盖继续保留。snapshot 完整但少某币汇率仍 partial，不能被后一个成功转换覆盖成 complete。

coverage 是该指标参与的 account/instrument/nature/run 来源数，不是成交条数或 episode 条数；available 还需目标币转换可用。current 只纳入实际有敞口、数量未知或显式快照有敞口的来源。空 scope 可以得到真正的0/coverage0，但排除数量/原因保留在 scope 中，调用方必须连同范围说明展示。

## 实际接口证据与后续接入

`interface-trace.test.ts` 生成 [interface-traces.json](interface-traces.json)：五组真实 summaries→entries→F 输出，以及相同 execution IDs/cursor 下 canonical 快照，包括平均成本分项、unknown fee 与可信市值、未来 statement 知识、原成交 reversal、生产 FX 来源。该 probe 不 mock ledger。

`ipo-fee-contract.test.ts` 另外保留10项原始 pipeline/canonical/F 对照，分别验证每个实现/UF/费用池分项，不能只检查总额桥。单次调用在每个 group 内复用相同 day/cursor/instant 的状态（如 end=current），缓存不会跨调用或跨 scope。每个独立边界仍需约 `执行数+非重复IPO数+1` 次 canonical 重播；canonical 每次重建 timeline，本接口不是批量日序列 API。最终版本有限同合同20/100/200笔测量约15/98/197ms（[scaling.json](scaling.json)），不能据此声称业务数据全量性能或日曲线可直接循环调用。P2/P4消费需复用边界或设计批量准备，不在 UI 每日重复调用。

页面调用应从真实普通交易库提供 entries、raw行情、独立 asOf 与明确 scope，消费 metric.available/null、coverage/reasons 和 money；不能仅取 value 再默认0。F 本票没有添加任何页面调用、日序列聚合、持久化写入、历史贡献迁移或新的 FX 获取器；这些属于后续已拆任务，当前 UI NOT VERIFIED。
