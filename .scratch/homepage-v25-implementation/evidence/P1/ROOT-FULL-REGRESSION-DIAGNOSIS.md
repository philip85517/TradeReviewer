# P1 freeze2：Workspace 全量 45 FAIL 只读根因分类

本报告只诊断，不修改产品、测试、F/S、数据库或共享文档，不启动服务、不访问浏览器、不新增代理。本轮未重新运行测试，因此下面的“确认”限于 root 原始运行结果和冻结源码可证明的首个失败原因，不表示后续功能已经通过。P1 正式第 2/3 轮仍由 root 判定；有限 DEPENDENCY-GATE 不等于整票接受。

## 输入与版本

- 原日志：`acceptance-2/verification/workspace-all.log`，SHA256 `cf24867a0f76781f065e0a7791b5e6f0b63e5dc33aa25ce301ffaf265c738d0f`。02:28:02 开始，95 项中 45 FAIL / 50 PASS，测试 83.20s / 总计 89.01s，root exec50939 exit1。
- 产品/测试绑定 `source-manifest.freeze-2.json` 的 30 个 owner 文件；本次读取逐项重新计算全部匹配，零漂移。聚合 `b5611a7a229ca1d661fe3a0533ac8729ec0761f265d673aa9a5830edc204a2d1`。
- Workspace `983f0b173ba0f29d9058237ab6f34e8b1722d33f70bdcc59f4d48639c5d5d657`；Workspace test `fb99532a53d88ddb60022a0f521b7bde9bf3de9e965598a84f19c438ab7af06f`；host `32fb69710d1bfdb86aef67253f39b162279473b4e70d375235e9ab0fa9f216a6`。
- F/S 后续授权开发可能改变消费依赖和 HMR 运行页；本报告不把之后的浏览器行为倒填为此 02:28 运行的证据。root 已另存真实 Recall 保存正证据，不纳入这 45 条自动测试的通过数。

## 分类结果与接受边界

|组|数量|首个失败可证原因|当前结论|
|---|---:|---|---|
|A1|26|共用 helper 在选择交易库前先等已卸载的旧首页 region|入口测试耦合失效；后续 Recall/行情/存储断言均未运行，功能仍 NV|
|A2|3|测试直接等旧首页 region，或访问旧首页筛选结构|旧页面结构不再适用；不能简单改 selector 便宣称原数据/性能合同通过|
|A3|5|共用 empty helper 同时依赖旧 region 和旧平仓日空态文案|空态断言需要迁移；migration/export/import 的原断言必须保留|
|A4|3|先等旧“1 个未平仓回合”，后续还依赖已退出生产首页的控件|旧首页入口/职责变化；按原功能目的迁移到合法页面，不能把模拟控件加回仅实盘首页|
|B|1|初始化现在多一次完整 owned read，bootstrap 实得 2 次|确定的读取生命周期变化；“不读 legacy”仍应保留，重复读预算需明确|
|C|3|缺 nature 的 futu 记录从首页导航进入 strict explicit-live 集合，被正确排除|当前用例入口与新首页来源合同不一致；原历史记录不能补 live，改为裸全局入口后重验原完整断言|
|D|1|旧 region/逐持仓重试消失；当前唯一全局修复会默认读 intraday|前半是批准交互变化，后半是可证明行为差异；是否应保留 daily-only 延迟读取，需要新真实消费 RED 与 root 裁定|
|E|2|“行情失败”mock 对 aliases 也返回 502，真实校验使初始化停住|fixture 混淆了端点故障；先隔离目标行情故障，再保留原取消/确认/图表/返回验证|
|F|1|首页来源集合里切 simulation，但账户目录仍只来自 homepage explicit-live|此用例有全局入口上下文问题，同时暴露可达的目录/本地 scope 不一致风险，不能只迁移测试就豁免|
|合计|45|无遗漏、无删测|45 条仍保留 FAIL 历史，所有被首错遮挡的断言均 NV|

其中 34 条首错逐字相同：找不到 `region "我的交易室"`；A4 的 3 条同样先停在旧首页文案。37 条属于入口/结构断言阻断，不等于“37 个功能已正常”。当前没有可证明的测试顺序污染；也没有运行隔离/换序试验来排除污染。

