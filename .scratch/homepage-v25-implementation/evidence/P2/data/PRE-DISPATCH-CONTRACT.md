# P2 prepared / batch / daily series：派发前数据合同

状态：**方案准备，可供 root 审查；未实施、未跑新测试、未接受 P2。** 日期：2026-10-23，Asia/Shanghai。P1 最小真实旅程及首屏视觉门尚未接受；本文件不授权开始产品实施。此次只新增本文件，不改产品、测试、数据库、UI、服务或既有证据，不再派代理。

## 1. 权威、版本与本次已裁定事项

规范正文为 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`，不是旧票摘要。HP02 191–252 行约束期间三卡、独立当前第四卡、Shanghai 自然日、日曲线及完整日期详情；HP05 349–435 行约束历史与互斥贡献，P4 仍不在本次实施范围。组件手册 `source/component-manual.html` Metric 611–698、ChartTooltip 872–959 行及 `images/period.svg`、`images/chart-hover.svg`、`images/chart-hover--keyboard.svg`、`images/chart-gap.svg` 是后续 UI owner 的直接参考。本文件只确定数据字段及验证 seam，不替代视觉尺寸、键盘/鼠标/触摸或真实旅程验收。

继承但不覆盖以下只读证据：

|材料|当前地位|
|---|---|
|`evidence/resume-2026-10-23/F-data-prep/P2-P4-DATA-PLAN.md`|早期方案；本文件细化 P2 派发接口，并以 root 最新裁定更正旧的费用/FX/性能待定项|
|`evidence/resume-2026-10-23/F-peer-review/P2-P4-DATA-SEAMS.md`|基于旧 F 的 seam 审查；其“尚无 currentUF”等描述不是当前 F3 状态|
|`evidence/resume-2026-10-23/F-data-prep/HISTORICAL-SOURCES.md`|历史来源与旧 session RED 的审计快照；session 缺陷已经原 F 第三轮修复，历史证据保持原样|
|`evidence/resume-2026-10-23/F-fix/acceptance-3.md`|root 原 F 恢复第 3/3 轮 PASS：19 文件 352 测试，定向 tsc/lint exit 0；仅纯财务合同，不能替代 UI 门|

本次读取确认的 SHA256：

```text
F source       e91dce9cdddf83137370ef44647dda260336b03bd49b5082d201352664f762b0
F same test    cbe5cb601126413a11183ff5af265f94f620e9b3acec19cc01144e0f92195cf7
canonical      53ac0845cdec18723e45201d231550158b14d22894fef9374e89ffbc04a7d113
old data plan  a93ed5bef8a8e0835712617057382a22dceb703e11daa985a0bf4edb10277e36
peer seams     520b67296b22a874c876dd77cc4c1fe5f917ddd3642d98c5bcfe85636265a743
F acceptance3  1cb6ff44b6fde302e9e5bc687865e4226c448f7b4df49ee6e4adfb898a4bab37
```

root 已明确的 P2 新合同：

1. 主线是**从所选期间起点至该点**的 `net`；前三卡也是所选期间。tooltip 六行金额依序为**市值、净浮盈、累计已实现、累计净盈亏、期间净盈亏、期间费用**。其中 `lifetimeRealizedNet/lifetimeNet` 是截至该 endpoint 的全源累计，不随所选起点改变；不能重复期间字段冒充累计。全源历史覆盖不足时累计项 unknown+coverage。
2. tooltip 费用标为“期间费用”，是期间**实际发生**且该点可知的费用；不是 `openFees`，也不是 canonical 已知累计 fees 的端点差。实际发生和知识时点分开，详见第 5 节。
3. 历史目标币只用该日有真实来源/知识证据的 FX。只有 latest 时，不能固定汇率回填历史；目标币未知、原币小计保留。
4. 原币先算期间差额，再按**单一 endpoint FX**转换所有该点的组成项。不能各自先按不同日期 FX 转换再相减。
5. 当前 MV、当前净 UF、当前 openFees 在独立真实 `asOf` 投影一次；期间切换不能拿历史期末替代它们。
6. 报价完成时段沿用已接受 F3。P2 **新增 strict daily coverage**：合法休市/未完场 carry 可画；缺应有已完成 session 则保留 fallback 原证据，当日受影响 MV/UF/net 未知并断线。按各证券各市场判断；末点与同 bundle 期间三卡使用一致 gate。原 F3 wrapper 行为及测试不变。
7. prepared handle 独占有界 cache；先做 F 内 exact-context canonical memo / fee checkpoint。1866 个显式 live 原始 fills ×365 天 **cold≤2s、同版本 repeat≤200ms** 是 root 工程验收目标，**不是规范原文、不是已测成绩**。达不到先交测量和最小 canonical 提取设计，未经授权不改共享 ledger。

**裁定更正记录（保留，不改旧证据）：** 本文件上一版 SHA256 `96859232abd91715bba5ce56e4e31cded373fa565911a2df7f3cb084e64d52ad` 的第 1 条沿用了 root 早先“tooltip 累计也从所选起点”的裁定。root 在派发实施前直接重读 HP02:238 及 `images/chart-hover.svg` / `images/atom-charttooltip.svg` 后明确撤换该项：正文要求六行金额，原图累计净额 **35,393** 与期间净额 **18,420** 分别存在，不是同一读数。本版同步 API、六行顺序及 B02/L01 oracle；旧裁定及其版本 hash 留在这里用于追溯，不再指导实施。费用沿 root 已批准的“期间实际发生费用”细化，未改 F3 净额/费用池。

原 F 三轮计数及接受快照不重置。后续独立 P2 范围可登记新批量/series 合同；若发现原 F 已接受合同的真实反例，应报告并按原票规则处理，不通过更名、wrapper 特例或改旧证据隐去。

## 2. 现有权威路径与可复用边界

|路径 / 函数|已有职责|P2 使用方式|
|---|---|---|
|`app/lib/reviews/homepage-v25-performance.ts:121` `collect`|原始 executions、重复/冲突、nature/run/account/market 分组与 scope coverage|只在 prepare 内执行一次；缺 nature 仍 unknown 排除，不能把旧 1866 改成 live|
|同文件 `replay` :179、`beforeStep` :215|精确 source knowledge、canonical 前缀及既有 fee pool 释放/留存|复用原管线及依赖 gate，按完整上下文共享结果；不在 series 重写|
|同文件 `amount` :300、`metric` :319、`evidence` :352|可信 quantity/cost/fees/quote 分离、原币和 FX、证据|新增 batch 仍走同一政策；P2 strict coverage 作为明确新投影策略，不改变旧 wrapper 默认|
|同文件真实入口 :359 / 兼容入口 :363|真实 entries 默认 live、required asOf；兼容 caller-scoped seed / mark|新 prepared 只接真实 entries；兼容 seeds 不纳入 batch，不以 period.end 推断当前|
|`app/lib/replay/position-ledger.ts:83` `replayPositionAtPrice`|唯一 quantity、平均成本、毛实现及 canonical fees 权威|先原样调用并缓存确切输入；不能复制平均成本方程、重放子集当第二账本|
|`app/lib/trades/ipo-cost.ts:77` `resolveIpoAcquisitionCost`|唯一既有 IPO 现金/费用归属校验，返回证据 IDs|沿该次 cursor 可知的事件求值；新 feeFacts 可引用原证据，不改变 acquisition cost 或 F pool|
|`app/lib/market/sync-range.ts:187` `requiredMarketDataRange`|`open:true, now=boundary` 得到最后完成 exchange session|完全复用 F3 选择边界，含 DST/已验证半日；不能另按 Shanghai 标签猜收盘|
|`app/lib/market/calendar.ts:15` `expectedTradingDates`|候选 session 有效性、期望 session、calendar-out-of-range|逐 instrument 做 strict freshness；不能把周末 raw 行变合法，不宣称支持个股停牌判断|
|`app/lib/fx/room-contracts.ts:37` `toRoomFxSnapshot`|生产 pair 键 `USD/CNY`、`HKD/CNY`，保留一个 asOf|当前兼容来源；它丢失 per-pair publication 信息，不足以伪造逐日历史|
|`app/lib/fx/fx-service.ts` `createFxService`，`room-contracts.ts:3`|BOC latest 的 `trading-room.fx` 单 setting 更新|无历史 journal；P2 只消费已提供证据，不能对这个 GET/ensureDaily 发请求补全历史|
|`app/lib/fx/provider.ts` / `storage.ts:15,28`|旧 latest endpoint / `fx.rates.snapshot.v1` 覆盖存储|也不是历史 FX；无可用历史时诚实缺口|
|`app/lib/market/contracts.ts`、`app/lib/storage/sqlite-repositories.ts`、`sqlite-store.ts`|raw daily、provider/fetchedAt、bounded reads、coverage segments|准备已有数据；日线无完整 revision archive，不能声称重建当时 app 已存版本|

`trading-room-history.ts` 的单 FX/episode/cashflow 实现不能作为 F 的替代财务引擎。现 P1 `app/components/homepage-v25/holdings-model.ts:94` 直接消费 F current 净 UF/openFees；P2 的 latest 当前块须与同一 F3 current 口径一致，不再写费用或成本账本。

## 3. 最小模块和拟议 API（均尚不存在）

第一段仅原 F 两文件新增 prepared / batch；第二段新增一个 series 两文件；第三段才由 P2 UI owner 接线。既有入口、输出及默认策略不改。下面定义是派发候选，实施仍须 P1 门及 root 精确授权。

```ts
// app/lib/reviews/homepage-v25-performance.ts
type SourceRevisions = Readonly<{
  trades: string; metadata: string; quotes: string; fx: string;
}>;

