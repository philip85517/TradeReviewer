# P4 实际闭环数据接口与接受准备

2026-10-23，`/root/financial_g61`，实际 `gpt-6.1-sol / ultra`。**只读准备；P4 同票 0/3，未授权产品实施，本文不签 accepted。** P2 架构选择仍待决定；四个 F/canonical 产品文件冻结，不做第四个性能修复或测量。本次只新增本目录文件，没有修改产品、配置、依赖、历史证据，没有使用 DB、服务或浏览器。

本文联合读取而不覆盖旧记录：[P4 issue](../../../issues/07-history-contribution.md)、[原准备合同](../PRE-DISPATCH-CONTRACT.md)、[root 财务裁定](../ROOT-FINANCIAL-DECISIONS.md)、[canonical seam 提案](../CANONICAL-READ-FACT-SEAM-PROPOSAL.md)、[来源裁定](../../P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md)。旧准备合同中的 D1/D2/D3 已由 root 财务裁定关闭，不能继续当未决政策。完整字面预期见 [LITERAL-ORACLES.md](LITERAL-ORACLES.md)；该文件是独立验收候选，未运行产品测试，不能称为 RED/PASS。

## 1. 原文、图和元素覆盖

正文路径基准为 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`。以下 `正文:n` 指 `visual-design.candidate.md:n`，图均为该目录 `images/` 的准确文件名。原稿没有逐控件原始 elementID；**不编造原始 ID**。HV25-* 是现有 DESIGN-COVERAGE 跟踪 ID，HOME-* 是该矩阵引用的文本 manifest block。下列 E* 只是本文局部实例索引，不替代原 ID。金融数据候选 owner 为 financial，页面/接线 owner 为 integration，独立功能/视觉/真实闭环接受 owner 为 root。每行未来均须有版本绑定证据；现在均 NOT VERIFIED。

|局部实例 / 跟踪ID / 原文block|准确原文与要求|准确参考图|数据/实际旅程与未来接受证据|
|---|---|---|---|
|E01 / HV25-32, HV25-54 / HOME-HP05-B001|正文349–355：持仓下默认展开，标题/年份→四等宽卡→图；功能标题18px/600，图标题16px/600，不再加左缩进|`home-history-1440.svg`, `home-history-1280.svg`, `history.svg`|直接滚动可见；真实整页双视口与原图比较；不能另加进入卡片/页面|
|E02 / HV25-32 / B001|353–355：净盈亏、回合数、胜率、已扣费用；胜率含盈利/总数；A321×88、B278×104计数层级|`history.svg`, `history-stats-win.svg`|同一 closed set/conversion facts 四卡；无回合 count0、胜率—；费用为 closed-round allocated，不是期间 incurred|
|E03 / HV25-33 / B001|357,361,369–372：单年/今年/区间/全部，草稿应用；历史卡/图/历史贡献原子变，不强制贡献切模式|`journeys-year.svg`, `history-stats-error.svg`|每种选项/年份输入/apply/cancel/非法范围；失败保旧范围+完整数据；迟到旧响应不覆盖|
|E04 / HV25-34 / B001|357–359,377–380：每期/累计/胜率/回合四模式，同容器/绘图区/工具区几何|`history.svg`, `history-stats-cumulative.svg`, `history-stats-win.svg`, `history-stats-rounds.svg`|四模式逐张同 viewport 比较；单年月12位置、多年年度；金额单位、%固定0–100、回合整数；完整值键盘可读|
|E05 / HV25-34, HV25-51 / B001|363：悬停/聚焦日期粒度、单位、完整读数；移开/Esc关闭，不导航|上述四模式；手册 `atom-charttooltip.svg`|每个有效点及缺口说明；方向键/Home/End/Enter固定/Esc解除；不插值、不提供局部修复按钮|
|E06 / HV25-35 / B001|383–392：无回合、真零、缺失、未来、失败分开；不造零趋势|`history-stats-empty.svg`, `history-stats-source-missing.svg`, `history-stats-error.svg`, `history-stats-extreme.svg`|源完整无回合 vs 源不完整；零回合与有回合净0；未知桶断线；future不补点；更新失败保旧组|
|E07 / HV25-36 / HOME-HP05-B027|397,413–415：底部唯一贡献；当前期间/历史已平仓沿各自日期，不加第三日期控件|`contribution-states.svg`, `contribution-historical-a-share.svg`|切模式只改本模块，上区保持；current 与 selected-period net 对账，history 与 selected closed rounds 对账|
|E08 / HV25-37 / B027|399,429：all先A/HK/US三市场→真实证券→既有详情；具体全局市场直接证券，header不随下钻变|`contribution-states.svg`, `contribution-current-a-share.svg`|三市场逐条/面包屑/证券真实身份/closed无持仓详情；无泛化固定证券按钮或双栏|
|E09 / HV25-38 / B027|401：做多/做空/打新互斥，IPO后手买归多；分类/排序/openOnly独立|`contribution-current-a-share.svg`, `contribution-historical-a-share.svg`|三类、profit-desc/loss-asc均实际操作；缺可信 mixed disposal link 不推定 pro-rata/FIFO；保留 canonical 总额|
|E10 / HV25-38, HV25-42 / B027|401,407：历史 openOnly 同位置禁用，回当前恢复；两模式分别记忆分类/排序/局部下钻/页|上述 current/history 图|先给两模式不同非默认状态，再往返/刷新/详情；全局市场只有一套，不能被局部记忆覆盖|
|E11 / HV25-39 / B027|397,403：current=R+endUF−startUF，100/150/0→50；history仅已闭合，不含当前UF|`contribution.svg`|全范围总额在分页/局部过滤前；局部小计不能冒充总额；缺估值仍保留独立可信 R，净额 unknown|
|E12 / HV25-40 / B027|403：实心R/中空UF变化，外高14px；正#53D7A0、负#EF7F89；同号连续、异号分零线；按分真零无假柱|`contribution-mixed-sign-demo.svg`, `contribution-extreme.svg`|双正/双负/正负/负正/零/极小/未知逐例；完整精度留数据，显示0.00不改变胜负|
|E13 / HV25-41 / B027|405：固定8行，50项7页末2；三市场无证券分页；全量合计不随翻页变|`contribution-current-a-share.svg`|全部页按钮与focus新页首行；0项无误导1/1；上方rect/截图不移动|
|E14 / HV25-42 / B027|407,429：详情关闭恢复模式/筛选/页/scroll/focus，消失仅回贡献标题|`contribution-current-a-share.svg`, `library-return.svg`|非默认状态→准确已有详情→关闭→库→返回→reload；数据重读且保有效条件，不写固定首行|
|E15 / HV25-43 / HOME-HP05-B034|421–426：贡献 loading/empty/error/extreme 保工具区和布局，真实零/无结果/未知不同|`contribution-loading.svg`, `contribution-empty.svg`, `contribution-error.svg`, `contribution-extreme.svg`|首次无值与更新保旧分开；同一全局恢复入口、重复提交防重；未知有原因/来源|
|E16 / HV25-31, HV25-44, HV25-45, HV25-55 / HOME-HP06-B018|436–448,646–668：普通库带当前已应用scope/date/真实symbol，execution-date含open，不带默认queue|`journeys-library-entry.svg`, `hcr06-final-return.svg`, `library-return.svg`|历史详情去库仍当前全局日期，不偷换历史range；到达即生效；direct URL与来源URL一致|
|E17 / HV25-46, HV25-53 / HOME-HP06-B016|454–464,646–668：返回重读+完整快照；非法参数明确提示，不静默扩大|`hcr06-final-return.svg`, `library-return.svg`|native back/forward、刷新后返回、来源消失；保存/409/失败路径沿现有流程另验真实隔离持久化|
|E18 / HV25-47, HV25-48, HV25-49 / HOME-HP09-B001/B028|467–502：完整旧组/冷失败/15s超时；generation+scope匹配；唯一全局修复|`loading.svg`, `loading--stale-data.svg`, `error.svg`, `error--update-failure.svg`, `repair.svg`|history/global/period并发与更高revision；取消/超时/旧响应不能提交；局部不另造重试/日志入口|
|E19 / HV25-50, HV25-51, HV25-52 / HOME-HP09-B031,HP08-B001,HP10-B001|503–568与手册：八态、减弱动效、独立功能/持久化/视觉门|`atoms.svg`, `visual-samples-board.svg`；各准确局部图|逐实际实例清单；鼠标、键盘、模拟触屏、物理触屏分开；1440×1000/1280×800，100%记录DPR，不以overflow=0代视觉|
|E20 / HV25-15, HV25-16 / HOME-HP02-B001|193–209：期间净额与历史闭合不同；成本100/期初120/卖130 → period10/history30；原币/FX/覆盖独立|`contribution.svg`, `account.svg`, `chart-gap.svg`|本稿 O03/O06；同原币差额后endpoint FX，不能分别转换起末再相减；current须等待被接受P2 bundle|

本次直接读取并以内存光栅化核对四种 history 图、history 四种空异常图、六种 contribution/current/history/mixed 图及其三种 loading/empty/error 图、年份旅程、两种整页 history 视口和三种普通库往返图，共23个准确资产；表中33个 SVG 引用均另查实文件存在。未启动浏览器、未写产品截图或声称视觉接受。`contribution-error.svg` 旧局部“重试”画法不能覆盖正文477–482唯一全局修复；`contribution-extreme.svg` 的零值小形状不能覆盖正文403真零无假柱。`history-stats-extreme.svg` 的演示卡数不作金融输入 oracle。原型详情占位不代替正式详情。

手册已完整读 Metric(611–697)、ChartTooltip(872–958)、SegmentedTabs(196–282)、Select(283–369) 及组合补充/使用边界。共享八态不可被“12类96态”总数替代逐实例验收。Metric pressed/disabled为NA（只读原因）；history openOnly disabled适用；ChartTooltip disabled不渲染；空分页无1/1；排序28px视觉/36px命中是选择器例外。历史范围按A组合，不增加粒度选择器；贡献标签14px下划线。窄卡B说明位于计数正上4px，不能用通用metric样例276×88覆盖本章A/B尺寸。

## 2. 四种 history 模式和两套 contribution 记忆

|历史模式|一份闭合事实上的读数|空/未知与几何|
|---|---|---|
|`period-pnl`（默认）|单年12个月，多年按年；每桶所选完整 closed rounds 净额，使用各 round 关闭日 conversion facts|有回合且净0是值0；无回合桶不造0点；unknown断线；future不绘值|
|`cumulative-pnl`|从所选历史range起点累计上述 converted round amounts；非lifetime，不加currentUF|已知完整无关闭桶可保持之前已知累计（原图有平段）；源缺失后累计 unknown，不能跨缺口重接为完整；全范围无回合仍空态，future不carry|
|`win-rate`|每桶盈利数/该桶全部完成回合；范围卡按范围总数算，绝不平均桶百分比|固定0–100%；无回合—/缺口；native net未知则该桶/范围率unknown，已知count保留|
|`round-count`|真实可信数量周期完整关闭次数，不是 execution、episode 或partial sell数|整数轴；已知无回合count0，源不完整unknown；四模式同绘图/工具区尺寸|

|记忆/变更|current contribution|history contribution|共享/提交约束|
|---|---|---|---|
|日期|`snapshot.period` 已应用期间|`snapshot.history.range` 已应用年份|无第三套日期；改一种不改另一种|
|局部记忆|category、sort、page、market、symbol、drilldown、openOnly|category、sort、page、market、symbol、drilldown|沿现有S v3；history无可激活openOnly，但保留当前已选值|
|全局市场/账户/attachments|读取当前全局 applied|同一全局 applied|local.market仅all下的下钻，不能恢复旧全局market；分组资格不预裁该组成本历史|
|贡献模式切换|恢复current局部记忆|恢复history局部记忆|不改上区/不请求第三日期/不把另一模式page覆盖|
|period成功|与前三KPI/series同bundle提交|保留|可见mode保持；current最新持仓市值仍独立|
|history成功|保留|四卡+四模式底层桶+history贡献一组提交|保持用户切换的chartMode/visible贡献mode；失败保旧范围+旧数据|
|详情/普通库返回|恢复来源状态且重新读取|同左|普通库URL仍全局applied scope/date；原对象消失focus contribution标题；仍有效条件保留|

## 3. 实际可用 seam 与最小缺口

|现有实际路径/函数|能直接使用|不能据此声称已有|
|---|---|---|
|`app/lib/replay/position-ledger.ts:97 evaluatePositionAtPrice`，`replayPositionAtPrice:446`|唯一 canonical 成本/毛实现/数量/事件排序 authority；已有普通/statement/IPO/transfer分支|不是公开完整事实流；private observer在初始/执行后，非execution多处continue没有完整before/after|
|同文件 `preparePositionLedger:466`、`replayPreparedPositionBoundaries:488`|相同 evaluator/private full-precision checkpoints；普通源一次sweep，attached精确context fallback|公开 `transitions` 仅执行前后数量，fallback为空；兼容snapshot的8位数/未知0占位不能判完整精度胜负或round归零|
|`app/lib/reviews/homepage-v25-performance.ts:122 collect`、`:180 replay`、`:280 finishState`|完整原始lineage去重/方向/知识截止；唯一F费用pool；IPO边界释放/留存；与canonical累积费核对|当前public没有每movement已实现fee allocation facts；不能用cum fee差/periodFees/openFees冒充closed-round fee|
|同文件 `HomepageV25FeeFact:453`、`prepareHomepageV25Source:584`、`projectHomepageV25Boundaries:856`|候选P2的incurred/knowledge/lineage事实，版本/source/strict quote/FX信息；current独立|P2仍NOT accepted且性能MISS冻结；没有accepted P4 history接口，不能把候选接UI当合同已交付|
|`app/lib/reviews/homepage-v25-state.ts:16–35`、`:314 beginHomepageHistoryApply`、`:326 completeHomepageRequest`|已定义range、四mode、两套局部记忆和domain token；业务数据不存S|不表示host已有history业务data原子commit|
|`app/components/homepage-v25/session-model.ts:9–18`、`use-homepage-host.ts:78–116`|现有global read/session commit、navigation/return与既有库scope构建|现有host此读链只处理global；需未来owned history-domain数据提交，不能只提交S标签后等业务data|
|`app/lib/trades/types.ts:59–139` / `StatementEvent` / `statement-evidence.ts:620–670`|方向/取得IPO现金证据/执行原始ID|无真实可信disposal→acquisition lot link；sourceTradeId只佐证同一次取得，不代表后续卖出来源|

最小新增 seam 仍沿前提案，不在本次实施：

1. **canonical只读事实**：未来获明确写权后，给既有prepared handle新增 `readPreparedPositionFacts(source, queries)`。同一 evaluator 观察所有实际timeline分支，输出 immutable full-precision `Decimal.toString()` 数量/成本/累计grossR/累积canonical费、每项knownness、movement before/after、实际matched closing/new opening quantity、顺序/业务时间精度/lineage/context。不重写任何成本或匹配方程，不新建按类别账本。普通源复用一次sweep；attached/late evidence逐精确context，不将全源最新事实当过去。
2. **F只读分配事实**：在既有fee step旁新增 `FeeAllocationFact`；contextId+movementFactId精确join，含poolBefore/After、releasedEntryFee、movementFeeToClosing/Opening、realizedFeeDelta、feeFactIds及coverage。沿F已实现的ordinary/IPO边界分配，不让P4自行计算另一费用池，不用数组index盲zip。incurred FeeFacts不变、不挪到关闭日；refund本金不是负费。
3. **history read model**：候选新 `app/lib/reviews/homepage-v25-history.ts/.test.ts` 消费canonical facts+F allocation facts。只维护 group+opening movement+direction+generation 的round关联，并加总现有gross/allocated fee事实，不能计算新平均成本。完整组先恢复，再按可信上海关闭日过滤历史range；跨年opening/费用/IPO知识不被range裁掉。
4. **contribution read model**：候选新 `homepage-v25-attribution.ts/.test.ts` 消费accepted P2同bundle的原币期间组件或history上述closed facts；纯来源可归类，真实mixed缺link类别unknown，instrument total保留。未来若真实trustedlink出现，按root已批数量份额×单canonical池语义，零和cost/fee transfer留证；不得给当前来源造链接。UI不直接调用ledger/F重算。
5. **一份 immutable P4 bundle**：integration将history与history contribution作为同一domain/revision结果原子提交；local mode/sort/page是S状态，不进入财务cache，也不让读完成覆盖等待期用户的局部mode变化。数据owner/整页owner/root的完整链责任不因拆文件断开。

第1/2项需要后续明确允许触F/canonical；当前冻结四文件不因本文开放。P2性能选择及接受仍是current contribution依赖，不能以P4命名绕开P2失败/轮次。P4 closed-history不需要调用365次完整F builder；也不能因此自行扩大prepared seam或预算。**本次不跑测量。**

## 4. 建议对外接口（候选，尚无这些导出）

```ts
prepareHomepageV25HistoryFacts(input: {
  // 由financial内部组合唯一canonical observer与F allocation facts；UI不能注入金额。
  canonicalFacts: CanonicalFactSource;
  feeAllocations: FAllocationFactSource;
  rawEntryAssociations: ReadonlyEntryAssociations;
  fxObservations: readonly HistoricalFxObservation[];
  sourceCoverage: readonly GroupHistoryCoverage[];
  revisions: SourceRevisions;
}): PreparedHistoryFacts;