## 首因及最小修复边界

### A：生产首页替换后，测试入口仍强依赖旧 dashboard

`app/components/trade-review-workspace.tsx:5925–5983`：`showDemo` 才挂旧 `ReviewDashboard`，生产挂 `HomeSurface`。新结构在 `homepage-v25/home-surface.tsx:167–201` 为“首页”、`当前持仓（最新）` labelled section 和 `table aria-label="当前持仓"`，没有旧 `region "我的交易室"`。

`trade-review-workspace.test.tsx:1065–1131` 的 `enterImportedReviewFromDashboard` 在 1068 无条件等待旧 region，然后尝试旧日历直入复盘，直到最后才有交易库 fallback；所以 26 条都在真正进入 Recall 前结束。`renderGoldReplay:927–957` 默认复用它，保存的 gold 原始记录没有显式 nature。原 helper 注释还假设“交易库默认 queue”，与批准规范 HP06:436–448 的普通入口相反。

最小修复不是重新挂旧 UI，也不是给源记录补 `tradeNature: live`。对功能目的是 Recall、缓存、历史、审核、补录和符号映射的用例：从明确裸 `/trades` 全局上下文进入普通库，选择实际标的/回合；保留所有后续断言、保存失败、未清仓拒绝、未来信息截点等。首页来源旅程则单独使用有真实 explicit-live 来源的记录，走 Eye 详情→唯一查看交易→普通集合，不用旧日历“打开复盘”旁路替代。

`expectEmptyProductionDashboard:1133–1137` 同时等待旧 region 和旧“已有交易数据会按来源平仓日显示”文案。5 条迁移/export/demo/import测试应等新首页真实 ready/空态，并继续验证原 export、migration、演示数据隔离和导入动作；不能只替换成某个永远存在的导航。

A2 的额外约束：

- #03 caller-owned tag cache：失败在 1345 的旧页 ready 门；其缓存调用与模式洞察传递尚未验。
- #16 daily-only hydration：失败在 1877；后续精确“2 次 daily 读取”可能还受 B 的新初始化周期影响。不能未经根因判断就把次数改成 4，也不能移除无 intraday 的断言。
- #41 stored ETF metadata：测试在 5300 后依赖旧“交易室范围/更多筛选/ETF”。批准新首页的筛选还由 P3 接线，当前旧结构不能作新筛选验收。应在对应合法消费页验证 persisted metadata，并保留 ETF 语义；是否作为 P3 跨期覆盖由 root 显式登记，不能在 P1 凭旧 selector 直接豁免。

A4 的原意分别保留：#42 完整模拟运行和账户选项不可因选中一项而缩水，应在全局库共享 scope 验；#43 真实 explicit-live 数据的分析 unknown→live→数据管理传播，只需替换首页 ready 门，保留后续全部断言；#45 原“持仓直接复盘→旧 period/currency/year calendar 返回”需要映射为批准的新详情/普通库来源快照旅程。P2 尚未落地的 period/calendar 不能伪称已经被 P1 覆盖。

### B：bootstrap 两次来自新 owned read，不能当作随机多读

Workspace `2598` 的 `bootstrapWorkspace` 先 `getBootstrap`；`2770` 置 storage ready。`2200` host `readOnInitialize:true`，`use-homepage-host.ts:133–151` 首次 ready 启动 `beginRead`；后者经 `73–80` 调 `readHomepageBundle`，Workspace `2182` 再 `getBootstrap`。这与 #14 实测 2 次吻合，不需要假定测试顺序。

新读解决了首屏行情/FX 早于源 ready 和无归属回写覆盖的问题，不能为恢复一次调用退回旧 `options.data` 整包同步。最小测试边界：保留“server bootstrap 有数据时 legacy execution storage 不读取”的强断言；明确初始化读预算/owned request 的数据归属。若要求只读一次，应在现有 Workspace/host 将同请求完整 bundle 复用或去重，并先证明不会把早期不完整源作为已提交快照；不触 storage API、F/S 或全局缓存语义。当前未授权实施该优化。

