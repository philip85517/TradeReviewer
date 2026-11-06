# 网页功能与数据生命周期独立审查

> 协调者补注：本报告已完成文档范围核验，见[最终验收](../../../.scratch/database-model-review-2026-10-26/FINAL-ACCEPTANCE.md)。下文保留作者提交时的证据边界与未验证项，不因报告接受升级为产品验收通过。

审查结论：现有模型已经承载成交事实、导入来源、行情缓存、复盘草稿/正式稿、设置及审计修订，不能概括为“数据库不完整所以成交丢失”。从数据库到页面的主要薄弱点是：**证据影响范围在选集之前被升为全局未知、全历史/历史汇率的真实提供者尚未接通、可变成交派生回合身份与长期复盘文档的归属规则需要明确、完整首屏 1 秒目标缺少当前版本端到端证据。** 这些问题不能仅靠增加表字段解决。

本报告是第 1 轮静态独立审查，交由 root 独立核验，**不是功能、视觉、持久化旅程或性能验收通过记录**。不恢复财务 P1/F07 或 Bars，不授权实现或模式迁移。

## 1. 依据、版本与限制

- 任务依据：`.scratch/database-model-review-2026-10-26/issues/02-feature.md`；采用 `review-design-logic` 的横向业务图、实际调用链、反例与竞争解释方式。
- 工作目录：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。HEAD 为 `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，工作区有大量既有未提交变更；结论绑定文末文件 SHA-256，**不只绑定 HEAD**。指纹在本报告落盘前计算；若后续源文件有变化，应重核相应结论。
- 当前需求基线：首页 v2.5、交易库 v1.0 当前正文；`CONTEXT.md` 的领域定义及策略原型限定。`target-design.candidate.md` 是候选设计，只用于评估方向，未批准的目标不作为当前缺陷依据。
- `current-state.md` 和既有验收报告只作历史上下文。本轮没有把旧版本的 228 条诊断、15 秒等待或历史失败重新声称为实时复现；“没有原始成交承载某条辅助证据”不等于丢失一条成交。
- 执行内容：只读文件、行号及 git 元数据，唯一产物为本文件。未打开业务 SQLite、未启动服务、未运行测试、未浏览 UI、未写产品代码或追踪文件，未再派 Agent。
- UI 审核标准触发记录：这是数据库模型/业务适配审查，涉及页面静态调用链，**实际控件/视觉验收 NOT APPLICABLE（纯文档范围）**。鼠标、键盘、触屏、真实图表推进、返回/重载持久化、截图对比均 **NOT VERIFIED**；不能据此放行 UI 交付。

## 2. 业务全链路与覆盖表

实际路由 `/`、`/home`、`/trades` 共同装配 `TradeReviewWorkspace`，因此页面差异主要由浏览器宿主、领域投影与读取策略产生，不意味着有独立的服务器页面数据模型。策略是开发环境原型分支（`app/page.tsx:24`、`:28`），不能把策略候选生产数据模型反推为现有功能必须已经具备的表。

|页面功能 / 已确认口径|数据对象 / 当前表|实际写入、读取与派生 / 发布|已确认优点|差距或边界|
|---|---|---|---|---|
|文件/截图导入、月结单重导、补充修订；原始成交不因辅助证据重导被虚增|`import_batches`、`executions`、`instruments`、`trade_revisions`；月结、对账与源证据 JSON|workspace `5343–5380` 补充走 `tradeRepairClient.revise`；普通导入 `5386+` 对账/去重；`/api/storage/trades` → `mergeTradeData`，证券/替换成交/历史同事务|成交 PK/FK、明确冲突、修订请求幂等与 before/expectedScope 对比，保留独立审计记录；DDL 有可空的 `source_fingerprint unique`（schema `:37`），但当前 `putImportHistory:1868` 未写此列，重导去重由应用层执行，不能把该唯一键当作已生效保护|辅助证据可存在于无成交月份；当前读取资格过度依赖 original carrier，影响范围丢失，见 QF01；不能据此宣称成交丢失|
|交易库：账户/市场/性质/日期/标的入参；无匹配≠无交易，缺失≠0；统计分母不随展开变化|事实成交+证券、导入证据、行情、旧 review 与 Recall 摘要；`TradeLibraryEntry` 为派生对象|`getBootstrap` → 原始执行+证据投影 → `buildInstrumentTradeSummaries` → `buildCachedTradeLibraryEntries`；进入 trades 复用 collection-only 读取|集合入口仍要求原子存储 receipt；交易库分支避免额外 FX/行情读取（workspace `2235–2255`）|全量 bootstrap 后在前端选集；有效范围/空态/统计分母是否完全符合批准规格，静态未覆盖到所有选择器，NOT VERIFIED；QF04|
|首页全局账户/市场/附加筛选与币种整组切换，失败保留旧整组|事实 receipt、资格、选集、领域 source/revisions、宿主请求 generation|`homepage-source` 一致读取 → acquisition → `ownHomepageFinancialSource` → `projectHomepageFinancialView` → host 提交（workspace `2287–2304`）|数量+内容摘要绑定；字段级 money availability/reasons；scope/source/revisions 在投影层核对，拒绝把未知作为零|全局 universe 的来源范围没有随选集裁剪，已选择无关市场仍可被压制，QF01；完整宿主竞态 UI 未实测|
|首页当前持仓：始终最新时点，数量、成本、行情、费用分别有资格，持仓市值不冒充总资产|成交/辅助持仓、证券币种、行情 coverage、FX 当前观测；`HomepageHolding` 派生|workspace `2292–2296` 读取一次 canonical financial facts 构建 holdings；期间 reload 复用旧 holdings|当前与期间域分离；HK/HKD、US/USD、全市场 CNY 有显式报告币；value null 保留原因|FX 只采集当前快照；跨币种和过期行情的实际展示与修复旅程未验证；QF01/QF02|
|首页期间表现/贡献：端点估值与期间收益；缺行情/FX 曲线断点，不补零/插值|日线、coverage、币种、FX observations、费用事实、财务 prepared source|acquisition 收集外部输入 → 期间边界/series → immutable view；期间变更不额外改持仓|金额类型带原币/展示币、来源版本、原因；全市场汇总不是把异币金额直接相加|生产 acquisition 的 `fxObservations=[]`，不能仅凭当前 FX 证明过去端点可换算，QF02；财务正确性为暂停域，本轮未重验|
|首页历史已平仓统计、历史贡献、全部起点；真实零/无回合/数据缺失分开|closed episodes、review 状态、`LifetimeSourceCoverage` 与历史范围；目前无独立覆盖提供者接线|workspace history domain seed/fromGlobal 均 `not-wired`，`reloadHistory` 抛错；财务 lifetimeFor 严格要求来源覆盖|空覆盖不会被当成“历史完整”，未用首条成交推断真实账户起点|历史读取明确未接线，lifetime 输入固定空；当前存储事实存在也不足以兑现该页面合同，QF02|
|复盘编辑/保存/完成/返回；草稿不得覆盖正式稿，拆分成交≠决策|`recall_documents` draft/finalized/revision；plans/bundles/actual/manual projections；旧 `reviews`|`/api/storage/recall` → repository 同事务 CAS → 服务端重建当前 episode → validate/finalize → 文档与投影同事务|expectedRevision CAS、正式稿显式 finalize、服务端验证已平仓、retained evidence digest 与来源指标关联，QF03 中也应保留这些优点|episode ID 由可变开仓字段派生；修订后旧文档保留但绑定旧 ID；对“为何保留、如何恢复”的产品规则需明确，QF03|
|回放阶段/行情截止点/成交截止点/未来可见性/视口恢复|Recall snapshot 与 working state 双 cursor、phase、hasSeenFuture、timeframe、viewport；retained bundle 内证据|`readRecallViewSource` 根据 working/history 或 retained 选择权威源；可见成交与可揭示 candles 分别裁剪|snapshot 不是只存 UI 游标；retained actual metric 校验 bundle/documentRevision/evidenceDigest；不以当前名称替换捕获财务身份|普通行情表按唯一键覆盖；工作态/非 retained 读取能否回到相同版本，尚无统一承诺；不能由持有字段宣称真实图表推进与防未来泄露通过，QF05|
|策略创建、研究运行、比较；当前仅已接受桌面 UX 原型|`CreationPrototype` 等 `useState`/合成数据；正式研究 run/dataset 不在当前库|`app/page.tsx` 非 production prototype 分支；`CONTEXT.md:93–97` 明确合成/内存/刷新重置|原型与业务成交库没有被混为实盘；模拟性质/run 字段已有基础|无生产策略表不是当前缺陷。将来生产化需版本化 dataset/策略定义/运行参数/随机性/结果，且先批准范围，QF05 仅就适配能力提醒|
|行情更新/重试/配置、图表设置与重载|`daily_candles`、`market_candles`、coverage、interval_coverage、provider_symbols、jobs、app_settings|`/api/storage/market-data` 有 instrument/interval/range；commit 同事务 candle+coverage；settings key/value upsert|raw/adjustment 区分；provider alias、currency、fetchedAt、intraday knowledgeAt；缺口结构化；行情缓存可局部范围读|最新值缓存不等同历史版本库，QF05；settings 无 expectedRevision，页面乐观更新失败只报错，QF06；重载未验|

已批准页面口径引用：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:32`（金额与范围）、`:233`（逐日真实持仓）、`:241`（缺数据曲线）、`:383`（历史状态）、`:497–501`（最后请求、整组一致、期间/历史/持仓独立）；交易库正文 `:31`、`:63`、`:78`、`:94–96`。这些是要求，不是当前 UI 已通过的证据。

