# P2 / P4 数据接线提案（只读准备）

本提案不实施 P2–P4，也不改变 F/S 或共享 tracker。P1 首条真实旅程独立接受前继续阻塞页面扩展。设计合同为 `visual-design.candidate.md` HP02、HP05；实施依赖见 feature PLAN。审阅基于 F source `9d7b44e00229e63dca5485589871ab442df636d953cfecd8224a374fc399e7b5`（2026-10-23 00:59:50 Asia/Shanghai 原五探针复验 5 PASS）；不能把本文建议写成已存在 API。

## 1. 可直接消费与有限扩展边界

|需求|现有 F 可消费|尚缺 / 责任|
|---|---|---|
|P2 四卡|`net`、`periodRealized`、`openingUnrealized`、`closingUnrealized`、独立 `currentMarketValue`；浮盈变动由期末减期初，两个依赖均 available 才可算|页面仅做展示组合，不改金额政策；建议 F 直接返回 unrealizedChange metric，避免页面重建 coverage/FX|
|当前市值详情|MV metric 的 coverage、原币、FX事实，current evidence 的 quantity/quote/costKnown/feesKnown|缺 `currentUnrealized` metric；不能把历史 closingUnrealized 当当前浮盈，也不能从公开 evidence 拼成本|
|P2 按日曲线与 tooltip|已存在单个期间投影的财务政策及 Shanghai/asOf/知识边界|缺批量日边界、当日 MV/UF、累计已实现/净额、期间费用、每点 coverage/quote/FX；由 F owner 有限扩展|
|当前期间贡献|每个 account/instrument/nature/run 的 realized、openingUF、closingUF、net 及 money/reasons|可先对同币已知 instrument 结果聚合核对总额；缺做多/做空/IPO provenance 分类、openOnly 所需分类敞口；不得由页面重新回放|
|历史四卡 / 4 模式 / 历史贡献|同一 canonical raw lineage、知识截止、去重、费用政策可复用|F 目前没有 closed-business-round 输出；需有限只读 closed-round 投影，再由 P4 纯聚合月/年。不能拿期间净额替代已平仓回合最终净额|

输入只用真实 `buildInstrumentTradeSummaries → buildTradeLibraryEntries` 的 entries、raw candles、required 独立 asOf、显式 live scope、目标币与来源完整的 FX。页面不回退到 episode 拆单作为 raw fills；scope、metric.available/null、coverage、money 和 reasons 必须一起消费。S 负责 UI 状态和原子应用，财务数据不写入 UI snapshot。

## 2. 日线必须一次准备、多边界批量计算

协调者已测单次 F 投影约 200 fills / 2 秒（本文未重跑性能测量）。源码 `replay()` 每个 movement prefix 调 `replayPositionAtPrice`；每次完整 ledger 都重建可见 timeline。单次调用内部可复用相同 start/end/current boundary，但跨调用没有共享 prepared context。按 365 日逐次调用公开完整 builder 会反复 collect、normalize、sort、IPO resolve、prefix replay，并重复当前 asOf，不能作为页面日线方案。

建议先在 F 原任务登记一个有限扩展，维持公开入口兼容，增加内部 prepared source + 批量边界投影。建议形状（**尚未实现**）：

```ts
const projection = prepareHomepageV25Projection({
  entries, candlesByInstrument, scope, asOf, targetCurrency, fxSnapshot,
  sourceRevision, // 数据/行情/FX修订；不是UI快照版本
});
const periodBundle = projection.period({ start, end });
const dailyBundle = projection.daily({ start, end });
const closedBundle = projection.closedRounds({ startYear, endYear });
```

三者共享按原账户/证券/nature/run/id 去重的源记录、规范化错误、canonical inventory 知识时间、IPO acquisition evidence、累计净实现和 open-fee pool。只暴露不可变只读结果；不要把可变 Decimal / Map / 内部 ledger state 交给组件。账户集合与市场别名先规范化，cache identity 同时包含数据、statement evidence、quotes、asOf、scope、目标币、FX快照内容/版本，不能只以 entries 引用或 URL 当证据版本。

