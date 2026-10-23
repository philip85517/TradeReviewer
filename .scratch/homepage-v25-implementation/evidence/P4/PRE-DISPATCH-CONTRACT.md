# P4 历史与贡献：派发前完整合同草案

状态：**DRAFT，供 root 裁定；P4 仍 0/3，未授权产品实施或正式验收。** 2026-10-23 02:55–03:05 Asia/Shanghai。作者 `/root/state_g61`，实际模型 `gpt-6.1-sol / ultra`（GPT6.1 Ultra）。本任务只新增本文；未修改产品、既有测试、S/F、历史证据或共享追踪，未访问 DB、浏览器、服务，未派代理。静态 SVG 经现有 sharp 渲染后直接看图，临时 PNG 位于 `/tmp`；这不是产品视觉接受证据。

## 1. 原始依据、范围和依赖

本合同依据原正文，不以 issue 摘要、原型 fixture 或本报告取代原文：

* `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`：HP02:193–221（费用、FX、跨期贡献）；**HP05:349–432 全文**（历史和贡献）；HP06:434–464（详情、普通库与返回）；HP09:467–514（状态、请求、动效）；HP08/10:516–568（公共组件和独立验收）；附录2:646–668（URL 权威）。同时核对 HP11 整页与局部联合规则。
* 同目录 `component-manual.html` 正文完整阅读：103–108 的历史/贡献组合约束；IconButton、SegmentedTabs、Select、MetricCard、StatusBadge、DataTable、ChartTooltip、EmptyState、RetryButton 的完整状态、键盘与事件规则；1133–1138 的边界。12 类组件的 96/85/11 是手册总表，不是 P4 已测数量。
* `.scratch/homepage-v25-implementation/issues/07-history-contribution.md` 全文，以及 `DESIGN-COVERAGE.md` 的 HV25-15/16、31–49、50–55 全相关行。
* `evidence/P2/data/PRE-DISPATCH-CONTRACT.md` 全文、`COORDINATOR-CONTRACT-DECISIONS.md`、`p2-a/CANONICAL-EXTRACTION-PROPOSAL.md` 与 `ROOT-CANONICAL-AUTHORIZATION.md`；`P4-MIXED-PROVENANCE-ORACLES.md` 和 **`P4-COORDINATOR-PROVENANCE-DECISION.md`（含真实输入补充）**。混合来源以后一份 root 决定覆盖旧 oracle 中的候选 pro-rata 政策。
* S v3 当前源码/接口；当前 session-model、host、home-surface；canonical ledger、F/P2 候选接口；真实 TradeExecution/TradeEpisode、StatementPosition/Event、IPO allocation 去重来源；现有复盘持久化 handler/repository/HTTP route。均为静态只读。

直接查看的精确图：

|作用|精确参考（均相对 `source/images/`）|查看范围|
|---|---|---|
|整页位置、密度、A/B 卡|`home-history-1440.svg`、`home-history-1280.svg`|完整长页；原图 1440/1280×2346；产品比较视口另为 1440×1000、1280×800、100%|
|历史四模式|`history.svg`、`history-stats-cumulative.svg`、`history-stats-win.svg`、`history-stats-rounds.svg`|同一 1440×1000 画布和绘图区|
|历史等待、空、错、缺、极值|`journeys-year.svg`、`history-stats-empty.svg`、`history-stats-error.svg`、`history-stats-source-missing.svg`、`history-stats-extreme.svg`|完整局部分镜；不是新页面|
|贡献路径与模式|`contribution-states.svg`、`contribution-current-a-share.svg`、`contribution-historical-a-share.svg`|全部市场→A 股标的→历史，同一底部模块|
|贡献异常、符号|`contribution.svg`、`contribution-loading.svg`、`contribution-empty.svg`、`contribution-error.svg`、`contribution-extreme.svg`、`contribution-mixed-sign-demo.svg`|完整状态和异号边界|
|胜率卡压力例|`../prototypes/winrate-proposed.svg`、`../prototypes/winrate-narrow-proposed.svg`|直接看原尺寸 321×88 与 278×104|

同时读 round5 `history.html/history.js` 与 contribution 交互控制，原型仅用于状态/视觉解释：其 `historical` 枚举不能覆盖 S 的 `history`，fixture 的 null→0 排序、简单去浮盈及详情占位不能作为财务/产品实现。

**既定 owner 与门槛：** 整页、历史/贡献 UI、host/session、已有详情及普通库返回由同一 UI owner `/root/integration_g61` 接线；财务候选 seam 由 `/root/financial_g61` 负责，root 独立整体验收。S v3 已由 root 独立接受恢复第2/3轮 PASS，继续冻结。P1 使用有限依赖门，不等于整页已经接受。P2 当前 source/batch/canonical extraction 仍是工作候选、0/3；F 已接受能力不等于 P2 新能力已接受。必须先接受 P2 最小实际数据旅程及其版本指纹，再消费其依赖能力；不得将 P4 接线当作暗中接受 P2。

