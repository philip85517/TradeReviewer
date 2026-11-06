# 首页 V2.5 与交易库 V1.0：设计驱动数据需求取证

日期：2026-10-31。工作树：`/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview`；分支：`codex/home-read-mvp-experiment-20261029`；HEAD：`b49b17066fab4bea7270082ce07c7dfdfa9cc7d1`。

本报告仅阅读已批准设计正文、其当前引用 SVG 的文字/结构与局部原型说明，梳理后续读模型需要服务的界面。没有读取任何数据库、运行产品接口或修改代码；只写本文件。功能、持久化、浏览器渲染与物理触屏均为 **NOT VERIFIED**，本报告不是实现验收。按项目工作流，文档取证不要求启动 UI/数据库验收。下表中的 `H-*` / `T-*` 是本报告覆盖行号，不是新批准的产品元素 ID。

## 1. 权威范围与版本

[设计总索引][INDEX] 将首页 V2.5、交易库 V1.0 列为当前规范；冻结 V2.4.2 与历史 A/B 方案仅供追溯。当前正文、其实际引用图稿、第四/第五轮局部原型共同构成设计合同，不能因目录存在某 SVG 就新增其要求。[首页 README][HR]、[交易库 README][TR] 明确了这一范围。

|权威材料|版本绑定与读取位置|
|---|---|
|首页正文 `[H]`|[V2.5 原文][H]，668 行；SHA-256 `daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`，与其 document-manifest 一致|
|交易库正文 `[T]`|[V1.0 原文][T]，134 行；SHA-256 `377f37b2ead444326dcca760628e8aa51ebb9507537ebe5604e78581ef7564fa`，与其 document-manifest 一致|
|当前入口修订|[2026-10-22 用户确认记录][ENTRY]：首页统一普通“交易库”，取消独立待复盘入口/徽章/默认队列；不取消库内显式待复盘筛选|
|公共控件|[首页 HP08][H8] 与[控件手册][MANUAL]；12 类 × 八态（96 组合，85 适用，11 不适用）|
|局部交互辅助证据|[历史原型记录][HN]、[贡献原型记录][CN]。固定 fixture、连接占位均不是生产数据或正式详情验收|

本地当前 `docs/design-system/reviews/SITE-HOME-V25.json` 与 `TRADING-LIBRARY-V10.json` 评论数组均为空；未从空评论记录推导额外产品决定。下文明确区分「正文明确」「图稿展示」「为模型提出的需求/缺口」。

## 2. 共同的数据与视觉边界

- 首页 **仅 live**；交易库 live/sim 互斥，各自记忆上下文。账户不是练习身份。
- 上海时区 `Asia/Shanghai`；自然周始于周一，月始于 1 日，年始于 1 月 1 日；快捷范围截至今天且含起止日。自然快捷项跨页传递实际日期。
- 首页有三套时间语义：期间表现（可跨年）、最新持仓、按平仓日归属的历史已平仓。不得合成一组总数。交易库另区分成交日、平仓日、练习保存日期。
- 市场 `all/a/hk/us`；全部/A 股显示 CNY，港股 HKD，美股 USD。金额必须携带币种、范围、覆盖/缺失原因。设计要求原币及 FX 来源可查，但并未定义每一指标的 FX 定价时点与提供者优先级。
- 未知不等于零：读失败、缺输入、无回合、无匹配、真零、未来未覆盖必须可区分。读模型不能只输出一个 `number | null` 而丢掉业务原因与覆盖计数。
- 请求成功前保留上一组完整范围和数据；成功原子替换范围标签、币种、数字；失败保留旧组并说明新选择未应用。只有最新有效 generation 与完整 scope key 同时匹配才提交，迟到结果忽略；15 秒后手动恢复。
- 桌面参考 1440×1000 / 1280×800、100% 缩放；首页左导航 72px、页头 64px、内容左右 24px、模块间 24px、内部 16px。卡高 88px，指标 28/34，模块标题 18/24，图题 16px/600，正文/控件 14/20，说明/轴 12/16。首页持仓标题 48、表头 40、行 48、分页 48、八行槽。
- 金额绝对值 ≥1 亿用“亿”，否则 ≥1 万用“万”，缩写两位小数；完整精度供提示/详情/复制/导出。单价显示两位小数、数量保留真实精度/负号。格式化不能改变事实精度。
- 主要来源为 [H 全站原则/布局][HBASE]、[H 公共状态/一致性][HSTATE]、[H 接口附录][HC]、[T 范围][T3]。颜色、对齐、动效沿用公共标准，不应进入业务事实表。

