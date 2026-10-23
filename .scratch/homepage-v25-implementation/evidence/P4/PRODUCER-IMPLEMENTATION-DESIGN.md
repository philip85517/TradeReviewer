# P4 producer：接口与测试向量设计

2026-10-23；作者 `/root/finance_calendar_resume`；实际模型 **gpt-6.1-sol / ultra**。本文件是 root 明确派发的**文档设计**，不是 producer 实施授权、seam 接受或 P4 产品接受。仅新增本文；产品、测试、seam 冻结文件均未写，未运行 CPU 测试/bench，未使用 DB、浏览器、服务、git 集成或子代理。P4 producer 待 seam 独立接受及另行实施授权。

## 1. 已批准依据与本次范围

直接依据原批准正文 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` 的 HP02:193–221、HP05:349–432、HP09:467–514，以及本目录 `ROOT-FINANCIAL-DECISIONS.md`、`PRE-DISPATCH-CONTRACT.md`；同时核对 `CANONICAL-READ-FACT-SEAM-PROPOSAL.md` O01–O08、P2 的 `P4-COORDINATOR-PROVENANCE-DECISION.md` 和当前 canonical/F/series/S 接口。前份合同 D1/D2/D3 已由 root 决定关闭，不重新列为未裁定。旧草案的候选 pro-rata 不生效。

本次派发文字出现 `openingUF + periodRealized − closingUF`。原批准正文 [HP02:204](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:204) 准确原文为“**期间净盈亏 = 期间已实现 + 期末浮盈 − 期初浮盈**”；HP02:208 的成本100、期初120、卖出130例为 `30＋0−20＝10`。HP05:403 原文也明确“期间内已实现贡献加期末浮盈减期初浮盈”，并给出期初浮盈100、期间实现150、期末0，贡献50。故本文保留 `periodRealized + closingUF − openingUF`。反式会把 H02 的10错算为50。root 已确认这是协调者派发措辞错误，不能覆盖原合同；`ROOT-FINANCIAL-DECISIONS.md:7–8` 的关闭日 FX / 全精度原币胜负裁定同样保持原文。

设计覆盖：历史四卡（关闭净额、关闭回合数、原币净胜率、所扣分配费用）、月/年各期与累计图、当前及历史贡献的纯财务 producer。UI 控件、host 请求、S、series、provider、数据库和导入 schema 均不在写范围。HP09 的旧数据保留/原子接收/15 秒超时/晚响应丢弃由既有 host/S owner 实施，producer 只返回绑定版本的完整不可变结果。

## 2. 权威与实际调用顺序

1. P2/source owner 取得同一版本的**完整合格复合组**：account + canonical instrument + market/currency + nature/run；attachments 只决定组资格，不裁掉该组早期 executions、IPO cash、position evidence 或费用。禁止 account×symbol 独立集合交叉匹配。source 的当前 period 不能成为历史输入截断条件。
2. 显式 P4 请求才调用 `readHomepageV25FinancialFacts`。canonical 仍是数量、平均成本、gross realization 的唯一 authority；F 仍是费用池、分配费用和净结果的唯一 authority。producer 只折叠已输出的 movement/allocated-fee delta，不重放价格成本方程。
3. 历史先折叠完整截至 asOf 的数量周期，再按**上海业务关闭日**选择 range。partial 产生的已实现 delta 暂存在同一回合，回合最终关闭才进入历史集合。
4. 当前贡献直接消费同一 accepted `HomepageV25SeriesBundle.periodSummary.instruments` 的 `periodRealized/openingUnrealized/closingUnrealized/net`，不从历史关闭集合求期间结果。分类所需 facts 使用该 summary 的 `effectiveCursor`，不能用更晚 asOf 的新 fills 给旧期间补分类。
5. 历史 FX 按关闭日批量解析一次；每 round 固定一份转换事实，四卡/桶/累计/历史贡献引用它。禁止图表或贡献再次以范围终点 FX 换算。**当前 F 仅有 asOf FX coverage，尚无可消费的逐关闭日 rate interface；见第 7 节，不私读 opaque source。**
6. 仅在所有 sourceId/revisions/policies/scope/selectionKey/asOf/generation 对齐时组合；错配是 input error，不返回看似完整的混合结果。缺金融数据是 coverage unknown，不当成 throw 或空集合。结果不写 S、hpSource、sessionStorage 或 prepared source memo。

## 3. 推荐公共 interface（提案，尚未导出）

建议新增独立财务 module，名称 `homepage-v25-history.ts` / `homepage-v25-contribution.ts` 供 root 派发确认。公共类型直接引用现有 F/series/S 导出，不重新定义第二套 scope/range。`HomepageHistoryRange` 仅 type import；producer 不读取或修改 S。

```ts
type FinancialRead = ReturnType<typeof readHomepageV25FinancialFacts>;
type FinancialGroup = FinancialRead["groups"][number];
type GroupIdentity = FinancialGroup["identity"];
type Metric = HomepageV25Metric; // 现有 F 导出，非新增金融 metric 实现
type Category = "long" | "short" | "ipo";
type ReasonCoverage = Readonly<{
  complete: boolean; known: number; unknown: number;
  universeComplete: boolean; reasons: readonly string[];
}>;
type CountMetric = Readonly<{
  value: number | null; confirmed: number; coverage: ReasonCoverage;
}>;
type WinRateMetric = Readonly<{
  winners: CountMetric; denominator: CountMetric;
  fraction: Readonly<{ numerator: number; denominator: number }> | null;
  coverage: ReasonCoverage;
}>;
type MoneyMetric = Readonly<{
  nativeByCurrency: Readonly<Record<string, PositionFactValue>>;
  targetCurrency: string | null; target: PositionFactValue;
  conversionIds: readonly string[]; coverage: ReasonCoverage;
}>;
type SelectionReceipt = Readonly<{
  sourceId: string; selectionKey: string;
  eligibleGroupKeys: readonly string[];
  coverage: ReasonCoverage;
}>;
type ProducerStamp = Readonly<{
  sourceId: FinancialRead["sourceId"];
  revisions: FinancialRead["revisions"];
  policies: FinancialRead["policies"];
  scope: FinancialRead["scope"];
  selectionKey: string; asOf: string; requestGeneration: number;
  producerPolicy: string; // 固定编译期版本，不接受 caller 改会计政策
}>;
type ClosedRound = Readonly<{
  roundId: string; groupKey: string; identity: GroupIdentity;
  direction: "long" | "short";
  openingAnchor: string; closingAnchor: string;
  closedAt: string | null; closeBusinessDate: string | null;
  timePrecision: "instant" | "day" | "month";
  executionIds: readonly string[]; eventIds: readonly string[];
  movementFactIds: readonly string[];
  allocationRefs: readonly Readonly<{
    contextId: string; movementFactId: string | null; beforeSourceId: string;
  }>[]; // F allocation 本身没有 factId；不伪造已有字段
  episodeIds: readonly string[]; evidenceIds: readonly string[];
  closureCoverage: ReasonCoverage; closeDateCoverage: ReasonCoverage;
  episodeCoverage: ReasonCoverage;
  nativeGross: PositionFactValue; nativeAllocatedFees: PositionFactValue;
  nativeNet: PositionFactValue; winner: boolean | null;
  category: Category | null; categoryCoverage: ReasonCoverage;
  gross: MoneyMetric; allocatedFees: MoneyMetric; net: MoneyMetric;
}>;
type HistoryStats = Readonly<{
  net: MoneyMetric; allocatedFees: MoneyMetric;
  closedCount: CountMetric; winRate: WinRateMetric;
}>;
type HistoryBucket = Readonly<{
  key: string; grain: "month" | "year"; from: string; to: string;
  state: "value" | "empty" | "source-missing" | "future";
  stats: HistoryStats; cumulativeNet: MoneyMetric;
  roundIds: readonly string[];
}>;
type ContributionRowBase = Readonly<{
  key: string; identity: GroupIdentity; roundIds: readonly string[];
  episodeIds: readonly string[]; category: Category | null;
  categoryCoverage: ReasonCoverage;
}>;
type CurrentContributionRow = ContributionRowBase & Readonly<{
  mode: "current";
  components: Pick<BoundaryInstrument,
    "periodRealized" | "openingUnrealized" | "closingUnrealized" | "net">;
  openAtEndpoint: boolean | null;
}>;
type HistoricalContributionRow = ContributionRowBase & Readonly<{
  mode: "history"; stats: HistoryStats;
}>;
type CurrentContributionDataset = ProducerStamp & Readonly<{
  mode: "current"; period: HomepageV25SeriesBundle["boundary"];
  rows: readonly CurrentContributionRow[];
  scopeCanonicalTotal: Metric;
  categoryTotals: Readonly<Record<Category, Metric>>;
  classificationCoverage: ReasonCoverage;
}>;
type HistoricalContributionDataset = ProducerStamp & Readonly<{
  mode: "history"; historyRange: HomepageHistoryRange;
  rows: readonly HistoricalContributionRow[];
  scopeCanonicalTotal: MoneyMetric;
  categoryTotals: Readonly<Record<Category, MoneyMetric>>;
  classificationCoverage: ReasonCoverage;
}>;
type ContributionDataset = CurrentContributionDataset | HistoricalContributionDataset;
type HistoryBundle = ProducerStamp & Readonly<{
  range: HomepageHistoryRange;
  bounds: Readonly<{ from: string | null; to: string | null }>;
  stats: HistoryStats; rounds: readonly ClosedRound[];
  buckets: readonly HistoryBucket[];
  contribution: HistoricalContributionDataset;
}>;

