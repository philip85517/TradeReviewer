# P4 最小 canonical 只读事实 seam 提案与红测字面 oracle

2026-10-23，`/root/state_g61`，实际 `gpt-6.1-sol / ultra`。**仅文档提案，不是写源码授权、RED 实跑日志或验收。** P4仍0/3，P2候选仍未接受，S v3继续冻结。本任务只新增本文，不修改前份合同、root决定、产品/测试/ledger/F/共享追踪；没有DB、浏览器、服务或新代理。

依据：HP05:349–432、前份 `PRE-DISPATCH-CONTRACT.md`（1140ad8…）、root 新 `ROOT-FINANCIAL-DECISIONS.md`（5ebe2ff…）及原 `P4-COORDINATOR-PROVENANCE-DECISION.md`。下面关闭前份合同 D1/D2/D3，不修改历史草案；后续派发应联合阅读 root 决定而不是继续称其待定。使用 codebase-design 技能收敛一个只读 interface，不引入可由调用方操纵成本/费用的第二实现。

## 1. 已裁定的财务合同

1. 同完整 account/instrument/nature/run，canonical 实际数量累计加仓→部分减仓→归零为一个业务 round；partial不增加closedCount；反向关闭旧方向一轮同时开新方向。非execution IPO/transfer不伪造成交。episode仅稳定关联，与实际事实冲突时fail closed，关闭/count覆盖与结果覆盖分别表达。
2. 历史已扣费为**选中已关闭round最终net承担的已分配entry+exit+IPO费用**，不是P2 incurred-date费用。前份H08的“首次平仓承担5”应准确读作“首次**部分卖出**的已实现部分承担5”；instrument尚未归零，历史closedCount仍0，不能发布一个已闭round。最终归零才1round、累计承担10。
3. 每round用其上海关闭业务日严格historical FX，同一conversion事实/policy/version复用于cards/buckets/cumulative/history contribution。缺journal保持unknown，不用最新/范围终点FX补。
4. 胜负用canonical全精度**原币native net > 0**；zero入分母，unknown不算loss也不删分母；winner/rate coverage独立。known排序在前，unknown在后，相等按完整identity稳定tie。
5. 普通库仍当前appliedscope/date，不隐式覆写history日期。真实无disposal→lot link的混合来源class unknown + provenance-ambiguous，canonical instrument总额可知；不做无链pro-rata/FIFO/整证券IPO。

## 2. 现有 seam 具体缺什么

读时 `app/lib/replay/position-ledger.ts`：

* `evaluatePositionAtPrice` :97 是唯一现有evaluator；初始`:174`和execution后`:413`调用private checkpoint observer。position :185、IPO/bonus/transfer等event :209以后走各自`continue`，**没有逐event的before/after事实**。
* `Checkpoint`保存未经过compatibility序列化的Decimal quantity/averageCost/cumulative gross realized/cumulative canonical fees及reasons/warnings/quantityUncertain。公开旧snapshot在`finalizePosition`用8位decimalString及兼容0占位；不能将该0当真结果或用8位展示值决定胜负。
* `PreparedPositionLedger` :450公开observer facts仅executionId和before/after quantity/quantityKnown；attached源`transitions=[]`，保守走exact-context fallback。它不能作为完整round、IPO或费用归因interface。
* `replayPreparedPositionBoundaries` :488调用相同evaluator或普通源private checkpoint，保留legacy显式visibleExecutionIds可选择cursor后execution的语义。P4不能顺便改变原wrapper规则。

读时 `homepage-v25-performance.ts`：

* `collect` :119–178先按原始entry.executions完整lineage分组/去重，episode的split settlement不是新fill；保留quantity/price/fee/identity冲突。P4不再flatten episode当原始execution。
* F `replay` :180–279以精确knowledge cursor + 原始source + selectedIDs建立canonical snapshot，并在原有fee steps计算closed quantity、pool release、execution fee的close/open分配；IPO beforeStep保留boundary现金知识同时只选合法movement前缀。
* `finishState` :280检查projectedFees与canonical fees一致，F独占netRealized/openFees及unknown规则。P2普通fast path `prepareOrdinaryProjection` :588沿同规则使用canonical before quantity；不是新的P4账本。
* `HomepageV25FeeFact`为实际费用发生/知识/原始来源；目前没有round allocated-fee事实输出。不能只返回FeeFacts让UI猜每round费用。