## 3. 优先问题树

### QF01 / P1：局部辅助证据诊断成为全局 unknown，选市场/账户后也不能缩小影响

**结论（代码事实 + 静态可构造反例）**：存储枚举完整、原始成交对象匹配、辅助证据足以支持某项金融结论是三件不同的事。当前实现把无 original carrier、未归属范围、某证券历史不完整等诊断汇入一个没有账户/市场/证券/期间字段的全局 universe。之后虽然选集正确筛出了条目，仍继承所有 universe 原因，压制选中集合的金额与 series。

- 实际调用链：workspace `2239` → `prepareHomepageFinancialAcquisition` → `projectMonthlyHistoryEvidence`；`statement-evidence.ts:625–638` 注册辅助项，`:684–688` 生成全局 gaps/reasons；`financial-acquisition.ts:227–248` 将其合为 raw universe。`financial-source-model.ts:176–189` 先选 eligible groups，仍调用不接收选集的 `universeReasons(raw, asOf)`（`:62–70`）。最终 `financial-view-model.ts:87–98`、`:113–130` 把 currentMarketValue/currentUnrealized/currentOpenFees 设为不可用，series 不构建。
- 最小反例（待隔离验证，非当前库实测）：账户 A 的 US 证券有完整可算成交/日线；账户 B 的 HK 月结单含一条无对应成交的期末辅助持仓，或已知仅属于 HK 的 incompleteInstrument。用户选择 A/US。只要该辅助项进入未附着 inventory，全局 `no-original-carrier/history-incomplete` 仍使 A/US 总量 unknown。
- 竞争解释：若证据完全无法确定所属账户/市场，保守阻断更广范围可能合理；安全拒算优于伪造金额。这里不能直接把所有诊断删掉，也不能把 universe 强改为 complete。问题是**当前原因结构没有表达最小已知影响范围**，使“确实无法界定”和“已知不属于本选集”无法区分。
- 建议：先由已批准规则决定每条辅助证据的 disposition、scope、有效时间、影响维度，再计算所求结论的资格；保留原始证据和诊断，允许独立于真实成交承载。候选 M04/M05 可以承接，但不要求特定新表或立刻迁库。
- 验证门槛：纯 fixture 中并列 A/US 与 B/HK、无成交月份、未归属现金/公司行动、被新月结取代的旧证据；证明选 A 不被 B 已定域风险污染，真正未知范围仍按规则阻断；original carrier 内容/数量验证继续失败即拒收，unknown 不变零。