## 2. 先请 root 关闭的三个财务边界

以下建议没有被本文自行升级成批准规格。UI 准备可以继续，依赖这些定义的数据实现必须等 root 裁定。

|编号|原文与真实接口缺口|建议最小决定及可检验反例|
|---|---|---|
|D1：关闭回合事实|HP05“交易平仓日”“未完成回合不混入”；真实 episode 有 `endedAt/status`，canonical 目前公开 observer 只有 before/after quantity，尚无完整 closed-round facts|以同一 canonical transition 及其证据界定实际关闭部分，episode 用作稳定关联而不是盲信结束标签。部分减仓不加回合；反向成交只关闭旧方向一个回合，同时开新方向；IPO 非 execution 事件可改变来源/数量，但不得造一次成交或重复回合。完整性不足时关闭事实/结果分别 unknown，不能拿最后导入/updatedAt 代平仓时间。请确认一个累计加仓→减仓→归零为一个业务回合，并确认 imported episode 与 canonical 关闭事实冲突时 fail closed + 原因，而不是静默任选。|
|D2：历史卡“已扣费用”|HP05 问已结束交易“最终结果”，四卡含“已扣费用”；P2 的 `periodFees` 是**实际发生日**费用，不能直接当所选关闭回合承担费用|建议历史净盈亏用选中关闭回合最终 canonical 净结果，历史已扣费用用这些关闭回合已分配、已扣的 entry/exit/IPO 费用，清楚称为该结果所扣成本；保留独立 incurred FeeFacts 对账，不能改写原发生日。下文 mixed-fee：首次平仓承担5、最终累计10；对应当前期间实际发生费2/4。若选实际发生费作为历史卡，需另明确卡与净结果不一一对应的文案，不能继续把2/4称“净结果所扣5/10”。未知费用的净结果/费用 unknown，不反向影响已知回合数。|
|D3：历史金额的 FX 基准|P2 当前期间用同一 endpoint FX 转换 R/openUF/closeUF；HP05 要历史四卡/图/贡献同口径，但未明说跨年份已关闭回合按关闭日还是范围终点换算|建议历史关闭结果按其**上海业务关闭日**具备 pair/known/published/fetched 截止的历史汇率转换，再聚合；同一选中回合在四卡、月/年桶、累计、历史贡献复用完全相同的转换事实。历史 FX 缺失就 unknown，当前最新 FX 不回填。若 root 选择统一范围终点 FX，也必须明确 policy/version 并让四卡/全桶/贡献同基准；禁止一边逐日 FX 累加、一边以范围终点重换总额。当前数据没有完整历史 FX journal，不能以“今日 FX 已有”假装历史可计算。|

另两处规格解释：

1. **已确定优先级：** `contribution-error.svg`/旧原型的局部“重试”与正文/手册唯一全局修复入口存在差异。采用 HP09 + 手册 RetryButton 的唯一全局修复入口；图中的旧局部按钮不进入产品。失败仍在原区解释并保留旧数据，不再复制修复控制。真实复盘保存失败的既有“重试保存”是持久化操作，不能与行情/首页全局修复混为一谈。
2. 胜率判赢建议使用 canonical 全精度净结果 `>0`，不能先万/亿或展示小数四舍五入再分类；正文“按分归一化0.00”明确约束贡献真零显示。对 `<0.005` 的展示归零与“盈利回合”若产品需同一业务精度，请 root 明定统一金额精度，禁止展示层自行改金融胜负规则。zero 回合始终在分母中。

## 3. 唯一权威和可消费 seam

|事实|唯一 authority|P4 可以做什么 / 不可做什么|
|---|---|---|
|数量、平均成本、gross R、F 费用池、开放费/已实现费|既有 canonical evaluator + F 已批准规则，P2 只提取/批处理同一 evaluator|读同一事实做聚合/展示；不得按 long/short/IPO 各跑独立成本账本，不重算一次反转整笔费|
|原始费用、实际发生日、金额及归属知识截止|P2 `HomepageV25FeeFact` lineage/incurred/knowledge|关闭回合分配与 incurred 两张视图保持来源可追踪；不能把晚退款当负费用或晚入库当发生日|
|期间/历史/来源输入与 asOf、quote/FX policy|P2 immutable opaque prepared source + accepted bundle `sourceId/revisions/policies/scope/period/asOf/generation`|同一次读数全模块引用同一版本；不读另一个 market cache 拼出“新”历史结果；无365次完整投影循环|
|已应用 UI、draft、四模式、两套贡献记忆|S `HomepageState.snapshot` v3；draft 和请求域仍在 S|不再建 React 第二份 committed range/category/page，不在 UI 缓存业务值进 snapshot|
|请求数据接收与浏览器/URL/返回|现有 host/session owned read，integration 唯一 owner|S 只判断 request，host 将对应 data 与 committed UI 原子接收；外部 options.data effect 不能覆盖已接收新 bundle|
|复盘状态及写入成功|已有 episode review record + server repository/版本检查|pending 来自真实适用 episode；控件操作不能本地伪造 completed/deferred |
|全局 market/account/live；普通库目标范围|已验证 URL + S committed scope；source 只恢复首页 UI|局部下钻不改全局 market；普通库不得偷偷携 attachments/queue |