真实输入仍不含处置lot link：TradeExecution的sourceTradeId仅可用于execution-backed allocation取得去重；IPO cash evidence是成本证据而非处置归属。新interface必须诚实暴露缺coverage，不增加“推定link”字段。

## 3. 推荐一个 additive canonical interface

**推荐只新增一个读方法，复用现有prepared handle及query语义；旧方法仍原样返回snapshot。** 名字供root授权时确认，以下不是已存在导出：

```ts
readPreparedPositionFacts(
  source: PreparedPositionLedger,
  queries: readonly PositionFactQuery[]
): readonly CanonicalFactResult[]

type PositionFactQuery = {
  cursor?: string;
  visibleExecutionIds?: readonly string[]; // 完全保留legacy语义
};
type FactValue = Readonly<{
  value: string | null; // evaluator内部full-precision Decimal.toString，无8位提前截断
  available: boolean;
  reasons: readonly string[];
}>;
type CanonicalFactResult = Readonly<{
  contextId: string;
  effectiveKnowledgeCursor: string | null;
  selectedExecutionIds: readonly string[];
  mode: 'ordinary-sweep' | 'exact-context-fallback';
  terminal: CanonicalStateFact;
  facts: readonly CanonicalMovementFact[];
  coverage: {
    quantity: FactCoverage;
    chronology: FactCoverage;
    costAndRealized: FactCoverage;
    reasons: readonly string[];
  };
}>;
```

最少`CanonicalStateFact`：signed quantity、averageCost（或等价同一canonical账面basis，不要求两份重复权威）、cumulativeGrossRealized、cumulativeCanonicalFees、已有reasons/warnings和各自knownness。所有金额string不可变，不返回Decimal对象/可变private checkpoint。`value:null/available:false`不能带numeric0占位。新knownness不得放宽旧canonical/F的unknown门；精细依赖提升需另授权，而不是本次observer“顺便修正”。

最少`CanonicalMovementFact`：

|字段组|必须的信息/目的|明确不做|
|---|---|---|
|identity/context|contextId、稳定factId、timeline ordinal；caller保有完整group identity；movement原始executionId/eventId或position证据key|不接受UI传入quantity/cost/net作为事实|
|kind/effect|execution / ipo-allocation / bonus / transfer / position-reconciliation / evidence-status；applied / suppressed-duplicate / unresolved|不把所有event变synthetic execution；no-op现金行不造持仓movement|
|time|canonical实际排序at、源date及instant/day/month precision、knowledge cursor与证据IDs|不以最后updatedAt/导入时间当业务关闭日；month不发明日/时分秒|
|before/after|上述CanonicalStateFact与quantity/cost/realized coverage；包括无quantity变化但knownness改变的evidence-status|不只在execution后观察；不从终态倒推中间持仓|
|actual matching parts|同一执行分支已算出的matched closing quantity和new opening quantity、原方向/新方向；不适用或不可信为null+reason|不在P4复制平均成本/覆盖计算；不把partial叫closed round|
|gross realization|evaluator该transition产生的gross realized delta与coverage；有反向时属于关闭旧方向部分|不按独立lot取得成本算利润；不在observer重算(price−basis)×size|
|source evidence|原始lineage、所用position/IPO cash证据、重复suppression依据、ordering/coverage原因|不声称sourceTradeId提供disposal link|

`matched closing/opening`应直接取现有buy/sell/IPO分支的`covered/closed/size/newQuantity`，或由evaluator内部同一次transition统一输出；不要调用方重演金融分支。持仓校准跳变不是已证明成交关闭，必须可与实际execution/event movement区分。

### 3.1 实现位置及保证

仅在同文件evaluator周围增加内部只读observer，**所有timeline路径包括continue都留before/after/状态变化事实**；实际成本/盈亏/顺序公式不动。旧wrapper与prepared读取继续共享同一evaluator。ordinary可在既有一次sweep保留immutable事实索引；attached必须按精确query context捕获，先保留exact fallback，不宣称一次全局sweep适用于late IPO。

不要求暴露markPrice或unrealized：P4 closed-round所需gross/cost/movement与市值mark无关；current UF仍用F/P2现有估值interface。新方法不应迫使调用方传一个假markPrice才能拿round事实。

contextId必须含完整captured source内容/政策、knowledge cursor、实际selectedID集合及原始排序意义。set输入排列等价不能改变选择；但相同时间源顺序可能有实际意义，不能盲目排序source消除语义。原始future carrier携带已知早期statement evidence仍要可见；不能先裁execution后丢证据。不同cursor、不同original lineage、同ID冲突/不同时间精度不能共享“碰巧同数量”的事实cache。