### QF02 / P1：有成交/行情表不代表首页历史与历史币种数据链已经接通

**结论（当前代码事实）**：`financial-acquisition.ts:171` 明确令 `fxObservations` 与 `lifetimeSourceCoverage` 固定为空。外层 complete 只补 universe，不补这两项。workspace `2286`、`:2297` 的历史域仍为 `not-wired`，`:2304` 抛出“历史财务读取尚未接线”。这是已批准历史页面能力的真实供数缺口，不是待批准策略生产功能的缺口。

- 实际调用者：workspace `2266–2268` 生产 acquisition；`:2290–2296` 将 raw 送财务 source/view/facts。`homepage-v25-performance.ts:938–942` 的 lifetimeFor 正确要求账户+证券+性质+run 的唯一本源覆盖、起点、through、knownAt 和 evidence；`:1014` 在不完整时返回 null。`financial-source-model.ts:180–190` 将同一覆盖用于 all bounds/历史范围。
- 最小反例：只有一笔一买一卖、费用和价全齐的实盘数据；即使用户另外确知其账户全部历史，当前正式 acquisition 没有能提交该已证实覆盖的提供者，所以 lifetime-source-incomplete 仍保留。跨币种历史端点即使今天取得当前 FX，也不能证明历史端点汇率和当时可知性；不能用当前快照补充。
- 竞争解释：当前暂停财务任务，明确 unavailable 是正确的暂存状态；少导历史本来就不能算全部。不能据空数组宣称期间所有本币指标均失败，也不能声称数据库没有任何 FX 机制。问题是**真实历史证据→领域输入→历史域发布链尚未实现**。
- 建议：在恢复授权前仅记录阻塞；恢复时先批准如何证明 inception/through、历史汇率业务日与发布时间/取得时间、未知覆盖恢复方式，再确定保存在证据表、版本对象还是既有结构中。不得以首条成交、当前时钟、空输入或当前 FX 自动证明全历史。
- 验证门槛：隔离库真实导入→完整覆盖证据→历史域读取→账户/年份切换→返回→刷新；本币与跨币种分别检查，真实零、无回合、缺历史、缺 FX、未来区和失败保持不同状态。财务 P1/F07、Bars 的既有失败/轮数保留，本报告不恢复该工作。