### 3.1 现有接口与缺口（不得把建议 API 当已实现）

* F 当前公开 `prepareHomepageV25Source` / `projectHomepageV25Boundaries` 候选返回 period R、opening/closing UF、UF change、net、lifetime R/net、MV、openFees、periodFees；每个 metric 带 `available/coverage/reasons/money/FX`，每 instrument 带独立 identity/evidence/quote/fees。P2-A 批处理方案仍待独立接受。
* canonical 当前 `preparePositionReplay` 的公开 `transitions` 仅 `executionId + before/after {quantity,quantityKnown}`；不足以提供关闭回合 gross R/fee pool/来源归属。不能凭 observer 名称假定已经有完整 seam。需要额外 canonical 事实提取时，先给 root **最小只读提取提案并获授权**，不能借 P2-A 授权搭车改 ledger。
* 当前没有正式 closed-round/history/attribution builder，也没有可信 disposal→lot link。建议边界如下（名字供派发确认，非新增第二 state）：

```ts
// 财务 owner：输入同一 accepted prepared source/selection，不重新读 DB。
buildHomepageV25History(source, {
  range: snapshot.history.range, asOf, attachments, requestGeneration,
  policy // root 关闭 D1/D2/D3 后固定版本
}) -> HistoryBundle

buildHomepageV25Contribution(source, {
  currentPeriod: snapshot.period, historyRange: snapshot.history.range,
  asOf, attachments, policy
}) -> { current: ContributionDataset; history: ContributionDataset }

// UI owner：选择、排序、分页为纯 view，不改数据事实。
selectContributionView(dataset, snapshot.contribution[mode], globalMarket)
```

建议只读输出最少包括：稳定完整 account+instrument+market+currency+nature/run identity；closedRoundId/原 episode 关联、关闭 instant/Shanghai businessDate/关闭证据；grossR、realizedFee、openFee、openingUF、closingUF、net 各自 availability/reasons；source class 与 provenance availability；原币/目标币、FX facts；scopeCanonicalTotal、每类 total、局部可见 total 分别命名。HistoryBundle 还含 range、bucket grain/date、closed count/winners/denominator、四卡、各期/累计、fee policy、sourceId/asOf/generation。**不知道来源类别的已知 instrument net 是合法输出，不能强制 category 非空才返回该 instrument 财务。**

关闭回合计算需先消耗完整 canonical 历史，再按关闭 businessDate 选中；不得先按当前期间 execution date 裁掉开仓、费用、IPO 或 opening evidence。history range 是独立范围，不能把当前 period 预先截断后的 trades 当完整历史。首页 attachments 采用已批准复合组资格并适配各模块源集合：表现、持仓、历史、贡献同范围资格，不得只筛表格；但不因此截断该合格组计算所需的完整账本。

### 3.2 S/host 最小接线差异

S 已存 `history.range`（all/year/this-year/years）、`history.chartMode`（period-pnl/cumulative-pnl/win-rate/round-count）；贡献 `mode=current|history`，两套各自 category/sort/page/market/symbol/drilldown，**只有 current 有 openOnly**。沿用这些字段与 `updateHomepageUi`，不改 S 源码或加影子 selected 字段。

历史范围用现成 `editHomepageHistoryDraft → beginHomepageHistoryApply → completeHomepageRequest({domain:'history',generation,scopeKey,ok,...})` 及 history retry/timeout/cancel。现有 session-model 的 finish 只有 global，host 目前 pending token 也只接 global；integration 必须在**同一 session/host**加对应历史域 owned data commit。range 应用成功一次提交历史四卡+四模式所需数据+historical contribution dataset；当前贡献 mode、当前 period/表现/持仓不强切。失败/取消/15s timeout 保留旧 committed range/data；retry 新 generation；晚响应不得提交。

期间请求与 history 请求独立，global identity/navigation supersession 按 S 域规则失效双方；完整 key 包含规范化 scope、attachments、该域期间、source/policy/asOf 所属数据版本。读取中改 chartMode/贡献本地 view 不能被完成回调旧快照覆盖。数据 bundle 不进 sessionStorage/hpSource。冷启动 UI 恢复后请求不活跃，要新读实际数据。URL navigation 的 period 原子提交沿用 S 已批准 intent，不加页面 hasExplicitAll。

## 4. 完整页面与控制状态合同

### 4.1 页面与历史

历史默认展开，位于当前持仓下方、**唯一底部贡献上方**；滚动即见，无卡片跳转入口、新页面、双栏或额外包裹左缩进。标题18/600、图标题16/600，四张等宽卡顺序固定：已平仓净盈亏、回合数、胜率、已扣费用。MetricCard 只读，整卡不伪装按钮；完整值/单位/unknown 原因可经 hover/focus 查到。