新方法的legacy visibleIDs超cursor能力只为兼容；homepage adapter仍按明确asOf/Shanghai选择合法IDs，不可借此泄漏未来fills。query未知ID处理与旧wrapper一致。没有明确信号时不改原选择规则。

### 3.2 Count不等于quantity终态

圆回合read model由财务owner消费这些事实，保有最小轮次标识（group+opening movement+方向+generation/source lineage），关闭后只做加总，不另实现成本账本：

* known 0→非0开启；同方向加仓/partial留同round；known归零关闭一次；已证明反向transition同时关闭旧round/新开，fee分别来自F分配事实。
* position snapshot把数量校准为0但存在position-gap/unknown prior flow：终态0可以known，**不能据此推断一次真实闭合或关闭日**。closure count coverage unknown，不伪造0或1。
* 非execution IPO确实cover旧short归零时，保留event为event，关闭的是既有short round，executionCount不增加；能否计closed的依据是实际可信数量/时序，不是“必须有sell行”。不再给allocation另计一个closed round。
* transfer可改变inventory而不形成卖出利润；必须保留inventory end与unknown financial result。建议本次只读facts暴露可信数量归零及event-kind，不在canonical硬编码“转出=已卖出获利”。root D1的数量周期规则可使完整可信转出结束一个inventory round；结果仍unknown，若缺完整期初/排序/日期则count也unknown。UI不得把其显示成“实现0的交易”。
* month-only/同日未排序IPO或transfer：quantity/closure chronology按现有ambiguous门传播unknown；不得为图表选月末假成交日。day-only且明确session-open的IPO沿现有evidence helper，不把其显示顺序当新增实际execution时间。

## 4. F仍独占费用池：第二个输出是现有计算的只读结果

canonical不增加P4费用池，也不从cumulativeFees直接猜round fee。最小F扩展是在**既有fee step**旁输出不可变`FeeAllocationFact`，由现有F方程/unknown判断产生：

```ts
type FeeAllocationFact = Readonly<{
  contextId: string; movementFactId: string; // 需能与canonical精确context对齐
  executionId: string | null; allocationEventId: string | null;
  feeFactIds: readonly string[];
  openingPoolBefore: FactValue; openingPoolAfter: FactValue;
  releasedOpeningFee: FactValue;
  movementFeeTotal: FactValue;
  movementFeeToClosing: FactValue;
  movementFeeToOpening: FactValue;
  // realizedFeeDelta = releasedOpeningFee + movementFeeToClosing，由F输出
  realizedFeeDelta: FactValue;
  evidenceIds: readonly string[];
}>;
```

可直接从现有局部变量留证，不新公开“applyFee”可写方法。round fee是该round关闭期间各partial对应realizedFeeDelta的全量累计；partial可以承担fee而尚未关闭round，最终round关闭才进入历史集合。F必须附beforeStep所用确切knowledge/selected前缀context，不能按数组index把普通prepared facts与attached fee prefix盲目zip。

同一execution反转拆为close/open两部分时，`movementFeeToClosing + movementFeeToOpening = 原始execution费`；释放旧pool不再作为新incurred费。IPO成本现金链late已知时，F继续决定合法fee/cost归属。P4不得绕过F `projectedFees == canonical.fees`核对或把unknown pool填0。

现有`HomepageV25FeeFact`保持原incurred date/amount/lineage，不改成round关闭日，不重复count执行费/statement费、不把退款本金写负费用。输出allocated facts和incurred facts是两个视图，引用同一原始证据。

最小对外financial read interface可在F/P2现有prepared source内部一次组合canonical facts与F fee facts；只有财务owner消费canonical method。UI最终只读history/contribution bundle，不直接调用canonical；不将这些业务facts写S/hpSource/sessionStorage。P2未接受时此组合只能是候选，不能开始UI消费。

## 5. 完整group、episode与缺coverage