同源潜在相邻点：Workspace `2981` ambient daily hydration 和 `2189` owned daily hydration 都可能读市场缓存。#15/#16 首错遮挡了它们的实际次数与顺序；需要修入口后观察准确调用轨迹，再判断是不是性能回归，不能把当前未跑的断言称为通过。

### C：首页来源和裸全局浏览必须保持不同边界

`availabilityExecution` 测试 helper `309–330` 的 `source={platform:"futu",row}` 没有 nature。`holdings-model.ts:41–45` 的 explicit-live 要求 episode 内所有 fill `tradeNatureOf === live`。Workspace `5812` 首页导航点击调用 `homepage.openTrades(null)`，其他页面的全局导航才 `openGlobalTrades()`；host `openTrades/openGlobalTrades:188–189` 分别形成带完整 scope 和裸 `/trades`。`acceptAddress:109–125` 按查询有无给 `collectionOrigin`，Workspace `2221–2237` 按该来源设置 ordinary scope 与 strict explicit-live 输入。

因此 #17/#38 看不到该缺 nature 标的，#39 因空 entries 连 library header 的“高级筛选”也没有：`trade-library.tsx:1196–1200` 只在非空时挂 header。它们不能证明按钮实现被删或 Recall lazy 状态失效。

最小边界是测试明确初始 `/trades` 全局上下文，然后保留 pending lazy、queue 内显式选择、完整历史 account 隔离的原断言。不得把首页导航改为裸 `/trades`，不得补性质，不改 shared-scope fallback。另必须继续保留首页 nav 的非默认 market/accounts/date 及同证券 unknown 排除用例；已批准 HP06:436–464 的首页范围传递优先于旧测试默认行为。

### D：首页修复动作和 daily-only 保障的分离

#18 先找 `region "当前持仓"`（2040），而新首页使用 labelled section“当前持仓（最新）”与 table role；且其输入仍是缺 nature 的 futu 记录，正确新首页不会显示该持仓。旧逐行“重试行情”也被批准的唯一全局修复替代（规范 `38/478–483`）。所以不能简单改 selector + 伪造 live 解决。

但代码确有相邻行为差异：Workspace `5982` 新 `onRepair` 调 `startMarketDataUpdate(undefined,{refreshMetadata:true,batch:true})`，`3494` 默认 `includeIntraday = options.includeIntraday !== false`，`3722–3725` 因而会读 intraday；既有 holdings 维度重试 `4605–4611` 明确 `includeIntraday:false`。当前这条用例还没触发新动作，故原日志不是 intraday 泄漏的动态证据。

最小下一步先用明确 live 的真实缺行情 holding，在当前唯一全局修复上记录 instrument/interval/请求归属 RED。若首页修复应补全全页历史所需 intraday，则这是批准动作范围变化，应将 daily-only 保障保留到“仅查看首页/持仓、不打开消费者”的用例，而不是恢复逐行入口。若 root 要求该动作仍 lazy，则只限 Workspace 新 onRepair 适配；不能改共享刷新默认值。此次只报告，不自行作策略裁定。

### E：两个 import 用例的非行情端点被连带 mock 失败

测试 `3713–3716/3740–3743` 将除 `/api/instruments/resolve` 以外的全部 fetch 都返回 502。它覆盖了 beforeEach 中合法 `{aliases:[]}`，所以 `activeAliasLoader` 的真实端点同样失败。Workspace `2200` ready 要求 `aliasRecoveryState === ready`；`2221` 路由集合 effect 等 initialized；`6053` ordinary key 未跟 route key 时只渲染“正在读取目标交易集合…”。因此 #36 搜索框和 #37 library region 都在导入上传之前不可达。

最小改动只在这两个 fixture 的端点分派：aliases 返回合法合同，FX 等不属于目标故障的端点也返回合法数据；只让待验行情路径失败。原 unknown 历史记录仍由裸 `/trades` 全局入口进入。完整保留取消不 merge、确认 merge 内容、原图表仍可见、返回搜索/展开上下文等断言。真正 aliases 失败→可解释 retry→恢复另有同票测试，不得删除/放宽 validator。此前 peer 的 W03 动态单变量证据与本链一致，但它绑定旧候选，不能冒充本 2 项现版本已通过。

