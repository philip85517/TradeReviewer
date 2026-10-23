# V2.5 集成诊断：P1 实际入口与状态边界

状态：**diagnosis-ready；未实施 UI，未进行产品验收**。诊断者 `/root/integration_g61`，GPT-6.1-sol / ultra。基线 `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；静态源指纹见 [source-fingerprint.json](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/source-fingerprint.json)，捕获时间 2026-10-23 00:22 CST。

## 1. 结论与证据范围

P1 不是给旧持仓表加一层弹窗。现有产品只有 `/` 下的单一 Workspace；首页、交易库和复盘靠内存 `activeView` 切换。批准的 `/home`、`/trades`、持仓详情→普通交易库、成交日期包含未平仓、完整来源快照、刷新重建都尚未接通。S 通过之后，必须由**同一 UI owner**负责新首页、路由适配、Workspace 导航、普通库范围与来源恢复这一条纵向旅程。独立 F/S 的职责保持为财务事实投影、纯状态合同；root 负责集成数据流、实际持久化与整页视觉独立接受。

本诊断应用 systematic-debugging，并完整读取 AGENTS、项目 development-workflow、task-decomposition、frontend-control-audit、ui-task-templates、issue-tracker；读取批准 V2.5 正文 668 行、当前 component-manual 1138 行、A interfaces/P1 计划、55 项设计矩阵与 96 公共状态清单、F/S 历史三轮接受记录与当前模块，以及下文列出的真实代码。使用本地 sharp 将批准 SVG 栅格化后直接看图；未以票据摘要代替规格或参考图。

前端检查触发依据：用户要求页面恢复开发前的布局、交互、导航与数据状态集成诊断。当前范围为静态集成调查与派工准备；不宣称整页控件覆盖。功能、实际端到端、持久化、浏览器 URL 行为、实时数据、视觉还原均 **NOT VERIFIED**。本次没有启动/停止服务、访问 API、打开数据库、改变业务数据、运行浏览器写入、提交或推送。root 告知的既有 3333 服务不构成本代理的运行验证。已有历史 PASS/FAIL 保留，当前文档不是新一轮交付验收。

## 2. 批准设计与直接看图结论

权威正文：[V2.5 source](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:1)；控件状态：[当前 manual](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html:1)。普通库目的地另外受 [交易库 V1.0 正文](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:23) BT03–BT06 约束。没有授权视觉或交互偏差。

已实际查看以下本地栅格化原稿：[1440 首页](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/home-1440.png)、[1280 首页](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/home-1280.png)、[C 1440 常规](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/holding-option-C-normal-1440.png)、[C 1440 极值](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/holding-option-C-large-1440.png)、[C 1280 常规](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/holding-option-C-normal-1280.png)、[C 1280 极值](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/visual-readback/holding-option-C-large-1280.png)、detail、holding-return--detail、holding-return--after、handoff、account。同目录保存这些像素；来源均为批准包 source/images。另看过已有旧实现 baseline-1440.png，差异明显，但历史截图不是当前浏览器证据。

看图和正文共同确定的 P1 不变量：

- CSS 视口 1440×1000、1280×800，100% 缩放；72 导航、64 页头、左右24、模块24、内部16。全页原稿高2346，不可把整张图缩至一屏来假装密度一致。保留“当前表现→当前持仓→历史已平仓→底部唯一贡献区”的顺序和信息层级。
- 持仓标题48、表头40、行48、页脚48，**8 固定槽**。C 汇总与标题同顶边，右侧保留局部搜索/导出，不能挤进表头/行；25/8/10/11/11/15/14/6% 列宽按内宽扣左右16计算。正文14/20、表头12/16、标题18/24；命中区36。极值或长名不得撑高行。
- 0 条没有假“第1/1页”和可操作箭头；1–8 条单页箭头禁用；9 条末页1条仍8槽。缺成本“暂无”、缺最新价“待更新”；数量保留真实精度与负号，不用科学计数。明细、复制、导出保留完整金额。
- 行末唯一动作可访问名称“查看持仓详情”；持仓详情唯一前行动作“查看交易”；关闭回原行，原对象消失回持仓标题。普通入口不带 queue，不是复盘直达。
- 所有市场/账户都属于首页的实盘身份。全市场/A股 CNY、港股 HKD、美股 USD；切换必须数据与标签原子一致。
- 全页首屏视觉接受不是 P2–P4 的开发通行证替代品。P1 首次切片只验收已实现旅程及其真实页面；后续区域未实施保持 NOT VERIFIED，不以假数字或无响应控制表示完成。

正文与历史图稿/准备文档出现措辞差异时按当前明确正文执行。例如账户的当前固定176×36不能被 A 的旧“min120”引用降低；附录二 URL 参数名是 `symbol`，值是 `symbolIdentity`，不是任意 instrumentId；旧图内说明框/演示前缀不是产品元素。manual Tooltip 的 loading 为信息提示，不应凭旧状态行另加独立转圈；应由 root 同步清单说明，保留85 applicable/11 NA 的分母，不将 NA 改 PASS。

## 3. 真实数据入口到 UI/持久化边界

|阶段|准确代码入口|现状与 P1 接缝|
|---|---|---|
|页面入口|[app/page.tsx](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/page.tsx:14)、[app/layout.tsx](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/layout.tsx:64)、[next.config.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/next.config.ts:1)|`Home` 只处理开发 prototype 参数后直接渲染 Workspace。没有 home/trades page、rewrite 或已接通的 route adapter。静态缺失不能冒充浏览器404实测。|
|存储客户端|[sqlite-http-client.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-http-client.ts:139)|`createSqliteHttpClient`；`getBootstrap`159读取 `/api/storage/bootstrap`、no-store；metadata160、migrate162、mergeExecutions163、putReview164、reviewState165。P1 URL 不能先于 bootstrap 的已知账户/别名就绪判未知账户。|
|服务与 DB|[bootstrap GET](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/api/storage/bootstrap/route.ts:1)、[reviews route](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/api/storage/reviews/route.ts:1)、[sqlite-store.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-store.ts:1019)、[db/sqlite.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/db/sqlite.ts:88)|`getBootstrap`、`putReview`1354、`putReviewInTransaction`1875、review state事务。`openSqliteDatabase`会初始化/迁移/WAL，即便 GET 也不能在本诊断随意访问。UI快照应为客户端 UI 状态，不能写成业务库行缓存。|
|Workspace bootstrap|[trade-review-workspace.tsx](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:2503)|2503–2714 effect：取 bootstrap；旧浏览器迁移如需会写后再取；过滤 demo、应用历史证据、账户别名恢复、构造 summaries、合并 reviews、2615设置 executions、2690 ready。返回首页当前没有专门重新读取闭环。|
|元数据/行情|[Workspace](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:2715)|2715 metadata queue、2720–2734 hydrate/read/progress；2839–2960市场 hydrate，`readInstrumentMarketState`545，经 repository+scheduler，AbortController/runId保护每个行情请求。新首页仍需自己的完整 scope+generation 批次提交，不能把逐证券到达当整页提交。|
|实盘原始视图|[Workspace](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:1845)、[trade-library-entry-cache.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/trade-library-entry-cache.ts:47)|`buildCachedTradeLibraryEntries`→1856 `tradeLibraryEntries` 为原始全量；1857 `scopedTradeLibraryEntries` 已受旧 SharedScope 预过滤。**首页新适配必须从前者进入，再按 live/market/account/applied filters 处理。**否则从模拟库返回首页会漏掉实盘；不能用旧 scoped 数据补猜。|
|报价/asOf|[Workspace](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:2123)|`holdingsQuotesByInstrument`从 entry.latestQuote 得到价/币种/日期/provider；标记 freshness=current 并不证明真实新鲜。2141日期 minute/focus/visibility刷新只更新 `roomTodayKey`，没有重取 bootstrap。新投影必须验证报价日、asOf、实际来源，不能把 focus 当重读证据。|
|真实持仓事实|[trading-room-holdings.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/trading-room-holdings.ts:678)、[trading-room-portfolio.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/trading-room-portfolio.ts:24)|`buildTradingRoomHoldings` 保留账户/episode/方向/quantityKnown与costKnown证据、未知状态、quote验证；`buildCurrentPortfolio`保留未知quantity行、排除已知0、算带符号市值/剩余成本/毛浮盈、coverage、unique instrument count。不能改为 UI 用 execution 简单相减。count不是表格行数；同标的不同账户/episode不可任意去重。|
|旧首页消费者|[review-dashboard.tsx](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/dashboard/review-dashboard.tsx:85)、[Workspace call site](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:5838)|props 已能传 entries、metadata、quotes/candles、asOf、position snapshots。Dashboard 内 `DashboardBrowseState`只保存旧 room/period/holdings query+page/pending/history calendar；不能当完整 V2.5 快照。|
|旧持仓消费者|[room-holdings.tsx](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/dashboard/room-holdings.tsx:1)|11列、5行分页、局部sort不入来源快照、直接 `onOpenInReview`；缺新8槽/8列/holding days/详情/完整返回。可复用事实投影和导出安全函数，不能把其现状当设计。|
|复盘持久化|[saveEpisodeReview](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:5457)、[sqlite-repositories.ts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-repositories.ts:141)|保存 completed/deferred 前检查并 flush drawing snapshot；await repository.put 成功后才更新 React reviews，409冲突失败。Recall 分支在自己文档持久化后回调1437。已有写入链不应被路由卸载绕过。|

数据边界应成为：`getBootstrap + metadata + quotes/candles/FX` → 未受旧 scope 过滤的 entries → **live 身份/账户解析与首页投影** → `{generation, scopeKey, applied scope, targetCurrency, dataBundle}` 原子提交 → 表格/详情/交易库；UI snapshot 只存恢复所需白名单 → 返回时重读数据并重建投影 → 数据已提交后恢复 scroll/focus。SQLite 写入仍由现有 repository/route/store 负责，不能把 UI callback 成功当持久化成功。

## 4. 必须一起打通的接缝

### 4.1 URL 初始化、直达、刷新与导航 guard

[Workspace 1308–1334](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:1308) 是默认 dashboard 的内存 activeView。`setActiveView`1317 有异步 Recall leave guard、navigationAttemptRef 防旧允许结果越过新导航；[6101](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:6101) 注册 Recall guard。5660后的导航只是 button onClick。不能在点击时先 `router.push` 导致卸载，然后才询问旧 guard；URL、页面、snapshot 应在同一获准导航提交点改变。

最小路由方案应保留 Workspace 为唯一数据/guard owner，为 `/home`、`/trades` 提供共享入口适配；直接加载时指定初始 route intent，应用内通过同一个 guarded navigation controller 切换并同步地址。新 route page 单纯复制 Workspace JSX 不够，必须证明状态复用或恢复与 leave guard 没有被卸载绕过。可在共用 layout 设 persistent host，或采用经过本项目 vinext 实测的地址适配；由 owner 先以 `/home→/trades→浏览器后退→refresh` 最小实验选择，不能凭 Next API 名称假定行为。不要顺便重写分析/数据/策略页。

URL 重建有两个阶段：先按纯 parser 校验路径、日期/市场/scope/显式 accounts 的语法，保留 intent；bootstrap、账户别名和证券身份目录 ready 后再做语义解析。加载中的账户不能视为非法而悄悄全部；合法直达 URL 优先于 localStorage SharedScope。`accounts=*`如 S 接受为全账户哨兵，不能在 allowedAccounts 校验中误当未知实体，也不能转换为曾选模拟账户。非法/缺失日期范围要可修正提示，不扩大为 all；非法market允许all+提示。首页只发live，交易库原有sim视角保留。

### 4.2 普通库成交日期与原平仓日期不是同一字段

[library-browse-state.ts:324](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/library/library-browse-state.ts:324) `matchesCloseDateRange` 先排除非closed，再取 `pendingFinalCloseDate`。[392](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/library/library-browse-state.ts:392) `buildTradeLibraryBrowseRows`把这个过滤用于 stock/queue 共享回合集。[现有测试204](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/library/library-browse-state.test.ts:204) 明确锁定最终平仓日期；这是旧合同有效用例，不能全局替换后删测试。

新普通入口必须显式新增 execution 日期范围/口径，并进入 normalize、range key232、缓存、筛选摘要、清空/reset、onBrowseStateChange 与 URL 同步；不能把 `from/to`塞进 `closeDateFrom/To`。实盘列表按每笔成交业务日含未平仓，统计仍以平仓日。`aggregateTradeLibraryStocks`446 会把已匹配episode的**所有 executions**再次展开：只用“episode内任一成交命中”还会把区间外成交显示/计数回来。因此列表需要明确 matched executions 投影，完整原episode另供账本/详情/复盘；不截断原账本后重算持仓，不将同一闭合统计直接复用为列表过滤。

[Workspace openPendingLibrary4599/openHistoryLibrary4640](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:4599) 设置 queue、closed、closeDate 范围。它们是旧显式待复盘/历史入口，不是新版普通库实现可直接调用的函数。普通入口应 stocks、reviewStatus=all、positionStatus=all，无 `queue=pending-review`，只应用显式来源条件。交易库内自己修改条件不反写首页。

### 4.3 标的集合身份，不能固定打开首回合

[TradeLibraryTarget](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/library/trade-library.tsx:137) 要求 episodeId；[openGlobalSearchResult4554](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:4554) 设置该target，库会自动选episode/详情。持仓“查看交易”应过滤该标的**集合**，不得调用这个函数代入一个首回合。目的地保留完整来源 market/accounts/date/live，selected episode 留空，用户选择具体回合后才进入既有详情。

[Instrument](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/trades/types.ts:50) 只有id/symbol/name/market/currency，`ResolvedInstrument` 的 [metadata-contracts](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/instruments/metadata-contracts.ts:35) 也没有exchange/shareClass。canonicalInstrumentId采用 `US:code`、`CN-SH:code`等市场身份；`US`不能证明NASDAQ/NYSE。已有 provider 可能消费交易所来源但当前规范化实体未保留，不能把显示市场名当完整交易所身份。P1需一个有证据的 identity resolver；CN-SH/SZ/HK等有来源映射可验证，美股未知交易所必须显式缺失/可恢复，不能硬造 NASDAQ。若必须保留 exchange/class 字段，先由 root 明确包含的有限 source/metadata 文件，再由唯一 owner接入；不新增全市场搜索业务源。

可信交易所的最小保留路径已进一步核查：

- [SEC parseSecCompanyTickers](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/instruments/providers/sec-company-tickers.ts:30) 实际按fields读取exchange43/52，验证非空，但创建ResolvedInstrument61时丢弃。可将该官方行的原始exchange与可验证的规范化值保存为optional metadata；不能只因source=sec便假设某个交易所。
- [Nasdaq addNasdaqRows](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/instruments/providers/nasdaq-directory.ts:163) 把nasdaqlisted与otherlisted共用同一构造器，只输出source=nasdaq；后者实际含不同交易所，因此 **provider=nasdaq不等于exchange=NASDAQ**。parseNasdaqDirectories195知道输入目录种类，可传递目录证据；nasdaqlisted成员可作为该目录来源证据，otherlisted必须保留该行Exchange原码并按有来源的映射解释，未知码不猜。当前fixture已同时含N/P，不能都标NASDAQ；fixture本身不替代官方代码映射依据。
- [validateResolvedInstrument](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/instruments/metadata-contracts.ts:118) 显式构造返回值，会再次剥离新增字段；必须同步optional type/validator/归一化规则和provider测试。证券代码中的share class（如BRK.B）不能因拼identity丢失，也不能从股票名称随意解析出新class语义。
- [metadata PUT/GET](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/api/storage/instruments/metadata/route.ts:35) 和 [putInstrumentMetadata1051](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-store.ts:1051) 经同一validator；当前StoredInstrument.metadata使用已有metadata_json，原则上可保留optional字段而无需新增业务表/迁移。需验证HTTP→store→bootstrap→metadata adapter往返。最新无exchange的元数据不能默默覆盖旧可信exchange，冲突/新旧证据政策应有明确测试。
- [LocalizedMetadataHydrationQueue](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/localized-metadata-hydration.ts:36) 当前只补缺中文名，不保证缺exchange的旧记录会重取。P1不能假设启动后身份自动补全；缺证据时明确不可解析状态，保留原查询/范围，可用已导入标的的有限metadata请求恢复，不扩展全市场搜索。

因此必要时由**同一P1 UI/data owner**追加有限metadata type/validator、SEC/Nasdaq parser、storage roundtrip测试与homepage identity resolver的写入权，root独立核对可信来源；不是另开并行metadata owner，也不是为填美股图稿硬编码映射。

### 4.4 实盘、账户、货币与真实持仓

旧 [SharedScope](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/shared-scope.ts:12) 可以是simulation；Workspace1861账户选项随旧nature变化。新首页不能复用这个已过滤选项集或其saved nature，应该从bootstrap原始身份目录取live账户，后续进入simulation页面仍保留原simulation记忆。未知nature不能伪造live。

旧 `RoomTargetCurrency` 仅 CNY/HKD，[trading-room-scope.ts:81](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/trading-room-scope.ts:81)，SharedReportCurrency仅original/CNY/HKD。美股USD不能通过改标签或者任意全局扩类型满足。按 PLAN，在 homepage 专属投影/类型边界支持 CNY/HKD/USD，货币由applied market决定；数字、coverage、汇率来源、标签作为同一 dataBundle提交。完整CNY可比值用于全市场金额排序，缺FX禁用并给理由；不能复用旧“原币种恰好一个才允许排序”的条件替代设计。

`buildTradingRoomHoldings`已有可靠位置事实，应优先复用；P1适配需补 holdingDays 的事实来源/业务日定义、持仓稳定identity、证券身份、Decimal格式与目标币种projection。持仓期初在观察期间前仍应显示；当前持仓不能被当前表现日期裁掉。未知cost/quantity/quote继续未知，不能以0换可用；方向、拆分/statement-only opening evidence必须保留。原row是account+episode级；若UI合并为证券行，必须先明确定义聚合与详情账户集合，不能无声明按instrument去重。

root已裁定P1沿真实account+episode行与稳定identity，不做证券合并；同证券多账户独立行，详情明确账户，unique count与row count分开。holdingDays仅在有可信连续持仓起点时，取active episode.startedAt的上海业务日与asOf上海日自然日差，当日0；statement-only、historyIncomplete、起点证据不足显示“—”及原因，不使用latestTradeDate代替。原始nature缺失维持unknown，不猜live，首页只呈明确live。普通库只增加必要execution-date投影接线，保留原统计close-date，不推进库V1内部重设计。

### 4.5 来源快照是 UI 状态，返回必须重新读取数据

[returnToDashboardSource5243](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:5243) 只将RoomPendingSourceSnapshot放回dashboardRestoreContext并切activeView。首页被 display:none保留，可制造“返回看起来恢复”的错觉；浏览器refresh时这些 useState 全部消失，而且没有新bootstrap读取。当前快照不含sort、完整scroll/focus、贡献双模式、完整历史等。

S的纯 encode/decode 不提供浏览器持久容器。UI owner需要版本化的 session/history UI snapshot存储适配，明确 source token、合法字段白名单、损坏快照回退、何时写/何时清，且不存 rows、quotes、fees、executions、positions、financial outputs。离开前记录真实DOM scroll和稳定触发键；返回重读bootstrap/必要metadata与行情，原子提交新投影后再恢复scroll/focus。React array index不是稳定焦点身份。source行消失只回来源容器标题，仍有效条件保留；不是清全部条件。目的地URL权威范围与来源快照分开，不能用快照覆盖刷新中的 `/trades` URL。

## 5. F/S 接口能否承接整页

本节针对 source-fingerprint 所录版本；F/S恢复修复后需重新核对导出，不能把历史缺陷结论冒认为新版本失败。

|边界|现有可用部分|不足及可核对证据|最小承接方式|
|---|---|---|---|
|S 纯请求/范围|create/begin/apply/retry、generation+scopeKey、15秒判定、clear/reset、URL parser/serializer|`HomepageState`/`HomepageSnapshot`有多份scope/attachments；当前 apply同步scope但附件另存；history没有chartMode；encoder对嵌套对象spread可泄漏，decode反而拒绝自身输出。对应历史S第三轮5个失败，不是新猜测。|S统一 committed authority与同一白名单；UI owner只消费纯状态迁移，不再另外维护一份applied或手写第二份URLparser。|
|S URL/焦点|已支持date/custom/all、市场警告、accounts、symbolIdentity形状；restoreHomepageFocus给区域/fallback|allowedAccounts与`*`冲突；没有浏览器存储、popstate/guard、DOM focus resolver；restore函数不直接恢复triggerFocusId。|S明确合法字段与枚举；UI owner以两阶段账户解析、稳定DOM键、版本化存储、guarded navigation接入。|
|S与数据提交|能拒绝迟到的state apply|没有业务dataBundle所有权，state apply成功不代表UI数据与货币已同步。|UI请求封装载入原始数据并投影；仅在matching generation+full key成功时一次commit `{applied,currency,bundle}`。失败显示旧applied与旧bundle+错误/draft，不能新标签配旧值。|
|F期间指标|buildHomepageV25Performance，净盈亏/已实现/openUF/closeUF/currentMV、per-account/instrument metrics+coverage/reasons，已接真实entries适配|历史F第三轮4失败：Shanghai首日、asOf后执行计入current、未来quote遮掉正确历史quote、periodEnd/asOf之外数据污染net。模块把部分未知证据丢失并建第二本简化账本。|F先接受，统一业务日/asOf与unknown证据；不能由UI补算、修截断或把null转0。P1真实持仓可用既有holdings/portfolio投影先落地，不等待F期间图。|
|F整页投影覆盖|已有聚合metric和instrument明细|当前导出没有daily curve、历史四模式序列/费用、current floating P/L来源/持仓行明细、贡献分类/阶段值/FX来源；输入仍混合已加工valuations与raw entries。仅有performance module PASS不足以为P2/P4画完整正确数据。|P2/P4前冻结小型消费合同与真实adapter样例；若扩导出，仍属F财务边界，UI不隐藏补一套金融计算。|

F当前SHA `81038783d8d2f8b7c5c680f6fd6179ebfceba6f960147cdda66076d474d99345`；S当前SHA `a0285648e5874a2678763083fbb07163782fdd4e88345e74ab98c280d1f35029`。本诊断未重跑旧反例，历史原始证据见 [F acceptance-3](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/F/acceptance-3.md)、[S acceptance-3](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/S/acceptance-3.md)。恢复诊断实验与新交付轮数不能混同。

2026-10-23 root最新派工信息：S正在TDD实现snapshot v2唯一committed UI，applied由scope+attachments派生；period/history独立request域与global generation；history.range明确single-year/this-year/year-span/all并带chartMode；contribution.current/history嵌套、current.openOnly独立；缺必要字段v1明确reject。此为**进行中的接口方向**，不是已接受导出；P1等待S的INTERFACES.md及root接受，禁止据本文旧字段实现适配。

## 6. 连续三轮暴露边界的架构原因

证据支持的核心问题是横切纯模块先行、实际消费者和真实数据边界后验，而不只是测试数量少：

1. F同时承担原始交易适配、独立lot重播、估值与可用性判断，但输入没有保存既有账本unknown/accuracy/费用语义。每补一个数量或截止日分支，又暴露另一个时点/报价/完整性边界。真实holdings已有处理过的事实不能先降为0或普通string再期待下游找回。
2. S同时存desired/draft/applied/snapshot.scope/snapshot.attachments，nested encode用对象扩展而decode用严格键集合；同一事实多处维护，循环恢复并不保证一致。纯测试很容易只断言一个副本，不见实际组件读了另一个副本。
3. 票据以“F计算、S状态、A资产”横切拆分，各自单测没有从 `/home`真实bootstrap贯穿到 `/trades`/refresh的consumer。旧library close-date、pre-filtered sharedScope、no-route、US身份缺口，只有集成时才会出现；继续扩函数不会自动解决。
4. Worker通过是其范围内证据，不能越过root独立接受。历史指纹已显示worker green与独立FAIL并存。模型换成GPT6.1也不能消除真实边界或设计门槛。

建议保持单一UI owner接收S/F事实，持有整页视觉与导航；F owner只修金融事实边界，S owner只修纯UI状态边界。root按纵向切片先看真实旅程，再按依赖扩展P2–P4；每片先给真实输入和预期输出，再做独立功能/状态/视觉接受。不要把本次P1拆成独立route owner、table owner、library owner各自交付后再拼接。不得为了通过而删视觉、改8槽、改普通入口、简化返回或隐藏未知。

## 7. P1 首次真实旅程及接受顺序

更精确的可派发说明见 [P1-DISPATCH-DRAFT.md](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/integration-debug/P1-DISPATCH-DRAFT.md)。此处是root首次接受的最小主线：

1. 在root管理的隔离DB，准备有9条以上真实ledger投影、跨账户/市场、至少一条期间内执行但未平仓的标的；另保留旧simulation scope作为入口陷阱。记录数据/代码版本，源业务库不写。先直达 `/home`，待bootstrap和身份ready后显示live持仓8槽与正确Csummary。
2. 将持仓局部query/sort/page设为可辨认状态，滚动到具体account/episode行；从可访问名“查看持仓详情”的图标进入详情，核对该行identity、完整数值与数据状态。关闭，实际回到同一query/sort/page/scroll/焦点。
3. 重新进入详情，唯一“查看交易”进入 `/trades?...`。URL显式market/accounts/live和真实日期；symbol是可信exchange+code身份。到达即应用，不需第二次点入口；普通stocks集合无queue，不先选固定episode。期间内未平仓执行出现，区间外执行不冒充命中；已平仓统计仍按close-date独立。
4. 对目的地refresh与完整URL新开直达，仍是同一applied条件，不被旧localStorage/snapshot覆盖。含非法日期、未知account、未知symbol的分支提供可修正错误，不能悄悄all。
5. 回 `/home`，重新读取数据。恢复期间、历史范围、全局scope/附件、持仓query/sort/page、贡献两模式记忆、scroll/focus；原行消失回持仓标题，仍有效条件保留。至少一个隔离库受控数据变更能在返回后的新读取中可见，证明没有拿旧data snapshot充数。
6. root另走既有library→复盘保存→返回→reload，核对API/repository/store实际持久结果、冲突/leave guard阻挡时URL和view不先跳走。P1不新增回放行为；只证明新导航未绕过已有持久化与guard。
7. 首次旅程通过后，root在1440×1000、1280×800同数据同状态直接对照批准原稿，量导航/页头/内边距/列边界/8槽/浮层/焦点与页面密度；首张整页视觉有重大差异仍FAIL。只到此通过才扩P2–P4。

首次切片通过不等于P1全控件接受。P1后续仍需完成已render的search/IME、排序/FX禁用、export全筛选、0/1/8/9/50条、loading/error/timeout/late response、长名字/缺值、mouse+keyboard等对应行证据。96公共状态原分母仍保存，未触达状态保留NOT VERIFIED，不靠单元测试或静态图补计。

## 8. root 独立反例清单

|反例|必须观察的结果|
|---|---|
|进入前旧sharedScope=simulation，随后直达home|live账户与live全量数据，不是空表/旧simulation账户。|
|URL账户在bootstrap异步完成前尚未知|等待后正确应用；不能早判invalid或回all。`accounts=*`按合同处理。|
|同代码跨交易所/资产类别，同标的多账户/episode|详情保持真实身份；交易库是目标集合，无固定首回合；未知exchange不能硬造。|
|1月有buy且仍open，2月才close；从1月入口进入|1月execution列表可见open/对应执行；2月close统计不归1月。|
|同episode有区间内外多个execution|列表计数/日期不被aggregate展开回所有执行；完整ledger仍供review。|
|从home进入时旧library有pending/closed/queue筛选|普通入口不继承隐含queue和closed；只传显式范围；目的地改条件不改来源。|
|应用A后很快应用B，B成功再A迟到；失败/15秒/重试|只B提交；新generation；标签/币种/表格同一applied；失败保旧数据且可修正draft。|
|US切HK再all，部分FX缺失|USD/HKD/CNY正确；缺失不能改标签当换算；排序禁用有原因。|
|未知quantity/cost、statement-only初始持仓、short、futurequote|保持事实/缺失，禁止0；当前持仓不受期间裁减；未来信息不混入。|
|源在第2页、query非空、sort非默认、scroll非0|详情close与trades返回/refresh均恢复；源行删除回标题，不清有效条件。|
|向nested UI snapshot注入positions/rows/quotes/fee|encode剔除，decode自洽；存储里没有业务缓存；history四模式/贡献双模式不丢。|
|复盘脏数据，点击home/库/浏览器后退；快速再次导航|guard按最后一次意图生效；取消时URL/view均不变；保存失败不卸载。|
|9条末页、零持仓、搜索无匹配、超长账户名与大额值|8槽与几何稳定，0无假页码，唯一X清局部query，176×36账户不伸长。|
|导出在第2页且有query；中文组词|CSV是完整筛选结果与完整值；不是当前页。组词时不触发查询，结束300ms最新词。|

## 9. 未决项与进入实施的条件

- **S当前仍未接受**：root接受修复后的committed state、whitelist roundtrip、完整snapshot/URL合同才派P1。报告写成READY不代表S gate已过。
- **证券exchange/share-class证据不足**：现有结构未保存；root需确认P1有限identity adapter与数据来源文件，或确定缺失可恢复呈现。不能把已批准精确身份要求当可选，也不能凭测试fixture假设业务有字段。
- **持仓天数与行聚合裁定待落实**：按4.4的root裁定实现与验证：account+episode行不合并、可信startedAt上海日差、证据不足未知。该实现规则已明确，实际投影与UI仍NOT VERIFIED。
- **router host选择须最小实验**：本项目vinext+Next混合，静态API存在不能证明guard/后退/remount行为。P1首个实现切片就完成真实URL与持久host实验，未通过不继续做组件。
- **F整体消费投影尚未冻结**：P1真实持仓可先落地；P2期间图/P4历史贡献必须等F接受并明确输出字段，不能要求UI补金融计算或先画假序列。
- **批准来源内的旧措辞须按当前正文对齐**：A仍写Luna，当前模型以恢复记录GPT6.1 Ultra为准；S/F旧三轮失败保留。parent需更新原矩阵owner/依赖/接受链接，本代理未越权修改。

本报告仅可作为恢复实施的根因与派发输入。下一动作由root明确派发，不自行开始产品代码。