1. grouping沿现有F原始entry.executions路径：account+canonical instrument/market/currency+nature/run；live/unknown/simulation不混，simulation须指定run。同一instrument跨account不共享持仓/费用；同一account跨instrument不借position/IPO/FX证据。原始fill只去重一次，episode split引用同一raw ID/whole settlement不能变2倍交易量或2倍费。
2. 完整group先恢复canonical事实，**之后**按真实关闭日选历史range。当前period/execution-date/分页不能预裁opening fills、期前费用或IPO cash；attachments group资格也不能截断该组计算所需历史。
3. 真实event-only库存可以用canonical已有`inventoryIdentity + evidence`读取，不为使F collect看见它造一条fill。若现有F/P2 prepared source没有纳入该group，则公开source coverage unknown并说明缺lineage，不默默漏掉该组。扩展其来源装载需单独root授权，本文不授权storage/schema/importer。
4. episode仅稳定关联、复盘/详情对象：原始canonical两轮不因一个episode误合并成一轮，也不因split episode变三轮。关联不完整/冲突必须保留`episode-association-conflict`（建议reason名）和证据，不指向固定第一episode。canonical原始数量/count独立可知，episode依赖的pending筛选/复盘保存/详情映射不可猜。
5. 若requested历史集合的资格依赖冲突episode，scope selection coverage unknown；不能悄悄丢掉该round、把分母减1，或用canonical已知未筛选instrument总额冒充已筛选历史结果。完整base fact和最终可发布scoped result分开；“fail closed”不是将known0写进finance字段。
6. count coverage、closure-date coverage、native-result coverage、allocated-fee coverage、winner/rate coverage、FX conversion coverage、source-class coverage各自可观察。例：已证明闭合1、fee未知，count1、native net/fee/winner/rate unknown；缺历史FX但native net正且完整，count/winner/native rate可知、目标币总额unknown；mixed无link时canonical历史net可知、source类别unknown。

## 6. 未来先写的RED字面oracle（当前未运行）

下表是待授权后的测试输入/期望，**不是已保存RED/已通过测试**。第一步应append对外interface真实调用测试，运行并保存失败（缺导出或缺事实的实际行为），再改实现；不得只测mock callback或复制方程的helper。保留原F3/ledger所有历史断言与失败证据。

### O01 累计加仓、partial、最终关闭

同一live组，买1@100费2，买1@200费4，卖1@180费2，再卖1@190费2；明确合法direction和instant。

|节点|signed qty|avg成本|cum grossR|F realizedFee累计|openFee|closedCount|完整关闭round净额/扣费|
|---|---:|---:|---:|---:|---:|---:|---|
|两次买后|2|150|0|0|6|0|无closed round|
|首次部分卖出后|1|150|30|5|3|0|无closed round；不得报net25的已闭round|
|最终归零后|0|0|70|10|0|1|native net60 / allocatedFees10|

实际incurred费用全程2+4+2+2=10；若期间从两次买后开始，首次/最终期间新费用2/4，不是5/10。opening mark160则netUF14，t1 mark180 netUF27，当前selectednet=25+27−14=38；最终currentnet=60−14=46，历史roundnet60。四者不是一个通用“pnl”字段。

### O02 反向不双扣整笔费

买1@100费2；明确open-short的卖2@120费4；买1@110费1 cover-short。

|节点|事实|字面结果|
|---|---|---|
|反向后|旧long归零1轮，新short−1开启；raw reverse execution仅1个|grossR20；旧pool释放2 + 本笔close费2 = long费用4；longnet16；short retained pool2；current closedCount1|
|cover后|short归零第2轮|gross增10；short费用3（retained2+cover1）；shortnet7；总gross30/fees7/net23；closedCount2|

必须分别断言原fee4只按2+2分配、不是旧round费6+新round费4；原始settlement quantity2/gross240不因episode split变两笔整额。close-only标注却超量反向的输入沿F `position-coverage-missing`门unknown，不能借canonical数学反向把非法方向变合法。

### O03 late IPO：关闭事实先可知，成本/净结果后可知

纯IPO：Jan8 application−220和IPO fee−2；Jan10 session-open allocation2；Jan15卖1@120费1；Jan16卖1@130费1；Jan20 refund+20。查询knowledge分别Jan18、Jan22（所有source保留完整原始lineage，查询时过滤knowledge，不删未来carrier）。

|context|quantity/closed事实|native结果/费用|费用事实与日期|
|---|---|---|---|
|Jan18|allocation2→1→0，若时序与quantity证据完整则closedCount1；close业务日Jan16|cash cost未具备完整refund链：round net/allocated费unknown；不借Jan20退款|incurred fee2 Jan8 +1 Jan15 +1 Jan16 =4可独立已知|
|Jan22|仍同1round、同Jan16 close，不改成Jan20完成|cash basis200，grossR50，allocated fee4，native net46|incurred仍4、原日期不变；refund20不是negative fee|

