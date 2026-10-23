# P4 root 独立字面 oracle 候选

2026-10-23，financial_g61，`gpt-6.1-sol / ultra`。**文档中的独立测试候选；未运行任何新产品测试，不是 RED/GREEN、implementation-ready 或 accepted。P4 0/3。** 数字按已批准唯一 canonical 平均成本与 F fee pool 政策逐项列出，不以“总数相等”取代分项预期。后续实现测试应真实构造 entries→canonical/F事实→P4 public接口，不用下面表格充当被测输出、不从被测函数自动生成expected。

接口/原文/全元素见 [ACCEPTANCE-DATA-CONTRACT.md](ACCEPTANCE-DATA-CONTRACT.md)。本文没有写 ledger、F、P2、配置、DB 或 UI。引用既有 seam 提案的算例不代表它们已有新接口或该提案已被实施接受。

## 公共输入约束

每个算例默认一个真实形状的 `accountId=A`、`instrumentId=CN-SH:T`、`currency=CNY`、`tradeNature=live`、`simulationRunId=null`，原始fill ID各不相同，完整原始lineage。普通fill用明确instant和生产 `positionEffect`，数量/价格/费用为十进制string，元数据及从取得开始的source coverage完整。除例中特别说明，费用明确0、不写缺失默认0；无FX需要时不要求snapshot。以下是fixture语义，不声称 T 为业务库真实证券；未来测试要经已有真实entries builder产生完整 instrument/entry，不以类型断言伪造缺nature/asOf的fixture。

时间均以明确UTC instant表示；业务日期为Asia/Shanghai。可以在合法session内选择具体instant而不改变本例先后；若测试mark，必须使用F3认可的完整exchange session raw candle，不能使用周末/尚未收盘bar。输入原始execution重复/拆episode settlement另有O10，不在基本算例偷偷加倍。

## O01 — 加仓、部分减仓、归零；fee10与两种期间费用

原始四fill：Jan5买1@100费2(open-long)，Jan6买1@200费4(open-long)，Jan8卖1@180费2(close-long)，Jan9卖1@190费2(close-long)。本例日期为2026年，均为CN工作交易日，各自instant同日02:00Z，无同刻排序冲突。Jan7为所选期间起点（opening在首日之前），期初mark160；Jan8完成session末mark180。Jan9已归零。全部为同一account/instrument/nature/run。

|节点|signedQty|canonical avgCost|账面basis|cum grossR|F cum realizedFee|F openFee|cum netR|closedCount|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|买1后|1|100|100|0|0|2|0|0|
|两买后|2|150|300|0|0|6|0|0|
|首次部分卖后|1|150|150|30|5|3|25|0|
|最终归零后|0|0|0|70|10|0|60|1|

必须独立断言第一次部分卖出：released entry fee3、该次exit fee2、realizedFeeDelta5、剩余pool3；不能将5当该期实际新发生费或一个已闭合round。第二次卖出：released entry fee3、exit fee2、realizedFeeDelta5；整个round fee10、gross70、net60，closedAt为Jan9真实sell，winner=true。所有原始incurred fees总额10，各fill fee不重复。

|范围 Jan7 开始|opening netUF|period netR|closing netUF|UFchange|period net|期间实际 incurred fee|完成round final net / allocated fee|
|---|---:|---:|---:|---:|---:|---:|---|
|截至Jan8|14|25|27|13|38|2|closedCount0，不能发布net25/fee5的已闭round|
|截至Jan9|14|60|0|-14|46|4|closedCount1、历史net60、历史fee10|

期间R60与历史net60在此恰好相等，但**period net46不同**；这不是可用同字段替代两模式的依据。期初已发生费用6、期间实际费用4、最终round承担费用10须同时可追溯。

## O02 — 反手一个movement关旧/开新，不重复费用和round

2026 Jan5 buy1@100 fee2 (open-long)；Jan8 sell2@120 fee4 (open-short，已知可reverse)；Jan9 buy1@110 fee1 (close-short)。原始fill3条；不是把reverse拆成两条新增raw fill。

|节点/round|signedQty或匹配量|grossR|closed allocated fee|final native net|openFee|closedCount|
|---|---|---:|---:|---:|---:|---:|
|buy后|+1|0|未关闭|未关闭|2|0|
|reverse旧long|close1/open1；终态−1|20|4（旧entry2+sell费2）|16|新short2|1|
|cover新short|close1/open0；终态0|10|3（sell开仓份额2+cover1）|7|0|2|
|全源合计|终态0|30|7|23|0|2|