## 3. 首页控件、状态与所需数据

「来源」列指设计要求的逻辑事实来源，不声称已有对应表或 API；实现/数据库映射由后续代码调查确认。

|覆盖项与控件/状态|显示字段、过滤/排序与交互|数据粒度、逻辑来源和计算需求|准确依据/参考图|
|---|---|---|---|
|H-01 页头市场|全部/A股/港股/美股四标签；影响表现、持仓、历史、贡献全部模块；币种同步变更|同一 live、账户、附加筛选下的全页范围；标的市场身份与各原币/FX；不能先更新标签后补数字|[H HP03 115–124][H3]；[整页 1440][HOME]|
|H-02 账户选择|当前值常显，全部账户及具体账户，长名可读全称；36px 高，176px 建议宽；开合不变宽|账户目录（ID、显示名、live 归属）与账户选择集；选项空/加载/失败不能抹掉当前值；账户与标的聚合键关系待明确|[H 117–128][H3]；[账户图][ACCOUNT]；[手册 Select][SELECT]|
|H-03 全局标的搜索|名称/代码输入，停顿300ms，IME组词完成才查；结果显示名称、代码、交易所、币种、资产类别；方向键/Enter查看；清除只清查询和候选；关闭不改变首页范围|标的目录实体级；完整身份必须区别同代码/同名/不同交易所；是否覆盖无交易标的、是否受当前账户/市场限制未明示|[H 130–159][HSEARCH]；[搜索结果图][SEARCH]|
|H-04 搜索遮罩/详情返回|最大960px舞台，覆盖且阻断底页，结果区独立滚动；关闭详情返回查询、候选滚动和所选行；详情焦点锁定且外点不关，搜索外点可关|搜索查询、选中实体、滚动/焦点属于导航快照；详情显示完整标的身份及数量、成本、当前价、市值、浮盈；一个“查看交易”主动作|[H 138–159][HSEARCH]；[搜索详情][SEARCHDETAIL]、[通用详情][DETAIL]|
|H-05 附加筛选草稿|320px独立浮层；标的类别、仅看未平仓持仓、是否待复盘；同维 OR/维间 AND；直接多选；应用后才生效|全局 filterDraft / appliedFilter 分离；类别由标的目录，未平仓由剩余仓位，待复盘由复盘状态派生；未平仓包含浮盈为0者，不能用浮盈非0判断|[H 161–175][HFILTER]；[筛选图（措辞滞后）][FILTER]|
|H-06 应用/清除附加/恢复默认/关闭|应用原子提交；清除只附加，保留市场/账户/live；恢复默认含市场/账户但不动日期；Esc/外点留草稿；切市场/账户丢旧草稿；失败保留提交前范围和当前草稿|条件计数、可移除已应用标签、草稿作用域；标签移除的提交时机/失败回滚需同一事务语义；默认值集合未在正文完全枚举|[H 165–188][HFILTER]；[已应用/重开图][APPLIED]|
|H-07 期间快捷/自定义|本周/月/年与实际起止日期；直接打开日期浮层；开始/结束/应用；开始晚于结束时错误并禁用；取消/Esc保留已应用期|期间草稿与生效日期；本地业务日期；更改只联动前三KPI、日曲线、当前期间贡献数据，不切贡献模式，也不改最新持仓/历史|[H 210–220][HPERIOD]；[期间图][PERIOD]|
|H-08 四项当前指标|期间净盈亏、期间已实现、期间浮盈变动、当前持仓市值；前三随期间，第四最新；正/负/零独立样式|期间已实现按实际平仓日扣费，含部分平仓/做空；`净盈亏=期间已实现+期末浮盈−期初浮盈`；最新市值不含现金/负债，不称总资产|[H 193–208][HKPI]；[整页四卡][HOME]|
|H-09 当前市值说明|详情可查当前浮盈、覆盖数量、原币金额、FX来源；正常不常驻成功徽章|最新仓位 × 最新可用有效价，并带行情时点/来源、覆盖分子分母、FX来源；缺价/缺FX不可伪零；带空头时市值净额/绝对额未在V2.5明确|[H 202–206][HKPI]；[H 32][HBASE]|
|H-10 当前日曲线默认/读数|单条“期间净盈亏（按日）”；网格/零线/双向十字线、日期/金额轴标签；点默认隐藏，hover/focus出现；左右有效点/Home/End，Enter固定/Esc关闭|业务日级估值序列；每点可取当日市值、当日浮盈、累计已实现、累计净盈亏、期间净盈亏、费用及原币/FX/行情覆盖；不能回填最新估值|[H 222–241][HCHART]；[六行金额提示图][HOVER]|
|H-11 日曲线缺口/未来/真零|缺行情/FX断线不插值，未来中性灰区；真零保留0；说明缺失日期范围和原因；仅一个全局修复入口|交易日/自然日轴域与有效性分开；点级计算可用状态及缺失原因、as-of覆盖边界；累计净盈亏 vs 期间净盈亏的完整基准定义待补|[H 226–250][HCHART]；[缺口图][GAP]|
|H-12 当前持仓行|标的(名称/代码/交易所)、持仓天数、数量、成本价、最新价、持仓市值、持仓浮动盈亏、查看；列25/8/10/11/11/15/14/6%；含负数量|“当前未平仓持仓”粒度；源为成交/剩余仓位、成本、标的目录、最新价/FX；多账户同标的合并与多空净额/分行未明示；持仓天数从哪个开仓起算未明示|[H 253–287][HHOLD]；[整页持仓][HOME]|
|H-13 持仓标题汇总|标题右侧并列(C方案)的市值/持仓浮动盈亏；工具区仍留局部搜索/导出；市值中性、浮盈正负色|汇总应注明实际过滤范围及覆盖；是否随局部搜索改变汇总未由正文写清，不可任意固化|[H 274][HHOLD]；[C方案 1440][HCPLAN]；[H 609–643][HCAPP]|
|H-14 局部持仓搜索|inline；300ms/IME；输入新词、清空、排序、切市场回第一页；只过滤表，不改全局|当前范围内持仓匹配索引、totalMatched/pageRows；无匹配与零持仓不同；查询匹配字段/大小写/代码规范待细化|[H 295–305][HHOLDOPS]；[搜索分页图][LOCAL]|
|H-15 持仓排序|列头按钮/菜单、箭头、可访问名；all市场完成CNY换算后市值/浮盈可排；FX/覆盖不足禁用并说明|全量结果先换算再排序再分页；不能只排当前8行；默认排序、允许的其他列、同值稳定tie-breaker未明示|[H 297–299][HHOLDOPS]|
|H-16 持仓导出|导出全部筛选结果，非当前页；0条禁用，提示“无可导出的持仓（0）”；保留完整金额精度|同一已应用全局/局部范围的完整行集；文件格式/列序/FX元数据未明示|[H 299][HHOLDOPS]|
|H-17 持仓分页/边界|固定8槽；0条不画可用箭头也不伪1/1；1–8一页箭头禁用；9条第二页1行；50条7页末页2行；数量左、页码右|pageSize=8、总量/页数、当前页、剩余空槽；数据删减后页码clamp与恢复策略需明确|[H 259,285,297–309][HHOLD]；[9条末页图][NINE]|
|H-18 持仓详情/返回|最后列“查看持仓详情”；详情唯一主动作“查看交易”；关闭恢复来源行/查询/排序/页码/滚动；行消失焦点回表标题|完整symbolIdentity、当前账户范围、来源快照；详情展示原值/全名/资产类别；缺成本“暂无”、缺最新价“待更新”|[H 312–345][HHOLDRETURN]；[详情返回图][HOLDRETURN]|
|H-19 历史范围选择|默认展开，在持仓下方；年份单年/今年/区间/全部；只联动历史四卡/曲线/历史贡献数据，不切贡献模式|历史闭合回合按真实平仓日期/业务年过滤；补录/撤销/修正能重算；更新时间有业务时区；未结束回合排除|[H 349–372][HHISTORY]；[历史图][HISTORY]|
|H-20 历史四卡|已平仓净盈亏、已平仓回合数、范围胜率、已扣费用；盈利回合/总回合与百分比同时显示；无回合胜率“—”非0%|范围内完整可信闭合回合，扣费净额、费用、正收益数、总回合数；胜率=sum赢/sum全体，不能平均分期胜率|[H 353–357][HHISTORY]；[历史图四卡][HISTORY]|
|H-21 历史图指标/粒度|单年按月，多年按年；各期盈亏/从范围起点累计盈亏/各期胜率/回合数；单位币种/%/回合；胜率轴0–100%，回合整数轴|与四卡同一回合集合，按平仓日期分桶；默认期净额；累计缺口后后续受影响（原型说明）；不能把月序号冒充日期|[H 357–385][HHISTORY]；[胜率图][HWIN]、[回合图][HROUNDS]、[历史原型说明][HN]|
|H-22 历史空/无交易/零/未来/缺失/失败|无回合低干扰背景+原因；真零保留0与真实回合数；缺失断线；未来灰区；加载留旧组、失败留旧范围可重试；提示仅临时读数不导航|每月/年 `no-rounds/valid-zero/missing/future/failed` 语义分开；金额/百分比/回合完整值、粒度/单位、原因|[H 363–392][HHISTORY]；[历史缺失图][HMISSING]|
|H-23 底部贡献模式|唯一贡献区在历史之后；当前期间/历史已平仓互斥，无第三套日期；两模式分别记分类/排序/局部下钻/页码|当前模式依期间表现日期；历史模式依历史年份；共用全局市场/账户/费用/FX；切模式不移上方布局|[H 395–409][HCONTRIB]；[当前/历史整页][HOME]、[历史贡献图][CHIST]|
|H-24 市场汇总/下钻/面包屑|all先3市场条；点具体市场条→该市场标的明细→标的详情；面包屑返回；页头仍all；直接选单市场直接明细|market汇总与symbol明细同源；市场条只3行不套8行分页；下钻不能偷换全局scope或跳固定首标的|[H 399,405,428][HCONTRIB]；[市场汇总][CMARKET]、[A股明细][CCURRENT]|
|H-25 贡献分类/仅看未平仓|做多/做空/打新互斥；打新限获配及后续卖出，上市自行买归做多；分类与排序/仅未平仓独立；历史保留复选框但禁用，切回恢复|可审计的业务分类、是否残余未平仓；不能用净浮盈非0替代；分类更新摘要/条/明细/总计/分页一起变更|[H 401][HCONTRIB]；[整页贡献工具行][HOME]|
|H-26 贡献排序/分页/合计|盈利最高降序、亏损最大升序；明细8行/页，50项7页；翻页焦点到新页首行；合计来自全量非当前页，下钻保留全量语境|market→symbol全量分类结果；总计/市场计/分页计语义区分；同比同值稳定顺序、缺值排序位置未明示|[H 401–407][HCONTRIB]；[A股明细][CCURRENT]|
|H-27 贡献组成/正负/不可算|实心期间已实现、中空浮盈变化；同号连续、异号分置零线两边；段外高14；正绿/负专用粉红；按分判真零，不画假柱；缺输入不可计算且可显示已知已实现|当前：R + U_end − U_start，含期内平仓部分的期初浮盈；全量适用贡献应对账期间净盈亏；历史仅范围内闭合回合，不含当前浮盈；partial与total不可算分开|[H 397,403,417–425][HCONTRIB]；[估值缺失图][CMISSING]、[异号样例][CMIXED]|
|H-28 贡献详情关闭/对象消失|恢复模式/分类/排序/下钻/页码/滚动/原焦点；对象消失焦点回贡献标题，保留仍有效条件|市场、symbol、日期、账户、过滤与返回快照；原型详情是连接占位，不能作为正式容器定义|[H 407–430][HCONTRIB]；[贡献原型说明][CN]|
|H-29 普通交易库入口|live；已应用范围/market/accounts显式传；普通入口无queue，无待复盘数量徽章；日期/标的来源继续传；到达即生效|URL可重建scope/rangeMode/from/to/market/accounts；all不带起止；symbol需交易所+代码（必要时资产类）；目标是标的交易集合非固定首行|[H 432–463][HENTRY]、[H 652–658][HC]；[入口修订图][LIBENTRY]|
|H-30 日期入口“查看交易”|按该业务日进入实盘交易库，成交日筛选，保留未平仓成交；回首页恢复原期间/滚动/日期焦点；与历史图临时提示区分|date精确值+来源market/accounts+source快照；当前日期详情六行图没有画动作的具体展开位置，不能假定历史tooltip也是入口|[H 440–444][HENTRY]、[H 652][HC]；[当前日期读数图][HOVER]；交易库[日期到达图][TDATE]|
|H-31 首页刷新/返回|重新读取数据并恢复期间、历史范围、市场/账户/附加、持仓查询/排序/页码、贡献当前模式及两模式各自状态、滚动/焦点；原对象消失只回容器标题|可版本化完整来源快照 + 当前数据版本；直达/刷新由URL重建目标范围，来源快照不能替代目标scope|[H 454–463][HENTRY]、[H 655–660][HC]|
|H-32 加载/缺失/失败/修复|首载稳定骨架；后台旧完整数据；空/无匹配/零/缺行情FX分开；唯一全局“一键修复”；进度/部分完成/失败；进行中防重复，完成相关数据一起刷新|全页状态、stale/asOf、错误、缺口清单、修复进度(完成/总)、剩余原因；原始成交不得由修复改写；修复可修哪些事实不由设计定义|[H 465–501][HSTATE]；[修复状态图][REPAIR]|