推荐最小性能顺序：

1. scope/normalize/sort/dedup/IPO cash identity 一次；raw quote 按 instrument/date 建索引，一次批量确定 Shanghai reporting boundaries。
2. F 内部按需 memo canonical prefix inventory 与费用 movement（同 prefix/cursor/可见证据相同才可复用），日边界只做 mark 与 metric 聚合。无事件时数量/平均成本/累计净实现/openFees 不重新回放。
3. 非 execution IPO、late refund、statement knowledge 会改变可见成本/费用，cache 必须包含 evidence cursor，不能只缓存 executionIds。先锁定正确性，再决定是否值得把 canonical ledger 提炼为共享 batch engine；跨共享 ledger 改动须单独登记，页面不能自行实现增量账本。
4. 若 prefix memo 仍不够，应由 canonical owner 增加一次排序的 multi-boundary evaluator，F 继续独占 fee bridge。不能为追速度在 UI 写 FIFO、现金流版 PNL 或第二套 averageCost。

`trading-room-history.ts` 的 boundary、quote、session、fingerprint 缓存可借鉴结构，不能直接当 V2.5 财务真值：它从 episode 分段建数据、`dailyReplayExecution` 按市场日映射，`dailyContribution` 另算现金流，并明确将 IPO 数量事件判不可计算；不具备 F 新 fee-pool 合同。旧 `buildRoomContribution` 只聚合 closed trustedPnL，也不是当前期间贡献引擎。此为接线不兼容性，不是要求修复旧模块。

## 3. P2 日点合同与时间/FX

每个有效业务日输出一个完整 bundle：`date/cursor/state`、当日 MV、当日 UF、从所选范围起点的累计净实现、累计期间净额、期间已发生费用、quote coverage 与每 metric 的原币/FX事实。令 `R_d` 为截止日累计净实现，`U_d` 为该日净浮盈：

- `periodToDay = (R_d - R_start) + U_d - U_start`；最后有效点与四卡 `net` 必须一致。
- 若需要“当日变化”，另给 `dayNet = (R_d - R_prev) + U_d - U_prev`，不得混称累计期间净额。HP02 tooltip 明确要求累计值，建议主线使用 periodToDay；实施前由协调者把此字段名与原图点口径锁定，不在组件里猜测。
- 当前 MV / 当前 UF 单独按 required asOf 计算一次；历史日点只使用自己的 quote/evidence cutoff，不能回填最新 quote/UF；盘中 asOf 不读取同日完整 daily close。
- quote 日期、reporting Shanghai 日、statement evidence 的物理知识时间是不同字段。保留 canonical event/statement timestamp；不能将 UTC 账单日末平移成上海日末以塞入当天。
- 区分有报价的休市/无新成交、应有交易日缺 quote、future、业务数据缺失、真实零。可用现有 market calendar 判 required session freshness，但必须在 F 批量 adapter 统一纳入 reasons，不能由图表根据相邻数值猜缺口。合并多市场时逐来源校验。
- FX 必须声明事实：若使用同一截至 asOf 的 FX 估值全段，应显示该固定快照，不能标“该日历史汇率”；若声称逐日 FX，需真正的逐日 source-backed snapshots（现接口未提供）。有限扩展不得仅把 snapshot.asOf 改成点日期。每点 missing/partial/future FX 保留原币并断开目标币曲线。

S 的 performance generation/key 一次请求并原子提交 `period label + 三期间KPI + daily + 当前贡献全量`；失败或取消保留旧 committed bundle。当前 MV 的数据域与历史范围的更新域不互相覆盖；不能用曲线逐点完成触发卡片先换范围。

## 4. P4 互斥分类须输出 provenance，不能贴 instrument 标签

同一个 account/instrument 可同时包含 IPO 获配及上市后自行买入，后者必须归做多；同 instrument 也可前 long 后 short。当前 F instrument aggregate 已丢失这层贡献分解，不能靠 `instrument has IPO`、`episode.positionEvents contains ipo`、当前 quantity 正负或 episode.direction 给整行分类。