年份范围完整提供单年、今年、年份区间、全部，以及选择、应用、取消/Esc、焦点返回；年份用下拉箭头语义，不能套日期日历图标。单年12个月；跨年/多年按真实年份，不加第二粒度控件。all 的可用范围来自真实可信历史/截止信息，不能由任意 fixture 年份硬编码。

四模式同一容器、绘图区、操作区和预留轴宽：各期盈亏默认；从所选范围起点累计；每期独立胜率；回合整数。金额轴标币种且同四卡，按万/亿、2位、完整值可查；% 固定0–100；回合轴整数覆盖范围。跨单位不曲线 morph。日期点 tooltip 包含真实日期粒度、单位、完整值、原因；十字线仅临时读数，不导航。键盘箭头/Home/End 查点、Enter 固定、Esc 解除/关闭；鼠标离开清除，键盘与鼠标信息等价。手册 point反馈120ms、tooltip300ms；触摸另验，不能用 mouse 证明 physical touch。

|读数状态|必须可观察输出|禁止的替代|
|---|---|---|
|初次读|稳定骨架/尺寸，真实 loading 语义|先画假0曲线|
|更新 range|旧范围标签、旧四卡/图/历史贡献完整保留，另有等待说明|新年份配旧金额；清空已知数据|
|成功无 closed rounds|回合0，胜率—，“暂无已平仓回合”；无伪趋势；点说明“该期间无已关闭回合”|0%当无样本；假盈亏0趋势|
|有 closed rounds、真零|0.00、中性，真实回合数；胜率按分母结果|与无回合混成同一空态|
|source missing|受影响金额/比例 unknown+明确原因，线断开；已知 count 可独立保留|丢掉 unknown round 缩小分母；null→0|
|future/uncovered|中性灰区域+尚未到达/未覆盖说明|延长最近点到未来伪趋势|
|read error/timeout|旧 committed range/data；唯一全局 repair/retry 入口作用于失败目标|局部复制按钮、错误被显示为无交易|

累计遇 unknown bucket 不可跨缺口宣称完整累计值；已知前段可以显示，后段传播 coverage/reason。无回合且资料完整与缺历史输入必须分开。未来不能参与总样本或金额。数据补录/撤销/修正成功后按关闭日重算受影响年，显示带业务时区的真实更新时间，不常驻“正常/已更新”成功徽章。

### 4.2 贡献全路径与互斥

默认在同一底部模块切“当前期间 / 历史已平仓”，各自日期只读继承 period/history range，无第二套日期选择器。切换不移动上方区域，不恢复另一全局 market。全局 all 时显示 A股/港股/美股三个市场行（来源缺失则真实原因），点击实际市场行→该市场标的列表→选择实际 symbol→已有详情容器；面包屑“全部市场 > A股”回市场，页头仍 all。全局 concrete market 直接对应标的列表，不强插三市场步骤。

long/short/ipo 三项互斥；切换同时更新摘要、条形/列表、该类全量合计、当前页。分类14px下划线；sort28px视觉面/36px命中；openOnly16px复选框/36px命中并独立于分类/sort。history 中该控件仍占原位且 disabled+原因，current 原选择保留；切回 current 恢复。IPO 只有获配及其后续处置，上市后自行买入属于 long；不能整个 instrument 标 IPO。

profit-desc 为已知净贡献降序，loss-asc 为升序；必须给相等值稳定 identity tie-break；unknown 排序位置需固定且标明，不用0参与排序（建议已知后置 unknown，待 root 确认）。切分类、排序、current.openOnly 只重置活跃模式 page=1，另一模式完全不变。局部 market 下钻 page=1；返回同一既有市场列表可恢复其有效 page。全局身份变化只做必要的合法性 reconcile，不能从另一贡献模式覆写全局 market。

标的固定8行/页；50项7页，末页2；三个市场不套符号分页。0结果无1/1，无可点击翻页；不足一页不伪造多页。翻页只替换当前列表，标题/四卡/上区位置稳定，键盘焦点进入新页首行；数据减少页码合法夹取，消失触发项回贡献标题，仍有效条件保留。**合计来自分页前全量**。同时明确 scope canonical total / active category total / local market或openOnly子集 total：不能把本页、已知子集或局部 openOnly 结果冒充全范围期间净额。current.openOnly 是局部视图；首页 attachments.openOnly 是全局源资格，二者不能互相覆盖。

current/history 分别完整记忆 category、sort、page、local market、symbol、drilldown；current.openOnly 单独记忆。模式切换前后这一组字段与上区 rect 可独立观测。refresh 保留 UI 有效记忆但重读业务；字段存在不等于已经完成消费，不能只测 snapshot。

### 4.3 条形、数值和可归因性

current `net = periodRealized + closingUF - openingUF`；实心为已实现，中空为 UF 变化，均为同一 scope、费用/FX/截止口径。历史只含选中关闭回合最终结果，**没有当前 UF**，不得把当前所有 symbol 的 UF 设置0就冒充历史闭合归因。