type HistoricalFxObservation = Readonly<{
  id: string;
  source: string;
  sourceRevision: string;
  businessDate: string; // 真实 observation 有效业务日，不能用请求日补写
  rates: Readonly<Record<string, string>>; // 生产 pair 键，正数
  status: "complete" | "partial" | "missing";
  publishedAtByPair: Readonly<Record<string, string>>;
  knownAtByPair: Readonly<Record<string, string>>; // 真实抓取/归档知识证据，不可由查询日期生成
  fetchedAt: string;
  evidenceIds: readonly string[];
}>;
type CurrentFxEvidence = Readonly<{
  snapshot: RoomFxSnapshot; // 原生产 pair 格式；当前 valuation 唯一显式输入
  fetchedAt: string | null; // FxState.fetchedAt 原值；不能用本次请求时间补写
  publishedAtByPair: Readonly<Record<string, string>>;
  sourceRevision: string;
  evidenceIds: readonly string[];
}>;
type LifetimeSourceCoverage = Readonly<{
  accountId: string; instrumentId: string;
  nature: "live" | "simulation" | "unknown";
  simulationRunId: string | null;
  state: "complete" | "partial" | "unknown";
  coversInception: boolean; // 必须有源/导入覆盖证据；最早现存 fill 不等于 inception
  through: string | null;
  knownAt: string | null;
  evidenceIds: readonly string[];
  reasons: readonly string[];
}>;

// symbol 和内部存储由 F 私有；不暴露 Decimal、可变 Map、标准化 fills 或 cache。
declare const preparedSourceBrand: unique symbol;
type HomepageV25PreparedSource = Readonly<{
  sourceId: string;
  revisions: SourceRevisions;
  [preparedSourceBrand]: true;
}>;

prepareHomepageV25Source(input: {
  entries: readonly TradeLibraryEntry[];
  scope?: HomepageV25Scope; // 默认 live；simulation 必须显式 run
  instrumentMetadata?: TradingRoomMetadataInput;
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  fxObservations: readonly HistoricalFxObservation[];
  currentFxSnapshot: CurrentFxEvidence | null;
  lifetimeSourceCoverage: readonly LifetimeSourceCoverage[];
  revisions: SourceRevisions;
}): HomepageV25PreparedSource;

projectHomepageV25Boundaries(source: HomepageV25PreparedSource, input: {
  periodStart: string; // Shanghai YYYY-MM-DD，包含该日
  asOf: string; // required，带时区的真实 ISO，规范化为 UTC
  endpoints: readonly { key: string; at: string }[]; // day 或带时区 ISO
  targetCurrency?: string;
}): HomepageV25BoundaryBatch;