建议 F 批量层输出可加总的 attribution rows，至少带：`scope identity + category(long|short|ipo) + instrument + provenance/source IDs + periodRealized + openingUF + closingUF + net + remainingExposure + per-metric coverage/reasons/money`。同一原成交的一个 closing/opening 部分只属于一个已声明 provenance slice，类别合计不重复。类别仅影响归因，不重新决定总 inventory/平均成本/fee pool。

- 获配 acquisition 与其后可证实售出的量归 IPO；上市后自主买入产生 long provenance；short 开仓/回补归 short。执行支持的 IPO allocation 必须复用现有 duplicate predicate，不能将 execution 与 event 记两次。
- 混合 IPO/manual inventory 后部分卖出，如果源证据没有指定卖出归属，原设计没有定义 FIFO 或比例匹配。**实施前需在 F 合同明确 deterministic attribution policy**：优先可信来源链接；无链接的处理由协调者裁定并红测，且类别 sums 仍必须等于 canonical。不能让页面临时选 FIFO；无法证明分类时保留“分类证据不足”覆盖，不把整 instrument 塞入 IPO。总财务可信不意味着类别必然可信。
- 分类归因的成本/费用子金额需要守恒：所有 provenance 的库存量、成本、open fee、累计净实现之和分别对齐同 canonical source。若选择比例归因，说明其为贡献归因政策而非另一个交易成本政策，尤其验证不同取得成本的 IPO+manual 混合部分卖出。
- reversal 用原始 execution 和一次 settlement 单价/总 fee，沿 canonical 过零量拆 close/open attribution。`episodes.ts:136–149` 仅改 quantity/allocatedFee，仍保留原 source.settlement；后续不能读取每个 part 的整笔 settlement.grossAmount 重记成交额，不能以 settlement fee 再覆盖 allocatedFee。`summarizeTradeEpisode` 使用 grossAmount/settlement.quantity 取单价，再乘 part quantity，此安全原则可借鉴，不能直接相加 split 的原整单金额。
- 非 execution IPO cover short / reverse 与晚到 refund 都须沿 F 已修正的 fee movement。openOnly 按所选类别真实剩余 exposure 过滤；历史模式禁用但保留 S current openOnly 记忆。

分类后先建立全量基数，再按市场/证券维度聚合，再排序、钻取、8行分页。保留 `scopeTotal/categoryTotal/drilldownSubtotal/filteredTotal` 的明确语义与来源；上层全量合计不取当前页。在无 local filter 的全量当前期间上，所有类别/市场/证券相同基数的总和 = F net（及各 realized、UF delta 分项）。选中互斥类别后只显示该类别摘要，另保留范围全量总额说明；openOnly 的过滤总额不能冒充全范围 F net。未知 metric 不能汇总已知子集后标完整合计。

S 已保存 current/history 各自 category/sort/page/market-symbol drilldown 与 current-only openOnly；P4 只消费已 committed 的状态。local drilldown 不改 global market，进入交易详情传精确来源 trigger ID。金额行不能用 UI snapshot 中旧业务结果恢复，返回需依最新数据重新派生。

## 5. 历史 closed business：独立口径，共享源证据

历史是所选年份内 **完成回合的最终净盈亏/费用**，按实际结束业务日期归属；不是期间 F net，也不是“期间发生过平仓的所有 realized”。跨年旧仓本年平仓：历史计其最终全回合净额，当前期间需扣 openingUF；两个数字不能相加。

已有 `TradeLibraryEpisode` 可以提供稳定回合 identity、open/closed、进入详情的 ID 与 split 对应；`episode.metrics` 可作为对照，但它是另一独立实现，不能未经核对当作 canonical extension。`tradeEpisodeClosingTradingDate` 优先市场/source日，不等同 HP05 Shanghai closed business 日；直接复用 `dashboardEpisodeDate/row.closeDate` 会沿旧日期政策。建议 F owner/登记后的只读历史 adapter 从同一 raw timeline 输出 `closedRoundId/closedAt/closedBusinessDate(Asia/Shanghai)/net/fees/positiveZeroNegative/coverage/evidence IDs`，closed domain 与当前 inventory domain 分开。