reverse原始fee4拆closing2/opening2，绝不能两个round各扣整笔4；旧entry2只释放一次。oldLong closeBusinessDate=Jan8，新short closeBusinessDate=Jan9。两个round身份含不同opening movement/方向。若改 `positionEffect=close-long` 且sell2超过持仓1，应unknown+原因，不借reverse规则放宽无证据超卖。

数量极小控制：buy1@100 fee0 后 sell0.9999999999@100 fee0，full-precision剩余0.0000000001，closedCount0。旧compatibility snapshot的8位0不能触发已闭round。这个断言必须读同一evaluator内部full-precision事实，不能在P4再算余量。

## O03 — 跨期 current / historical 不同；关闭日归属

2025取得1@100费0；2026所选期间开始前mark120；2026 Jan9 sell1@130费0后归零：

|读数|字面值|
|---|---:|
|opening netUF|20|
|period realized net|30|
|end netUF|0|
|UFchange|-20|
|period net / current contribution全量|10|
|selected2026 closed history net / historical contribution全量|30|
|lifetime realized / net（完整全源）|30 / 30|
|selected closed count / wins / fees|1 / 1 / 0|

若只在2026执行数据上重建，取得成本丢失必须unknown，不能从sell30/130猜成本。range不能预裁opening历史。跨年时间控制另用US/USD证券、target USD、明确原始取得和归零fill：`2025-12-31T15:59:59Z` 归2025；另独立case `2025-12-31T16:00:00Z` 归2026。两instant均为美国Dec31正常session内，不伪造CN午夜成交。month-only证据不产生“12月31日真实平仓”或一个可选年份点。

## O04 — 每桶胜率、无回合/真零/缺源/future不同

完整关闭round原币net列表：Jan=[1]；Feb=[1,-1,-1,-1,-1,-1,-1,-1,-1]，fee均0。

* Jan count1/win1/rate1；Feb count9/win1/rate1/9；range count10/win2/rate1/5=20%。**不能**平均两个百分比成55.555…%。同一转换事实下范围net=-6。
* 单独fixture Jan=[10]，Feb=[]且source完整，Mar=[-4]：period金额点Jan10、Feb无回合不画假0点、Mar−4；selected-start cumulative Jan10、Feb可合法维持10、Mar6（原SVG有已知无回合平段）；win Jan1/1、Feb—、Mar0/1，range1/2。range有已知结果，不能把no-round当未知源。
* 单独范围只有一完整round net0：count1、wins0、rate0、金额真0、fee0；与完整source零round的count0、rate—/空图不同。
* April source缺失：该桶金额/数量coverage unknown；range保留已知closed facts，但不发布假完整总count/胜率。累计自缺口起unknown，后续May已知新round不能掩盖April缺口重接完整累计。
* 单年始终12月份位置；asOf在Oct23，Nov/Dec为future，不能补0/当无交易。多年度以实际年份标识/年度桶。四模式容器/plot/tool rect相同；win轴0–100、count轴integer。

## O05 — full precision 决定胜负，展示精度不修改金融事实

三轮分别buy1@100，sell1@100.004 / 100 / 99.996，费用明确0。native final nets为 `0.004`、`0`、`-0.004`，全部以CNY显示0.00仍须count3、wins1、rate1/3。再加一轮buy1@100→sell1@100.0000000001，其net `0.0000000001`、winner=true，不能被legacy8位序列化吞掉。该四轮count4/wins2/rate1/2，gross/net合计 `0.0000000001`。

再加一已证明归零但费用缺失的round：closedCount5可知；第五round native net/winner unknown，total winRate unknown，不能用2/4当最终50%，不能当第五loss生成40%。knownNativeCount4只是coverage，不是新分母。全精度string在详情/复制可见；chart按分显示中性零且无假柱，金融winner仍独立可信。

## O06 — 每round关闭日FX一次转换，缺journal诚实unknown

本例日期为2025年（Jan10周五、Jan20周一）。USD两完整round native net各10、allocated fee各1（因此gross各11）；真实Shanghai closeBusinessDate分别Jan10、Jan20。真实historical observations该两日USD/CNY分别6、7，positive/complete，knownAt/publishedAt/fetchedAt均不晚于对应关闭业务日截止，完整来源与revision。最新快照9、所选range终点快照7只能做错误控制，不能被历史采用。

|输出|字面预期|
|---|---:|
|每round CNY net|60 / 70|
|历史四卡/Jan桶/累计/history贡献同一范围converted net|130|
|converted closed allocated fees|6+7=13|
|native USD subtotal net / fee|20 / 2|
|closedCount / wins / rate|2 / 2 / 1|