### QF03 / P2：成交修订后回合身份变化是有意保留旧文档的边界，长期归属规则仍需决定

**结论（事实明确，业务缺口待确认）**：`episodes.ts:87–102` 的开仓键包含 scope、成交时间、方向、数量和价格，`:120` 形成持久化 episode ID；`recall_documents` 以 episode_id 为 PK（schema `:193–198`），而成交修订保持 execution.id、允许更改上述字段。两者不是稳定的同一身份。

- 实际调用者：workspace 数据检查 `6712` 的 onRevise → `reviseCurrentTrades:5059` → `trade-repair-client.ts:14–15` → `/api/storage/trade-revisions:14` → `sqlite-store.ts:1323–1364` 审计修订。`applyCorrectedExecutions:5055–5056` 已检测旧回合消失并提示“原笔记和绘图已保留”。Recall 保存 repository `117–120` 则按当前成交重建回合，旧 ID 不再在当前集合时会 not-found（需要权威 episode 的保存分支）。
- 最小反例：对已完成复盘的首笔买入仅修正成交价；原 execution ID 不变，旧 Recall 行仍存在，当前 episode ID 变更。新列表的 pending-review/完成摘要如何对待旧正式稿，是否允许对旧证据继续编辑、显式迁移或仅查阅，应有确定规则。
- 竞争解释：自动将旧判断附到不同财务事实可能更危险；保留旧证据且提示重新选择具有合理性。当前已经保护旧数据，**本报告不称其丢失、损坏或必然应自动重连**。数据检查可能已提供人工核对入口，本轮没有进行 UI 旅程。
- 建议：明确原始成交 identity、事实 revision、由其派生的 round incarnation、复盘引用版本四者；若批准稳定回合 ID/显式 supersedes/人工迁移，应让旧正式证据仍绑定原版本，避免为追求新列表“已复盘”而改写历史。
- 验证门槛：修正开仓价/数量/时间、插入更早成交、重导替换、拆分/合并回合、TV canonical simulation；在隔离库验证旧稿可追查，新回合状态准确，首页摘要不重复且不误标完成，reload 后一致。

