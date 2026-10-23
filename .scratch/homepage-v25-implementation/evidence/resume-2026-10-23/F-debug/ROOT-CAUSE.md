# F 财务诊断：diagnosis-ready，未修复、未验收

2026-10-23；执行者 `/root/financial_g61`。已执行 systematic-debugging 的第 1–3 阶段（调查、工作模式对照、最小假设实验），没有进入第 4 阶段修复。

**结论：四个已知失败不是四个孤立算术错误。真实库适配层没有定义统一的业务时间/知识截止，把带可信度和来源的账本快照降成普通数字，再交给一套不同成本/费用政策的账本重算。** 时间、证据、金额三类契约分别有可复现反例，不能用一个 UTC 游标补丁概括全部根因。

本次只新增本目录内的诊断文件。未修改产品源码、原测试、既有验收证据；未启动服务、未读写业务数据库、未运行全量套件、未提交或推送。所有输入均为合成最小样本，经过真实 `buildInstrumentTradeSummaries → buildTradeLibraryEntries → buildHomepageV25Performance` 管线。该纯模块尚未被生产页面消费；本报告不宣称 UI、数据库、集成或整页验收通过。

## 1. 可重复环境与版本绑定

- cwd：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`
- HEAD：`5a94ee3ff76e32993fe2c4791a83b40e877a7344`
- Node：`v26.0.0`；可执行文件 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`
- Vitest：`4.1.10`；Node 环境；单 worker；`--no-cache`。
- OS/架构：darwin/x64；Intl 默认时区 `Asia/Shanghai`；环境 `TZ` 未设置。
- `app/lib/reviews/homepage-v25-performance.ts` SHA256：`81038783d8d2f8b7c5c680f6fd6179ebfceba6f960147cdda66076d474d99345`，与第三轮接受记录的源码一致。
- 完整环境、源码/测试/设计 SHA256 和工作区状态：[source-manifest.json](source-manifest.json)。相关产品文件仍是工作区原状；模块及其测试原本未跟踪，不能仅靠 HEAD 指代本次版本。

原失败复现命令（`--no-cache` 仅禁止 Vitest 缓存写入，不改变财务输入）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/F/coordinator-round3.vitest.config.ts --no-cache
```

结果：**14 项，10 PASS / 4 FAIL，exit 1**。[原样日志](reproduce-round3.log)。四项失败与历史第三轮相同。

因果探针命令：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-debug/diagnostic.vitest.config.ts --no-cache
```

结果：**14 项观察测试 PASS，exit 0**。[最终日志](diagnostic-final.log)、[探针源码](boundary-probe.test.ts)。探针只包装真实 `replayPositionAtPrice` 记录输入输出，实际运算仍调用原实现；36 个记录包含对照样本、变体、纯入口反例和既有 money 对照。**这里的 PASS 是确认故障机制，不是功能验收 PASS。** 初次十组探针日志及原始 trace 另存为 [diagnostic.log](diagnostic.log)、[boundary-traces-initial.json](boundary-traces-initial.json)，未抹掉中间证据。