正绿 `#53D7A0`，贡献负柱粉 `#EF7F89`（普通负数文字 `#FF8592`），相同方向实心/中空同色。两段外高都14px，空心描边内缩；同号从0连续叠，异号分居0线两侧，不能全取abs向右叠。极小值不加可见最小金额宽度；按分归一化真零中性0.00、无假柱；unknown显示“不可计算”及原因、不画0柱。金额缩写不能替代 tooltip 完整值或真实排序。

## 5. 历史/期间字面 oracle 与边界

|ID|最小输入|字面结果 / 反例|
|---|---|---|
|H01：完整跨期|openingUF=100；期间 net realized=150；closingUF=0，其他同scope同FX|current net=50，不是150。已平仓部分 openingUF 必须仍在扣除|
|H02：同事实的两口径|成本100；期初mark120；期间以130全平，费用0|current R30/openUF20/closeUF0/net10；历史关闭回合最终net30。两者不能相加或共享一个“收益”字段|
|H03：上海年边界|平仓 instant分别 `2025-12-31T15:59:59Z` 与 `2025-12-31T16:00:00Z`|Shanghai 分别2025-12-31与2026-01-01；年计数分别归2025/2026；不能按UTC/机器本地/updatedAt归年|
|H04：部分/反转|+2→卖1→卖1；另 +1→卖2|前者首次部分不完成、最终完成1回合；后者关闭long1回合并新开short1，不算2个已闭回合；execution fee一次，不给close/open各扣整笔|
|H05：分母|1月1赢/1closed；2月1赢/9closed；含零净结果于closed|范围 winners2/closed10=20%；不平均100%和11.111…%。零结果仍入10的分母|
|H06：空/零/unknown|无closed；有2closed净额0；已知closed2但一个net缺费用|分别胜率—/有分母按真实胜负/胜率unknown原因；第三种不能丢一回合变“1/1”。已知closedCount2仍保留|
|H07：范围与月桶|单年2025；当年尚未到达12月；多年度2024–2026|单年12个月位，future灰不造点；多年度真实年份；累计从选中起点，unknown后不能接完整累计线|
|H08：费用非同量|取得费2+4在期前；期内首次平仓费2，下一次平仓费2|当前期间 incurredFees=2/4；对应关闭已分配费用5/累计10，不能替换。历史卡待D2裁定|
|H09：FX|原币R30/openUF20/closeUF0；当前endpointFX=7|同endpoint转换 R210/open140/close0/net70；禁止opening×旧6、closing/R×7得90。历史跨期FX另按D3统一policy|
|H10：数据修正|已闭round12月31，补录费/撤销/关闭日改次年|真实源新revision重算所有受影响原/新年、cards/chart/history contribution一起更新；旧请求晚到不恢复旧归年|
|H11：独立依赖|无估值但closed gross/fee完整；有quote但fee未知；quantity conflict|closed结果不依赖无关当前quote；fee未知影响net/fee而非凭空抹掉已知count；quantity冲突不能发布可信MV或分类数量|
|H12：权限与未知|无适用episode；deferred；completed；至少一适用pending|前者review资格unknown，不当“已复盘”；deferred/completed非pending；yes仅真实pending，no须全部适用已知且无pending。[]与[false,true]不筛选但保选择|

聚合计数、金融结果与 UI 页码独立：不能用 rows.length、当前页、复盘完成数或 execution 数当闭合回合分母。历史盈利不是“只统计获胜/复盘完成/可估值”的幸存者样本。实际 group 资格按 account+instrument+nature/run 保持复合键，不能 account集合×symbol集合交叉泄漏。

## 6. 混合来源：root 已裁定的 oracle 与真实限制

**实际模型没有 disposal→lot link。** `TradeExecution/TradeEpisode`、`StatementPosition/Event` 无可信处置关联；`ipoCostEvidence` 是取得现金链，`positionEffect` 是方向。`sourceTradeId` 在 `isExecutionBackedIpoAllocation`（statement-evidence:620–670）只佐证 buy 与 allocation 是一次取得，不能推出后续 sell 来自 IPO。不得为 passing trusted oracle 人工补造真实 link、扩 schema/importer，或无链默认 FIFO/pro-rata/整证券 IPO/“其他”。

### 6.1 零费 trusted oracle（仅 future-capable 合成输入）

IPO 1@100 + 手买1@200，**一个 canonical 平均池**成本300；t0 mark160，t1卖1@180且mark180，t2卖余1@190。期间从t0开始。可信且截至处置已知完整 link 指明首次卖IPO：

|时点/类别|qty|cost|grossR|openingUF|closingUF|selected net|
|---|---:|---:|---:|---:|---:|---:|
|t0 canonical|2|300|0|20|20|0|
|t0 IPO / long 各|1|150|0|10|10|0|
|t1 canonical|1|150|30|20|30|40|
|t1 IPO|0|0|30|10|0|20|
|t1 long|1|150|0|10|30|20|
|t2 canonical|0|0|70|20|0|50|
|t2 IPO|0|0|30|10|0|20|
|t2 long|0|0|40|10|0|30|