重复先Jan18→Jan22再Jan22→Jan18，旧context始终unknown；晚知识只能产生新context/source结果，不能mutate先前returned facts。历史目标币须Jan16严格FX；缺journal时native46可知而converted net未知。

### O04 非execution IPO真实cover，零execution增量

Jan6明确short卖2@120费2；Jan8 application−220/IPO费2；Jan12 session-open allocation2；Jan20 refund20；knowledge Jan22。allocation确实使−2→0，**没有新buy execution**：关闭既有short1round，gross40、F最终allocatedFee4、native net36，关闭来源event、业务日Jan12；raw executions仍1个。partial allocation1则数量−1、closedCount0，不能将cover部分单计closed；allocation3则关闭旧short且新开long1，沿同canonical与F分配，不把整个IPO费重复给两边。复杂reverse金额以现有F精确context oracle为基准后写literal，不自行造第二公式。

### O05 event-only变化与coverage缺口

|输入|必须断言|必须拒绝|
|---|---|---|
|known long2，完整且明确排序的transfer-out2|event fact quantity2→0、execution增量0；inventory周期结束独立可观察；缺可归属basis/处置价则结果unknown|伪sell、净结果0、用当前quote当transfer卖价|
|opening position2→closing snapshot0，无中间movement、存在position-gap|terminal q0可知；真实关闭次数/日期coverage unknown，金融结果unknown|“看见0所以closedCount1”或按snapshot更新时刻造关闭日|
|month-only transfer/IPO与同月fill无法排序|保留month precision和ambiguous-event-order；closure date/count按不确定性传播|制造一个月末execution、假定先event后fill|
|bonus有效增加数量|event fact数量变化，仍同round；execution数不变；原canonical成本变化保留|凭空新round、零cost独立盈利lot|
|statement-only identity/evidence无execution|保留可见group或明确source未覆盖；未知不等于空集合|造0费0价synthetic fill强行过collect|

transfer closed-count在最终发布前应按root D1“完整可信数量周期”政策显式断言，且结果unknown/count known不得混成“全都可计算”；若输入只证明终态而不证明完整周期，count也unknown。此区分要通过实际源fixture，不靠手填quantityKnown=true。

### O06 episode冲突与完整group

* raw买1/卖1完成1轮，但episode.status=open/endedAt在次年：canonical实际close日/count fact保留；episode关联冲突有原因，不能用endedAt改年度或指向另一episode。依赖该episode的pending selection/保存目标fail closed；公开scope count/result不得静默以任一侧覆盖。
* raw为一个reverse fill量2费4，episodes各保留完整settlement：原raw仍1fill费4，facts分close/open；不从两episode再造raw量4费8。
* accountA IPO、accountB手买同symbol：两个group，不需要处置link即可各自纯来源；A的IPO cash和B的selling不互借。live、unknown、simulation-runX/Y同ID同symbol也不合并。
* 同raw ID identical重复只1事实；quantity/side/time冲突quantity+closure coverage unknown；price/fee-only冲突可保已知数量关闭count，但native net/fee/winner未知；不能将first-wins数字当可信profit。
* future fill携带已知早期IPO/position evidence：保留原始carrier不让历史证据丢失；反之未来event知识不因carrier已在当前selected IDs就提前可知。

### O07 native胜负、历史FX和来源unknown独立

* 三已知closed轮native净值`0.004`、`0`、`-0.004`：closed3、winner1、rate1/3；显示按分可能全为0.00，不改变胜负。无需FX就能算native rate。增加一轮native未知：closed4known，winners/rate因覆盖不全unknown，不变成1/3或1/4的完整胜率。
* 两USD closed rounds各native10，上海close日Jan10/Jan20，严格历史USD/CNY分别6/7：历史card130；月桶130；累计130；历史贡献130；每round同一conversion事实。最新FX9所得180、范围终点FX7所得140均错误；任一历史pair missing，则目标币总额unknown，不发布已知70当全量，native20与count2仍可知。
* O01混合IPO1@100/手买1@200没有真实disposal link：canonical current38/46和历史最终round60可知（FX齐全时）；受影响IPO/long class unknown+provenance-ambiguous。不得使用trusted oracle的18/20/28作为真实分类。历史全范围总额与category未知同时可见，不能藏instrument或求known subset。
* known同值以完整identity稳定tie，unknown置后；改变输入集合排列不随机换行，不用null??0排序。