新增明确预期的回归候选命令：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-debug/invariant-red.vitest.config.ts --no-cache
```

结果：**10 项全部 RED，exit 1**。[红测源码](invariant-red.test.ts)、[红测日志](invariant-red.log)。这些是新增诊断回归候选，未替换原测试或改变验收基线。R09 的平均成本要求明确绑定现有真实账本政策；若协调者依据批准规格决定另一套政策，必须显式记录，不能让两套政策在适配边界隐式混用。

## 2. 已读合同与本次范围

完整读取 `AGENTS.md`、当前开发流程/拆票标准、systematic-debugging 及 root-cause-tracing；读取原功能 README、PLAN、DESIGN-COVERAGE、01-financial 和 F 三轮验收。金融合同以原设计为准：

|合同|规格位置/覆盖项|本次核查|
|---|---|---|
|净额=期间实现+期末浮盈−期初浮盈；部分平仓、跨年、费用一次；第四卡独立|HP02 193–221；HV25-14..18|输入、边界、成本与输出因果|
|日净额/市值/浮盈/累计实现来源；缺值不可造 0|HP02 222–252；HV25-19..20|模型输出是否足以支撑，未验图形/UI|
|当前贡献全量对账；已平仓也保留期初浮盈；历史闭合回合独立|HP05 347–431；HV25-38..43|本模块分项能否对账，未验分页/交互|
|金额、缺失与来源解释|HP09 465–502；HV25-16/43|原币、FX、可信度与缺值政策|

已对比完整 `homepage-v25-performance.ts/.test.ts`、真实 instruments/library/episodes/episode-metrics/types、position-ledger 及其时间证据解析；对比现有 history、holdings、portfolio、scope/money 的相关工作模式。没有把历史 contribution 的“仅已平仓”算法当作当前期间算法。

## 3. 真实管线边界：错误在哪里引入

详尽逐层输入输出保存在 [boundary-traces.json](boundary-traces.json)；便于阅读的数值/状态摘要是 [compact-traces.json](compact-traces.json)。每条 trace 都有原成交、上海日期、真实 summaries、entries/episode 状态、传给 F 的输入、三个真实 ledger 调用及最终结果。

|层|实际语义|被下一层丢弃/改变的合同|
|---|---|---|
|原始 TradeExecution|精确瞬间或 date-only；市场日标签；settlement；feeStatus/historyIncomplete；仓位证据；live/simulation/run|不能用市场日标签、UTC 日期和上海自然日互相替代|
|真实库 episode|按账户/证券/nature/run 成轮次；反向成交拆为 `:close`/`:reverse`；保留 accuracy/directionKnown/initialPosition/events；列表按开始时间倒序|adapter 只保留账户/证券键、首个 episode.direction 和拆分 executions|
|真实 ledger|游标包含边界（`<=`）；加权平均成本；费用独立；`quantityKnown/costKnown/accuracy` 区分可靠值与兼容占位数值|adapter 仅在 seed 时查看已知标记；估值和 current 仍用占位 `quantity`，不传 accuracy|
|F adapter|期初 UTC 当天 00:00（含边界），期末 UTC 当天 23:59，current 无游标；current 行情先取全量最新；opening direction 用最新 episode 的方向|没有共享上海 cutoffs、asOf 截止；没有保留来源状态、拆单 lineage、scope 和 money 契约|
|F pure|按上海日（有 source 日则优先 source）筛期间；独立 FIFO book；opening fee 入成本，closing fee 当次扣；期末不限制 asOf|同一成交可既 seed 又 replay；同一来源被两种会计政策运算；reason 只是文字，未成为数值不可用门槛|
|输出|单一无币种数值+coverage+reasons|无法表达原币小计、FX来源、报价来源/截止、数量已知但成本未知等设计要求|

### 四个历史失败的完整最小链

1. **上海首日**：`2025-12-31T16:30Z` 是上海 `2026-01-01 00:30`，pure 纳入期间；adapter 的期初 cursor 却是 `2026-01-01T00:00Z`（上海 08:00），已把它纳入 seed=1；pure 再买一次→bookEnd=2，而 endSnapshot=1→`valuation-quantity-mismatch`，opening/net=null。只把执行时刻改为 `2026-01-01T02:00Z`，seed=0、net=10；恰好 UTC 午夜也因 `<=` 被双计。问题不是 Decimal 精度或执行顺序。
2. **未来成交污染 current**：已知 1 份+2/2 未来买入、asOf=1/31。期间 endSnapshot=1，current replay 未传 cursor=2；current 价格仍是 1/31 的 110→完整 220。删除唯一未来成交→110。问题在数量回放的知识截止，不在报价筛选。
3. **未来行情阻断回退**：有 1/31=110 和 2/2=999；adapter 只发 current 999，pure 才按 asOf 丢弃，已没有 110 可选→null。删掉唯一未来 candle→110。不能只“拒绝未来”；必须先构造合格候选集，再取最新。
4. **未来期间净额**：asOf=1/31，period.end=12/31，2/2 买100，12/31=999。endSnapshot 纳入未来成交，pure 也按 period.end replay，end mark 虽标 `quote-future` 仍参与数值→完整 899。相同输入纯入口也899，证明不只是 adapter 错误；只把 period.end 改1/31→0。

## 4. 已验证根因与最小实验矩阵

### RC-T：缺少统一的业务边界与知识截止

引入点：`homepage-v25-performance.ts` 的 `businessDate`、`selectValuation`、periodExecutions、adapter 三次 replay 和 candle selection。期初要求严格早于起始上海自然日；期末/当前必须在一致的知识截止内。现实现只有彼此不相容的字符串/瞬间筛选，并以 period.end 代替可选 asOf 的 current 截止。`statement-evidence` 的 date-only 日末及 statement opening/closing 是知识排序标记，不能机械套上海偏移去改共享 ledger。

### RC-E：证据状态和身份在适配边界被降维

引入点：adapter `groups`、openingPositions/valuations 映射、recursive call。`quantityKnown=false` 的兼容 0 变成“完整市值 0”；`costKnown=false/accuracy` 及 unknown fee 被本地重放覆盖。`group.direction` 来自倒序列表首个 episode，添加未来相反方向 episode 会改变过去的期初仓向。按账户/证券聚合也抹掉 nature/run；接口没有声明必须预筛选或携带可校验 scope。反向拆单的原 settlement 没按拆分部分分配，F 又优先按 settlement.quantity 而非 split.quantity 运算。

### RC-A/M：重复账本和不兼容金额接口

引入点：adapter 用 canonical ledger 的 averageCost seed，本地 `applyExecution` 却 FIFO+fee-in-cost；期初费用累计丢失。`fxRate` 读取 `rates.USD`，现有 `RoomFxSnapshot` 生产键是 `USD/CNY` 或 `USD:CNY`；也跳过 complete/partial/missing 和正数检查。原币/来源完全没有进入输出。这是独立的真实接口不匹配，不是 RC-T 单独修复能解决的。

|实验（trace 标签）|只改一个因素/对照|当前观察与因果结论|红测/修后要求|
|---|---|---|---|
|H1|上海首日跨UTC午夜→同日白天|seed1→0，null→10；恰好UTC午夜仍失败|原 round3 case1；首日只纳入一次|
|H2|仅添加 asOf 后成交|current ledger q1→2，110→220|原 round3 case2；未来成交对已知 current 不可见|
|H3|仅添加未来 candle|110→null，旧合格价存在却消失|原 round3 case3；先截止再选价|
|H4/H14|仅延长 period.end，asOf 不动|0→899；纯入口同样899，reason=quote-future却available=true|原 round3 case4；范围拒绝或截至asOf投影，禁止899|
|H5 unknown-fees|仅加 feeStatus=unknown|库metrics.net=null，ledger costKnown=false/unknown-fees；F net10且无原因|R01；PNL不可计算，current数量/市值可独立可信|
|H5 history-incomplete|仅加 historyIncomplete|ledger q=0/quantityKnown=false；F current0/available=true|R02；未知数量不能当0|
|H6 unknown opening|statement opening 量1，无成本→补 nominal cost100|两者 canonical ledger 都明确 initial-position/unknown-cost；F丢原原因，只剩direction/mismatch|保留未知成本；不可将 statement.cost 或 mark 当可信收购成本；此变体未证明 ledger 应接受cost|
|H6 unknown transfer|仅加缺数量转入事件|ledger quantityKnown=false；F current0/available=true|与R02同类；保留事件原因，不造0|
|H7 currency mismatch|仅加CNY结算700到USD买100|ledger/库拒算；F把700成本与USD110报价相减，发布-590|R03；货币不匹配必须不可计算或显式可信换算|
|H7 reversal|同一 reverse fill 加原 settlement|拆单两段各qty1/fee1，但都保留settlement.qty2/fee2；F新增position-coverage-missing|先保留原成交/分配lineage；不能用整单结算重播两次；现无settlement反例本身也有未证明short的方向问题，未将其宣称正确空头控制|
|H8 carry fees|仅把开始日移至开仓之前|同一1/20平仓的periodRealized 19→17；current-period净19碰巧正确，开期UF0丢费用|R06；同一平仓的净实现不随期间起点变；费用分项需完整桥接（例如净实现17、开期UF-2→当期净19）|
|H8 future direction|仅加未来显式空头episode|期初ledger仍正1，但group.direction从long变short；旧期间net19→null、current0→-110|R07；未来相反方向不能改变过去结果；方向来自边界库存证据|
|H9 FX keys|生产USD/CNY→裸USD，数值都是7|真实money完整770；F生产键null，裸键770|R04；复用真实FX接口|
|H9 FX status|仅complete→missing（裸键控制）|F仍完整770；真实money则null，保留USD110原币|R05；完整度/来源保留且缺FX不造0|
|H10 periods|显式asOf，同current换旧period|110保持110（局部正常）|保留此PASS，不能以其他FAIL否定所有逻辑|
|H10 scope|仅加同账户证券simulation|真实库保留两种nature；F合成current220/net20|需明确入口scope并隔离；不是擅自要求本模块独占页面过滤责任|
|H11 first-day mark|旧仓成本100，前日100/首日120/末日130|F opening20、closing30、net10，吞首日20|R08；首尾日期包含当日应计30；opening使用期前合格mark|
|H11 end date|仅加1/31T16:30Z（上海2/1）买入|pure期间排除，endSnapshot却计入；mismatch/null/current220|与原case1/2同边界根因；结束日后不可见|
|H11 date-only|首日精确瞬间→合法date-only标签|正常net10|必须保留date-only工作模式，不全局给账本cursor减8小时|
|H12 average/FIFO|期前1@100+1@200；期内1@300，再平1@400|真实ledger avg200/realized200；F FIFO realized250/UF250，net400仍对；真实UF300|R09；分项与既有成本政策一致，不能只验总净额|
|H13 implicit asOf|仅换期间、asOf省略|current110→0、coverage0/0|R10；入口要求明确currentAsOf或独立解析当前时点，不能回退period.end|
|H14 malformed current|仅把current.quantity改unknown|`DecimalError Invalid argument:null`|类型/状态边界应返回不可计算，不能数值占位或抛未分类异常|

结论：开平仓证据、unknown cost/quantity、fee、FX、跨期 current 独立性分别属于以上三个明确边界问题的直接影响面。无需修改导入规则、全项目 ledger、其他页面或历史 contribution 来修本模块。一般反向卖出并不自动证明允许开空，不能为让数值通过而降低证据门槛。

## 5. 与现有工作模式对照

|现有模式|应保留的合同|不能直接照搬的部分|
|---|---|---|
|`position-ledger.ts`|数量与成本分别可知；accuracy理由；settlement currency保护；费用独立；加权平均；statement/evidence时间顺序|数值0可能是兼容占位；不能直接公开；date-only和statement知识游标不是上海墙钟|
|`trading-room-history.ts`|end=min(period.end,asOf)；按scope拆nature/run；回放完整证据；quantity/cost/marketvalue分别覆盖；合格raw行情/市场日历；前一应有交易日基准|其日界是市场日，不自动等于首页上海自然日；不要整体替换首页投影或发散重构|
|`trading-room-holdings.ts`/portfolio|合并episode/execution accuracy；方向/数量证据门槛；marketvalue不依赖成本已知；当前独立scope|部分现有 latest-then-reject helper本身不证明未来candle回退正确，不把“已有代码”当通过证据|
|`trading-room-scope.ts` money|`USD/CNY`/`USD:CNY`正汇率；complete门槛；原币小计；snapshot id/source/date；缺失转换null|当前最新FX估算政策不等于历史FX；需保留实际使用的策略/日期，不能自行创造历史汇率|
|episodes/library|原始成交与拆分轮次分开；显式开空证据和accuracy；nature/run身份|倒序首轮direction不是期初方向；拆单source settlement是整单证据，不是每段完整金额|

## 6. 为什么前三轮修复仍失败

1. 第一轮已经发现原始模块没有真实适配、FX未换算、缺值/费用/方向简化。后续补了本地 FX 和 entries adapter，但输入测试使用裸 `rates.USD`、手造entry，未验证真实 money/episode/evidence合同。
2. 第二轮 quantityMismatch、missingCost、invalidFee、current未来价格等失败后，第三版加了局部数值检查，修了“白天首日成交”样本。仍以UTC午夜seed，再用上海业务日筛选，因此新的跨午夜反例会继续出现；“拒未来价”发生在适配后，只丢最新价却不能恢复合格价。
3. 本地纯函数与 canonical ledger 都在计算库存/成本，却没有一份共享的归一化证据和成本政策。quantityMismatch 能阻止某些错误总数，但不能恢复原原因，不能阻止 unknown-fees→完整10 或 quantityUnknown→完整0。更多孤立断言只会把缺失合同藏得更深。
4. 净额恒等式可在错误分项间相互抵消。H8/H12 说明只验 net/恒等式会漏掉 realized/UF 的错分、费用跨期失配。全量贡献对账和KPI详情要求各分项独立正确。

历史三轮记录保持 FAIL。新增诊断不重写历史、不把原10PASS覆盖新的10RED。

## 7. 建议的最小修复架构（待协调者裁定、尚未实施）

保留纯函数可测试性，但取消“真实ledger seed → 另一套不兼容book重算”的隐式桥。先定义一份证据保真的输入和边界，所有期间分项及current从同一规范化来源投影；限定改动在F模块及定向测试，不重写通用导入/其他页面。

```ts
type EvidenceValue<T> =
  | { state: "known"; value: T; evidenceIds: string[] }
  | { state: "unavailable"; reasons: string[]; evidenceIds: string[] };