// app/lib/reviews/homepage-v25-series.ts（新）
buildHomepageV25Series(source: HomepageV25PreparedSource, input: {
  period: HomepageV25Period;
  asOf: string;
  targetCurrency?: string;
  requestGeneration: string;
}): HomepageV25SeriesBundle;
```

### prepare 的精确责任

- 捕获不可变原始 entries/executions、statement positions/events/coverage、metadata、raw quotes、历史 FX observations、独立 current FX 及全源 lifetime coverage；保留未来 carrier 上合法的早期 evidence。不能只取“当前 active episodes”，未来关闭不能删除过去持仓。lifetime coverage 是带来源的覆盖声明，prepare 校验 identity、范围、时间及证据；冲突/缺失不按完整处理。
- 使用实际原成交 lineage 去重；episode split/相同 settlement 不重复记量或费用。scope 显式包含 nature/run。UI 不能先过滤再把未知 scope 当完整。
- 一次规范化、分组、去重、排序和 quote-date/FX index。输入范围的 raw 日线按引用的 instruments/年份索引，不能每个日点重新扫描所有 154k 日线。
- `revisions` 为调用方变更标识；prepare 同时生成内容 digest 和 `sourceId`，cache 正确性不能仅靠调用方 revision 或 object identity。捕获后 caller 原数组变动不影响已有 handle；新原始证据必须产生新 handle/content digest。
- handle 同时记录 ledger/metadata/quotes/FX 子 digest、F/fee/calendar/coverage/FX policy versions。quote/FX 变化不混用旧 valuation；不同 range/target 共用同一 handle 内库存/fee cache。此最小版本不承诺跨 handle 共享 cache。
- handle cache 由 handle 独占；无应用级无界 Map。初始硬上限：结果 cache 最多 4 个完整 batch/series、所有 memo cache 合计最多 8192 项/64 MiB 估计保留量，任一达到则 LRU 淘汰；原始 source/index 占用另记。丢弃 handle 即可释放全部；淘汰只影响耗时不影响值。实施测量需同时报实际 heap 和估计 cache 字节；这些上限是本方案工程参数，不是设计规范数字。

### batch 输出和边界语义

`HomepageV25BoundaryBatch` 带 `sourceId/revisions/policies/scope/asOf/periodStart`、有序 `points`、独立 `current`、`feeFacts` 和 aggregate-only `diagnostics`。结果均 readonly、Decimal 只序列化为字符串；私有 prepared handle 不进入浏览器持久化或 UI snapshot。

核心输出形状固定如下；同一 metric 名称在 point、group、summary 的定义一致：

```ts
type EndpointMetrics = Readonly<{
  periodRealized: HomepageV25Metric;
  openingUnrealized: HomepageV25Metric;
  closingUnrealized: HomepageV25Metric;
  unrealizedChange: HomepageV25Metric;
  net: HomepageV25Metric;
  lifetimeRealizedNet: HomepageV25Metric;
  lifetimeNet: HomepageV25Metric;
  marketValue: HomepageV25Metric;
  unrealizedNet: HomepageV25Metric;
  openFees: HomepageV25Metric;
  periodFees: HomepageV25Metric;
}>;
type BoundaryEvidence = HomepageV25InstrumentResult["evidence"]["current"];
type QuoteCoverage = Readonly<{
  state: "complete" | "market-closed-carry" | "session-in-progress-carry"
    | "missing-completed-session" | "quote-missing" | "quote-invalid"
    | "unsupported-market" | "calendar-unavailable";
  requiredCompletedSession: string | null;
  selectedDate: string | null;
  missingSessions: readonly string[];
  reasons: readonly string[];
}>;
type FxCoverage = Readonly<{
  state: "not-required" | "complete" | "partial" | "missing";
  businessDate: string;
  observationIds: readonly string[];
  requiredPairs: readonly string[];
  pairKnowledge: Readonly<Record<string, {
    publishedAt: string; knownAt: string; fetchedAt: string; source: string;
  }>>;
  reasons: readonly string[];
}>;
type BoundaryInstrument = EndpointMetrics & Readonly<{
  key: string;
  identity: HomepageV25InstrumentResult["identity"];
  evidence: { opening: BoundaryEvidence; endpoint: BoundaryEvidence };
  quoteCoverage: { opening: QuoteCoverage; endpoint: QuoteCoverage };
  fxCoverage: FxCoverage;
  feeFactIds: readonly string[];
  canonicalKnownFees: HomepageV25Metric; // audit；不是 actual periodFees
  lifetimeCoverage: LifetimeSourceCoverage;
}>;
type HomepageV25BoundaryPoint = EndpointMetrics & Readonly<{
  key: string;
  requestedAt: string;
  businessDate: string;
  effectiveCursor: string | null;
  boundaryPrecision: "day" | "instant";
  state: "value" | "source-missing" | "future";
  plottable: boolean;
  instruments: readonly BoundaryInstrument[];
  quoteCoverage: Readonly<Record<string, { opening: QuoteCoverage; endpoint: QuoteCoverage }>>;
  fxCoverage: FxCoverage;
  lifetimeCoverage: readonly LifetimeSourceCoverage[];
  reasons: readonly string[];
}>;
type CurrentInstrument = Readonly<Pick<HomepageV25InstrumentResult,
  "key" | "identity" | "currentMarketValue" | "currentUnrealized" | "currentOpenFees">> & Readonly<{
  evidence: { current: BoundaryEvidence };
}>;
type CurrentProjection = Readonly<Pick<HomepageV25Performance,
  "currentMarketValue" | "currentUnrealized" | "currentOpenFees">> & Readonly<{
  asOf: string;
  instruments: readonly CurrentInstrument[];
  quoteCoverage: Readonly<Record<string, QuoteCoverage>>;
  fxCoverage: FxCoverage;
}>;
type ProjectionVersions = Readonly<{
  sourceId: string; revisions: SourceRevisions;
  policies: { finance: string; feePool: string; feeFacts: string; calendar: string;
    dailyCoverage: string; fx: string; quoteKnowledgeMode: "retrospective-completed-session" };
  scope: HomepageV25Performance["scope"];
}>;
type HomepageV25BoundaryBatch = ProjectionVersions & Readonly<{
  asOf: string; periodStart: string;
  points: readonly HomepageV25BoundaryPoint[];
  current: CurrentProjection;
  feeFacts: readonly HomepageV25FeeFact[];
  diagnostics: { canonicalCalls: number; distinctCanonicalContexts: number;
    canonicalCacheHits: number; feeSteps: number; feeCheckpointHits: number;
    quoteLookups: number; fxLookups: number; cacheEntries: number;
    cacheEstimatedBytes: number; evictions: number };
}>;
type HomepageV25SeriesBundle = ProjectionVersions & Readonly<{
  requestGeneration: string;
  boundary: { businessTimezone: "Asia/Shanghai"; asOf: string;
    periodStart: string; requestedEnd: string; effectiveEnd: string | null };
  periodSummary: Pick<EndpointMetrics, "periodRealized" | "openingUnrealized"
    | "closingUnrealized" | "unrealizedChange" | "net" | "periodFees">;
  points: readonly HomepageV25BoundaryPoint[];
  current: CurrentProjection;
  feeFacts: readonly HomepageV25FeeFact[];
}>;
```

diagnostics 不含证券/账户/成交明细，不是 UI 正常流程字段；ledger transition 精确计数仅在获得可观察 seam 后增加，不能用调用数冒充 transition 数。

每个 point 至少包含：

|字段|明确含义|
|---|---|
|`key / requestedAt / businessDate / effectiveCursor / boundaryPrecision`|保留请求、实际知识截止及day/instant选择语义；`businessTimezone` 固定 Asia/Shanghai|
|`state: value \| source-missing \| future`、`plottable`|`plottable` 只由该点期间 net 的完整性决定，不能用 0 代未知；其他字段可独立有值|
|`periodRealized / openingUnrealized / closingUnrealized / unrealizedChange / net`|从 `periodStart` 至该 endpoint；均 `HomepageV25Metric`，原币差额后按该 endpoint FX 转换|
|`lifetimeRealizedNet / lifetimeNet / lifetimeCoverage`|截至该点全源累计净实现 / 累计净盈亏，与所选起点独立；全源起始及截至点覆盖不足的依赖 unknown，不拿期间数代替|
|`marketValue / unrealizedNet / openFees`|该 endpoint 的实际状态，不是 current 回填；`unrealizedNet == closingUnrealized`（同 target/coverage）|
|`periodFees`|第 5 节实际发生、该日可知的期间费用；与 pool、canonical fees 名称分开|
|`instruments[]`|account/instrument/nature/run identity；相同各 metric、opening/endpoint evidence、quote/FX coverage、fee fact IDs|
|`quoteCoverage / fxCoverage / reasons`|逐组、逐依赖可解释；全量合计不以可知子集伪装完整|

`current` 至少含现 F 的 `currentMarketValue/currentUnrealized/currentOpenFees/instruments/evidence.current`，使用同一真实 `asOf` 的一次 F3 current 投影。P2 strict daily coverage 只用于 period/points，不暗改既有 current wrapper 的 stale fallback 政策；current 明确输出其 quote coverage 以供查看。range 只变时 current cache key 不变；asOf/源/target 变化才按相应上下文失效。

所有 endpoints 必须 key 唯一、日期有效且不早于 periodStart；错误是一次完整的结构化输入失败，不返回半组数据。按输入顺序返回；相同有效边界不同 key 复用私有结果而不重放。day 边界为当日 `15:59:59.999Z`；opening 为起点前一 Shanghai 日结束。精确 execution 转 Shanghai 后执行截止；date-only/month-only evidence 保持既有真实知识排序，不能把 source day 冒充一个精确成交时刻。保留 F 的 day 与 instant 选择精度：不能把已完成历史day请求简单改成同cursor的ISO请求而改变 date-only fill 选择；statement事件仍按自身canonical知识时刻裁剪。

历史 endpoint 使用自身 cursor；asOf 同日 endpoint 截至较早真实 asOf，完全未来日返回 `future`、金额 null、无未来 replay/quote/FX。当前独立有效，即使选中期间尚未开始。periodStart > requested end、invalid asOf、无 run 的 simulation 等不能生成看似有效数字。

### series 输出和 UI 数据 seam

`HomepageV25SeriesBundle` 输出 `requestGeneration/sourceId/revisions/policies/scope/boundary`、`periodSummary`、按 Shanghai 自然日排列的 `points`、独立 `current`。series 仅枚举日点、组合一次 batch 请求、挑选有效末点并映射稳定展示字段；不写 quantity/cost/grossR/fee pool/FX 方程。

`periodSummary` 含期间 `realized/unrealizedChange/net` 以及审计用 opening/closing UF、periodFees；与有效末点共享同一计算结果及 coverage gate。不是从已转币的日点做差或累加。requestedEnd > asOf 时保留未来灰区 points，但 summary 截止真实 asOf；没有有效历史点则明确 future。latest current 在一次 batch 中独立算出一次，同一 current key 后续期间请求复用。

后续 UI 只消费 `point.net` 画主线。tooltip 日期后严格保留六行，依序读取 `marketValue`、`unrealizedNet`、`lifetimeRealizedNet`、`lifetimeNet`、`net`、`periodFees`，以及各自来源/异常说明；不得把 `periodRealized` 映射为“累计已实现”。鼠标和键盘共用同一 point；“期间费用”不使用盈亏色。UI 不从行级已知金额拼新总额，也不保存业务结果恢复旧账。

## 4. 原币、endpoint FX、行情缺口的计算政策

### 4.1 期间净额与换算

设 opening 为所选起点首日前最后知识边界；`R_b` 为 F 费用净后的累计实现，`U_b` 为 F 当前开放库存对应净浮盈。对每个 group 的原币先计算：

```text
periodR(d)  = R_d - R_opening
UFchange(d) = U_d - U_opening
periodNet(d)= periodR(d) + UFchange(d)
lifetimeRealizedNet(d) = R_d           // 仅当全源 inception→d 覆盖成立
lifetimeNet(d)         = R_d + U_d     // 全源零基准，不减 selected opening
```

沿用 F 费用政策：`R_b = canonicalGrossR_b - canonicalKnownFees_b + openFees_b`；`U_b = canonicalGrossUF_b - openFees_b`。上述仅说明已接受公式，series 不实现其转移过程。任何依赖 unknown 则对应项 unknown；可信 quantity/MV 不因仅 cost/fee unknown 消失，未知成本不伪 0。

同一 endpoint，先在原币做这些差额并聚合，然后用该 endpoint 允许的同一 FX context 对 periodR、openingUF、closingUF、UFchange、net 转换，确保各分项可核对。不能取 opening 在其日期已转换的值再减 endpoint 已转换值。原币净额 10、openingUF20、periodR30；opening FX7、endpoint FX8 时，endpoint net=80、R=240、UFchange=-160；错误的 `240-140=100` 必须 RED。历史 opening 点自己的展示可以用它自己的 FX，但不能把那个转换结果用于之后点的期间差额。

同币不需要 FX。多币目标不完整时 `.value=null/available=false`，保留每个原币已知小计和 coverage；原币已知子集不是完整原币总额。不会将裸 USD/HKD/CNY 数字相加。生产 pair 键及正数/`complete` 要求沿用 F；不能为旧错误 fixture 放宽为裸键或 missing 状态数值。

`lifetimeRealizedNet/lifetimeNet` 使用相同 endpoint 的 canonical/F 净实现和净 UF，先在每组原币计算，再统一用该 endpoint FX；不是分别转换每次历史 realized cashflow 后累加，也不是拿最新 current 代入。source 仅有选中期间、期中 statement opening balance 或有进口缺口时，即使当前 cost/MV 可知，也不能猜此前 realized 为 0。需要各组 `lifetimeSourceCoverage` 可证明 source inception 的真空零基准、截至点的覆盖，且知识证据在 cursor 内；不能从“最早现存成交”反推 inception。缺此证明时累计字段 unknown+分类 coverage，仍可保留有可信 opening 的期间净额与当前市值。group/原币中已知值保留，全量累计不以子集冒充完整。unknown lifetime 不单独使可信 period 主线断线。

跨期硬 oracle：买入成本100，所选期间首日前 mark120，期间卖130全平，fee0；endpoint `lifetimeRealizedNet=30/lifetimeNet=30`，但 `periodRealized=30/openingUF=20/UFchange=-20/net=10`。六行里累计净额30与期间净额10必须同时存在，切换所选起点不改全源累计30；去掉全源覆盖证据时累计两项 unknown，不能复制10。

### 4.2 历史 FX 的选择与真实性

按 endpoint 的 Shanghai businessDate 取真实同业务日 observation，并逐所需 pair 验证 `publishedAt/knownAt<=cursor`、正数、source/id/revision/证据和 complete 状态。pair 间时间不能取全局 max 代替。多 observation 只在各自真实时间内选最新合法完整 context；重复 id 内容冲突须明确未知，不选择首条蒙混。

最小版本没有 FX publication calendar，故不自动跨日 carry；有来源明确有效期的历史 observation 可在后续另批支持，不能由“股市休市”推断 FX 也休市。最新 setting 即使 asOf 较早，也不能重新命名为每天观察值。历史目标币无证据就 null，原币结果继续保留。真实当前可使用其当前真实 latest snapshot，标明实际 asOf；不会为了历史连续把其复制到历史日期。

**当前输入与真实知识时间：** `prepare.currentFxSnapshot` 与 `fxObservations` 分开捕获、分别入 source digest；没有 current 输入时不偷偷取历史数组最后一条或访问 setting/provider。现有 `FxState`（`app/lib/fx/room-contracts.ts:12`）通过 `toRoomFxSnapshot` 产生生产 pair snapshot，同时保留原 `fetchedAt`，将 `publishedAtByCurrency.USD/HKD` 映射为 `USD/CNY`、`HKD/CNY` 的 per-pair publication。该真实 `fetchedAt` 可作为此快照的 **app knownAt**；不能用 global `publishedAt` 代替抓取知识时间，也不能把查询 now 写成 fetchedAt。current 所需各 pair 要求真实 publication、fetchedAt/knownAt 均不晚于 current asOf，正数/complete/source/id 一致；缺证据则 target unknown+原币保留。current latest 可以是较早已公布的真实快照，须展示实际时间，不套用历史“同业务日 observation”限制。

`HistoricalFxObservation.knownAtByPair` 必须由真实历史抓取/归档记录提供。若来源是保留下来的完整 `FxState`，每个所含 pair 的 app knownAt 可用该条原始 `fetchedAt`；per-pair publishedAt 仍用 `publishedAtByCurrency` 原值。latest-only 即使 publication 是过去，也只能证明这一条快照在其真实 fetchedAt 才被 app 知晓；不能据此生成此前每日 observation、回写更早 knownAt 或声称历史完整。没有 fetchedAt/归档知识证据的历史行维持 unknown，不从请求日或股市 calendar 推导。snapshot 的全局 `asOf` 继续原样保留为来源字段，不能替代这两个时钟。

市场 raw OHLC 采用已接受 F3 的完成 session 作为经济可知边界；保存真实 fetchedAt/provider/原始版本。当前存储无完整日线修订档案，P2 数据应标为 `quoteKnowledgeMode: retrospective-completed-session`，不能声称恢复旧 app 当时存储的精确修订版本。FX 则必须有真实 dated observation，不能从 session 规则推演汇率。任何未来要求 `stored-as-known` 的严格修订回放均属缺失来源，需另行批准，不伪造。

### 4.3 P2 strict daily coverage（新于 F3）

先对每个 instrument 的该 cursor 调 `requiredMarketDataRange(...,{market,open:true,now})` 得到 requiredCompletedSession，再检查 candidate 本身 `expectedTradingDates` 有效。不能用所有市场共用一个全局报价日期。

|coverage state|条件 / 结果|
|---|---|
|`complete`|合法 raw candidate 就是 requiredCompletedSession；当前 source market session 已完成，可用于需要报价的金额|
|`market-closed-carry`|source 市场该日合法休市、selected=requiredCompletedSession；价格年龄可大于一天，仍合法，不因为周末误判 stale gap|
|`session-in-progress-carry`|source 当日尚未完成，selected=前一 requiredCompletedSession；可用于该 Shanghai cursor；不能看到未收盘当日 full bar|
|`missing-completed-session`|selected<requiredCompletedSession；保留 fallback date/price/provider、缺失 expected date/range；MV/UF/依赖 net unknown，断线|
|`quote-missing` / `quote-invalid`|无 candidate、价格/币种非法；分类 reason，不能当零或任取 adjusted candle|
|`unsupported-market` / `calendar-unavailable`|市场/时段未被支持或无法确认；unknown，不猜交易日|

stock-specific 停牌、上市前、退市等现 calendar 不能证明。没有额外可信证据时，不把“缺 required quote”宣称为合法休市。raw 周末/节假日行即使 date≤completed 也要拒绝；已接受 F3 的 candidate 检查不可退化。

gate 只阻断**需要该报价且数量可信非零**的依赖：有可信真空仓时 MV/UF 可为 0，不凭空要求一条报价；已实现/实际期间费用在不依赖报价时仍可知。只缺一个证券的报价时，对应 group 的 MV/UF/net unknown，全量依赖合计不能显示已知子集为完整；其他 group/原币小计/quantity/cost/openFees 证据仍保留。开期与期末分别判断；开期 quote missing 同样使依赖 openingUF 的期间 net 未知，不能用末期覆盖开期。

末点 `periodRealized/unrealizedChange/net` 与同 bundle 前三 KPI 共用各自依赖 gate；不能把不依赖 quote 的 realized 也一刀切清空。这里只让真正依赖缺失报价的分项未知，保持原币证据和 coverage。与 F3 金额全等的 oracle 只用于 complete/合法 carry；missing 场景单独验新增 null+reason+来源，F3 wrapper 仍可返回较早 fallback 数值。

## 5. 期间实际费用：发生事实与知识事实分开

旧 plan 将 `cumulativeFeesIncurred` 直接取 canonical fees 的段落由本节取代。canonical 累积 fees 是**账本在本 cursor 已知/纳入的费用量**，名称使用 `canonicalKnownFees`；它仍用于既有 F 净额/fee pool。它不是按实际发生日分配的 `periodFees`，不能通过端点相减冒充。

新增 `feeFacts` 是原始费用证据的只读索引/归属事实，不是新的 quantity/cost ledger，不改变 canonical 或 F pool。batch 仅输出其 asOf 已知事实，历史 point 仅引用其自身 cursor 已知的事实；amount/attribution 未知时保留覆盖占位而不暴露未来确定值。不能把本次 asOf 可知的归属复制到更早 point。拟议精确字段：

```ts
type HomepageV25FeeFact = Readonly<{
  factId: string; // 稳定的真实 source lineage，不用金额相同去重
  accountId: string;
  instrumentId: string | null;
  nature: "live" | "simulation" | "unknown";
  simulationRunId: string | null;
  kind: "execution-fee" | "statement-fee";
  currency: string | null;
  expense: string | null; // 费用正数；经证实 fee credit 可为负，principal refund 不算
  incurred: {
    businessDate: string | null;
    at: string | null;
    precision: "instant" | "day" | "month" | "unknown";
  };
  knowledge: {
    amountKnownAt: string | null;
    attributionKnownAt: string | null;
    availableAt: string | null; // 所需证据均可知的最早真实 boundary
    evidenceIds: readonly string[];
  };
  lineage: { executionIds: readonly string[]; eventIds: readonly string[]; sourceRows: readonly string[] };
  coverage: "complete" | "unknown";
  reasons: readonly string[];
}>;
```

执行规则：

- 原成交 execution fee 只发生一次，在实际成交业务日归属；跨回合 split、partial close、reversal 不制造第二次费用。F 的 closed/open 分摊不是新的 feeFact。
- statement fee 用其真实费用事件日期和 precision，amount/归属分别可知。引用现 resolver 返回的 evidenceIds/现 lineage 校验，不能因 IPO cash/refund 之后才完整就把 fee 的实际日期挪到 allocation、退款或费用释放日。
- 在 endpoint 只看 `availableAt<=cursor` 的事实，并按实际 incurred 区间 `[periodStart, endpoint businessDate]` 求和，再按该 endpoint FX 转换。ISO 当日只计实际已发生且可知者。precision 为月、期间边界无法确定包含关系，或实际日期/币种/归属不足，则有关期间 amount=null+reason；保留范围、事实和原币。整个确切月份被完整包含且范围/知识足以判断时，可明确计入月粒度事实，不捏造某日。
- 未知事实若可能属于已选 account/market/instrument 范围，不能静默丢掉而宣称完整 0；无法归属时保留 scope/fee coverage。已明确不在范围的事实可排除并给理由。
- execution-backed IPO 的 statement event/同一 fill fee 须按可证实 lineage 消重；不能用金额相等猜重复。一个独立 statement fee 只有证明确为额外费用才额外计；有冲突/无链接时 unknown，不自动双记或消除。
- 可信空费用范围才是真 0；missing/unknown fee 不改为 0。未知费用不抹掉可信 quantity/cost/MV，但会阻断依赖费用的净 UF/net。`periodFees` 独立 coverage 可以与 PNL coverage 不同。

### Jan8 / Jan10 / Jan20 必须保留的反例

使用真实 summaries→entries 和已有 statement event 形状：Jan8 application=-220、明确 account/market/symbol/currency 的 IPO fee=-2；Jan10 allocation=2；Jan15 卖1@120，execution fee=1；Jan20 refund=20，完成 cash cost=200。日线用真实有效交易日及该 cursor 最后完成 session，价110；不能继续用旧证据 fixture 的周末 raw bar 作为有效 quote。Jan8/Jan10 date-only 的可知性沿原 `statementEventAt`（UTC 日末）保留，不人为提前到 Shanghai 当日日末。

|查询 / 事实|P2 actual incurred fee 预期|原 F 兼容预期 / 不允许做的事|
|---|---|---|
|Jan18 endpoint，期间 Jan1–18；Jan8 fee 金额/证券归属本就明确、知识已到|费用3：Jan8的2 + Jan15的1；即使 allocation cost 尚未知也可独立核实费用事实|F canonical 目前只纳入 execution fee1，IPO acquisition cost/净额未知；不改 F 将其提前算出|
|Jan22 endpoint，期间 Jan1–22|费用3，新增 refund principal20 不是负费用|F 已知 canonicalFees3，R18、UF9、net27、openFees1（opening真空0）；分项分别断言|
|Jan22 endpoint，期间 Jan12–22|实际期间费用1；Jan8费用2不在期间|不能以 `canonicalKnownFees(Jan22)-canonicalKnownFees(Jan11)=3` 冒充期间费用；原 F 不新增该费用口径|
|Jan8费的证券归属必须待 Jan20 evidence 才可证实的变体|早期该范围费用 unknown；晚期 fact 的 incurred 仍 Jan8、availableAt 为实际证据知识边界；Jan12–22仍不能当新费用计2|晚查询不改变保存的 Jan18结果。不能把“这天才可知”写成“这天新发生”|
|将来源日期/归属去掉的变体|null+分类 reason+覆盖，不返回3或0|不能从 allocation日或 refund日猜 fee date|

该 P2 期间费用读数是新合同。它不重命名、不替换 F3 `currentOpenFees`、费用净 UF、canonical fees 或已实现费用分配；旧 F 金额/reasons/证据回归必须保持。

## 6. 批量实现策略、复杂度与有限提取条件

### 6.1 先在 F 内做的最小工作

1. prepare 复用 `collect`，保留一次标准化原始源和索引。private kernel 接收 prepared group，旧 wrapper 的原行为经同一 kernel 保留；不是新 public builder 套循环。
2. 包装**原样 canonical input**的 exact-context memo；保存真实 snapshot，不 mock 财务。key 包含 source/metadata/policy digest、group identity、可见原始 execution lineage/内容及次序、cursor/precision、当次已知 statement positions/events/cash/coverage、bonus/IPO 抑制上下文。只按 selected ID、fill 数、object identity 或 period key 缓存不正确。
3. F fee checkpoint 包括 movement prefix、canonical knowledge epoch、可信 before quantity、pool/projectedFees、错误 gate。只有所有 canonical/fee 依赖等价时共享；不能把最新 refund 下的 pool 带回早期点。期初、所有 endpoints、current 可复用确切同上下文。
4. quiet day 只重估该日允许的 quote/FX；没有库存/fee 新知识时复用库存 checkpoint。新 cash/refund、statement position/coverage、month-only knowledge、bonus ambiguity、execution-backed allocation 匹配改变时生成新 epoch，对受影响旧前缀保守失效；不把“同 fills”当同状态。
5. 选价先建立 raw 有效 session 日期 index，逐 cursor 找完成时段/二分候选，计算缺 session reason。FX 索引按真实日/pair/knowledge 选择。只对真实候选范围做验证，不每点扫描全 raw 数组。
6. period 原币差额、feeFacts 期间选择、endpoint FX、严格 coverage 在 F 中产出；series 只组装，UI 只读取。完整 batch result 以 source+periodStart+endpoints+asOf+target+policies 做有界缓存。current key 不含期间。

缓存不改知识政策：即使晚查询使 Jan10 allocation 可计算，早查询仍必须未知；晚→早、早→晚及单点/批量顺序结果必须一致。feeFact 可因晚知识变可用，但原发生日期不可变。

### 6.2 不承诺 F-only memo 就能达到目标

现 canonical 每次建/匹配/排序完整 timeline；即使只剩 O(N) 个不同前缀，F-only memo 仍可能有 O(N² log N) 建表工作。D 个日点还可能有 D 个不同 cursor 的最终状态请求。不能把 memo 命中数说成线性 transition 数。

理想稳定 knowledge epoch 的准备为 O((N+E)log(N+E)+QlogQ+XlogX)，库存/fee sweep O(N+E)，查询/估值约 O(D×G×logQ)，其中 E=statement/cash/coverage事件，Q=quotes，X=FX，G=scope内financial groups。K 个会改变旧成本意义的知识 epoch，最坏需要重算各受影响前缀；应报告 `sum(affectedPrefix(epoch))`，不能承诺每个新退款 O(1) 或所有数据永远线性。

若 F-only 未达到 root 目标，停止产品扩展并交实测；条件性最小 seam 为：

```ts
// 仅另获 root 授权后可触及 app/lib/replay/position-ledger.ts
preparePositionLedger(source): OpaqueCanonicalTimeline;
replayPreparedPositionBoundaries(timeline, requests): readonly CanonicalBoundaryResult[];
// 可选 readonly observer facts：真实 transition 前后 quantity/grossR/fees/evidence。
```

在**同一 canonical 文件**提取现有 transition evaluator，原 `replayPositionAtPrice` 也委托它；新 prepared 只复用原 normalized timeline 和同一 evaluator，不复制平均成本/IPO/statement 数学。observer 是同一 transition 的观察，不决定成本、不做另一个 replay。F fee checkpoint 消费 canonical before/after facts，保留原 fee pool 方程。知识 epoch 的可见 events/positions/cash 仍按每个请求 cursor；晚 refund 可改变早 allocation 在晚查询中的成本，故不能只沿时间一次不可逆追加，再把最新状态回填过去。

可能改动仅该 canonical 文件及必要邻域 tests，另行明确授权、TDD 和兼容接受后才行；不先建第二个 `ledger-fast.ts`，不在 F 自己重写成本，也不为节省时间忽略 IPO/statement。

### 6.3 测量合同与已知证据限度

固定 Node `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`，本机、定向配置、无服务/供应商/业务库；未来实施测量保存 config/command/source+test+fixture SHA/raw log。1866×365 指**受控合成、显式 live 的1866原始成交**；原隔离备份是1949条=1784unknown+82simulation+83live，原1866不能改nature来满足规模。

|测量|验收方法 / 状态|
|---|---|
|cold|三次独立新 handle，从已在内存的真实entries/quotes/FX开始，计 prepare+全部365日series+一次current≤2s；另分报 raw fills→summaries→entries、prepare、query、serialization及总wall，不隐去上游源准备。目标只衡量prepared API及查询，不代表DB/HTTP/UI整链；报告最大值与中位数，以三次均满足为准|
|repeat|同 source/政策/范围/target/asOf 查询三次，各≤200ms，返回内容/evidence相等；说明缓存命中与内存。不是只返回一个空承诺或 UI已有对象|
|防365×fullbuilder|公共 fullbuilder 不能按日被调用；记录真正 canonical调用/独特完整context/transition数、sum selected-prefix sizes、fee steps、quote/FX lookups。spy必须call through，不替换finance|
|分布|一个instrument长前缀作为主要worst case；另有固定数量多account/market、晚refund/statement变更变体，数量/事件/报价/FX规模均入manifest。不拿83个多数单fill的组代替1866单组|
|内存/淘汰|source/index与cache分别记bytes/heap/entries/evictions；超过硬上限仍算值正确。重复范围、target及新源版本压力后不存在跨版本泄漏|
|正确性|独立金额oracle + 选取的合法单点F3全输出对照 + 365点逐依赖/边界不变量；不跑365次fullbuilder造性能基线|

历史旧测量仅说明问题：四个结束日的20/100fill探针为151/711次canonical调用，25/105个不同完整输入，sum selected-prefix1470/35350，78.60/582.59ms（旧源）；旧 F 单次83live投影71.99ms/239calls，DBbootstrap1512.24ms、entries472.37ms。其源/分布/quote政策不同，**不能证明F3当前或新batch达到1866×365目标**。本次文档没有新计时、没有DB访问，目标状态为 NOT MEASURED。

## 7. root 独立接受 oracle 清单

下列为未来 dispatch 必须保留的 RED→GREEN 和独立接受项；不是本次已跑测试。每个金额用 Decimal 字符串独立断言，不能只验 `net=R+UFchange` 恒等式。fixture 必须真实 summaries→entries、explicit live/run、合法原始行、真实市场有效日期及生产FX pair格式；源quote边界不得mock。

|ID / 合同|独立输入与必须断言|
|---|---|
|B01 batch与单点|完整/合法carry点分别与F3真实入口比values、original money、coverage、reasons、scope、execution IDs、quantity、costKnown、feesKnown、pool、cursor、quote。允许新metadata字段，不允许悄悄放宽旧wrapper|
|B02跨年|买入成本100，opening mark120，期间以130全平，fee0：periodR30/openUF20/closeUF0/UFchange-20/periodNet10；全源完整时lifetimeR30/lifetimeNet30。六行同时保留累计30与期间10，不能把两者复用|
|B03跨期fee|期前买2@100fee2，opening mark110；期间卖1@120fee3、期末mark115：openingUF18、R16、closeUF14、UFchange-4、net12、periodFees3、openFee1；分别断言，不能只看12|
|B04期内累计|起点空仓；日1买2@100fee2、mark110：MV220/UF18/R0/net18/periodFees2。日2卖1@120fee3、mark115：R16/UF14/net30/periodFees5/openFee1；主线第二点30不是12|
|B05平均成本|同一组买1@100及1@200，卖1@180，余仓mark160，fee0：avg150/R30/UF10/net40；排除FIFO。成本只来自canonical|
|B06reversal/settlement|买1@100fee2，再卖2@120fee4且明确open-short，mark110：grossR20/netR16/shortUF8/openFee2/actualFees6/net24；整单原始settlement和fee只一次，quantity=-1|
|B07IPO费池|原F已覆盖allocation新开/cover short/部分cover/reverse/部分或全部卖/后续自主买卖/execution-backed，保留冻结原测。逐项quantity/canonicalgrossR/canonicalfees/netR/openFee/netUF/net分别核对，不仅总净额|
|B08Jan8/10/20|第5节所有早/晚知识、不同selectedperiod、归属不足变体；`feeFacts.incurred`与`availableAt`独立断言。Jan12–22actualFee1，不是canonical累计差3；早snapshot不被晚查询突变|
|B09未知分离|quantity冲突使MV unknown；unknowncost但qty可信仍可算MV；只有feeunknown时canonicalcostKnown保持true、MV可知而净UF未知；真空仓0、无源、future各异|
|B10lineage/scope|完全同源重复去重，冲突quantity/方向/时间阻断库存依赖；纯fee冲突不伤可信MV。跨episode split/settlement不双算。unknown nature排除、simulation须run、不同run/account不混|
|L01全源累计|B02不同selected起点同endpoint，lifetimeR/net恒30而period随起点变；缺inception/through/knowledge coverage时累计unknown+来源，可信period/MV独立保留。IPO晚refund按各cursor原F证据，累计不得用最新知识回填早point|
|T01Shanghai|UTC跨Shanghai午夜、首日0点、上一日最后1ms、current ISO早于期间末、期初严格首日前。future执行/episode不能改过去方向、futurecarrier可带已知早证据|
|T02source知识|date-only fills与statement，month-only事件、opening/closing statementpositions、cash/coverage的真实cursor分别验证；Shanghai次日但UTC同日的未来证据不能漏入旧日|
|Q01F3原3session|US 2026-10-22T17:30Z只取10/21close110（buy1@100fee2→MV110/netUF8）；CN/HK同日08:30Z取10/22close999（MV999/netUF897）；不是排所有Shanghai同日|
|Q02完成时段|US冬/夏DST、验证半日、HK半日/CN/HK盘前盘后、weekend/holiday、date-onlyEOD，各start/end/current分别检查。未来日线、adjusted、wronginstrument/currency、非法price及周末raw候选拒绝|
|Q03strict缺口|所需completedSession存在且quote等于它→合法carry可画；缺该session仅旧raw→保留旧source但依赖MV/UF/net null/断线，realized/fee独立；开期缺与期末缺分别测，zeroqty不虚构quote依赖|
|Q04混市场/单股缺失|US/HK/CN在同Shanghai cursor有不同requiredSession；仅一个证券缺应有session，保留其他组和原币证据，全量net不得伪完整；calendar未知/unsupported明确原因，不按价格年龄猜停牌|
|X01endpointFX|原币net10/openUF20/R30，opening7、endpoint8→net80/R240/UFchange-160；错算100必须RED。其他point用各自真实FX，不用current回填|
|X02FX覆盖|只latest、部分pair、裸键/0/负/invalid、未来publication/knownAt、pair时间不一致、重复id冲突、缺历史日；targetnull+原币保留。同币无需FX。当前validlatest不反填历史。真实FxState.fetchedAt作appknownAt，publication早但fetch晚的历史point仍unknown；current输入缺失不偷取historical最后一项|
|C01exactcontext|同fill IDs早退款未知/晚已知，晚→早及早→晚相同；quietday新statement/coverage也改变库存，不靠fillcount。无新knowledge的quietday只重估quote/FX，canonical/feecheckpoint可复用|
|C02隔离/失效|prepare后改caller输入/返回数组不能变既有结果；同revision但不同内容必须新digest；metadata/fee/settlement/quote/FX任一变化失效正确层。缓存unknown也须在新源版本后恢复，不永久negativecache|
|C03边界重复/有界|多个key相同endpoint复用但顺序稳定，重复key/invalid输入整体失败；不同range不重算current；LRU淘汰后金额不变，旧handle不读新handle数据|
|S01全年/未来|365个Shanghai自然日，合法休市有明确carry；unknown点断线、不插值、不填0，真实0可画。未来灰区无假点，最后有效点三项与同bundle KPI完全一致|
|S02原子generation|连续切换range/market/account，旧请求迟到/取消/失败保留旧label+三卡+curve+当前期间贡献整体；只新generation成功后一起commit。current/history不被period误改，必须交UI真实旅程接受|
|P01目标/计数|第6.3节cold/repeat/分布/内存/真实callthrough计数与full数据等值；未达目标先交报告/条件seam，不把80fill通过当1866通过|

单点F3对照为相同 periodStart、point 日期作 period.end，且 `asOf` 使用该 point 的真实选择精度：历史day用原day，instant/当日clamp用ISO；FX使用该point真实endpoint来源。独立current另外只在batch.asOf对照一次。不能将所有历史点的F3对照asOf固定到最新而允许未来FX，也不能通过改成ISO使date-only选择悄悄变化。

Root 定向接受应读取原始 configs/logs/版本 hash 并独立运行新合同，不以worker报告代替。需运行的回归为原冻结F财务/IPO/session/unknown/current合同、受影响canonical邻域（仅条件提取时）和新batch/series；不授权全量套件。测试名/数目在实际派发时登记，不能预报本文件“全部通过”。

## 8. 最小分段、owner 与各段交付门

|段|确切文件/owner|实施前置及交付证据|
|---|---|---|
|P2-A prepared/batch|F owner：`app/lib/reviews/homepage-v25-performance.ts`、同名test；新`evidence/P2/data`证据|P1最小真实旅程+首屏视觉通过，root精确授权。先新增API/知识/feeFacts/strictcoverage RED，再有限F-only实现。冻结source/testhash、INTERFACES、原RED/GREEN、完整定向tsc/lint和P01测量。旧F wrapper/历史证据不动|
|P2-A条件canonical|只有F-only不达标，root再决定；`app/lib/replay/position-ledger.ts`及必要邻域test|先测量和提取设计；获授权后同一evaluator/observer、老wrapper全等，不另建成本账。仍保持F3原接受证据与影响追踪|
|P2-B series|P2数据owner：新`app/lib/reviews/homepage-v25-series.ts`、同名test|A独立接受后消费其冻结batch；固定主线/tooltip字段、365点及endpointFX、末点同KPI、current独立、generation序列化合同。数据RED/GREEN/root接受，不能开始P4归因/closedround|
|P2-C UI接线|P2 UI owner，按root登记精确组件/state/provider文件|B数据冻结后，按原HP02/手册/images落实全部状态和键盘鼠标交互；真实服务/隔离DB/返回reload若适用、独立视觉对照与控件审计。数据PASS不等于UI通过；不得在UI内修财务|

P4 的 exclusive long/short/IPO provenance、混合来源部分出售分配、closed rounds/history四模式另待批准政策和派发，不在A/B顺带实现；可以保留source identity/evidence references，但不预生成未经批准归因结果。新 prepared/canonical seam 必须有能力保留 source lineage，不能为本次性能删除未来可核对证据。

当前确定的限制：现存历史FX缺口、quote修订档案缺口、stock-specific休市证据缺口均要在覆盖中暴露；性能尚未测新实现。唯一条件性架构决定是F-only测量后是否授权canonical提取；它不阻止先按本合同准备未来RED。P1 gate之前保持本文件为**只读派发准备**，不宣称任何P2/P4、UI或数据库接受。