buildHomepageV25History(
  source: HomepageV25PreparedSource,
  request: Readonly<{ range: HomepageHistoryRange; asOf: string;
    targetCurrency?: string; requestGeneration: number;
    selection: SelectionReceipt }>
): HistoryBundle;

buildHomepageV25CurrentContribution(
  source: HomepageV25PreparedSource,
  series: HomepageV25SeriesBundle,
  request: Readonly<{ requestGeneration: number; selection: SelectionReceipt }>
): CurrentContributionDataset;
```

上文 `Metric` 仅 alias 到 F 现有导出 `HomepageV25Metric`；`BoundaryInstrument` 同为现有导出。`ContributionDataset` 使用 `mode` 判别 union，不能任意混合当前/历史金额类型；history 不造 opening/closing UF 字段。

`SelectionReceipt` 是**待接线的组资格证明**，不是给 caller 手填账本数据的入口。现有 prepared scope 不含完整 attachments/selectionKey，现有事实也未暴露 episode membership：不能宣称这份 receipt 或细粒度 episode 分类已存在。receipt 应由唯一 source/selection owner 产生并同 source 绑定；覆盖不全不得把省略组当无交易。第 7 节列出其最小裁定/授权。

公共结果 deep readonly + 冻结，金额保持 canonical/F Decimal 全精度字符串；不接受 caller 传 quantity/cost/allocatedFee/nativeNet。`roundId` 建议由完整 identity + 实际 opening anchor + closing anchor + reverse segment 构成；context/source 版本单独留 stamp。不能使用会随查询 knowledge 改变的 `contextId/factId`、episode.status/endedAt 或 updatedAt 作稳定业务 ID。修正实际 opening/closing lineage 可产生新 ID，晚补成本知识但 opening/close 未变必须同一 ID。具体编码须在 RED 中固定，不新建持久化交易对象。

## 4. closed-round 折叠与覆盖规则

|实际 movement|round 判定|金额/覆盖要求|
|---|---|---|
|可信 0→非 0，同向加仓|首次开启一轮；加仓不另开|只保有当前轮 anchors、direction、已有 delta 的累加；无 lot 表|
|部分减仓但未归零|同轮继续，closedCount 不变|累计该轮 gross delta 与 F `realizedFeeDelta`；尚不进入历史四卡|
|可信非 0→0|关闭一次|close 取该实际 movement 的业务时间/证据，不取最后 episode/知识更新时间|
|合法跨零|旧方向关闭一轮，新方向开启一轮|关闭 gross 用 canonical 已匹配部分；旧轮费用 F release+close fee，新轮 fee 留 F open pool；一笔 raw fill 不重复|
|close-only 却超量反向、非法/缺 direction、quantity conflict|不把数学反向当已证明业务关闭|沿 `position-coverage-missing` 等 unknown；不得“修正”为合法 open-short|
|非 execution IPO allocation 真实 cover short|可信 −2→0 关闭既有 short 一轮；−2→−1 不关闭；跨至 +1 开新 long|execution 数不增加；不为 allocation 另造一轮；金额严格照 canonical/F，不重算 IPO 均价|
|execution-backed IPO 被既有 authority 抑制重复|只保留一次 acquisition|IPO 识别只用原 suppression authority；sourceTradeId 不是 disposal link|
|bonus|数量增加仍同轮|保留 canonical 成本变化；不造零成本新 lot/round|
|transfer / reconciliation|完整可信数量周期可结束 inventory round；不代表已实现卖出|缺 basis/处置证据则 net unknown；仅 snapshot 2→0 或存在 position-gap 不能证明 closedCount1。当前 event-only fixture 本身 coverage unknown，不能升级为可信闭合|
|month precision / ambiguous-event-order|保留月精度与不确定性，不能选月末假日|无法证明实际关闭业务日则关闭日期/选中范围/历史 FX 覆盖分别 unknown；月桶的有限推断尚待第 7 节裁定|
|episode conflict|canonical actual close 保留为基础证据；episode mapping fail closed|不能用 endedAt 改年度、选固定首 episode 或静默丢该轮缩小分母；公开 selection 受影响时结果 unknown|

每个 round 的 native gross 是该轮匹配关闭 movements 的 canonical `realizedDelta` 之和；allocated fees 是同轮 F `realizedFeeDelta` 之和；native net 为这两份已知事实相减。只有加总/减已输出 delta，没有 price×quantity、平均成本、fee 池再分配算法。movement 与 allocation 按精确 `movementFactId/contextId` 关联，并保留 `beforeContext.sourceId/selectedExecutionOrder/movementPrefix/evidencePolicy`；不按数组 index zip attached 与普通 prefix。缺/多/冲突关联必须 unknown。

F 的 `incurredFeeFacts` 原日期/金额/knowledge/lineage原样留作对账：不改到 close 日，不拿 periodFees 替代 historical allocatedFees，不重复减 entry pool，不把 IPO refund 本金当负费用。独立缺费用时可保已知 closedCount，不能把 net 或 winner 填 0。

## 5. 历史图、FX、当前贡献和分母

**历史集合。** range 按关闭业务日含首尾选择，先排除真正未来 movement；单年/今年 12 月桶，跨年按真实年份桶。`all` 起点只能来自可证明 source coverage/实际历史，不能取任意 fixture 年份。本次不决定 UI 轴、单位缩写、图形或动画。四模式读同一 `HistoryBucket`：净额、range 起点累计净额、各桶独立胜率、关闭数。胜率总体为总 winners / 总 closed，不能平均桶百分比。

**未知与零。** 完整 source 且无关闭回合：count0、denominator0、fraction null、无 fake trend；卡片的已知金融零与图的 `empty` 区分。已知关闭净额真零仍有真实样本；winner=false 且进分母。已知闭合 4 轮、有 1 轮未知 native net：denominator4，winners.value=null（confirmed 可为1），fraction=null；不能发布 1/3 或假装完整 1/4。若 source/quantity/关闭日不足以证明全集，count.value=null，同时保留 confirmed 下界，不能将未发现组当 0。`unknown` 仅已观察候选数量，`universeComplete=false` 明确还有不可枚举缺口。

**历史 FX。** native winner 使用全精度 `nativeNet > 0`，不依赖 FX，不先归一到分；zero 入分母。每 round 的目标币 gross/fees/net 使用同一 strict close-day FX conversion，按原币精度换算后加总，最后才由 UI 格式化。缺任一所需 pair/知识时钟/来源证据时，相应全量 target total unknown；可见 nativeByCurrency 与 known count/rate 保留。不能发布已知子集金额冒充全量。累计前段可知、遇未知桶后后续累计 unknown，不跨缺口连线；future 既不计分母也不延长最后值。

**当前贡献。** 直接使用现有 periodSummary，不用 `series.current` 的今日市值/今日 UF 替代期间终点；同一 period endpoint FX 下 `net = periodRealized + closingUF − openingUF`。手续费已在 F 的净 R/UF 中扣除，贡献不再减 periodFees。持仓未结束也可贡献；closing qty 仅用于 current local openOnly，不改变 scopeCanonicalTotal。history mode 无 openOnly，也不加当前 UF。无 endpoint summary 不回退前一 known 点。

**分类与局部视图。** 先保留完整 instrument canonical total。纯来源且已证明的 group 可直接归 long/short/ipo；实际混合 IPO+manual 库存无可信 disposal link 时 `category=null`、`provenance-ambiguous`，category totals unknown，canonical total 可以仍为已知。不得强制 category 非空才返回 instrument。当前 seam 分类为 group 级，不足以把混合 group 的每段历史/期间金额细分；禁止按 direction/整证券IPO/比例推定。零仓后不同轮纯来源是否可恢复细分需新增可信细粒度事实，不能在 producer 猜。

局部 category/market/symbol/openOnly/sort/page 属于纯 view 选择，不能改 scope total。建议 view owner 返回明确 `scopeCanonicalTotal/categoryTotal/visibleTotal`，不都叫 total；页大小8沿批准 UI。known 金额在前、unknown 在后；known 相等以完整 identity（再 roundId）稳定 tie。不同目标币/没有共同换算不能跨原币直接排 numeric 大小。UI 不以 null??0 排序。

## 6. 实施后的 RED 向量和精确 oracle（本次均未运行）

须先通过拟公共 interface 写真实 source→producer RED，再实施最小 O01/O02，root 复核接口和 literal 后才扩大；保留 seam 及原 244 条测试断言，不能只测自制聚合 mock。下表复用原 O 编号，不把 seam 的通过误报为 producer 通过。

|向量|producer 必须发布/保留的字面结果|
|---|---|
|O01 累加/partial/final|买1@100费2、买1@200费4后 qty2/openFee6/count0；卖1@180费2后 gross30/realizedFee5/openFee3/count0，历史无 net25 的 closed round；再卖1@190费2后 qty0/gross70/allocated10/net60/count1。period 从两买后开始、opening mark160：openUF14；首次 mark180 closeUF27/current net38；最终 closeUF0/current46；历史60。期间 incurred2/4 与分配5/10独立|
|O02 合法 reverse|买1@100费2→卖2@120费4（explicit open-short）：closed long1，gross20/fee4/net16，新 short pool2；再买1@110费1：closed2，short gross10/fee3/net7，总 gross30/fee7/net23。原 reverse fee4 仅 close2+open2，不变成两整笔。非法 close-only reverse 沿 unknown，不能同 expected|
|O03 late IPO|application−220、IPO fee2、allocation2、两次卖120/130各fee1、晚refund20：Jan18 已证明同一轮 Jan16 close/count1，native net/allocated fee unknown；Jan22同 roundId/close/count1，gross50/fee4/net46；incurred 始终4且IPO费Jan8，refund20不计费。早晚查询顺序/返回 mutation 不改变旧上下文。此处 Jan16 指原 oracle 的 source 上海业务日；precise UTC fixture 的上海换日另按 H03|
|O04 非fill IPO cover|原 short2@120费2，支付现金固定200、IPO费2；allocation1：q−1/gross−80/realizedFee3/nativeRealizedNet−83，尚未关闭，历史count0；allocation2：q0/gross40/fee4/net36，event关闭旧short1轮；allocation3：q1/旧short关闭1、新long开启，gross106.66666666666666667/realizedFee3.3333333333333333333/net103.33333333333333334。raw fills均1，无新增buy；这些literal来自冻结 F 测试，不能把 allocation 数变了仍假定每股100。旧short/IPO category 不强猜，见决策表|
|O05 event-only/gap/month/bonus|现有 opening2→transfer0 fixture raw fills[]、terminal0而 source未知/net未知；不得 count1或0冒充已知全集。另需真实完整可信 transfer 周期 fixture 验证“inventory结束、无sell、结果unknown”。snapshot gap count/date unknown；month ambiguous 不造月末；bonus不另开轮；statement-only费2保 incurred、allocations[]、不造已知净额|
|O06 identity/duplicate/episode|raw buy/sell实际1轮 close2026，而episode open/ended2027：基础close仍2026，episode conflict，相关selection fail closed；不以2027归桶。原reverse跨episode仍一次raw量2/费4。相同ID完全重复只一次；price/fee冲突可保closure count但net/winner未知，quantity冲突count覆盖未知。accountA/B、live/unknown/sim run1/run2不借持仓/IPO/费。future carrier的已知早期证据保留，future knowledge不提前|
|O07 precision/FX/provenance|native +0.004/0/−0.004：closed3/winner1/fraction1/3；±0.000000000001同符号，不能旧8位归零。再加未知net轮：denominator4/fraction未知。两USD轮各10，关闭日FX6/7：目标币四卡/月桶/累计/历史贡献均130；最新9得180、终点7得140均错。任一pair缺：target未知/native USD20/count2仍知。混合IPO/manual无link：O01当前38/46、历史60可知，分类未知，不套trusted18/20/28|
|O08 purity/batching/complexity|新结果money/quantity/unknown逐组件等于同context F；所有调用顺序相等，原输入/返回嵌套mutation无影响，normal A无额外facts。200 movement普通fixture seam实际 evaluations1/transitions200/indexProbes200/feeSteps200/retainedFactBytes0；producer只再线性一次fold/fee索引，不每round/query过滤全部history。actual attached fallback明报，不冒称线性。生产预算/1866×365仍由root正式quiet窗口复跑，本次不跑|

前份 H01–H12 的 producer 补充 oracle：

|编号|必须另覆盖的预期|
|---|---|
|H01/H02|R150/openUF100/close0→current50；cost100/startmark120/sell130/fee0→R30/open20/close0/current10/history30|
|H03|2025-12-31T15:59:59Z→Shanghai2025-12-31；T16:00:00Z→2026-01-01；cards/chart/contribution只归同一个正确年度|
|H04/H08|partial不开closed；reverse一次关旧开新；O01 allocated5/10与period incurred2/4不互换|
|H05/H06|Jan1win/1、Feb1win/9→总体2/10=20%；无closed为count0/rate—；两已闭一未知费仍denominator2，rate未知；真零有样本|
|H07|单年12月；2024–2026真实3年桶；未来灰态不进统计；累计从range起点且不跨unknown|
|H09|native R30/open20/close0、period endpoint FX7→210−140=70；不得把open按旧6换成120而得90。历史仍严格close-day FX|
|H10|回填/撤销/close跨年改变source revision，受影响旧/新桶全部重建；返回stamp绑定新source。晚旧generation能否commit由host/S验，不由producer静默接纳|
|H11|无quotes但完整闭合gross/fee仍history可算；费未知只降net/fee/winner；数量/chronology冲突单独降count；不以quote失败抹已知count|
|H12|pending资格来自真实episode：任一适用pending为yes；全部known无pending为no；缺关联为unknown；completed/deferred不pending；[]与[false,true]无过滤但保UI原状态。producer只收正确组receipt，不自行伪造review状态|

## 7. 不能从批准合同擅定的事项及最小所需授权

|事项|已确定部分 / 缺口|root 决策或 owner 实施范围|
|---|---|---|
|逐关闭日 FX 读取|D3关闭日与pair/known/published/fetched严格门已批准；当前 facts 只有一次asOf的coverage，无rate。不能从 endpoint net 的比值倒推rate，也不能复制 private fxFor|建议 F owner 批读 `readHomepageV25HistoricalFx(source,{asOf,targetCurrency,requests:[{key,businessDate,originalCurrency}]})`，返同source/revisions/policies、每key明确 original→target fullprecision rate、coverage、clock/evidence/observation IDs、conversionId。所有解析复用既有fxFor authority，正常A不调用；需独占F文件授权。精确instant close的知识截止究竟close instant还是该上海业务日结束，D3未明确到这一层；不得自行放宽|
|selection receipt|attachments的完整复合组资格/不裁历史已批准；现有prepared scope不含attachments且不存在该receipt|source/selection owner 确认receipt生成及selectionKey规范、source绑定验证；不能让producer重新实现pending/来源资格或接受任意手填partial groups|
|episode细粒度映射|seam只给group episodeIds/conflict IDs，未给每轮execution→episode membership|确认既有authority输出最小只读关联，及未依赖episode筛选时冲突group的公开统计是否仍须全组fail closed。基础canonical count可保留，但不能把诊断count当已接受发布政策；pending/detail/save必须fail closed|
|分段来源分类|纯group可知；混合无link必须unknown，trusted oracle不授权真实分摊|是否授权F输出每实际round/period的来源coverage；seam现有group级unknown不能由producer缩窄。IPO cover旧short的category、同group归零后不同来源纯轮的分类粒度需明确；净额/数量不因此改公式|
|month-only范围归属|不造日/instant已批准；严格历史FX缺关闭日即unknown|若整月包含于range，能否发布known闭合数但date仅月、是否给月桶count须明确。未裁定前传播date/selection unknown，不假定月末|
|all范围与空source|all来自真实历史，缺历史不是空已批准；当前sourceCoverage按asOf给组级状态|确认完整空scope/事件only组未载入时的universe coverage证明与可用年份边界来源；不得以groups[]证明完整0历史|
|接口文件/政策版本与缓存|本文名字/类型是提案；未增source retained预算|root确定最终两module写范围、固定producerPolicy与FX conversionPolicy。首次实施建议无持久producer cache，不预分配第二64MiB；任何新增retained cache必须另计预算并获授权|

以上是剩余接口/发布政策缺口，不重新打开已裁定的 round累加/partial/reverse、历史分配费、原币胜率、close-day FX 和禁止无link分摊。可先设计/RED这些不依赖缺口的向量；依赖缺口的行为不得静默补全。

### 7.1 关闭日 FX 的两个具体 interface 选项

**选项 A（建议）：F 批量提供明确 original→target rate，producer 仅做 Decimal 乘法与加总。** 签名提案如下，所需 policy 由 root 固定而非 caller 可选：

```ts
readHomepageV25HistoricalFx(
  source: HomepageV25PreparedSource,
  request: Readonly<{
    asOf: string; targetCurrency: string;
    requests: readonly Readonly<{
      key: string; businessDate: string; originalCurrency: string;
    }>[];
  }>
): Readonly<{
  sourceId: FinancialRead["sourceId"]; revisions: FinancialRead["revisions"];
  policies: FinancialRead["policies"]; conversionPolicy: string;
  results: readonly Readonly<{
    key: string; businessDate: string; cutoffCursor: string;
    originalCurrency: string; targetCurrency: string;
    rate: PositionFactValue; // 单位：1 originalCurrency 可换多少 targetCurrency
    coverage: FxCoverage; conversionId: string;
  }>[];
}>;
```

同币种 rate1/not-required 无外部 FX；original/target大小写规范与 CNY pivot、pair正反方向由原 F resolver 决定，不交给 producer。未知 rate 返回null及原始原因。conversionId 绑定source/policy/关闭业务日/cutoff/pair/observation证据，不因四卡或桶用途变化。若 root 选 close instant 截止，则 request 需增加 `closedAt` 并把 instant 加入去重/ID，不能保留仅businessDate key而混用两个cutoff。

**选项 B：F 批量提供已换算槽位，producer 不见 rate。** 相同 source/request stamp，items 增加 `nativeValues: {gross: PositionFactValue; allocatedFees: PositionFactValue; net: PositionFactValue}`，返回每槽target PositionFactValue + 同一conversionId/coverage。输入只能来自已验证canonical/F facts的内部producer调用，UI不能自由传金额。F复用原resolver和乘法；优点是FX数值运算完全留F，代价是F interface与P4三种槽位耦合，返回/验证多3R金额。两种选项择一，不能同时引入两套转换authority。

两者均由 **F 唯一 owner** 在单独明确授权的 F文件及test中实现；本设计不改冻结 seam。基于现有 `fxByDay`，按day/pair先去重、每组候选journal一次解析；实际成本应记 `O(Σday J_day × P_day + D)`（J为该日候选数，P为所需pair数），不能未经证明声称总O(D)。选项A输出O(D)，producer对R个round复用rate；选项B输出O(R)。私有索引仅本次调用，无normal A预建/持久cache；同时保存额外retained0、原A public equality及root原预算复验。所需决定仅是 A/B、精确cutoff、固定policy/version及F独占授权；历史关闭日严格FX政策本身已批准。

## 8. 批处理、cache 和真实复杂度

令 M 为本次选定完整group的canonical movements总数， A 为F allocation facts数， R为closed rounds数， G为组数， B为桶数， D为不同关闭业务日×币种pair请求数。producer每context建一次 `movementFactId→allocation[]` 与证据索引，单次fold O(M+A)，range选择及聚合O(R+B)，输出排序O(G log G)或rows相应规模；FX按D去重批读，禁止R次重放source、B×M过滤或365个独立boundary build。仅在不同实际context需要时读第二组facts，不按chartMode/category/page重复读取。

普通源沿seam现有一次canonical sweep与F prefix sweep，不新增成本引擎。attached当前精确fallback可能在内部对N步重放前缀，保守上限仍可能O(N²)；producer不能用自己O(M+A)掩盖这项实际成本。必须以原source模式、evaluations/transitions/indexProbes/feeSteps及实际分配大小记录；要优化fallback须另授权，不在producer搭车修改ledger/F。

首次实施推荐**零持久producer memo**：索引/facts仅显式P4调用期间持有，返回最终round/bucket/contribution必要证据后释放私有索引，不将整份FinancialRead塞入结果或accepted A cache。当前贡献已存在series bundle只引用必需immutable metric，不克隆完整day series。正常A/series没有P4请求时不收集/持有事实图；现有source memo/retained估算必须逐字节保持既定计量。

这不是新增性能豁免：保留 A 已接受快照、原cold2617ms及旧FAIL、原九样本/阈值/预算和恢复轮次。worker不跑重性能；root给quiet窗口并独立验原budget。设计阶段没有测试通过、性能通过或新增测试数声明。

## 9. 本次冻结依据与剩余门

静态读取时四个seam冻结SHA与此前候选一致：

|文件|SHA256|
|---|---|
|`app/lib/replay/position-ledger.ts`|`37a121bf069e6b726540a6fce99d8d7f499b8c5b9b0139a4ab74562d4f05b270`|
|`app/lib/replay/position-ledger.test.ts`|`5906258436d922a4bd0d507ef4cd450e04a460fa43caaeda379b58ef7d3166c6`|
|`app/lib/reviews/homepage-v25-performance.ts`|`f4091fb3e442cda6e04d8cd3254855bb07adc3a7dbc21c0543ddd3dc70b96889`|
|`app/lib/reviews/homepage-v25-performance.test.ts`|`58e2760efce1c774c50465c87a1624bf65a9cce5665a988152dd2b16e47d4749`|
|`app/lib/reviews/homepage-v25-series.ts`（只读）|`30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6`|
|`ROOT-FINANCIAL-DECISIONS.md`|`5ebe2ff314be1126baec8359390fbf0f810dd6e9f040fa5d0f34a887df28118e`|
|`PRE-DISPATCH-CONTRACT.md`|`1140ad8c6430562f2f6cb6478f1244717ef07ad5215058eda41784dcf095b803`|

禁区保持：**无新lot/FIFO/第二ledger，无未经批准分摊，无原财务公式/unknown门修改，无normal A额外retained图，无UI/host/series/provider/DB实现。** 下一步仅由root独立seam接受、关闭第7节必需事项、另派明确producer文件和TDD顺序后开始；worker不能以本文为隐含写授权。producer RED/GREEN、strict/lint、全量新旧回归、root独立财务接受与最终UI/持久化/视觉接受仍均 **NOT RUN / NOT VERIFIED**。