### F：模拟账户测试有入口问题，也有实际目录一致性缺口

#44 从首页点击交易库，先进入 strict live，再在库内将 `交易性质` 改成 simulation，选 canonical account 时失败。Workspace `6057` 只更新 `ordinaryLibraryScope`，`6058` 却始终传 `homepageAccounts`；后者来自 explicit-live。于是即便本地 nature 已变成 simulation，账户列表仍无 canonical simulation account。`sharedSimulationRunOptions` 又来自全局 sharedScope，而不是 ordinaryLibraryScope。URL/来源摘要仍是原 live。

该用例的原意“canonical source-run 不变成业务 run 筛选”属于全局共享 scope，应从裸 `/trades` 验证，保留真实 canonical account 和 `simulationRunId`，不为变绿伪造 fixture。全局路径已有 `sharedAccountOptions:1869` 和 `sharedSimulationRunOptions:1877` 与 sharedScope 对齐。

但只改用例入口会掩盖普通库当前**真实可点击**的 nature 控件。`LibraryScopeControls` 在 `trade-library.tsx:1181–1182` 接受 onChange，首页来源集合内用户可改变本地 nature；列表范围、账户/运行目录、source 摘要和 URL 随后不再同一权威。这是源码可证明的集成缺口，尚无本轮动态独立 RED/浏览器证据，不能签 PASS。最小待授权方案应在现有 Workspace/library 适配统一该作用域的目录与目的地/本地筛选语义，或明确已批准业务合同是否允许变更 nature；不能无依据禁用控件、删除选项、把首页 URL 永久改 global，不能改 F/S/共享 scope 或原始数据。

## 顺序污染判断

当前 45 条有可重复解释的确定首因，日志没有证明“前一测试污染下一测试”。beforeEach `655–679` 重置 history/sessionStorage/localStorage、Recall repository/errors、IndexedDB trade-reviewer、所有主要 mocks 和 Sqlite client；afterEach `644–647` cleanup/restoreMocks。它们支持隔离意图，不足以证明所有 late promise 都清理干净。

旧 helper 早停时，某些 deferred metadata/行情 promise 可能未完成；当前没有单项/整组两顺序对照，也未审完所有计时器所有权，因此顺序污染标 **NOT VERIFIED / 未发现确证**。不得通过放大全局 timeout、关闭断言、强制 serial 或清空真实业务数据掩盖。修合法入口后若剩余失败，只对该最小组对比单跑、前后顺序和 late request 的归属，再决定是否是真污染。

## 建议下一步与最小改动范围

1. root 先裁定 B 的读取预算、D 的全局修复延迟加载保障、F 的 ordinary nature/目录/URL 一致性策略；没有假定新的产品授权。
2. 如获授权，在现有 `trade-review-workspace.test.tsx` 迁移共用进入 helper/新空态 ready 条件、合法端点 mock、全局入口上下文，逐条保留原业务断言。#41/#45 涉及未完成新筛选/period/calendar，显式关联后续票，不用空壳 UI 造 PASS。
3. 先跑这一份 95 项与受影响最小闭包，保留当前 45 FAIL 原日志；失败若从入口推进到业务断言，按新 first cause 继续诊断。仅在证据需要时改现有 host/Workspace/library 文件，不扩大到 F/S、shared ledger、storage 业务、全局 CSS 或配置。
4. 任何测试入口迁移都不能替代真实业务持久化、reload、guard 冲突和两宽视觉门。root 的真实 Save 正证据单列，未验门继续 NV。

以下逐条登记保持原始测试标题、首个错误位置和原验证意图；表内“迁移”是最小后续工作建议，不是已修改或已通过。

## 45 条逐项登记