### QF04 / P1 验证缺口：范围查询接口有基础，但完整首屏 1 秒尚无当前证据

**结论（查询成本事实，时延 NOT VERIFIED）**：`getBootstrap:1024–1036` 无 scope 参数，`getExecutions:1091–1093` 全表读取并排序，`getImportHistory:1096–1110` 全量历史/修订投影。首页先全量事实与 Recall snapshot，再对所有 summaries 并行读日线（workspace `2238–2268`），最后才在 source 层按选择筛选。

- 精确范围：**不是无界读取全部本地行情**。`marketRanges:539–555` 按每证券 statementReplayBounds→requiredMarketDataRange，`readInstrumentMarketState:587–595` 传入该日期范围；`market-data/route.ts:43` 与 store `1175+` 支持 instrument/date 范围。当前成本主要随全部证券数量、各自所需回放日线范围、完整文档/证据体积增长，而非只随屏幕当前选集增长。交易库 collectionOnly 已避开额外 FX/行情，是有效优化。
- 最小压力反例：用户只看一只 A 股但存储有许多其他市场、多年成交与大 Recall JSON；所有 summaries 日线/证据仍参与本次首页采集。SQLite 索引存在不证明网络序列化、JSON 解析、领域重算与最终绘制能在 1 秒内完成。
- 竞争解释：整库原子读取简化一致性，并可对小规模个人数据很快；服务端缓存、浏览器缓存及 prepared source 可能足够。**本轮不报告超时、不引用历史 15 秒作为当前实测，更不把 15 秒恢复阈值降格为性能目标**。
- 建议：先测“本地数据齐全的完整首屏 ≤1 秒”的完整链路，再按结果设计查询/输入规划；原子快照 receipt 要继续绑定选集与版本，不能为快先发布列表然后长期缺完整金额。候选 M03/M05/M08 的切分可行但不是性能证明。
- 验证门槛：明确硬件、Node/SQLite版本、数据库规模、冷暖缓存、网络和完整首屏定义；隔离副本测 SQL/序列化/传输/浏览器 parse/计算/commit/render 的总时延与分项，至少覆盖全市场、单账户、单证券、首次和返回重读。目标按已确认 1 秒验收，不在本轮虚构分位数或放宽口径。

### QF05 / 设计适配边界：最新行情缓存与可重现历史版本是两种承诺

**结论（存储事实 + 将来设计建议）**：`daily_candles` 主键为证券/交易日/adjustment，`market_candles` 增加 interval/timestamp；`sqlite-store.ts:1999–2008`、`:2033–2043` 冲突时覆盖价格、provider、fetchedAt/knowledgeAt。GET 按 instrument/interval/date 读，不接受数据集 revision/知识截止点。当前数据适合“最新本地缓存”，不自动提供历史版本重放。