精准结束 timestamp 转 Shanghai；date-only 保留来源日粒度与知识截止，不捏造精确时刻。结束若来自 statement event，以实际已知 event 知识时间/声明精度处理；若无法证明结束数量或先后，记录未知，不当成一笔已完成赢/输。当前 F 对 IPO 费用的修复不自动使现有 episode builder 标记的所有 closed 回合可信。

P4 纯聚合负责完整 buckets：单年12个月、跨年逐年，bucket 必有状态 `value | no-rounds | source-missing | future`（请求失败由整 bundle 控制），并输出闭合回合数、可信分类覆盖与费用。四模式统一基数：

1. period-pnl：该月/年 completed rounds 最终 net。
2. cumulative-pnl：从所选范围起点累计；若有 source-missing，此后累计也不能补0连接。无回合 bucket 保留 no-rounds 的视觉缺口，不伪造本期收益点；未来不生成趋势。
3. win-rate：每 bucket `positiveRounds / allCompletedRounds`；breakeven 属分母。范围总体为总 wins / 总 rounds，禁止平均月胜率。未知净额不能静默剔除后把“可信子集胜率”当完整；可另显 covered/total。
4. rounds：真实已完成数量；无回合为0，但图表 no-rounds 状态与有回合净额0仍不同。全范围无回合显示空态，胜率 null。

历史贡献消费同一 closedRound rows，按历史范围/category 聚合，不混 current UF。全量贡献 = 历史净盈亏；unknown/FX 覆盖与历史四卡一致。历史补录/撤销/修正改变 sourceRevision，重算关联年份和历史贡献，更新时间标 Asia/Shanghai。切换 mode 仅格式/字段，不重新回放整个账本；切换范围一次原子提交历史四卡、四模式所需 buckets 与历史贡献。

## 6. 下一次有限接口扩展的必需反例

|领域|最小反例与验收|
|---|---|
|性能/一致性|200 fills、跨365日：batch 与单边界 F 对照金额/coverage完全一致；记录真实耗时与 ledger调用数；日数增长不乘完整 prefix replay成本。不是只测最终net|
|日线边界|跨Shanghai午夜、date-only、盘中asOf、未来statement/month-only证据、休市与缺应有rawquote分开；最后点=期间KPI，历史点不回填当前值|
|fee/IPO|原5 peer probes继续绿；IPO现金晚于获配、IPO cover short/full/reverse、跨期费用池、execution-backed allocation不重复|
|分类|同 instrument IPO1@100、manual1@200、部分sell与最终close；手动买入long，获配IPO，分项与total守恒；同instrument long→short；证据不够不得整标IPO|
|reversal settlement|买1后卖2，整笔settlementgross/quantity及fee；close/open分摊量/费守恒，不能重记整单金额/fee|
|历史|UTC12/31上海1/1关闭、date-only、跨年open后close；partial close不冒充完成回合；0/正/负及未知费用、非execution结束；范围回合数与贡献分母一致|
|4模式/缺口|单年与跨年，无回合、真实0、missing、future分别输出；全范围wins/rounds不是月平均，breakeven在分母；source-missing不被累计填0|
|全量贡献|50证券7页最后2行；市场3条不分页；最后一页/下钻/排序不改变scopeTotal；openOnly有独立filteredTotal；多币FX partial不冒充完整对账|
|域与恢复|新期间失败/取消保留旧bundle与旧标题；history更新不改当前MV/当前贡献；S恢复后仅UI、请求不活跃、最新数据重投影、精确焦点fallback；真实浏览器交P1/P4验证|

建议先由协调者确认主线累计字段及混合来源卖出的归因政策，随后只给 F owner 分派 batch/currentUF/fees/attribution/closed rows 的有限接口任务（可按 P2/P4 先后分段，避免一次扩整个账本）。P2/P4 页面 owner 消费投影和 S，不另写财务。本文未通过任何 P2/P4/UI/存储/实际数据重载接受门槛。