## 4. 交易库控件、状态与所需数据

|覆盖项与控件/状态|显示字段、过滤/排序与交互|数据粒度、逻辑来源和计算需求|准确依据/参考图|
|---|---|---|---|
|T-01 顶栏/来源条件/返回|先显示实盘/模拟视角、来源条件与返回来源；首页传入日期/标的/市场/账户立即生效；只读摘要与按钮分开|来自URL的目标范围 + 独立来源快照；未提供条件保留交易库自身范围；库内改条件不回写首页|[T BT01/02][T1]、[BT03][T3]；[条件交接图][THANDOFF]|
|T-02 实盘/模拟视角|互斥；分别记忆日期、市场、账户条件、查询、排序、页码、滚动/焦点；不创建额外模拟账户模型|viewScope隔离的UI状态；练习identity ≠ live账户ID ≠ 导入文件名；列表/统计共享当前视角日期/market/accounts|[T 11–13,29][T1]；[统计视角图][TLIVE]、[模拟图][TSIMSTATS]|
|T-03 日期工具|单日/区间/全部/周月年；实际日期可见；上海自然日期；非法值明确默认并提示|同一日期值用于不同明确的dateBasis：live列表=成交日，live统计=平仓日，sim=文件保存的练习日期；不是行情bar日期|[T 13,25–29][T3]；[日期到达图][TDATE]|
|T-04 市场/账户条件|来源market/accounts保持，到达立即生效；切视角不覆盖另一视角账户选择；分布下钻不变顶部条件|market/account集合需要跟视角/日期一起进入查询身份；sim账户控件和业务模型不是本合同新增要求|[T 25–31][T3]；[待复盘图][TPENDING]|
|T-05 库内搜索/刷新/筛选|局部inline，不调用全局搜索遮罩；搜索220px、刷新36px、间隔28px；摘要独立；刷新保留条件；空/失败不改工具几何|当前交易库行集的局部搜索；规范引用inline规则，但搜索具体匹配字段、待复盘规则、列表排序字段/默认未列全；不能套首页八行约束|[T 19–21,31,37][T2]；[待复盘图][TPENDING]|
|T-06 普通/待复盘范围|首页普通入口不预设`queue=pending-review`；内部显式筛到待复盘，保留来源范围；完成复盘后可核对结果变化|review完成状态→队列成员派生；待复盘判断以成交/标的/回合何者为单位、完成定义/状态机未在当前设计精确定义|[T 9,76,84–90][T6]；[待复盘列表图][TPENDING]|
|T-07 实盘列表行|图示：成交日、标的名称/交易所代码、方向、成交价、数量、状态、查看交易；按每笔成交日过滤且保留未平仓；打开该标的回合集|成交事实级过滤+symbol交易集合导航；是否一行每成交或同标的汇总列表未被正文完全钉死（见缺口）；价格2位、数量真实精度；状态区分已平仓/待复盘等维度|[T 41–43][T4]；[日期列表][TDATE]、[待复盘列表][TPENDING]|
|T-08 实盘标的→回合集|点击某标的交易进入既有详情容器的回合集，不增加中间页；来源列表恢复symbol/过滤/排序/页码/滚动/焦点|回合集关联symbolIdentity+账户/范围、成交/平仓回合；可带范围外必要开仓上下文，但不改变列表/统计归属；live回合配对方法未在V1.0单独定义|[T 43,78–80][T4]；[完整旅程][T6]|
|T-09 模拟练习列表|一次练习/单标的/多回合，同标的同日再次练习独立；显示练习日期、标的/练习标识、练习记录数、有效(已平仓)回合数；点击直接回合集|practiceId主键、practiceDate、symbolIdentity、sourceFile归属；不能按symbol+date合并；原始来源日期需可追溯|[T 45–49][T4]；[练习A/B图][TPRACTICE]|
|T-10 练习回合集|回合、开仓上下文、配对数量、净盈亏；余量明确未平仓不计回合/统计；开仓上下文保留|同practice内最近开仓优先(LIFO)匹配；100+50卖80→配50、30两回合，余70；净额扣费；一个配对就是一个有效已平仓回合|[T 49][T4]；[练习A回合图][TROUNDS]|
|T-11 回合复盘/逐层返回|回合集选回合，携practiceId/roundId及必要开仓上下文进入既有复盘容器；回合→回合集→标的/练习→交易库→首页逐层恢复|独立稳定回合身份、复盘保存状态、来源对象/区间/过滤/排序/分页/滚动/焦点；当前分镜只说明绑定身份，复盘正文字段须另查既有复盘规范|[T 74–90][T6]；[回合A1][TREPLAY1]、[A2][TREPLAY2]、[B1][TREPLAYB]|
|T-12 列表/统计主体切换|两者复用当前viewScope的日期/市场/账户；统计不是按列表成交日直接求和；原列表上下文需可返回|同scope有不同dateBasis与grain；不能把同一未限定语义的filteredRows同时喂列表/统计|[T 11–13,29,61–65][T5]；[实盘统计][TLIVE]|
|T-13 统计趋势与自动粒度|跨度≤31天按日；>31天且≤2年按月；>2年按年；图示日期排序↓；趋势单位金额，带币种|live按平仓日期、sim按练习保存日期的有效闭合回合聚合；默认各期/累计曲线语义、两年端点含义未精确定义；不能直接套首页年度规则|[T 59–65][T5]；[实盘统计][TLIVE]、[模拟统计][TSIMSTATS]|
|T-14 范围汇总KPI|图示live：已平仓回合、胜率、扣费净盈亏、平均盈利(排除净零)、平均亏损(排除净零)；sim另加练习记录数|扣费净>0赢、<0亏、=0平；胜率分母含平；平均盈利只正回合、平均亏损只负回合；sim练习记录数与回合数分别计算；回合收益率分母未明示|[T 49,61–65][T4]；[实盘汇总][TLIVE]、[模拟汇总][TSIMSTATS]|
|T-15 盈亏分布单位/桶|默认回合收益率，可切金额；图示收益率桶：亏>50%、亏0–50%、净零、盈0–50%、盈>50%；显示回合数+占比2位，窄栏占比换行|当前范围全部有效回合固定分母；按选中单位分桶；收益率精确定义、±50%端点、金额桶阈值没有完整定义；缺失输入不伪成净零桶|[T 61–65][T5]；[分布正常图][TLIVE]|
|T-16 分布区间下钻|只展开该区间回合；不改变顶部范围，不改分母，不重算原分布；行示practice、round、symbol、收益率、金额、状态、打开复盘；保留原区间和位置|bucketId+当前分布版本+roundIds的稳定成员关系；全体有效回合数与bucketCount分开；一页8条是图示，不等于正文全库pageSize=8合同|[T 63][T5]；[区间8行明细][TDIST]、[复盘返回][TDISTRETURN]|
|T-17 缺输入/空/极值|没有交易、无匹配、无已平仓回合、缺事实、缺计算输入分开；金额/收益率不可算“—”；极值/负值/集中分布可读；不混缺失到完整分布|round级可算性/原因、受影响IDs、全量/有效/缺失计数；“全部有效回合”与“缺失排除”对分母的定义需明确可审计|[T 92–103][T7]；[输入缺失][TMISSING]、[极值][TEXTREME]|
|T-18 加载/失败/重试/快切|首次按最终尺寸占位；后台保留完整旧组；失败/超时保留旧scope并说明未应用；重试保留过滤；只接最后有效响应|查询标识、稳定读取版本、stale/错误/可重试状态；库内retry不强套首页唯一全局修复布局|[T 94–96][T7]；[加载][TLOAD]、[失败][TERROR]|
|T-19 保存/刷新/重开一致性|从日期、普通库、内部待复盘、live标的、sim练习、分布区间各路进入；保存复盘→返回→刷新→重开仍绑定正确对象/状态|review事实写后更新队列/统计/回合集的依赖；来源上下文跨导航恢复；本报告未验证实现与持久化|[T 115–119][TACCEPT]；[H 568][HACCEPT]|