- 已确认保护：Recall snapshot/working state 保留 phase、market cursor、executionCursor、hasSeenFuture、viewport（`recall/types.ts:30–57`）。`readRecallViewSource:48–70` 优先 retained bundle，核验 documentRevision/evidenceDigest、按双截止点裁剪执行和 candles。这比只按当前行情重新推导正式截图稳健。
- 最小版本反例：同证券同日原价100后被 provider 修正为101。最新缓存只保留101；已经捕获并保留 candles 的 Recall 可继续用100的证据，但某个未固定数据集版本的工作回放/未来研究 run 若重新读缓存，则不能只凭同一个 instrument/date 声称复现100。
- 竞争解释：现行回放要求防未来信息与真实逐根揭示，不必然要求数据库保存所有历史 provider 修订；正式 Recall 已自携证据，可能满足其范围。策略当前被明确批准为内存 UX 原型，所以没有生产 dataset/run 表**不是当前缺陷**。本条不恢复 Bars，也不证明已有回放泄露未来。
- 建议：产品先区分“最新数据回放”和“绑定版本的研究/证据复现”，确定 provider发布时间、取得时间、知识时间与市场时间的规则，再评估版本化数据集/不可变观测/retained reference。不得把 fetchedAt 当成历史可知时点，也不得仅新增 revision 字段就宣称数据版本可恢复。
- 验证门槛：真实图表最小旅程逐根推进，确认目标 bar/trade 可见；对同日修订、未收盘 bar、阶段切换、回到旧快照分别验 market/execution cutoffs、future marker 与 viewport。纯静态本轮均 NOT VERIFIED。

### QF06 / P2 潜在竞态：设置写入没有文档 revision，乐观状态与持久化状态需要明确一致规则

**结论（代码事实，竞态未复现）**：`sqlite-store.ts:1427–1430` 事务内逐 key 写 app_settings，无 expectedRevision。workspace 图表 settings 回调 `6503–6507`、`:6610–6614` 先 setSettings，再异步 PUT；失败只显示保存错误。与 Recall CAS 的一致性级别不同。

- 最小反例：两个标签页从同一设置开始，各修改不同选项并提交完整 next 对象；较晚写入的旧值可覆盖另一个标签页刚保存的值。或快速连续设置请求次序逆转，刷新后读取的最终值与刚才 UI 所示不同。
- 竞争解释：单用户单标签页、允许 last-write-wins 的偏好项可以接受；每 key 事务也避免单次半写。未实测请求体是否包含全部 key、用户是否要求跨标签协作，因此不是已确认丢设置事件。
- 建议：按设置域明确 patch 或替换、请求串行或最新请求规则、失败后旧值/未保存标记、是否需要 revision；不应为普通偏好无条件引入完整事件存储。
- 验证门槛：隔离库快速改两项并故意重排响应、写失败后返回/刷新、双标签互改；确认实际持久化结果与界面保存状态一致，且未覆盖无关 FX/provider 等设置键。

## 4. 对候选设计的适配意见与验收状态

候选稿将事实写入、原子读取、证据资格、查询选集、行情/金额、页面发布区分开，方向能对应当前跨文件职责：`mergeTradeData/reviseTrades`、`readHomepageStoredCollection`、`projectMonthlyHistoryEvidence/acquisition`、`ownHomepageFinancialSource`、财务 prepared source、homepage host。但应避免把这些层各加一张“结果表”就视作解决。最关键的契约是：输入事实与版本、资格的受影响范围、所求结论/期间、输出的 provenance，以及哪些未知允许局部降级。