type ProjectionScope = {
  accountIds: string[]; markets: string[];
  nature: "live" | "simulation"; simulationRunId: string | null;
};
type ProjectionBoundary = {
  businessTimezone: "Asia/Shanghai";
  periodStartInclusive: string; periodEndInclusive: string;
  currentAsOf: string; // required, resolved once by caller
  // Normalizer owns exact instant, date-only and evidence cutoff semantics.
};
type InventoryBoundary = {
  identity: { accountId: string; instrumentId: string; nature: string; runId: string | null };
  quantity: EvidenceValue<string>; signedCost: EvidenceValue<string>;
  realizedNetEvents: EvidenceValue<unknown[]>;
  quote: EvidenceValue<{ price: string; currency: string; date: string; source: string }>;
};
// Output money keeps originalByCurrency + target conversion state + FX provenance.
```

接口名字仅建议，不构成实施授权。修复前需要在F任务合同里裁定下面几项，随后才能开始红绿循环：

1. **时间一次解析**：精确成交统一转上海业务日；source市场日保留独立字段；date-only证据使用已有知识顺序，不捏造精确时刻。期初严格在首日前，期末含末日但不越asOf。未来范围选择拒绝或clamp须固定一种；currentAsOf不得由period.end推导。行情按边界先过滤再选最新合格raw价；opening取期前合格mark。
2. **原成交与身份一次归一化**：使用真实原成交（或显式分配结算金额的拆单）去重；保留附着的statement/evidence和不可计算理由。库存键包含nature/run；scope由明确参数或已验证的预筛选输入承担，不能默许任意entries混算。方向来自签名库存/显式证据，不取最新episode字段。
3. **会计政策统一**：沿用现有平均成本/方向证据规则，并为“平仓净实现、未平仓费用基准、期间桥”建立同一套可追踪分配；opening fees不能在跨期seed时消失。可在F内做证据保真的投影适配，避免另建独立FIFO。不要仅从ledger累计net相减后冒充各分项已正确。
4. **金额统一**：沿用真实FX键和完整度/正数验证，保留原币和snapshot id/source/date；不把USD与CNY裸数相减/相加。修复阶段应将源码同名测试里的裸 `rates.USD/HKD/CNY` fixture 改为生产 `USD/CNY` 或 `USD:CNY`，不能为兼容错误fixture继续接受裸键或 `status=missing`。单币已等于目标币时无需FX；混币保留原币小计、转换状态和来源。每项 coverage 按实际参与且可信的库存/实现事件统计，错误项不能从分母消失。历史 evidence/F 测试继续保留。

### 未知值政策（必须进入接口和红测）

- 数量未知：current市值/依赖该数量的估值不可计算，保留原理由；不能解释成空仓或0。
- 数量已知、成本未知：PNL不可计算；合格同币种价格下current市值可以独立可用；不能把成本未知误伤市值。
- 费用未知：受影响净实现/浮盈成本和期间净额不可计算；不改变可信数量。费用必须一次且跨期分项一致。
- 明确无敞口：可为真0，不要求不存在仓位的报价；与“没证据”分开。
- 行情缺失/未来/币种不匹配：相应市值/浮盈不可计算；先筛候选，不能选未来价再无回退地丢弃。
- FX缺失/partial/missing：保留原币与已知覆盖，目标币数值null；不能补0或伪称完整。
- malformed值：返回可分类不可计算原因，不抛未分类Decimal错误；warnings/reasons不能与available=true矛盾。
- 原因按指标依赖传播：opening未知不能无条件污染可信current；数量未知也不能被纯数字current绕过。共享Set只能收集全局索引，不能代替依赖图。

## 8. 最小修复顺序与回归门槛

1. 固定上述时间、scope、成本/费用和未知值接口；协调者独立审查，不动UI消费。
2. 先红后绿修时间归一化/合格候选/current独立截止；保持原四项红测和H11/H13控制。不通过就不扩展下游。
3. 修复证据/原成交/scope与方向归一化；unknown费用/数量、currency mismatch、未来episode、reverse settlement必须有定向红绿证据。
4. 统一成本费用投影和真实money接口；对各分项分别验证，保留原币/来源，再对账总净额。
5. 最后接入页面数据层；此前F只能是implementation-ready，不能accepted。页面后的真实交互、孤立数据库写入、参考图视觉及独立接受另按主任务执行，不由本纯模块诊断替代。

|回归组|必须涵盖|现状|
|---|---|---|
|历史14项|原round2/round3/真实pipeline4反例|10PASS/4FAIL，完整保留|
|T时间|上海首日/末日、恰好边界、date-only、asOf日前后、未来价有旧合格价、未来范围、首日mark|原因已确认；原4FAIL、R08/R10 RED；date-only正常控制PASS|
|E证据|unknown qty/cost/fees/history、statement opening、事件、显式开空/普通买卖、未来相反episode|R01/R02/R07 RED；opening保留根因需回归|
|A会计|部分平仓、跨年、100/150/0桥、开平仓手续费、跨期fees、平均成本、reverse split lineage|旧桥算例PASS不代表分项；R06/R09 RED；reverse仍不可接受|
|M金额|生产FX键、complete/partial/missing、原币/来源、同币无需FX、混币禁止裸合计|R03/R04/R05 RED；输出原币/来源合同尚未具备|
|I隔离/独立性|账户/市场/nature/run、期间切换current不变、current不含现金负债、缺开期价格不伤current|显式asOf正常样本PASS；nature混入已观察，入口责任需固定|
|集成/UI/持久化/视觉|真实页面消费、核心流、隔离库、参考图、独立接受、可点击存活预览|本诊断不适用；功能交付仍NOT VERIFIED，不得据此关闭F或整页票|

**交接状态：diagnosis-ready。** 根因已达到可修复设计裁定所需证据强度；尚未实施任何修复，10项新增红测和原4项失败仍存在。等待协调者审查和下一次受限派发。