## 5. 必须保留的设计缺口、内部差异与假设

|编号|证据与差异|对数据模型的影响 / 本报告处理|
|---|---|---|
|G-01 旧整页徽章|[HOME] SVG文本仍含“12”；[当前入口正文][HENTRY]、[用户修订][ENTRY]取消首页待复盘徽章|不为首页入口新增pending计数读模型；待复盘仍可作为首页筛选维度/库内筛选。旧SVG是视觉资产滞后，不能推翻最新决定|
|G-02 筛选语义滞后|[筛选SVG][FILTER]与[手册 FilterPopover][MANUALFILTER]仍写“是否有未实现数据”；[H 163][HFILTER]写“仅看未平仓持仓（包含浮盈0）”|按明确业务状态建openPosition条件；不得按unrealizedPnL!==0过滤；若需要有/无布尔反选的确切组合仍待确认|
|G-03 模拟示例回合数冲突|[模拟统计SVG][TSIMSTATS]称100+50卖80为“练习A·3回合”；[T49][T4]、[练习回合集][TROUNDS]为两回合|采用两回合的明确定义；不要从SVG例数倒推算法。live是否也按配对回合计算不可从sim规则自动推出|
|G-04 单价/数量SVG例值|[待复盘图][TPENDING]ETF价2.814；[T19][T2]价格统一两位。[标的详情][DETAIL]数量182.00的隐藏/完整文本带CNY|保留原始精度、显示单价两位；数量不是货币。示例异常不成为字段类型定义|
|G-05 历史范围提交机制|[H361][HHISTORY]“选择器并应用”；[第五轮历史说明][HN]“选范围直接读取，没有额外应用按钮”|已应用范围只有请求成功后变化是共同合同；具体是否显式Apply需采用当前批准控件原型并由协调者统一，不建两种互相矛盾状态流|
|G-06 当前日曲线字段基准|[H230–237][HCHART]与[提示图][HOVER]同时有累计净盈亏、期间净盈亏，正文未逐一定义累计起点；图标题“按日”不等于日增量|读模型需区分dayPoint/累计/期间净额；基准、交易日无行情而非缺失、日内截止需补充。不能凭字段名把两值合一|
|G-07 最新持仓/合并粒度|[H257–287][HHOLD]给行字段，未定义跨账户同标的是否合并、多空是否抵销、持仓天数起点/成本算法|保留账户、symbol、仓位/lot维度的来源，不提前压缩到symbol唯一一行；这些是模型决定前的缺项|
|G-08 实盘列表展示粒度|[T43][T4]按成交日期筛且打开标的回合集；[日期图][TDATE]呈成交字段；正文未明确每成交一行还是symbol摘要|至少需要成交可审计且日期过滤不吞未平仓；展示grain不能仅靠截图一行推断；后续与现有代码/产品合同核对|
|G-09 已平仓“回合”跨版本术语|[当前T49][T4]明确sim每个有效配对为回合；较早[领域术语][DOMAIN]说完整交易回合，旧实现历史还有净仓位归零回合|不静默把episode、配对closed-lot、practice相互替换；当前sim按配对规则，live缺单独明确定义；需建立共同术语并标dateBasis|
|G-10 FX/价格/成本可算策略|[H206][HKPI]要求FX来源/原币，[H235][HCHART]要求日值；[领域术语][DOMAIN]另有最新FX估算词汇|缺少period/history每天采用哪日FX、缺当日FX能否回溯、收盘价/复权与成本/费用分摊方法。不能把“当前最新FX”自动套历史点；数据模型需保存定价依据/覆盖|
|G-11 日期查看交易的具体入口形态|[H442][HENTRY]保留日期详情“查看交易”；[H241][HCHART]仅删除“查看该日敞口”；[日期读数图][HOVER]六行没有画按钮；历史提示明确不导航|保留按日导航参数合同，但入口具体固定/弹层状态及点击目标需补；不能凭历史tooltip可聚焦就给它增加导航|
|G-12 收益率/分布桶/有效分母|[T61–65][T5]定义默认收益率、占比/有效分母，未定义收益率分母、空头/零成本、±50%归桶、金额边界、缺金额仅缺收益率的分母关系|不能由本报告发明计算公式；需要版本化可算性及bucket contract；保留原始成本/费用/数量等证据|
|G-13 待复盘定义|[T76][T6]要求内部筛选并在复盘完成后核对变化，但未定义完成判据/成交或回合级queue|需要review对象绑定与状态规则；禁止简单“有notes即完成”或按symbol把多回合一次清空|
|G-14 默认/排序/页大小|首页持仓8行、贡献symbol8行明确；[交易库正文][T]没有把所有表固定8行，待复盘图12项第1/4，区间图8行；默认period、排序、tie-breaker也未完全定义|不可复用首页pageSize当全库常量；对明确值执行，对缺项记录假设；稳定排序/有效页码恢复需单独设计|
|G-15 贡献“标的”与“历史回合”图文混用|[H405][HCONTRIB]说标的明细八行；[历史贡献图][CHIST]行标签写“历史回合·标的·序号”且同symbol多行|正文定义market→symbol list→detail，历史贡献最小聚合grain不宜仅凭fixture重复名称推断为round；须明确symbol聚合与round可追溯字段|
|G-16 还未被本设计决定的存储/来源|两份当前视觉规范均未定义业务表名、API路由、缓存/预计算刷新算法、数据供应商优先级或物理存储|本报告“逻辑来源”是需求分解，不是实现事实；不能从旧July IndexedDB设计恢复当前SQLite之外存储决定|
|G-17 未决视觉与未验证状态|[H601–603][HCAPP] O02徽章24px继续，20px紧凑待确认；[H566–568][HACCEPT]窄屏/触屏独立；[原型说明][CN]详情占位、fixture无DB|不把原型通过当正式功能/持久化/视觉通过；保持当前24px，不新增手机设计假设；本报告相关验收NOT VERIFIED|