|编号 / 组|原测试标题|首错 test 行|原验证意图与最小等价入口/边界|
|---|---|---:|---|
|01 / A1|keeps imported review actions in the Recall frame without a duplicate page header|966（旧 helper region @1068）|保留 Recall 唯一 header/动作结构；进入实际 round 后再断言；原首错后的断言 NV|
|02 / A1|keeps Recall header actions wired to data management, repair, and return navigation|982（旧 helper region @1068）|保留数据管理、修复、返回三动作及正确目标；原首错后的断言 NV|
|03 / A2|uses the caller-owned tag cache and sends its suggestions to the existing patterns view|1345（旧首页 region）|保留 caller-owned cache 调用次数、建议值和传往现有模式页；原首错后的断言 NV|
|04 / A1|opens production in the queue and stays on a rejected completion|1585（旧 helper region @1068）|保留未清仓不能完成、动作仍可用、putReview 未调用；queue 必须显式选择；原首错后的断言 NV|
|05 / A1|gold replay does not reveal the sale before the first bar is played|1595（旧 helper region @1068）|保留首 bar 播放前 sale 不可见的时间知识边界；原首错后的断言 NV|
|06 / A1|gold replay explains missing historical bars when stepping its first available day|1602（旧 helper region @1068）|保留首个 available day 步进和缺历史原因；原首错后的断言 NV|
|07 / A1|gold replay keeps cached historical bars before and after its first step|1611（旧 helper region @1068）|保留首步前后 cached historical bars 不丢失；原首错后的断言 NV|
|08 / A1|gold replay repairs the previously saved empty-chart entry cursor|1618（旧 helper region @1068）|保留已存空图 cursor 修复后的准确落点；原首错后的断言 NV|
|09 / A1|gold replay preserves saved progress after its first completed bar|1624（旧 helper region @1068）|保留首根完成 bar 后保存进度；原首错后的断言 NV|
|10 / A1|does not advance the training cursor when the target timeframe has no known candle yet|1632（旧 helper region @1068）|保留目标 timeframe 无已知 candle 时 cursor 不前进；原首错后的断言 NV|
|11 / A1|keeps an actual parent timeframe change in Recall's saved working graph|1644（旧 helper region @1068）|保留真正 parent timeframe 写入 Recall working graph；原首错后的断言 NV|
|12 / A1|gold replay next execution lands on a market-open fill rather than the first bar close|1659（旧 helper region @1068）|保留 next execution 到 market-open fill 而非首 bar close；原首错后的断言 NV|
|13 / A1|supplements only the selected stock account and retries the same audited request|1692（旧 helper region @1068）|保留只补选中 stock/account 和原 audited request 重试；原首错后的断言 NV|
|14 / B|boots from the SQLite bootstrap response without reading legacy execution storage|1750（bootstrap 2≠1）|不读 legacy storage 断言保留；一次 bootstrap 改为明确 owned 初始化预算前需裁定；原首错后的断言 NV|
|15 / A1|does not re-read every instrument market cache when metadata hydration updates presentation|1822（旧 helper region @1068）|保留 metadata 只更新呈现不重读全 inventory；先观测新 owned/ambient 两链；原首错后的断言 NV|
|16 / A2|hydrates the dashboard with daily data only until a replay consumer is opened|1877（旧首页 region）|保留仅 dailyOnly/无 intraday ranges；精确两次读需区分生命周期；原首错后的断言 NV|
|17 / C|keeps saved intraday replay state pending until lazy data settles|1949（strict live 中目标/筛选缺失）|从裸全局库进入同一 unknown round，保留 deferred intraday settle/离开后 late result；原首错后的断言 NV|
|18 / D|retries a homepage holding with daily data only|2040（旧 holdings region）|迁移到唯一全局修复后先测真实 interval；不能恢复重复逐行按钮或猜 live；原首错后的断言 NV|
|19 / A1|does not label daily-only partial coverage as overall market data availability|2121（旧 helper region @1068）|保留 daily partial 不能被宣称整体行情可用；原首错后的断言 NV|
|20 / A1|marks a short hourly cache as updatable even when daily data is absent|2143（旧 helper region @1068）|保留只有短 hourly cache、无 daily 时仍可更新；原首错后的断言 NV|
|21 / A1|does not block the selected replay on another stock's market data|2212（旧 helper region @1068）|保留选中 stock 不被其他 stock 的市场请求阻塞；原首错后的断言 NV|
|22 / A1|keeps a persisted hourly provider failure visible when no cache exists|2284（旧 helper region @1068）|保留无 cache 时 persisted hourly provider failure 可见；原首错后的断言 NV|
|23 / A3|keeps XPEV absent when an empty SQLite bootstrap is used in production mode|2304（旧 empty helper region @1134）|新首页真实 ready/空态后仍断言空 bootstrap 不出现 XPEV；原首错后的断言 NV|
|24 / A3|does not export legacy browser state after the SQLite server confirms migration|2334（旧 empty helper region @1134）|新 ready 门后保留 server migration 已完成时不导出 legacy；原首错后的断言 NV|
|25 / A3|migrates legacy browser state when SQLite has no migration despite a local marker|2362（旧 empty helper region @1134）|新 ready 门后保留 server 无 migration 时即使 local marker 存在仍迁移；原首错后的断言 NV|
|26 / A3|does not expose the bundled demo in production mode|2395（旧 empty helper region @1134）|新生产空态后保留 bundled demo 永不泄漏；原首错后的断言 NV|
|27 / A1|preserves the review timeframe and cursor while top navigation re-enters training mode|2831（旧 helper region @1068）|全局库进入 Recall 后保留导航 re-enter training 的 timeframe/cursor；原首错后的断言 NV|
|28 / A1|retains a Recall drawing draft per episode and gates completion until a snapshot exists|2883（旧 helper region @1068）|保留 drawing draft 按 episode 隔离及无 snapshot 完成被 gate；原首错后的断言 NV|
|29 / A1|keeps the latest Recall drawing draft while completion is gated|2952（旧 helper region @1068）|保留 completion 被 gate 时最新 drawing draft 不丢失；原首错后的断言 NV|
|30 / A1|does not describe confirmed grey-market trades as a regular-market history gap|3428（旧 helper region @1068）|保留 grey-market 成交不能误作常规市场 history gap；原首错后的断言 NV|
|31 / A1|shows all daily history by default and explains trades before the first candle|3442（旧 helper region @1068）|保留默认 all daily history 和首 candle 前成交原因；原首错后的断言 NV|
|32 / A1|scopes Recall history and replay to the selected episode|3467（旧 helper region @1068）|保留 history/replay 只用 selected episode；原首错后的断言 NV|
|33 / A1|starts before entry and advances to the first known candle when history begins after the trade|3494（旧 helper region @1068）|保留 late history 首 candle 揭示与从 entry 前推进；原首错后的断言 NV|
|34 / A1|refreshes every trade episode regardless of the selected episode|3574（旧 helper region @1068）|保留 refresh 不受当前选中 episode 限制；原首错后的断言 NV|
|35 / A1|uses META as the market-data symbol for historical FB trades|3679（旧 helper region @1068）|保留历史 FB 用 META 请求及原历史 identity 存储证据；原首错后的断言 NV|
|36 / E|keeps the library chart available after a cancelled import with failed market refresh|3720（库未 ready/仅 loading）|合法 aliases/FX，裸全局入口；保留取消不 merge 和原图表仍可用；原首错后的断言 NV|
|37 / E|keeps library context through a confirmed import with failed market refresh|3749（库未 ready/仅 loading）|合法 aliases/FX，裸全局入口；保留确认 merge 内容和图表/搜索/展开上下文返回；原首错后的断言 NV|
|38 / C|opens a library queue entry directly in the shared history workbench|3800（strict live 中目标/筛选缺失）|裸全局库显式 queue/stock/round 入口；保留 shared workbench 完整历史与返回展开；原首错后的断言 NV|
|39 / C|keeps complete-history executions within the selected account|3850（strict live 中目标/筛选缺失）|裸全局库后按原账户筛选；保留完整历史不跨账户；原首错后的断言 NV|
|40 / A3|offers the import flow in data management from the empty workspace|5239（旧 empty helper region @1134）|新空态进入既有数据管理；保留 import flow 实际可达；原首错后的断言 NV|
|41 / A2|passes stored instrument metadata into the trading room scope|5300（旧首页 region）|旧 ETF 控件不加回；persisted metadata 由合法消费者复验，P3 覆盖需显式登记；原首错后的断言 NV|
|42 / A4|retains alternate simulation runs when the complete room changes its shared scope|5322（旧未平仓回合文案）|从完整全局库 scope 验 run-a/run-b 和完整账户目录、不因筛选收缩；原首错后的断言 NV|
|43 / A4|carries an analysis unknown-to-live scope change into data navigation|5378（旧未平仓回合文案）|只替换首页 ready 门；分析 unknown→live→数据管理 scope 断言原样保留；原首错后的断言 NV|
|44 / F|does not expose canonical TradingView source runs as business run filters|5416（simulation account option 缺失）|原 canonical source-run 断言从全局入口重验；另给 ordinary 切 nature 的目录错配独立 RED；原首错后的断言 NV|
|45 / A4|returns to the trading room with its filters, period, and calendar view after opening a holding review|5439（旧未平仓回合文案）|保持恢复 UI 的目的，映射新详情→普通库→返回；period/calendar 待 P2 不能伪称已验；原首错后的断言 NV|