t0 类别成本重分配须留零和 transfer（IPO+50，long−50），不是改写原取得100/200。t1→t2 选择期间的 IPO0、long `40−30=10`。若可信首次卖long则类别角色交换，canonical不变。无链 pro-rata 的 t1各0.5份、R15、t2各R35 不是实际来源 oracle。

### 6.2 非零费 trusted oracle与实际 no-link 门

取得费 IPO2/long4，各次卖出费2。t0费用池6；t1释放旧费用3+卖费2→已实现费5，余openFee3；t2累计已实现费10。

|时点/类别|grossR|realizedFee|openFee|openingUF(net)|closingUF(net)|net R|selected net|
|---|---:|---:|---:|---:|---:|---:|---:|
|t0 canonical|0|0|6|14|14|0|0|
|t0 IPO / long 各|0|0|3|7|7|0|0|
|t1 canonical|30|5|3|14|27|25|38|
|t1 IPO|30|5|0|7|0|25|18|
|t1 long|0|0|3|7|27|0|20|
|t2 canonical|70|10|0|14|0|60|46|
|t2 IPO|30|5|0|7|0|25|18|
|t2 long|40|5|0|7|0|35|28|

t0 fee-pool transfer 也须零和（IPO+1，long−1）；不得将取得费事实2/4写成3/3。实际期间新发生费用 t1=2、t2=4，非5/10。qty/cost/grossR/realizedFee/openFee/openingUF/closingUF/net 均逐组件加总守恒，实际费另按原始来源/发生日守恒。

对**当前真实 no-link 混合处置输入**：t1/t2 canonical selected net 仍可知40/50（非零费38/46）；受影响 IPO/long 分类为 `unknown + provenance-ambiguous`，类别合计不得发布20+20、18+20等 trusted 数。保留全范围 canonical 总额及不可归因说明；不求“已知分类”小计冒充全量，不填0，不藏掉这一instrument。纯IPO、纯手买、纯short、同instrument多account不同来源必须另测；只因一类别未知不能抹掉无关instrument已知金融结果。

## 7. 详情、普通库、返回与持久化权限

symbol行唯一稳定 triggerID 要含 mode/local market/完整symbol身份，点击实际目标打开**已有交易详情容器**，不能固定首个symbol、复制 prototype 占位或要求其必须仍在当前 holdings。history 已闭symbol无持仓也须可达真实详情，身份/范围不可用时给可解释状态，不选别的symbol代替。

普通库目标仍按附录2 market/accounts/current applied date或custom/symbol/live，不因历史贡献选了某年就偷偷改目标日期；history range 与当前 period 是两域。若 root 希望“历史贡献查看交易”特设历史日期目标，需要另显式裁定，不能由接线者隐式覆盖。attachments 仅恢复来源首页，不通过 hpSource 暗中过滤库，不把 pendingReview 转 queue。跨市场目录/详情不改全局身份，交集为空是真空集合+原因。

关闭详情恢复来源 mode/category/sort/page/local drill/current.openOnly、history range/chartMode、全局身份/附件/period、滚动和精确 trigger focus；对象消失时回**贡献标题**，保留有效条件。进入普通库→浏览器返回/应用返回→reload 必须 URL 目标和 UI source 分工正确，catalog先验证；source过时/无效不能扩范围或伪造data。所有请求新读，snapshot只含S允许UI，无fills/FX/金额缓存。

pending review 与“pending request”分别处理：

* 复盘资格沿 P3 root 裁定：yes=至少一个适用 episode 的真实reviewState=pending；no=没有pending，completed/deferred是非pending；未知/缺episode不推定已复盘。不能直接复用 review queue 的 closed-only 筛选去改首页组语义。
* P4 模式/排序/分页/hover 不写业务记录。若详情可完成/暂缓/重开，复用 `EpisodeNotesPanel` → autosave → workspace `saveEpisodeReview` → `ApiEpisodeReviewRepository.put` → HTTP PUT `/api/storage/reviews` → SQLite既有链。完成有正文校验、暂缓必须原因、drawing flush失败先阻断、409版本冲突不假保存成功；busy时按既有权限禁用并给原因，失败保输入和焦点，不吞掉dirty/leave guard。
* 保存成功后的 pending组资格及四区投影必须用新read/revision统一刷新，不能只从当前行本地移除再假称持久化。保存失败不能让历史/贡献先显示completed。迟到旧全局/history bundle不能覆盖更高版本review或刚接受bundle。
* 请求等待保旧 committed，重复apply/retry去重，禁用控制须可解释；不能因financial unknown而无差别禁掉所有可浏览详情/返回。

真实写入验收只用隔离DB：读取seed baseline→详情真实保存→HTTP/SQLite读回→返回→整页reload→核对pending筛选与四区结果；再测defer/reopen、409、网络失败/drawing失败、取消/离开。原始业务DB不得写。本次未执行任何上述旅程，全部 NOT VERIFIED。