最新9回填得到180、range endpoint7统一换得到140均FAIL。缺Jan10合法observation时，target net/fee=null+FX原因，USD20/2、closedCount2、native wins2/rate1保留。只有Jan21 fetchedAt的Jan10标称rate不是真实Jan10 app已知；publishedAt晚/knownAt晚/裸键/负数/status missing/混淆pair均不可用。sameUSD target无需FX，直接20/2。

current contribution不同合同控制：若原币period R150/startUF100/endUF0，endpoint USD/CNY7，则原币period net50→CNY350；不能startUF×6后与R×7混减得450。历史按每round close FX的政策不被这个endpoint规则覆盖。

## O07 — mixed IPO/manual，无可信disposal link不pro-rata

IPO取得1@100费2，后manual买1@200费4；同一canonical平均成本150、qty2，期初mark160。卖1@180费2、再卖1@190费2（与O01数值相同）。真实public模型无disposal→lot字段，`sourceTradeId` 取得去重不是后续处置link。

* 取得后canonical q2/basis300/gross0/openFee6/netUF14；真实取得来源数量IPO1/manual1可知。
* 第一次卖后canonical q1/basis150/grossR30/realizedFee5/openFee3/netR25/endUF27、period net38、closedCount0。IPO/manual各自剩余数量和处置金额未知，不发布各0.5或FIFO；分类net/R/fee/UF等受影响分项null+provenance-ambiguous。总instrument net38保留。
* 最终归零canonical q0/basis0/grossR70/realizedFee10/openFee0/netR60、period net46、closedCount1/final history net60。归零可证明两来源剩余数量均0，但**不能由此倒推**两次不同价格处置属于谁；类别已实现/费用/净额仍unknown。全范围总46/历史60保留，不求已知类别子集冒充总额，不添加“其他”类别。
* 无费用控制：第一次period40、最终period50；费用控制：38/46。不能将manual独立成本200、IPO独立成本100重放两账本得到另一利润分配。

**仅未来真实可信link能力的合成oracle，不用于当前生产归因，不造输入字段：**若可信完整link先卖IPO再卖manual，批准单canonical池语义如下；费用池也同一份。

|时点/类别|qty|canonical分摊basis|cum grossR|cum realizedFee|openFee|period opening netUF|closing netUF|period net|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|期初 IPO|1|150|0|0|3|7|7|0|
|期初 manual|1|150|0|0|3|7|7|0|
|首次卖后 IPO|0|0|30|5|0|7|0|18|
|首次卖后 manual|1|150|0|0|3|7|27|20|
|最终 IPO|0|0|30|5|0|7|0|18|
|最终 manual|0|0|40|5|0|7|0|28|

取得后avg pool重分配留零和transfer：IPO成本+50/manual−50；IPO openFee+1/manual−1；原始取得成本仍100/200、实际fee仍2/4，不能改写来源事实。首次每项和=q1/basis150/gross30/realizedFee5/openFee3/openUF14/endUF27/net38；最终=q0/basis0/gross70/realizedFee10/openFee0/openUF14/endUF0/net46。无fee可信link期初每类UF10，第一次net20+20=40、最终20+30=50。仍只有instrument最终一次round，不能把首次IPO来源q0造一个历史已闭instrument round。

## O08 — IPO late refund、真实非execution close、知识隔离

本例日期为2025年。现金链Jan8申购−220/IPO fee−2，Jan10获配2；Jan15 sell1@120 fee1，Jan16 sell1@130 fee1；Jan20退款本金+20。完整原始证据ID与real canonical现金关联，IPO获配保持event而非额外假buy。

* knowledge Jan18：数量归零与Jan16 close可证时closedCount1/closeDateJan16；缺refund导致取得成本/native结果未知，不能用未来退款发布net46。实际incurred费用按原发生Jan8=2/Jan15=1/Jan16=1总4可独立保留；incurred-known不代表round allocation-known。
* knowledge Jan22：原始取得basis200/平均100，grossR50、最终allocatedFee4、native final net46、closedCount1/closeDate仍Jan16。退款本金20不成为Jan20负费或一个新round；不会把closeDate改Jan20。历史FX仍要求Jan16真实已知journal。
* 查询Jan22→Jan18与Jan18→Jan22顺序结果相同，旧对象immutable；晚知识不能污染旧cursor cache。未来carrier附的早期合法证据仍按既有exactcontext可见，不先剪carrier丢知识。

真实非execution归零控制：Jan6 short2@120 entry fee2，Jan8申购220/IPO fee2、Jan13allocation2、Jan20refund20，Jan22知识完整。canonical q−2→0，gross40、旧short round allocatedFee4、native net36、closedCount1；原始execution仍仅short那1条，不能计“卖空关闭+IPO平仓”两round。allocation部分cover未归零不计closed；若证据月度/排序不足则closure/date覆盖unknown，不能编造精确日。