|审查门槛|状态|本轮依据 / 后续要求|
|---|---|---|
|主要页面功能→当前表/对象→实际调用链覆盖|PASS（静态审查范围）|第2节覆盖表及 QF01–06；不是每个控件的实现验收|
|未知与零/来源资格/跨币种规则|PARTIAL|当前领域类型与拒算有保护；QF01范围与QF02提供者仍阻塞完整业务能力|
|身份/版本/修订完整性|PARTIAL|导入、修订及Recall事务/CAS有保护；回合归属与缓存版本承诺待决定|
|导入→页面→复盘保存→返回→reload持久化|NOT VERIFIED|未连库、未运行服务；后续必须隔离数据库，不可用回调成功替代|
|未来信息与真实图表推进|NOT VERIFIED|仅确认双截止点和retained校验代码存在|
|完整首屏 ≤1秒|NOT VERIFIED|本轮无性能采样，QF04定义验证范围|
|UI视觉/控件/鼠标/键盘/触屏|NOT APPLICABLE / NOT VERIFIED|纯文档审查不承担UI交付；一旦进行UI交付须按项目标准另做全旅程独立验收|
|策略生产持久化|NOT APPLICABLE|已接受范围为合成内存原型；未来生产化需另批|
|当前报告独立验收|PENDING ROOT|本报告作者未实现被审查UI；root需核验源码/指纹/结论，不因子审查通过宣布功能完成|

建议 root 优先就 QF01 证据作用域与 QF02 覆盖提供者形成设计决策；QF03/QF05 明确产品承诺再选身份/版本结构；QF04先补当前性能证据。上述建议均不构成实施授权，也不改变暂停任务状态。

## 5. 本轮读取文件指纹

采集时间：2026-10-25T17:19:44.187453+00:00。SHA-256 直接对工作树实际字节计算，未读取数据库内容。完整文件指纹用于重核；本报告的行号可能随既有并行变更漂移。