## 8. 逐项验收与动态控制清单

每项需绑定实施冻结SHA、实际输入和输出、鼠标/键盘等输入方式、证据路径。pure/DOM不能代替真实UI/HTTP持久化/视觉比较。root独立人直接对渲染图与参考图；worker/pass局部不等正式P4接受。

|验收ID / coverage|可观察旅程与反例|必需证据|
|---|---|---|
|P4-01 / HV25-32,54|从首页直接滚动，历史四卡→图→唯一贡献；无卡片入口/双栏；1440/1280布局A/B|真实整页截图+原图同状态对比，区域rect与独立审查|
|P4-02 / 32,33|year/this-year/years/all每选项、应用/取消/empty/非法range；range成功原子换历史三部分，mode/current上区不变|S/host domain测试+真实range旅程，等待/失败前后读数|
|P4-03 / 34|四模式全切、轴单位/月年文字/尺寸、金额极值0/100%/巨大回合数|同viewport四张图、几何与full-value键盘读数|
|P4-04 / 35|H03–H07；无回合/真零/缺失/future/失败/timeout分开|字面finance断言+逐态截图，不以一张空态覆盖|
|P4-05 / 15,16,32–35|H01/H02/H08/H09，关闭日、分母、费用/FX政策全组件对账|canonical/F/P2同bundle pure oracle；当前缺历史FX必须unknown|
|P4-06 / 36–38|全局all→真实market→symbols→真实closed/noholding详情；concrete market直接symbols；三类互斥|真实journey+URL/global header前后不变+detail身份|
|P4-07 / 38,42|mode两套非默认分类/sort/page/drill，current.openOnly勾选→history禁用→回current恢复；globalmarket变更不串|snapshot纯测+真实切换/refresh/reload/UI值和行集|
|P4-08 / 39|当前贡献全范围对期间net，历史贡献对选中closed结果；局部类别/openOnly/page不冒充全量|全量与local total分别读数，H01/02、mixed字面oracle|
|P4-09 / 38,39|trusted纯来源/混合oracle与真实no-link分别；missing/conflict/future/partial link unknown|全组件守恒+真实类型输入反例；no-link canonical已知/category未知同时出现|
|P4-10 / 40|正正/负负/正负/负正/真0/极小/unknown/极大；实心/空心同14px，符号色与full值|独立像素/几何对比mixed-sign图，键盘tooltip|
|P4-11 / 41|50项→7页末2；3市场无symbol分页；0项无1/1；分页全量合计不变/焦点首行/上区不移动|真实完整分页journey+静态全量对账+focus/rect|
|P4-12 / 42,44–46,53|非默认状态→详情→关闭；→普通库→return→reload；原symbol消失titlefallback；nativeback/forward|真实URL/持久化/scroll/focus证据；不能只测restore函数|
|P4-13 / 43,47–49|首次loading、更新保旧、新旧并发、失败/15s timeout/cancel后late、domain交错|host-owned原子commit定向测试+真实等待失败状态；scope/generation前后值|
|P4-14 / 48,51|全局唯一repair入口；局部说明无伪按钮；全部hover/focus/keyboard/Esc/disabled原因|逐control状态表，误click/重复click无重复read|
|P4-15 / 31,44–46,55|普通库execution-date包含open，历史closed-date独立；附件不潜入queue；跨市场空交集|直接URL与来源URL同目标集，真实列表+返回；非库V1重设计|
|P4-16 / 38,46|pending yes/no/mixed/unknown，完成/defer/reopen成功/失败/冲突后返回reload，四区同scope|隔离DB真实持久化、版本与数据read回，不是callback rerender|
|P4-17 / 50–52|reduced motion，keyboard/mouse/emulatedtouch/physicaltouch分别；长名称、窄viewport、倍率边界|输入方法独立记录，真实视觉审查，不以overflow=0替代视觉|

需在实施前由 UI owner 展开实际实例清单，至少包括：history标题解释icon；range触发、4种范围、from/to年份每选项、apply/cancel；四只读metric的解释/full-value；四chart modes和每个日期点（空/future/missing也含可聚焦解释）；contribution2modes、3categories、sort触发与2选项、openOnly及disabled原因、breadcrumb、3market rows、每symbol实际可点目标、每实心/空心读数、全部分页按钮/页位置；详情close/查看交易/既有复盘写入/离开；受影响全局repair/navigation。不能只盘点容器，把子选项计作已验。

按公共手册八态逐实例标 default/hover/focus/pressed/disabled/loading/empty/error：MetricCard只读pressed/disabled为NA有理由；历史openOnly disabled是适用；ChartTooltip不存在 disabled但其loading/empty/error说明适用；EmptyState的loading属于父容器而非自造按钮；pagination第1/末页disabled适用。每项记录开→选→应用/关闭→结果→返回/持久化；不适用要给范围原因。不能复制手册85PASS或用一个总分签署100%。