## O09 — quantity/closure/date/fees/行情独立未知值

|真实边界输入|必须保留的独立预期|禁止结果|
|---|---|---|
|完整buy1→sell1，数量/价格已知，fee缺失|count1及可信closeDate；fee/net/winner/rate unknown|删该round、count0、fee0或winner=false|
|known opening2后完整可信transfer-out2，但无变现对价|可证明数量周期归零/关闭1；native realized/net/fee按各自证据unknown；event保持transfer|把转出当sell@0/realized0的盈利或亏损交易|
|position snapshot2→后snapshot0，中间覆盖gap|终态0可known；实际closure/count/date未知+gap，保留两快照证据|凭snapshot0构造一次真实平仓及月末日期|
|仅month的IPO/transfer或不可排序同日事件|对应时序/归属覆盖unknown；不向year/month桶偷偷塞确定round|updatedAt/导入时刻当closeDate|
|完整纯成交closed round，无行情|closed gross/fee/net/count可知，不需current price|因current quote missing清空历史财务|
|unknown成本但可信qty/current quote|可信MV保留；UF/net按成本依赖unknown|将已知qty当0或费用不明导致MV也清空|

无法确定是否存在额外闭合round时，范围count为unknown而保留knownClosedCount作为coverage；不能把未解组过滤后声称全范围count完整。资格依赖episode冲突时同样保留base事实与scoped selection uncertainty。

## O10 — 原始lineage、身份、episode与future隔离

1. O01原始fill在多episode/split settlement引用同ID：原始buy量仍2、sell量仍2、incurred总10、final closedCount1/net60。完全相同duplicate不新增fill；同原始ID qty1/2冲突使quantity/closure依赖unknown，不能发布首条数量MV。纯fee冲突不必抹去独立可信数量事实。
2. 同instrument跨account A/B、live/simulation、simulation不同run：分别原始组独立库存/fee；不得A buy给B sell做平均池。unknown nature不默认live；未知scope coverage显式保留。
3. episode `endedAt` 在Jan8，但O01canonical Jan8仍q1：closedCount0；canonical Jan9才归零。reverse被episode拆两段不双算原始fee。关联冲突可阻断详情/资格但不改canonical base gross facts。
4. asOf Jan8不能因Jan9未来sell或未来episode close删当前行/发布未来round；source futurecarrier早期statement知识沿exactcontext保留。显式legacy visibleExecutionIds可选cursor后fill的旧wrapper能力保持，homepage合法asOf适配不滥用该能力。

## O11 — 完整历史查询和同一转换事实跨视图复用

同原币net10的两关闭round：2024关闭一轮、2026关闭一轮（费用各1/gross各11）；另2026仍open的一轮gross realized7、openUF9。history range2026只count1/net10/fee1，不能混入open轮的7或9；all count2/net20/fee2；current贡献仍按current期间完整R/UF变化，不被历史range改。2024开仓2026关闭属于2026结果，取得证据不能被range裁。

range年度桶、cards、selected-start cumulative、history contribution引用同一round IDs和conversion IDs；相同round不同展示不能重新挑FX。补录/撤销/修正改变相关版本/年份投影，但不是新round也不能只改单个card。unknown FX时全部依赖该conversion的金额同步unknown，保留原币与count；一组缺输入不能隐藏其他组原币证据。

## O12 — 下钻、全量合计、双记忆和实际返回（非纯财务替代UI）

分页read-model候选：50个稳定完整identity，net为1..50、无未知；profit-desc页1为50..43，页7为2、1；每页8槽、总7页、全量合计1275，翻页不变。空结果无1/1；all市场只有三行而不继承7页。unknown行排known之后；同值按完整identity稳定排序，不能只比可重名symbol。局部category/openOnly筛选后的合计另名，不能冒充scope总额。

真实闭环接受必须另做：current设置long/profit-desc/A股symbols/page4/openOnly=true，history设置short/loss-asc/US symbols/page2；来回切换分别恢复。global market后来切HK时不能从旧local记忆把header恢复A/US。history openOnly同位置禁用、回current恢复true。详情关闭/普通库返回/reload重读后scope/date/两记忆/scroll/focus保留，消失回贡献标题。ordinary库始终当前已应用全局执行日期，不用history年份覆写；closed无current holding也能正确定位已有详情。

如操作既有复盘写流，需实际隔离DB保存/readback/返回/reload及409/失败；本文无产品/DB授权，不执行、不以纯readmodel oracles冒充真实UI或持久化PASS。四历史模式和全部控件/原图视觉独立接受仍全部NOT VERIFIED。