### O08 interface和query顺序不变量

1. 新facts terminal与旧wrapper/已接受F在同完整context的quantity、cost/unknown、grossR、canonical fees、reasons/warnings逐字段一致；不能只比最终net。
2. 精确instant/day、selected非prefix、同timestamp/tie、unknownID、显式visibleIDs超cursor均保留legacy行为；homepage的合法asOf选择另断言不泄漏未来。
3. 修改returned facts数组/嵌套值不可影响下一query；修改original caller input不可影响prepared source；full precision胜负不经过旧8位snapshot。
4. ordinary一次sweep+O(N)事实索引，不每round/每bucket重放全部source；attached如暂保exact fallback就报告实际复杂度。cache/context keys和保留大小进既有P2计量，不新增unbounded Map；1866×365既定预算不能被“只测新facts几条”绕过。

## 7. 给root的必要最小写授权建议（尚未获得）

建议**等P2冻结并独立接受或明确重开其票**后，将以下四文件独占给financial owner；不能与其P2同文件并发写：

|拟授权文件|限额|明确不授权|
|---|---|---|
|`app/lib/replay/position-ledger.ts`及同名test|additive只读fact query、同evaluator内部observer、不可变精确数值/证据/覆盖；原legacy行为和金融公式不变；append定向TDD|新ledger、平均成本规则调整、lot匹配、费用池移入canonical、attached未经证明fast sweep|
|`app/lib/reviews/homepage-v25-performance.ts`及同名test|在现有F fee step留只读allocation facts，组合同context；保留incurred FeeFacts，不改F方程/unknown门；append真实原始entries/IPO/反转反例|schema/import/storage/provider/真实source link补造、重新设计scope、复制P4 fee engine、把P2候选宣称接受|
|新`evidence/P4/seam/`（若root批准）|RED→GREEN、精确命令/hash、wrapper/F逐组件对照、上下文/性能与未验证项|覆盖旧FAIL/修改已接受旧证据/共享tracker|

本次无需授权S/host/session/Workspace/UI、新global types、DB或浏览器，也无需先写完整history/attribution产品module。完成此只读seam的独立数据接受后，root再派P4 history/contribution modules与唯一UI owner接线；不可将本提案视为隐含批准。

owner实施时先记录当前P2/F/canonical冻结hash，append O01–O08的真实interface RED并保存日志；再最小修改；GREEN必须包含原ledger/IPO/F相邻回归、strict types/lint、旧wrapper/新facts/F allocated逐组件等价及P2性能重新测量。全量suite不在当前只读任务范围；未来是否跑全量由root按变更决定。worker只称implementation-ready，root独立接受；P4产品功能/持久化/视觉仍独立NOT VERIFIED。

## 8. 读时版本与证据限制

静态读区间约2026-10-23 03:00–03:05+08；P2 owner仍可变动。03:04:41抓取：

|文件|SHA256|
|---|---|
|`app/lib/replay/position-ledger.ts`|`f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126`|
|`app/lib/reviews/homepage-v25-performance.ts`|`f9112e208617262be1699aff3c9bbcb5f49cdcfa45f2ccf64aa493f33156bdd2`|
|`app/lib/trades/ipo-cost.ts`|`f7d087bbd5233d209af6df8f1be95ab4d2954926fec1d788d10aa090814f413b`|
|`app/lib/import/statement-evidence.ts`|`45360f1373f4b185250182aad0acdac12d1c78cce9e3e7a1c40ec258c04ad6c2`|
|`app/lib/trades/types.ts`|`a7c7ba341a5f566c4e851dfe2a033c35cc4f7584205f3ab86cb82269546470a1`|
|`ROOT-FINANCIAL-DECISIONS.md`|`5ebe2ff314be1126baec8359390fbf0f810dd6e9f040fa5d0f34a887df28118e`|
|前份`PRE-DISPATCH-CONTRACT.md`（未改）|`1140ad8c6430562f2f6cb6478f1244717ef07ad5215058eda41784dcf095b803`|

本提案读时source与前份02:55指纹不同，是并行P2候选进展，不是本agent源码修改或新的freeze。上述行定位用于复核当前语义，派发前需owner按最新冻结源再确认。本文未执行O01–O08，所有red/green/性能/产品/UI/DB结果均NOT VERIFIED；本次交付仅是root可裁定的最小interface与授权范围。