未来视觉比较须在 CSS viewport1440×1000与1280×800、100%缩放记录DPR，直接比整页和局部同状态；至少常规、窄卡压力、range等待/失败、历史四模式、current/history、all→market、50项分页、unknown/mixed/极值。上区不移动以实际前后区域位置和截图支持；固定容器不是裁切数据/取消原图层级的许可。所有required NOT VERIFIED或in-scope FAIL阻断交付，保留原FAIL和版本，不以新轮或换票清零。

## 9. 最小文件/owner建议与派发顺序

不在本文授予文件写权；root正式派发时决定：

1. **财务 seam先行（financial owner）**：候选 `app/lib/reviews/homepage-v25-history.ts/.test.ts` 与 `homepage-v25-attribution.ts/.test.ts`，读accepted P2 source/boundary/canonical事实，输出上述不可变read models。若只靠现有公开seam不够，先单独提交最小canonical只读fact接口提案；未授权不得改 ledger/F/shared types/schema。trustedlink oracle只为边界验证，不扩真实导入模型。先关D1/D2/D3，再红测→最小实现→独立财务接受。
2. **唯一页面owner（integration）**：`app/components/homepage-v25/home-surface.tsx` 与其同目录局部history/contribution组件/CSS；现有 `session-model.ts`、`use-homepage-host.ts` 的history域ownedcommit；workspace只传accepted bundle/detail identity及既有保存/导航回调。不新建平行homepage、不改全局CSS、不把业务cache写S/browser。先最小真实market→symbol→详情→return，再扩8行分页和全部状态。
3. **root独立接受**：先数据字面oracle/actualno-link/closedate/feesFX，再真实scope/双模式/请求原子链/隔离持久化，最后逐状态视觉和完整控制覆盖；三道门各自证据。不能用数据纯测PASS签署产品，不接受当前history reservation或prototype详情占位作为P4完成。

若 P2 正在变动，接口提案绑定读时hash，但不得边接线边假设其新candidate已接受；全页面data/persistence owner负责一套scope/attachment资格，同UIowner负责上区保持/真实详情/ordinary返回，避免跨文件无人拥有完整旅程。P3附件资格与P4 projection接线依赖须由root排序，不在本票另造筛选状态体系。

## 10. 读时源码指纹及当前 readiness

2026-10-23T02:55:32+08:00 读取。S已冻结；其余是工作树读时指纹，**不是新冻结或接受记录**。

|文件|SHA256|
|---|---|
|`app/lib/reviews/homepage-v25-state.ts`|`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`|
|`app/components/homepage-v25/session-model.ts`|`ece59d74c52a5ea5a64f4c8501fdd797e8b90cdf6ff8fa6c4e60396746c628d5`|
|`app/components/homepage-v25/use-homepage-host.ts`|`b6fa6f855b6e2fc6a6a3de2c23d8d4465ddd634a4349cd7da2bcdd002efc02ec`|
|`app/components/homepage-v25/home-surface.tsx`|`2c2c12f041666b8357e4756956feb30868479c9c4f8847e202e6dc3cc1158c1a`|
|`app/lib/reviews/homepage-v25-performance.ts`|`e43c9a2ebfbe674c63286bb0f34a195dd521579055ef9ae4bfc32f13fe7bd8fa`|
|`app/lib/replay/position-ledger.ts`|`d81b12c1aca83f53f2079867acfd92869298b9bc06c3023f13c94d5709300cba`|
|`app/lib/trades/types.ts`|`a7c7ba341a5f566c4e851dfe2a033c35cc4f7584205f3ab86cb82269546470a1`|
|`app/lib/import/monthly-statement.ts`|`56732b949fb0b65c7af203723ff24df38dfeed6406be11420f7495ea5dc188cb`|
|`app/lib/import/statement-evidence.ts`|`45360f1373f4b185250182aad0acdac12d1c78cce9e3e7a1c40ec258c04ad6c2`|
|`evidence/P2/data/PRE-DISPATCH-CONTRACT.md`|`a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a`|
|`evidence/P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md`|`0c0bb00c0d52ec0f278c52e375cb9a4b7def8f1de366cd517401e9297f30a378`|
|`evidence/P2/data/P4-MIXED-PROVENANCE-ORACLES.md`|`2565c7ee8de0768412b1a97923206a1f6aa741d81d0d83085c88cbeb8263b787`|

当前确定缺口：home-surface仍为历史 reservation；host/session尚无history域业务data commit；无正式closed-round/attribution read model；canonical公开quantity observer不足以提供所需完整事实；真实mixed无处置link；历史FX输入不能冒充完整；D1/D2/D3待root。上述是派发前能力/政策清单，非对尚未实现P4的正式验收FAIL。

文档准备已读原文/图/真实接口；产品功能、数据实际链、持久化、控制全态、浏览器返回/触屏与视觉门均 **NOT VERIFIED**。本任务为文档只读准备，当前不要求启动UI/DB，也不提供产品完成/预览声明。等待root裁定并正式派发，P4保持0/3。