projectHomepageV25History(source: PreparedHistoryFacts, query: {
  scope: AcceptedGlobalScope;
  range: HomepageHistoryRange;
  asOf: string; // 该次真实知识截止；不是关闭日期/最后导入时间
  targetCurrency: string;
}): HistoryBundle;

projectHomepageV25Contribution(input: {
  mode: 'current'; period: AcceptedP2PeriodBundle;
} | {
  mode: 'history'; history: HistoryBundle;
}): ContributionFacts;
```

`CanonicalFactSource`/`FAllocationFactSource`是内部受控immutable handles，不能让任意UI构造数组冒充权威；实际是否复用一个组合handle由root后续授权确认，不新建第三本账。详细内部候选已有前seam提案。本接口只是精确最小职责，不声称已有/实现ready。

`HistoryBundle` 最小公开结构：

* `sourceId/revisions/policies/scope/range/asOf/businessTimezone='Asia/Shanghai'/updatedAt`；updatedAt真实重算知识时刻带业务时区，不当closeDate。
* `closedRounds[]`：完整group identity、roundId、opening/closing movement facts、可信closedAt/closeBusinessDate/precision、raw execution/event/episode关联、native currency、full-precision grossRealized/allocatedFees/net、winner、conversion事实、各项coverage。未知值null+reasons，不保留误导性0。每个closed round只一次。
* `unresolved[]`：缺数量、顺序、闭合日期或资格的组及原因/来源，不偷偷删去分母。countKnown但nativeUnknown的round留在closedRounds；count不确定的组留unresolved并使相关scope count coverage不完整。
* `cards`：closedNet、closedCount、winRate（wins/total以及coverage）、closedAllocatedFees。缺费用可countKnown且net/rateUnknown；缺FX可native net/winner/rateKnown而converted amountUnknown。无回合count0/win—，净额空态不画假趋势。
* `buckets[]`：固定month/year key、日期边界/grain、state(value/no-rounds/source-missing/future)、roundIds、periodNet、selectedStartCumulativeNet、winRate、roundCount、allocatedFees、native subtotals和相同conversion refs。UI仅挑模式，不重新算钱/平均胜率。
* `historyContribution`引用同一closed set和conversion facts，保留完整原币subtotal、目标币unknown及coverage；无当前UF。`allScopeTotal`是全量，`localFilteredTotal`另名，不能随page改总额。

`ContributionFacts` 最小公开结构：版本/context、模式与已应用日期、全范围 canonical总额、分类coverage、三市场/证券的稳定完整identity及导航target；current每行R/startUF/endUF/UFchange/net，history每行closed gross/fee/net/count；原币subtotals、目标币、FX来源/政策/日期/知识cutoff；分页前全量行集。category未知保留unknown与原instrument总额，不造“其他”类别或求已知部分冒充全量。

## 5. 时间、FX、round、未知值政策

* 完整 group 为account+instrument（市场/币种身份）+nature+run。真实entries默认live资格；unknown nature不推live，simulation/run不混。原始execution去重/拆单lineage只一次。episode只关联详情/review，不从 `endedAt` 认定canonical round。
* known0→nonzero开round，同向加仓/partial仍同round；实际归零关一次，实际reverse同movement关旧开新。必须用full-precision可信数量/分支，不把兼容8位0当已归零。snapshot校准到0且中间缺流量，不证明真实close/date；完整transfer可数量周期结束但金额未知；IPO cover旧short可闭合但不是新execution或第二个round。
* actual close instant按Shanghai business day归桶，16:00Z是次日00:00；month-only/无法排序日期不发明月末关闭日。源数量/闭合/日期/资格/native结果/allocated费/winner/FX/provenance分别coverage。
* canonical gross/cost唯一；F费用唯一。round最终net汇集该轮所有partial实际gross以及已分配entry/exit/IPO费用，只有真正闭合才进入历史范围。partial承担fee5不成为已闭round；最终fee10不能当P2期间incurred费4。原发生事实、知识时点和关闭日三者不互换。
* 本次asOf可因late refund获得更完整native结果，但不得把未来知识回写早asOf。历史FX仍每round **上海关闭业务日** 的真实已知pair observation，正数/complete且published/known/fetched满足该日截止；没有真实journal保留unknown+native，不用当前/范围终点/最新FX。所有卡/桶/累计/history贡献复用同一转换事实。same currency无需FX。
* current contribution沿accepted P2：先原币R+endUF−startUF，再单一endpointFX，不能不同FX先转起末再相减。latest current MV/UF不是history范围末点，不混入history。
* native全精度net>0才win，0入分母；unknown不能当loss或删除。原币已知缺FX不阻断native winner。展示按分归0仍可金融win；排序已知值前、未知后，相等用完整identity稳定tie。不要通过预先四舍五入/JS Number丢精度。
* 数据读取失败与金融unknown分开；更新失败保旧已提交bundle+标签；成功返回未知数据则按新scope诚实unknown，不能暗留旧数字冒充成功新值。全局唯一修复。

## 6. 最小真实闭环与root独立接受清单

1. **数据先行**：后续获实施授权才将O01–O12 literal输入接真实entries→唯一canonical/F事实→public P4 bundle，先保存明确RED，不读root独立测试改期望。独立验证每项数值、count/date/coverage/来源，不只等式。保留原F100测试字节和原legacy wrapper完整字段兼容；任何跨原F范围回归立即报告，不以新票重置cap。
2. **最小往返**：all→真实market row→真实symbol→已有详情→关闭；concrete market直接symbols；closed无current holding也能到正确详情。真实身份、scope、返回scroll/focus须可观察。此最小旅程通过后再扩全部行/分页和状态。
3. **history提交**：year/this-year/years/all→应用→四卡/四模式桶/history贡献同revision；current period/holdings不变，可见贡献mode不强切；失败/15s/取消/late旧响应/global supersede分别验证。历史修正/late knowledge重算正确年份并显示真实updatedAt。
4. **全部实例**：E01–E20逐控件展开inventory，选项/点/行/分页/说明均列default/hover/focus/pressed/disabled/loading/empty/error的适用性和证据；图点只是读数不导航，局部缺失不新增恢复按钮。不能用容器可见代替所有选项实际操作。
5. **返回与持久化**：当前与历史设置不同的category/sort/drill/page，current.openOnly=true；切mode/详情/普通库/nativeback/reload恢复。普通库仍全局applied日期且包含open executions。若触现有review写流，沿现有autosave/repository/HTTP/SQLite链，在隔离库实际完成/defer/reopen/409/失败/返回/reload；callback不是持久化证据。本次未触DB。
6. **视觉单独接受**：root未实施UI者在1440×1000及1280×800、100%记录DPR，比整页顺序及四模式/current/history/market/symbol/mixed/unknown/8行分页/窄卡；14px外高、负色、零线、全量合计、上方位置分别实证。物理触屏不能以鼠标/模拟替代。当前全部NOT VERIFIED。

尚待正式派发的工程授权：canonical全事实observer与F allocation只读输出、P2候选架构与接受、event-only group装载覆盖、history域host data commit、新history/attribution模块以及现有详情关联资格。政策已裁定；这些是实际能力/写权依赖，不将其改名为政策未定或已通过。本文完成范围仅为接受准备，P4维持0/3。
