# P1 派发草案：真实持仓→详情→普通库→首页

**DRAFT / 尚未开始实施。** 拟唯一UI owner：`/root/integration_g61`，GPT-6.1-sol / ultra。root独立接受数据/持久化/整页视觉。开始条件：root明确派发，A已接受，S恢复修复已接受；F通过是P2/P4消费前置，不是P1已有真实持仓投影的必要阻塞。首次真实旅程及整页首张视觉接受前，不扩P2–P4。历史失败记录保留；新任务仍最多3轮独立交付验收，不能用子切片改名重置轮数。

## 1. 实现目标与不变量

直接读取批准V2.5全文与current component manual，继承55项DESIGN-COVERAGE、96公共状态清单，逐行补本P1准确owner/旅程/证据。P1包括新首页真实框架、live/market/account/current持仓、固定8槽/Csummary、持仓详情、普通library接入、URL直达/刷新、source snapshot/reload/focus、既有leave guard与持久流回归。已渲染控件必须工作，未实施后续区域不能显示假值或宣布通过。

批准参考目录 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`，必读：`visual-design.candidate.md`全文（重点HP04、HP06、HP08、HP10、附录二），`component-manual.html`。必看images：home-1440/home-1280、holding-option-C-normal/large-1440/1280、holding-return及detail/after、detail、handoff、account、count-boundaries、empty、local-search-pages、extreme。普通库同时读 trading-library-v1.0/source/visual-design.candidate.md 的BT03–BT06。ticket/A说明只指路，不替代原稿。

## 2. 文件所有权与最小改动面

本表是root可批准的精确边界，路径均相对共同仓库 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；不授予本草案实施权限。

|Owner写入范围|用途/限制|
|---|---|
|`app/components/homepage-v25/**` 新文件|新首页、8槽持仓/详情、局部格式/投影适配、browser UI snapshot/route adapters；独立样式作用域，唯一视觉owner。纯数据适配也可在本目录明确命名，避免与F/S修改冲突。|
|`app/components/trade-review-workspace.tsx`|真实bootstrap/metadata/market来源、raw entries到新首页props、guarded navigation、普通库intent、返回重读/commit、原始scope适配。不能平行保留第二套applied状态。|
|`app/page.tsx`、新`app/home/page.tsx`、新`app/trades/page.tsx`|真实server入口/初始route intent；现有dev prototype分支保留。不要只做看似有URL但刷新失效的button。|
|`app/layout.tsx` 或新共享host/route group（仅root确认需要时）|如最小route实验要求persistent Workspace host，限定此目的；不顺便改metadata/fonts或其他页面。owner先报告选择与guard/后退证据。|
|`app/components/library/trade-library.tsx`|普通入口来源条件即时生效、execution-list/date摘要、集合identity选择、返回层级；保留library内部显式pending和simulation记忆。|
|`app/components/library/library-browse-state.ts`|新增明确execution日期口径与完整range/cache/resetkey；原close-date字段继续服务统计/旧显式入口，不能一刀改义。|
|root追加确认后：`app/lib/instruments/metadata-contracts.ts`及测试、`providers/sec-company-tickers.ts`、`providers/nasdaq-directory.ts`及`metadata-providers.test.ts`、必要metadata route/store/repository往返测试|有限optional exchange/source evidence保留；SEC实际exchange，Nasdaq目录种类+otherlisted行Exchange，不以provider或US推断；已有metadata_json原则上无需schema迁移。唯一owner负责完整路径；validator不能剥字段；旧无exchange记录明确不可解析。详见集成报告4.3。|
|上述对应`.test.ts/.test.tsx`与新`homepage-v25/**`测试|真实input adapter、guard/URL roundtrip、execution含open、不误截账本、恢复identity等有意义验证。对应旧行为测试应迁移到旧控件或更新新合同，不删除失败掩盖设计。|
|新P1 browser evidence/test文件与原任务记录（root批准精确目录）|隔离库seed/实际交互和对照图，明确版本/状态/viewport，不复用历史PASS冒名。|

默认不改 `app/lib/reviews/homepage-v25-state{,.test}.ts`（S owner）、`homepage-v25-performance{,.test}.ts`（F owner）、全局SharedScope/RoomTargetCurrency类型、回放引擎、业务数据库schema、导入业务、公共globals.css大范围规则。新证据证明必须跨界时，先给root文件/必要性，由root调整边界；这不是向用户重复要产品授权。

旧 `review-dashboard.tsx`/`room-holdings.tsx`只作为迁移接口与既有可复用函数来源，避免另派旧表owner；新首页采用新受控surface。在确实需要小适配时由同一UI owner承担并告知root，不留下两套来源状态争权。

## 3. P1需要消费的S合同

下面描述消费者需要的语义，**不是固定旧S类型形状**。root已告知S正在实现v2唯一committed UI、兼容applied getter、period/history独立request域+global generation、history.range/chartMode、contribution.current/history嵌套及current.openOnly、v1必要字段缺失则reject。UI owner必须先读S新INTERFACES.md并以root接受的最终types为准，不能据旧exports/本文表格复制一套兼容状态。

|消费对象|必须具备的字段/保证|UI owner责任|
|---|---|---|
|`HomepageScope`|live=true、market all/a/hk/us、explicit accounts（含合法all哨兵）、rangeMode/date/from/to、可选symbolIdentity；scope只含scope字段，稳定canonical key。|加载bootstrap/alias目录后做账户/证券语义解析；home强制live，目标库保留sim能力；currency由market映射不单独乱改。|
|committed/applied + attachments|categories/openOnly/pendingReview白名单，scope与attachments从同一committed对象生成；clear/reset/draft/identity切换合同；完整key包含影响结果的附件。|每次请求收集完整raw数据并投影；matched成功时一次提交dataset+applied+currency。不得自行再复制一份分离的已应用附件。|
|request lifecycle|generation单调、scopeKey、target、begin/retry/fail/timeout/cancel；15秒超时、retry新generation、旧结果不生效。|AbortController、cleanup、错误显示、可修正draft、连续切换atomic DOM；网络取消不是单独通过证据。|
|`HomepageSnapshot`完整UI白名单|period preset/from/to；history range/year/**chartMode四模式**；global scope+attachments；holdings query/sort/page；contribution mode和current/history各自category/sort/drill/page；search query/open/resultsScroll/selectedSymbol/triggerFocus；scrollTop；稳定source/trigger identity、container fallback。|浏览器session/history存储、版本/source token、真实DOM滚动/焦点采集，return重读后再恢复。稳定键至少区分instrument+account+episode/source，不用row index。|
|encode/decode|同一字段allowlist/枚举，合法snapshot roundtrip自洽，nested未知/业务字段剔除；损坏输入可恢复，无业务row/price/fees缓存。|storage exception/版本错误fallback，URL与source snapshot分别保存；允许扩字段必须先回S合同。|
|parse/serialize navigation|附录二exact URL；`symbol`值为symbolIdentity；all不带from/to；日期真实有效、缺/非法范围错误，invalidmarket all+warning，显式accounts；allowed实体校验不误拒all。|route adapter/URL sync、direct/refresh/back/forward、leave guard先允许后commit；不把source snapshot覆盖目标URL，不用TradeLibraryTarget选首回合。|
|focus intent|区域+稳定triggerFocusId+不存在回来源标题，条件保留。|按新数据解析DOM；details close和trades return分别还原正确来源。|

S不负责business数据读取、FX运算、DOM、浏览器router或实际持久化；这些由同一UI owner接入并由root独立验收。

## 4. P1数据/财务消费合同与P2–P4的后续接口

P1输入必须来自Workspace未经旧SharedScope预过滤的entries、metadata、quote/candle/status、position snapshot、FX、asOf与ready/error/provenance，不能只给已经过滤的rows。复用 `buildTradingRoomHoldings` / `buildCurrentPortfolio` 的事实，保留account+episode稳定identity、direction、quantity/costKnown/accuracy、未知和quote reason。新projection给UI至少：

- identity `{instrumentId, accountId, episodeId, liveNature, symbolIdentity?, exchange?, assetClass?, displayName, fullName, symbol, market}`，以及unknown identity明确reason；不得造exchange。
- 行 `{holdingDays|null, quantity:string|null, averageCost:string|null, latestPrice:string|null, marketValue:string|null, unrealizedPnl:string|null}`；每值availability/reason、原币种、目标币种与精确原值。计算用Decimal，不将未知0化。
- 汇总 `{marketValue, unrealizedPnl, coverage, reasons, currency, asOf, quote/FX provenance}`，rows计数与unique instruments明确区分；全市场排序用完整CNY可比值或禁用原因。
- local filter/sort/page/export由受控UI派生，不改变原始ledger。0条与no-match分开；CSV完整筛选结果、完整数值、formula-safe文本。

root已作数据裁定：不合并证券行，使用真实account+episode行及稳定identity，同证券不同账户可独立行，详情明确账户。holdingDays只在可信连续持仓起点下计算active episode.startedAt上海业务日到asOf上海日的自然日差，当日0；statement-only/historyIncomplete/起点证据不足显示“—”与原因，不用latestTradeDate。nature缺失维持unknown，首页只明确live。新增execution-date仅完成普通入口必要接线，原closed统计保留，不扩展成交易库V1内部重设计。

P1不需要UI调用F模拟缺失财务口径。若F修复后提供current/holding projection，必须先与上述真实holdings测试对齐，再由root批准消费。待P1真旅程接受、F接受后，P2/P4冻结以下后续字段，不在P1提前实现：

|阶段|F或财务投影需要提供的事实|
|---|---|
|P2期间卡/曲线|period business start/end、asOf、targetCurrency；realized净额、openUF、closeUF、UFdelta、net、currentMV，每个metric的available/value/coverage/reasons；daily points含date、真实gap/unknown状态、可用性与原始来源，不补直线/未来值。|
|P4历史|已平仓net/rounds/wins/denominator/fees（已扣除，不再扣一次）；四模式period/cumulative/win/rounds序列、历史已知/未知/未来/真实0状态、year/range；close-day归属与execution-list区别明确。|
|P4贡献|current/history分别输出long/short/IPO分类；完整总计、市场/证券分层identity；realized与UFdelta分段、可比值/coverage/FX；open-only语义和每模式sort/drill/page输入；不能让UI凭net差额反推金融事实。|

接口导出以小型domain投影+真实数据样例确认，不要求一个大函数承包整页UI，也不由UI重建第二本lot账本。未知quote/cost/fee、业务日/asOf/future过滤是F/财务投影的职责。

## 5. 最小纵向切片顺序

1. **Route/data shell**：`/home`、`/trades`直达与refresh，bootstrap ready后应用URL，guard/controller同一authority；实测后退/取消不绕guard。建立1440/1280真实页面首屏，保持批准布局，不铺P2–P4业务。
2. **真实持仓8槽+详情**：live raw entries→可靠projection→Csummary/8列，完整rowidentity；在非默认query/sort/page/scroll打开/close详情恢复。先展示事实/未知，不加假行情。
3. **普通库execution**：unique查看交易→附录二URL→立即应用集合，open execution包含，closed statistics独立，target不预选首episode，无queue。
4. **返回/refresh/持久化回归**：完整source UI snapshot→重读→scroll/focus；direct目标URL权威；source消失容器fallback；已有复盘保存→返回→reload及guard不回归。
5. **root首条旅程与首张整页视觉独立接受**。FAIL停在此片修复，不扩P2–P4；PASS后P1剩余rendered控制/边界完成，之后按原计划扩展。

以上是同一P1任务内部切片，不自动建立新的验收轮数。每轮root保存版本、失败反例与证据；第3次仍失败暂停、说明根因和进展，不覆盖历史。

## 6. 测试与root接受证据

应优先更新/增补：`app/components/trade-review-workspace.test.tsx`（route intent/accountready/guard）、`app/components/library/library-browse-state.test.ts`（execution range与closed stats并存/范围key/reset）、new homepage components tests（IMEsafe300ms、stableidentity、snapshot/focus intent）、已有 `app/lib/reviews/trading-room-holdings.test.ts`（真实事实回归、不要镜像UI实现）。既有room-holdings测试锁定5行/直接复盘的是旧组件行为，不能当新首页通过证据。

命令由root/implementer实施时按固定runtime执行：`./scripts/native-node.sh node_modules/vitest/vitest.mjs run <changed relevant tests>`；`./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit`；变更完成后按实际范围build及必要相邻回归。`tests/local-dev-storage.test.mjs`可参考显式隔离DB/服务模式；`tests/focused-review-ui.test.mjs`只是静态源码断言，不能当浏览器旅程测试或接受证据。不得不加隔离参数直接写库。

实际浏览器接受必须记录：运行版本、显式隔离DB、URL/端口/服务、fixture真实身份、CSS viewport/zoom/DPR/数据状态；mouse与keyboard分别操作；source/destination/return/reload前后截图与范围/scroll/focus、HTTP/持久层结果；原始交易未变证据。模拟touch与physicaltouch分开，未执行留NOT VERIFIED。

root独立视觉直接看批准原图与当前render同状态截图，测72/64/24/48/40/48/48、8槽与列宽/right boundaries、176×36账户、Csummary/搜索导出无挤压、长值/缺值/空态。截图只比“看着差不多”、HTTP200、DOM控件存在都不够。

交付记录按原feature README、DESIGN-COVERAGE、CONTROL-STATE-COVERAGE、issue、FINAL-ACCEPTANCE同步；当前草案未修改这些文件。最终UI交付才提供真实浏览器新鲜检查、服务仍运行的可点击预览URL与启动方法。本诊断不提供伪预览通过声明。