## 其余 11 条：产品回归判断逐项

|编号|已观察的断言 / 真实行为|当前能否判产品回归|
|---|---|---|
|14|一次 bootstrap 实为两次；调用链为 legacy bootstrap + 首次 owned bundle|读取次数变化已证实；是否违反预算待裁定，未发现 legacy 误读证据|
|17|库 region 出现，但没有缺 nature 的 stock row；尚未打开 saved intraday round|当前首错符合首页 strict-live；lazy restore 是否回归 NV|
|18|旧 holdings region/逐行按钮不在新结构；新 repair 源码默认 full intraday|批准交互替换不算回归；daily-only 性能保障存在行为差异，未动态定性|
|36|搜索框前就受 aliases=502 阻断；没有上传/取消|当前不能判 import/chart 回归；精确故障 mock 修正后原断言必须再跑|
|37|找不到 library region；没有上传/确认/返回|同上，不把 alias 初始化故障归为 merge 后上下文丢失|
|38|缺 nature 的 stock row 在首页 strict-live 入口排除；尚未打开 shared workbench|当前入口合同与测试上下文不一致；workbench/history 回归 NV|
|39|strict-live 空 entries，header 内高级筛选动作不挂；未选账户|不是此日志可证明的账户隔离泄漏；进入合法全局库后原强断言仍必需|
|42|旧未平仓文案之前终止；后续 simulation options 未执行|生产首页仅实盘是批准变化；完整 run/account options 可达性仍 NV|
|43|旧未平仓文案之前终止；实际 fixture 已 explicit live|未到分析/数据管理，当前不能判 scope 传播回归；仅入口门失效|
|44|库内可切 simulation，但 account options 没 canonical simulation account|源码确认 ordinary 本地 nature 与固定 homepageAccounts 不一致；有真实集成缺口，需独立 RED/有限策略修复，原全局目的仍应另验|
|45|旧未平仓文案之前终止；旧持仓直入复盘和旧 calendar/filters 未执行|批准旅程已改变；返回快照目的仍必需，后续 P2 控件尚不可视作本票已验证|