|实际读取文件|SHA-256|
|---|---|
|`AGENTS.md`|`0decd31562077f3a696a2b1d6bc072d023962e27eff6fa1e23000c4c25fa3c6f`|
|`CONTEXT.md`|`569d300b8d4892df6d6c545232eabf16ccb346ff82922c3e38561a195f8f670d`|
|`docs/agents/development-workflow.md`|`43203bdb9915e28c18b479585e1b2ade058aefa8e67dd2f902e64f29eff94146`|
|`docs/agents/frontend-control-audit.md`|`ff09338e1e4605cec2682076ec1f5ceedcb56fd2fd1dcbcc96b91ab3f40e9777`|
|`docs/agents/task-decomposition.md`|`f0180fca7dbdd18b930bf442a04014e4cff392d2896de3526b87743e02c7cf92`|
|`docs/agents/issue-tracker.md`|`f63b9d2619dfbff376c70253cefdd62dfc9a74f14f8e26b30da1ffc9dd8b57e2`|
|`.scratch/database-model-review-2026-10-26/issues/02-feature.md`|`7f69fc410d61189b644e9f720d4ab82722460291e6a0d0d2ff61168485e61a74`|
|`docs/backend-design/current-state.md`|`3389492fcd029c6e370462de646c582f9e3fff5d7813241210d619d90e768d3f`|
|`docs/backend-design/target-design.candidate.md`|`c1e38c52949dc05e86570f9cc67378eec25054f70eb1a6052267fcfe5f224897`|
|`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`|`daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`|
|`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md`|`377f37b2ead444326dcca760628e8aa51ebb9507537ebe5604e78581ef7564fa`|
|`docs/specs/2026-09-29-strategy-portfolio-backtesting.md`|`d4ac1e678337799a9798381a84659e9a8c81feae082a0e8dd068512c86a1aa5d`|
|`app/page.tsx`|`76de4eb447c1ef8fa19620e4176a767a567544f8bca83b94c7e27a6eb11afed5`|
|`app/home/page.tsx`|`30cf179d48257d0ac48d3f92f6866907022b17caec6614e5019f8c52f30a1a7c`|
|`app/trades/page.tsx`|`23947c67b07fe1ef541081c3382edf815431e2066a864c6be31581b2a1743a9d`|
|`db/sqlite-schema.ts`|`55c3f10bfbb097155acf4963fae9d3e1eeb92f062cae415ff3ea5d2989b4e7e5`|
|`app/lib/storage/sqlite-contracts.ts`|`bba026e9394f958e30f31d3e28aa2211ea435a84446db547d1eaf0a32edd4635`|
|`app/lib/storage/sqlite-store.ts`|`95249464037d0a44a04c35175fa069ba6ac27c614ef561c558fc50f80712d948`|
|`app/lib/storage/sqlite-http-client.ts`|`9df447e07dcc05f0a625debdaccc1bad711d8d037203220deae8a06e4403a5e9`|
|`app/lib/storage/homepage-source-snapshot.ts`|`96bd3fa1e782e46ef7a8792248a0063e8fba331693b1ecc81780eaf98658e183`|
|`app/lib/storage/market-data-repository.ts`|`48bad91a42e928bdb3e2c03d3f571b25ec3ea16e79318862cec3ef111b405deb`|
|`app/lib/storage/trade-repair-client.ts`|`8f23e562467ae78386676c3b26f580aca5cc6786ec6ce8e571233396069898b0`|
|`app/api/storage/homepage-source/route.ts`|`e10db039109fa682f2bdfc700958ebe0408c408309806302d62e5fe370fab932`|
|`app/api/storage/market-data/route.ts`|`b5402a1cb2d915f56991039d36ac44be6930c64d19b9e8eb6ebcc1e7cba24969`|
|`app/api/storage/trades/route.ts`|`9b65fec2067ae0dfd7b486a33ace58dc1a7570ecab3387ef9c5d65e32a98c8db`|
|`app/api/storage/trade-revisions/route.ts`|`70fbe076ec0a28dfa6a0fa4b0b310a7d08957dd31256ae36da3c2e1bc9594a07`|
|`app/api/storage/recall/route.ts`|`099d849934a9531324158268c58dd4fd77bf087b2c01c8fd3d9805f60ce82b5f`|
|`app/components/trade-review-workspace.tsx`|`b9c7e37d68269d49276b2e529bb0c0d435ebc47e07a073d91ecc614c4c60a11b`|
|`app/components/homepage-v25/financial-acquisition.ts`|`2dd467cf06625d68fd0c02b4abca472b94f70d9b3baee2bf46108208c3a7f73a`|
|`app/components/homepage-v25/financial-source-model.ts`|`e7dcd33a5d856f13274d0157355fe1c1472e889eaa77c69f6b76f7ed6702ec05`|
|`app/components/homepage-v25/financial-view-model.ts`|`9202b4942ee68ed981a17e8c85b93222853f257a1879e4ff9cfacbe4ff98f72c`|
|`app/components/homepage-v25/home-surface.tsx`|`f8bb96a3348b1a1e2ea37af1021573aaa2b47d77637d8d996f9e76fd6bb18d82`|
|`app/lib/import/statement-evidence.ts`|`0a37316553c5c43bc3edf8bb193ca047fec8b3b59e0f67c7c3ffe21e8f497755`|
|`app/lib/trades/episodes.ts`|`5a9689c07807e23b00ba70ba32974edc86d3b8f5791ebb6870618676f8b7bbeb`|
|`app/lib/recall/server-repository.ts`|`bfd9cdf1a417d82bb7750199295e6c9d0ae4fae6528b67c2529b217ca776446b`|
|`app/lib/recall/view-source.ts`|`8c6cff35bc33dc95a08e036d429558a6ecf596247749b2e35dc0f987c5c93681`|
|`app/lib/recall/types.ts`|`e2be4ac79b53cc2544adf737198a70b9c4bbcb2b639644ac13d02e8ab292f3e8`|
|`app/lib/reviews/homepage-v25-performance.ts`|`7d6b2c7617d97b4fedf26bf6bd2d8df63d7a56078dad3ddc4c5b12ff45b8cfb1`|
|`app/lib/fx/storage.ts`|`91086f7b770439d86e76c379165a2d5371adaee26da88b1bd6a8570133429dc8`|
|`app/components/strategy-prototype/creation-prototype.tsx`|`e5457bd178bbe17f212249f3523fd77cca8f849321e8c1db376a217778ad56a6`|