## 6. 供主协调者建读模型时直接采用的边界

1. **共同事实不等于共同响应。** symbol身份、账户、成交/费用、练习、配对/回合、review、带时间/来源的估值和FX是可复用的逻辑输入；首页期间点、当前持仓、历史回合、market/symbol贡献、库内成交列表、练习列表、回合集、分布桶分别有自己的grain/dateBasis与输出字段。
2. **所有全量量值与页内量值分开。** `fullResultTotal / matchedCount / totalRounds / validRounds / bucketCount / pageRows`不能只剩一个total。贡献与分布下钻尤其不能重置分母或合计。
3. **同一屏需要完整版本一致性。** market/account切换全页，period切期间组，historyRange切历史组；贡献模式各自局部记忆但共用全局scope。请求中旧scope与旧数据同存；一次成功才换完整组。
4. **恢复上下文不是统计事实。** URL承担目标已应用范围，来源快照承担返回位置/焦点及各视角局部状态，不能用快照代替目标URL过滤；显示格式、动画、布局也不写成交易事实。
5. **先补G-06至G-15的业务语义，再固化唯一键和预聚合。** 可先保留足够的来源链（账户/成交/开平仓关联/练习/回合/估值日期/FX来源），避免过早只存一套已换算summary而无法区分期间与历史、成交与回合、真零与缺失。