结论：不删测试、不放宽旧业务断言、不把缺 nature 自然填 live。先修入口/端点前置条件，再让原功能断言实际运行；D/F 和 B 预算由 root 审查后才决定产品最小修复。顺序污染目前没有确证，所有遮挡行为维持 NV。

## Root 后续裁定（本原始 02:28 FAIL 不倒改）

Root 已在 `acceptance-2.md` 将正式第 2/3 轮判 FAIL，有限依赖门保留，下一候选为最后第 3/3 轮，计数不重置。完成本只读分类后，原允许范围的最小修复已获授权；本报告本身没有实施这些修复。

- **B**：固定两次 bootstrap（legacy 初始化 + owned 完整 bundle）允许；保留不读取 legacy execution storage、请求归属和完整 bundle 的强断言。不做缓存重构；daily 双 owner 次数必须迁移入口后记录真实轨迹，不能随手放宽。
- **D**：首页当前/期间/历史消费者都只需日线。先以真实 explicit-live 缺行情持仓触发唯一全局修复的 RED，再仅首页 `onRepair` 显式 `includeIntraday:false`；共享 refresh 默认值不变。这使本报告 D 的策略不确定项获得明确裁定，仍需 RED/GREEN 证据。
- **F**：用户在首页来源普通库主动改 nature 时，明确转入裸全局普通库；共享 scope、账户/运行目录、来源摘要一起切换，原首页来源 UI 保留可返回。不给缺性质记录补 live，不禁用选项，不改首页 live 范围。F 仍需先交独立动态 RED 和原子方案，等待 root 实施授权。
- **A/C/E**：迁移 helpers/ready 条件、两个 endpoint fixture、明确裸全局入口，完整保留原业务断言。#41/#45 的新真实消费分别待 P3/P2，不伪造当前筛选/曲线控件。S 消费待 root 独立接受新接口后再改。

## F 最小接口与原子顺序建议（尚未实施）

当前断点不是 `LibraryScopeControls` 本身：它在改 nature 时已显式清 `accountIds` 与 `simulationRunId`。缺口在 Workspace 当前只改 `ordinaryLibraryScope`，host 路由和共享目录没有同一次转移。

建议只扩既有 host 的全局导航适配，不修改 S：`openGlobalTrades(commit?: () => void): Promise<boolean>`，把可选 commit 传入私有 `navigate`。它只在现有 guard 返回允许、导航仍有效之后调用，并与写入 `/trades` history/route 同一同步提交段执行；拒绝或旧导航返回 false 时不运行 commit。具体名称可由 root 审查，关键是不得先调用 `updateSharedScope` 再 await guard，也不得先写裸 URL 再异步补共享 scope。

1. Workspace 只检测 ordinary 首页来源集合上的 **nature 实际改变**；先纯计算 `normalizeSharedScope({...ordinaryLibraryScope,...patch})`，采用控件已提供的 accounts/run 清除，不提交任何状态。
2. 调 `homepage.openGlobalTrades(() => updateSharedScope(nextScope))`。host 先沿既有 leave guard；取消/失败时 URL、普通库 scope、共享 scope、账户/运行目录、来源 snapshot 均保持旧值。
3. 允许后，单个同步提交段：更新全局共享 scope；保留当前首页 `hpSource`；push 裸 `/trades`，并将 route 标为 global。不得改 homepage snapshot.scope/live/market/accounts/date。现有 Workspace route effect 继续将 ordinary scope 置 null、采用 global browse；在 route key 未同步时现有 loading gate 防止旧 ordinary 行以新 global 标签展示。
4. 全局 render 统一使用现有 `sharedScope`、`sharedAccountOptions`、`sharedSimulationRunOptions`、`scopedTradeLibraryEntries`，来源摘要显示“普通交易库 · 当前共享范围”。之后普通库 nature 切换继续用既有全局逻辑，不自动切回首页来源。
5. 返回首页仍用保留 source snapshot 做完整恢复及 owned fresh read；global nature 不能覆盖首页仅实盘范围。直接裸 `/trades`、pop/back/forward 和 global→round→guard retry 保留原策略。

最小验证面：来源 live→simulation 时 URL 变裸、nature/account/run 同步，live→unknown 同理；guard cancel/throw/stale intent 不得提前提交；原 canonical source-run 不生成业务 run filter；返回仍是原首页非默认范围/UI，global 修改不污染 source。这个 callback 只用于 guard 后提交适配，不引入新业务 scope 或共享账本。

### F 独立动态 RED 已补（不倒填原全量运行）

证据 `F-nature-diagnosis/REPORT.md`、`01-product-red.log`、前后 manifest：1 FAIL / 1 PASS，模拟读取/内存 IndexedDB，无服务/真实 DB。来源库性质已 simulation，但 URL 仍 scope=live&accounts=live-account，账户目录仍 all/live-account，运行控件缺失；裸全局对照同数据同动作有 simulation-account/run-f-probe。因此 F 的新策略缺口已有独立动态确认，仍等待实施授权。探针消费 F/S 是各自正在开发的新 hash，非旧 F3/S2，只将稳定的 P1 源路径与观察绑定，不当作 freeze2 02:28 全量结果。第一遍 harness helper 缺失错误单列保留，不计产品 RED。