[INDEX]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/README.md:3
[HR]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/README.md:17
[TR]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/README.md:17
[H]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:1
[T]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:1
[ENTRY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/iterations/2026-10-22-homepage-library-entry/README.md:3
[HBASE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:28
[H3]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:111
[HSEARCH]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130
[HFILTER]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:161
[HPERIOD]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:210
[HKPI]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:193
[HCHART]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:222
[HHOLD]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:253
[HHOLDOPS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:295
[HHOLDRETURN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:312
[HHISTORY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:347
[HCONTRIB]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395
[HENTRY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:432
[HSTATE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:465
[H8]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:516
[HCAPP]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:601
[HC]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:646
[HACCEPT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:550
[T1]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:7
[T2]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:15
[T3]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:23
[T4]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:39
[T5]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:59
[T6]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:74
[T7]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:92
[TACCEPT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:115
[MANUAL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html:102
[SELECT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html:283
[MANUALFILTER]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html:457
[HN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round5/HISTORY-NOTES.md:3
[CN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round5/CONTRIBUTION-NOTES.md:3
[DOMAIN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-19-trading-room-domain.md:7
[HOME]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg
[ACCOUNT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/account.svg
[SEARCH]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search.svg
[SEARCHDETAIL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-detail.svg
[DETAIL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/detail.svg
[FILTER]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/filter.svg
[APPLIED]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/multi-applied--reopen.svg
[PERIOD]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/period.svg
[HOVER]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-hover.svg
[GAP]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-gap.svg
[HCPLAN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-normal-1440.svg
[LOCAL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/local-search-pages.svg
[NINE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/count-boundaries--nine-items-last-page.svg
[HOLDRETURN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-return--after.svg
[HISTORY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history.svg
[HWIN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-win.svg
[HROUNDS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-rounds.svg
[HMISSING]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-source-missing.svg
[CMARKET]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-states.svg
[CCURRENT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-current-a-share.svg
[CHIST]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-historical-a-share.svg
[CMISSING]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution.svg
[CMIXED]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-mixed-sign-demo.svg
[LIBENTRY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/journeys-library-entry.svg
[REPAIR]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/repair.svg
[TDATE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/journeys-date.svg
[THANDOFF]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/handoff.svg
[TPENDING]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-pending-library.svg
[TPRACTICE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-sim-ab.svg
[TROUNDS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-rounds-a.svg
[TREPLAY1]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-replay-a1.svg
[TREPLAY2]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-replay-a2.svg
[TREPLAYB]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-replay-b1.svg
[TLIVE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/01-live-normal.svg
[TSIMSTATS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/02-simulation-normal.svg
[TDIST]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/03-distribution-selected.svg
[TDISTRETURN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/04-return.svg
[TLOAD]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/05-loading.svg
[TERROR]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/07-error.svg
[TEXTREME]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/08-extreme.svg
[TMISSING]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/09-missing-input.svg
