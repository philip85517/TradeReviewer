# 复盘与导入：本地设计证据及 ViewModel 需求

审阅日期：2026-10-31。范围：`/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview` 的本地规范、参考图、历史验收记录及少量现有组件。只读代码和设计；未读取任何数据库，未运行应用、UI 或持久化验收。本文描述设计契约和所需数据，不证明当前页面已实现或通过。报告中的 I01–I17 是本次检索编号，**不是原设计已批准的元素 ID**；复盘 E01–E22 则来自正式元素规格。

## 1. 权威层级与图像证据

| 来源 | 地位与适用范围 | 精确证据 |
| --- | --- | --- |
| 当前设计系统索引 | 当前全局/首页 V2.5、交易库 V1.0；V2.4.2 冻结历史，迭代页不是新修改入口 | [设计索引][index]；[交易库 V1.0 README][library-readme] |
| 9/25 主图优先三阶段复盘规格、元素表 | 已确认、冻结开发依据；覆盖复盘内页。阶段不是新业务对象，不能替换回合/决策/成交/快照身份 | [主规格开头][replay]、[领域与阶段约束][replay-identity]、[E01–E22][elements] |
| 9/25 视觉稿 A | 已批准 A 方案：K 线+图上 Text+真实布局右栏；B/C 是历史探索。查看了 02/04/05/06 原 PNG | [图集说明][images-readme]；[02 买入前][image-pre]、[04 持仓][image-hold]、[05 事后][image-post]、[06 导出][image-export]、[07 状态图][image-states] |
| 当前交易库 V1.0 源规格 | 文件名虽含 `.candidate.md`，但由当前 V1.0 README 作为 source 指向；负责入口、筛选、练习、回合集合和返回，不能拿简化 replay SVG 替代完整图表规格 | [交易库源规格][library]；[练习列表图][library-practices]、[回合集合图][library-rounds]、[回合容器示意][library-replay] |
| 9/19 复盘工作区及决策访谈 | 继承未冲突的决策/快照/Text/导出规则；访谈明确含已被覆盖的历史说法。旧“买入当日完整 K”被 9/25 更严格规则覆盖；旧“无右栏表单”不能否决已批准 A 的结构字段侧栏 | [旧工作区][old-replay]、[旧访谈状态说明][old-decisions] |
| 多券商、截图、月结单、TradingView、招商核对规范 | 各来源有已确认功能契约，后续专用修订覆盖原来源规范；未找到统一导入页的已批准视觉稿或正式元素清单 | [多券商][broker]、[截图][screenshot]、[截图修订][screenshot-fix]、[月结单][monthly]、[TV][tv]、[TV 核对][tv-check]、[招商][cms]、[招商页面核对][cms-check] |
| 当前导入组件 | 只作为“现有控件/字段补充证据”，**不是用户批准设计**，不可凭代码把新增行为追认为已批准 | [入口][code-actions]、[月结单审阅][code-monthly]、[确认][code-confirm]、[审核计划][code-plan]、[历史][code-history] |
| 后端 ViewModel 文档 | 明示候选，非实施/迁移/性能验收依据；领域、财务、Bars、身份决策仍需独立定案 | [后端索引][backend-index]、[视图驱动候选状态][backend-candidate] |
| 9/27 复盘历史集成验收 | 记录 `integration-pending`，真实手机软键盘仍 NOT VERIFIED。旧截图、端口、测试结果仅是当时范围证据，不能视作本次新验收 | [历史 README][historical-readme]、[历史最终记录][historical-final] |

视觉边界：主图桌面参考 1440×900，紧凑桌面 1280×800，窄屏约 390px；侧栏 300–320px、主绘图区至少约 640px、轴 84–108px、沟槽至少 14px、工具区 48px；下置表单时趋势区约 200–240px。应按实际可用空间切换，不复制 demo 的 1000px 近似断点。深蓝灰、蓝色交互、Geist/Lucide、金色虚线计划；输入/Text 14px，标签至少 12px，桌面命中 36px/触控 44px。来源：[布局与状态][elements-layout]、[主规格布局][replay-layout]。已看原图能证明所指设计，不代表当前产品相似度通过。

## 2. 复盘逐业务元素数据需求

共同粒度：一份当前回合 Recall 文档，含 stable round/decision/execution/snapshot ID，计划/绘图/Text/评价修订，双游标和版本。服务端 SQLite 文档是业务权威，浏览器只暂存编辑；派生投影必须可重建。以下“写”指设计要求，未在本次验证。全元素来源：[E01–E22][elements]、[结构/保存契约][replay-storage]。

| ID / 控件 | 显示字段、筛选与交互 | 数据粒度、来源及计算 | 时间可见性、写入与缺项 |
| --- | --- | --- | --- |
| E01 顶栏 | 返回、证券全名/代码、周期、来源/实模拟标签、保存、导出、更多；长名省略可查看 | 当前回合上下文+证券元数据+用户图表设置+真实保存状态；保留交易库来源筛选/焦点上下文 | 来源需区分事前/后补记、日期精度；周期切换不推进执行；不得以 UI 变字代替保存成功 |
| E02 阶段导航 | 买入前判断/持仓过程/事后复盘，识别当前位置 | 同一回合的阶段视图及对应快照/双游标；不是三份独立交易 | 初次买入前执行截止早于首买；首次揭示买入转持仓；事后结果显式展开；返回恢复草稿、双游标与视图，不泄露最终结果 |
| E03 绘图工具 | 选择/Text/趋势线/水平线/通道/盈亏比/更多/撤销；保留已有工具 | drawing stable ID+revision、类型、参数、锚点、作用决策/全局；用户样式 | 只改变绘图；输入/IME/撤销按焦点解释，不推进回放；旧快照独立不可被后来修改覆盖 |
| E04 K 线/量 | 可知行情，原缩放/平移；网格/量设置 | instrument+period+时区/复权/marketDataVersion+completed bars；量为对应 bar | 不放透明未来 K；未完成本周期 K 隐藏，提示“本周期尚未完成”；不能用未来极值定轴；缺行情显示真实可用周期而非合成 |
| E05 轴/计划标签 | 入场/止损/目标标签随价格坐标；点标签定位字段 | E06 相同价格对象经 chart 坐标映射，不另存一份数值权威 | 侧栏开合后语义坐标不偏移；空/无效不画；价格轴不能被表单或长 Text 挡住 |
| E06 原计划线 | 金色虚线和名称/值，拖动与数值输入联动 | planVersion 的 direction/entry/initialStop/target；同一对象双向映射 | 留存冻结初始计划；后来修正新版本，不能倒改初始风险；方向无效/字段缺失不造线 |
| E07 实际成交标记 | 实心菱形+买入/减仓/清仓，点选定位决策 | 只读原始标准化 executions，经 decision-execution link 分组；time/qty/price/fee/source | 受执行游标和 showExecutions 同时约束；不能在事前画首买；不能用颜色唯一表达动作；未知费≠0 |
| E08 图上 Text | T→点图、编辑/换行/拖动/折叠；1–2 短卡，长文摘要；时间价格或画布锚点 | stable Text ID+revision+raw text+style+owner decision/global+anchor；内容继承按身份不按字符串去重 | 明确 occurred/recorded/knowledgeCutoff、hasSeenFuture；看过后续后补记有来源标签；离屏文本仍保存/导出；旧快照独立 |
| E09 侧栏开关 | 底栏入口与侧栏关闭；关后焦点返入口 | 纯布局状态与本地编辑草稿/焦点；图表 resize | 不推进两游标、不 fitContent、不丢输入；侧栏是布局列不是遮罩 |
| E10 事前价格 | 计划入场、初始止损、单目标；方向/单位清楚 | nullable decimal plan fields，long: stop<entry<target，short 反向 | 可空不阻看图；非法值留草稿+原因，不能保存有效计划；不显示退出评价 |
| E11 规模三段切换 | 数量/金额/仓位，一次一个主输入；切换换算和手数提示 | raw sizeInputMode/value 与 resolved quantity 分开；qty×entry×multiplier；股票/ETF multiplier=1，按最小交易单位处理 | 不偷偷归零；资本/价格/币种缺失则无法换算并说明；不可推断杠杆/保证金 |
| E12 资金基数 | 折叠金额/币种/时点/来源；手填“参考资金”，可信快照“账户净值” | capital amount/currency/asOf/source；来源证据引用，不是把任意持仓市值当账户资本 | 未提供保持 null；缺资本不显示仓位/风险比例；不使用未来账户快照补事前 |
| E13 计划派生 | 名义金额/仓位、初始风险/占比、预期 R，同时解释收益:风险 | [计算规则][replay-math]；冻结 riskBaselineRef，计划币种/方法/范围/版本 | 缺分母、零/负风险、币种不同显示原因；不 abs 修复；目标收益实现率不是评分 |
| E14 持仓侧栏 | 只读原计划、当前可知持仓/成本/成交摘要，调整另建修订 | 执行游标内 inventory/avgCost/realized/unrealized；当前可见价格及时间 | 不展示最终评价、终局盈亏；多次入场有独立风险，未经预定全回合预算不能冒算全回合 R |
| E15 事后摘要 | 原计划、风险基准、实际建仓、完整成交、结果且逐项来源 | captured plan 与实际成交+费用分配+metrics projection，不取正在编辑草稿 | 结果显式展开后显示；未闭合仅部分已实现/未实现，不叫最终闭合 R；费用缺失可 gross、net 待补 |
| E16 退出决策 | 日期+减仓/清仓+qty+price 单选；每次退出独立评价 | decision ID 指向只读 exit executions+所引 plan/target；source timestamp precision | 切 D68/D74 不串值；不把退出原因列表当退出决策列表；date-only 不伪造时刻 |
| E17 提前退出 | 是/否/不确定，未评价单独空态 | exit evaluation enum yes/no/uncertain/null，对比引用计划条件 | 没到目标≠自动提前，提前≠错误；OHLC 同 bar 先触止损/目标未知时不得推断顺序 |
| E18 原因/符合度 | 分批计划/结构失效/减风险/情绪/资金/其他+短说明；按计划/偏离/无原计划/未评价 | 每 exit decision 的 evaluation，comparedPlan/target、recordedAt/phase、证据、标签字典版本 | 原因人工证据，非因果自动诊断；未知 null≠否；长叙述仍用 Text；随文档原子保存 |
| E19 底栏回放 | 上一/下一根、播放暂停、游标、下一决策、留存、精简指标、完整历史显式动作 | 独立 market/execution cutoff；默认1根已完成bar/秒；同bar多决策稳定顺序；next-decision 改 Text ownership，普通bar不改 | 新 bar 必须在真实图上显露；编辑暂停播放；留存不是下一步前提；洞不填补；输入/IME/方向键不回放 |
| E20 保存 | 保存中/已保存/失败/冲突/待重新确认，重试/比较 | expectedRevision+round/decision IDs，服务端请求结果；plan/eval/Text/快照/完成原子边界 | 本地继续编辑不等于已存；失败保留草稿，409 不覆盖；重载以服务器真相；重导/重组保留原关联并需重新确认 |
| E21 导出 | 既有 Markdown+图保留；三阶段图+可编辑数据表，默认16:9 PPTX四页 | 选择已留存 snapshot；document/execution/metric版本冻结；自包含图像；Text stableID+rev 去重 | 缺阶段明确缺失不反向生成；未保存编辑排除并警示；导出失败不改业务；同周期/窗口对比、事前构图不借未来极值 |
| E22 决策/快照 | 原入口折叠，逐决策多快照、排序/选择/再编辑、全局总结 | round→decision→execution；snapshot stableID/ordinal/version/phase/context/view/draw/Text refs+image | 每决策≥1快照，回合已闭合且完整才可完成；三张阶段图不等于完整；未揭示决策不得漏日期/结果；既有快照不被后改串写 |

## 3. 必须单独承载的时间、结果与计算契约

依据：[双游标及阶段][replay-time]、[计算][replay-math]、[结构保存][replay-storage]、[旧工作区完整性][old-replay]。

| 动作/状态 | market cutoff / execution cutoff / 可见内容 | 写入或投影要求 |
| --- | --- | --- |
| 初次事前 | 执行截止早于首买；只可知 completed bars；计划线与事前 Text 可见、实际首买/未来退出/终值不可见 | 保存阶段草稿/上下文，标记 retrospective；不是模拟下单 |
| 下一根/播放 | 一次揭示一根已完成可用 bar；同 bar 的执行按独立稳定事件游标推进；空档真实保留 | viewport 不无故跳 fit-all；显示的 bar/成交与游标需一致，不能只更新数字 |
| 下一决策 | 定位真实决策，切相应 Text 归属；period/pan 不可推进 execution cutoff | stable decision ordering，不依赖偶然列表下标 |
| 切周期/开关侧栏/拖动 | 维持 execution cutoff；当前周期未完成 bar 继续隐藏，即使成交事实已经可知 | marketKnownAt 与 executionKnownAt 分开；窗口/价格轴/设置可恢复 |
| 展开结果/完整历史 | 显式授权查看后续；完整历史可看平仓后市场但不可混入下一回合成交 | 追踪 hasSeenFuture；回到事前新记录标“已查看后续后补记”；不能抹去来源 |
| 留存/完成/重开 | 留存冻结该刻文档+结构+图像；完成仅闭合且所有必要决策有留存 | 完成前暂存草稿不覆盖 formal；完成事务失败整体不变；重分组使完成待确认，旧成果保留 |
| 统计/导出 | 默认 captured/formal 版本组合，草稿不填充旧图旧表；数据源结果在完整可见之后 | metric calculationVersion/executionVersion/planVersion/currency/nullReason 必须可追溯 |

计算字段最小要求（均十进制，缺项带原因）：

- 名义金额=`qty×entry×multiplier`；仓位=名义金额/同币种参考资本；初始风险 R0=`abs(entry−initialStop)×plannedQty×multiplier`，但须先通过方向/正值校验，不能拿 abs 挽救非法计划；风险占比=R0/capital。预期R=方向正确的目标收益/R0。初始留存冻结分母，后改止损不改原 R0。
- 多次退出加权价=`Σ(exitQty×exitPrice)/ΣexitQty`；方向化 gross PnL 后扣明确费用得 net。入场费按已平数量分摊，退出费给对应平仓，余留费用池最后吸收舍入；多次买入移动平均。金额/数量/费用 known/completeness flags 必须保留。
- actualR=net/R0；无全回合预定预算的多次建仓不强行得到唯一全回合R。示例（不是当前用户数据）：56/52/68、1000股、资本200000 → 56000/28%、4000/2%、3R；600@64+400@61 → 加权62.8、gross6800、fee40、net6760、1.69R。
- 数量偏差=`actualInitialQty/plannedQty−1`；入场偏差多头=actual−plan、空头=plan−actual，正值表示更差。提前退出率=yes/(yes+no)，uncertain/null 排除但必须展示评价覆盖率、缺项及受影响回合占比，数量加权另列。
- 不同币种不直接加总；折算必须 rate/direction/asOf/source，实盘/模拟分开。TradingView 源报告净损益/回报/MFE/MAE/累计/持续 bar 是 pair 级源值，不是逐行可加账本或盲态已知值。

## 4. 交易库到复盘的入口与筛选契约

来源：[交易库 V1.0][library] 第 9–31、43–80、90–96 行。

| 控件/状态 | 字段、粒度与交互 | 数据/时间/写入要求 |
| --- | --- | --- |
| 普通入口与待复盘 | 普通入口不带 `queue=pending-review`；待复盘是内部显式筛选，不由首页默认入口隐式施加 | 完成复盘会改变待复盘集合；不能把“全部/0条/无匹配/缺数据”合并为空态 |
| 日期/证券/市场/账户 | 从首页立即继承只读摘要；交易库本地调整，不反向写首页；单日/范围/全部，上海自然周月年至今含端点 | 实盘执行列表按 execution date；闭合统计按 close date；练习列表按 imported/saved date，不用其历史行情日期代替 |
| 实盘/模拟视图 | 各记住筛选、搜索、排序、分页、滚动、焦点；本地搜索，refresh 保留条件 | 分视图上下文不是“再发明账户模型”；无效条件回退应显式；最新有效请求胜出，刷新失败保留完整旧数据 |
| 模拟练习→回合 | 一个 practice 一个证券、多回合；同日同证券 practice 独立；列表 practice count 与 closed round count 不是一回事 | V1.0 明示最近开仓优先：买100、再买50、卖80→配50和30两份有效配对，70仍开放；不跨practice配对。此口径须和回合领域界限明确定义，见缺口 |
| 统计与钻取 | ≤31天按日、≤2年按月、>2年按年；收益率/金额切换，闭合回合分母固定；正/负/零分别盈利/亏损/平手，胜率分母含平手 | 开放不入闭合统计；缺输入为虚线。盈亏比均值排平手；钻取返回同 bucket/list，不重新改变分母 |
| 返回链 | replay→原round集合→原security/practice→原首页周期/模式/表格/滚动焦点 | range外必要开仓上下文可补进图但不改归属范围；原项消失焦点落容器标题，不去随机新项 |

## 5. 导入逐业务控件及状态需求

统一原则：原文件在浏览器本地解析；远端元数据只传 market/symbol；**确认前不写成交**。取消/解析失败不产生业务写；确认后事务持久化成交+批次/证据，失败回滚；行情失败不回滚已确认成交。每个来源的预览行、规范成交、pair、round、practice、batch/material/account **不可混为同一粒度**。

| 本次ID / 控件或状态 | 显示字段、筛选与交互 | 数据粒度、来源、计算及时间 | 写入、缺项与依据 |
| --- | --- | --- | --- |
| I01 入口/数据管理 | 文件 PDF/Excel、截图、TradingView 分入口；现组件紧凑菜单可Esc/blur关闭、禁用；管理抽屉临时 modal | 文件/图片 batch；内容识别不只扩展名/文件名 | 无成交写；没有统一已批准布局尺寸。批准来源格式见[券商][broker]、[TV][tv]；组件[入口][code-actions]、[抽屉][code-drawer]只是观察 |
| I02 券商识别/解析 | 文件名、broker、账号、范围、有效行/待证券/排除原因/诊断/指纹；Futu worksheet、Tiger股票段、招商流水 | xls/xlsx/pdf 内容识别；market:symbol身份；decimal strings；稳定 source row/page+fingerprint+source order | 类型未确认不可用代码冒充证券名；date-only 不补秒；同源同值多笔保留，只有精确主/明细对才合；[券商规格][broker] 54–174行 |
| I03 元数据补全 | 自动证券名/类型，未识别列表、选中/重试；分类证券名代码市场计数；明确排除类别/记录数 | statement/local/cache/规定metadata来源；仅 proven stock/ETF 纳入；raw record 与 normalized instrument分离 | 未确认不保存为有效；接口失败可重试且不改变已确认原成交；不能手填猜名/把缺名写代码；[券商][broker]、[确认组件][code-confirm] |
| I04 TradingView 证券上下文 | filename候选证券，不足时SH/SZ+6位码选择；内容日期、TV·模拟盘、日期精度/时区 | CSV无证券/账户列；filename证券只能候选、filename日期不算成交日期；BOM/quoted/newlines/content fields | 证券上下文冲突须处理，不静默复用；[TV][tv] 19–44/50–77行；[上下文组件][code-tv-context] |
| I05 TV 解析/配对/报告 | raw row count、source pair count、execution count、round count分列；trade#、type、signal、date、qty、price、value、fee、报告指标及诊断row/trade# | long enter/short exit=buy，反之sell；pair保留2份额成交；pair#≠round#；源value可能入场value；同pair费只计一次、当前规则记退出；源Pnl/MFE/MAE/cum/duration单独保留 | 缺角色/数量不平/重复角色/顺序歧义按组诊断，不导半组；date-only不猜盘中；报告完整退出后才展示；[TV实现约束][tv-rules]、[TV核对][tv-check] 47–60行 |
| I06 月结单审阅 | 文件/月/template/timepolicy、成交/快照/事件数、诊断severity/page、timezone选择+重新解析；展开逐行/持仓/事件；warning确认 | 行：证券市场/rawtime/语义/zone/置信度/UTC/qty/price/fee/page；库存opening/closing/date/qty/sourcecost；auxkind/description；内联zone优先，IANA DST检查 | 切zone但未重解析、结构/现金错误、未ack警告则禁继续；重复完整文件与未完成重试区分；[月结单批准规格][monthly] 9–14行，具体控件[现组件][code-monthly]（未找到批准视觉图） |
| I07 现金/库存/17列核对 | 原值 vs 标准值，日期市场代码名方向数量价格、gross/各fee/netcash/balance/currency；可导入/重复/冲突/排除/未识别/无效/核心未表示 | PDF每行含页/行/指纹及脱敏账户；detail/subtotal fee只一次，分摊守恒；结算date不是执行date；snapshot/corporate action不是买卖 | 缺fee/cost/zone未知，不0填；期初/期末市值≠买入成本，不假造short；范围内核心未表示阻断，批准排除转债仅记录排除；[月结单][monthly]、[招商][cms]、[招商核对][cms-check] |
| I08 截图队列/进度 | 顶部批次/进度/总行/待确认/重复/冲突；左缩略图状态行数问题；retry/remove/调整图片顺序 | JPG/PNG/WebP，最多20张、单图25MiB/60Mp；原图/裁剪只browsermemory；支持Tiger/Futu已识别版式 | 取消worker释放资源；刷新明确丢未确认draft；模型失败重试保留memory；不传raw图/OCR全量到服务；[截图][screenshot] 91、211–232、301–328行 |
| I09 截图总表/筛选 | status/market-stock/side/qty/price/time/sourceimage/dupconflict；all/pending/conflict/autodup，chronological；编辑/确认/删除/手添 | OCRdraft row+field rawtext/confidence/bounds/sourceimage，<.85/修复/缺项/非法代码/时区/元数据不确定须人工 | editable不等于trade；核心字段变化重做补全/冲突/去重；未解决字段/冲突禁确认；[截图][screenshot] 222–259行；[修订][screenshot-fix] 单行截断+证据drawer |
| I10 截图证据与时区/账号 | 右侧current field crop/raw/confidence/control；长值完整证据；批次时区必须确认；选账号或本地label | 保留source walltime+zone+converted UTCsecond，不猜缺日期/秒；DST歧义待确认；账号影响筛选/回合 | OCR值编辑或显式confirm才confirmed；低置信不当事实；旧截图候选键不含account与后续普通实盘account规则冲突，不能照旧通用化；[截图][screenshot] 182–207、249–259行 |
| I11 重复/冲突处理 | 既有/候选逐事实side/qty/price/fee/source/page；保留已有/采用候选/确实两笔都保留；展示实际作用范围 | source-instance fingerprint、跨源候选/核心事实、多重集合次数；不能全局Set抹同源合法重复；普通实盘跨account永不匹配 | 冲突未决禁保存；更完整证据保留来源；替换只针对列明ID不扩范围；[截图][screenshot] 265–281、[招商核对][cms-check] 11/44行；新server plan见I13 |
| I12 通用确认 | source/file/account/currency/timeprecision；date range、execution/instrument/duplicate/excluded/unresolved counts；范围notice；确认/取消/元数据retry/saveError/saving | preview counts是候选估算；TV source pair metrics与系统账本清楚区分；新增/修订/仅证据可不同 | 仅确认后原子写；月结单可零成交但有库存/auxevidence；无新成交不等于无业务证据写；[月结单][monthly]、[TV][tv-rules]、[现确认组件][code-confirm] |
| I13 来源材料/服务器审核计划（现有、待补设计） | 材料独立/已有材料新版本；实际候选/变化项/服务器重复；身份待审；替换理由；缺失成交保留/撤回理由；已撤回保留/恢复理由；before/after | material!=batch!=account；服务器planId/inputDigest/bookRevision/identity scope/allowed choices；精确重导需完整材料核对，旧指纹不能证明完整 | ready且所有必需choice/reason完备才可保存；identity review时重新准备；审核结果才是变化真相，客户端预估不能替代；[组件][code-plan] 10–83/107–171行。**未在已批准视觉规格找到整套材料版本/撤回恢复控件合同** |
| I14 保存/完成/失败 | 提交中、成功新增/修订/证据/重复/排除实际计数、失败重试；不能用预览duplicate count冒充实际结果 | 服务端commit/transaction结果，来源材料证据和execution关联，completion evidence要闭合 | final事务失败全回滚；cancel不写；metadata/行情失败区别于save失败；confirm→SQLite→reload是原批准验收边界，但本次没执行；[TV][tv-rules]、[截图][screenshot]328、[招商核对][cms-check]50–54行 |
| I15 导入历史搜索/排序/列表（现有） | filename/source/nature本地搜索；importedAt/tradeCount asc/desc；importtime/source/datecoverage/trade+instrumentcounts/actualduplicate+excluded/status；click/Enter/Space选batch | 一条批次，不是回合；maskedfilename；TV·模拟/截图/文件来源；scope time来自成交不是filename | 列表数据不代表每批实际commit已核实；empty/search no match应分；[现历史组件][code-history]26–108行。未找到现列表统一批准视觉 |
| I16 历史详情/重试（现有） | 原filename显式查看、exclusions/instruments/capture/conflict/preestimate vs actualduplicate/monthlyaux；未核实/加载/失败/重试 | 按batch懒取commit，exact batch/count校验；过期bookversion要求刷新 | 懒取loading/failure不能显示0重复；取消旧请求防选中串批；不是重新导入；[现历史组件][code-history]39–68/115–117行 |
| I17 入库→交易库→复盘 | 真路径选择→解析→预览→确认→重新加载→security/practice/round→图表→保存复盘→reload | 来源/账号/性质/运行/配对/round/note stable lineage；market/history单独供图 | 不能以API脚本、mockchart、callback成功代替真实旅程；TV未来报告不可泄漏、来源dateonly显示、历史行情不足明确；[TV核对][tv-check]11–15/41/60行、[交易库][library] |

## 6. 数据层/投影需要承载什么（从视图推导，非新批准表结构）

| 读取面/粒度 | 必需内容 | 不应被投影隐去的状态 |
| --- | --- | --- |
| Replay context / round | stable round+account/nature/practice/run/source lineage、entry return context、plan/evaluation/drawing/document版本、双cutoff、phase、settings、viewport、hasSeenFuture、save/conflict/completeness | draft/formal/captured分开，regroup/reimport orphan/relink/待确认、缺行情/缺风险/费用未知、当前period未完成 |
| Replay bars / executions / decisions | versioned completed bars及cutoff；raw execution readonly事实；decision grouping确认与stable order；current known ledger/position/avgCost/fees | market vs execution cutoff，不可预先把终局汇总塞进事前字段；dateonly/orderOnly/ambiguous保持语义，不强转精确时刻 |
| Plan / risk / evaluation / Text / snapshot | 单独stable refs与revision、currency、方法、来源、occurred/recorded/knowledge time；snapshot原子组合与图像；Text identity/anchor/ownership | reference capital≠equity，initial plan≠later revision，null≠0/否，partialrealized≠closedresult，seenfuture不能变回盲态 |
| Import preview / source rows | raw/normalized/evidence/conflict/unsupported/notrepresented分层，fingerprint/tablepage/row/account/timeprecision，counts守恒 | source rows≠pairs≠executions≠rounds≠practices；source report metric不可用normalized PnL静默覆盖 |
| Import review / commit / history | server plan+scope/version/digest+allowedchoices+reasons；commit真实变化/duplicates/completion；batch/material version与源观察关联 | old fingerprint≠完整导入；previewcount≠commitcount；0新增可能仍修订/证据写；未取actual结果≠0；book变更使计划/commit读取需要刷新 |
| Library practice / round collection | imported/saved date与market date、固定筛选分母、closed/open、search/sort/page/scroll/focus/return | account/practice/run/paired portion/round关系未批准不能压平；实模拟/币种不隐式混算 |

## 7. 明确缺项、冲突与后续定案点

1. **账号、练习、运行与回合不能直接套旧模型。** [9/28 领域更新][domain-update] 明确当前四份 TradingView 文件归一个模拟账户，source文件/批次不是账户边界；[9/7 TV][tv-rules]原先按不同内容独立 simulationRun；[当前交易库][library]第47–49行仍要求 practice独立且最近开仓优先的“配对回合”。这不必然互斥（可同账户多practice），但缺少已批准的三者稳定映射与“0→非0→0回合”对“最近开仓份额配对回合”的口径衔接，不能自行认定同一ID或同一统计分母。
2. **日期精度和严格已完成bar规则需合成明确边界。** TV/招商只有dateonly，可能同日多pair；不得伪造盘中顺序；9/25要求当前周期未完成bar隐藏，即使某execution已可知。读取模型必须分别输出事实已知、行情完成、源报告结果可见三种状态，不凭“到了这一天”一次放出整日未来。
3. **导入统一视觉契约缺失。** 有批准的功能和截图“总表优先”布局，但未找到统一导入页、历史、材料新版本、服务器审核、撤回恢复的批准元素ID/参考PNG/尺寸/响应式/状态全表。现代码可列盘点，不能代替视觉批准；本文I编号只是证据索引。
4. **新服务器审核链与旧重复规则须显式继承/废止。** 旧截图候选键不含account/fee；后续招商要求account隔离、费用冲突、完整证据次数。现server plan还有材料版本/撤回/恢复/身份待审，应确定哪些是已批准后续业务决策，不能以通用“导入重复数”抹去这些差别。
5. **已批准导入范围是来源/任务限定。** 早期多券商股票/ETF、特定招商任务含港股通但排转债、月结单aux库存证据、截图有限券商版式均有不同范围。统一VM应保留type/status/reason及限定，不把一个来源排除规则推广到所有导入。
6. **复盘已有历史实现，但整体接受仍挂起。** [9/27历史验收][historical-final]显示真实手机价格与退出原因软键盘未验证；本次不重新宣称PASS，也未检验当前工作树是否已补。主规格要求functional、state safety、visual独立通过，历史 scoped worker pass 不等于整体接受。
7. **后端候选不应反向决定前端契约。** [候选文档][backend-candidate]自己声明不是批准migration/performance结论。本文只给读模型所需语义，不新定表、不推断预算/资本、不调整业务数据或原始成交。

验收状态：文档检索与证据映射已完成；UI/数据库/物理触控/PPTX实际渲染/当前实现差距均 **NOT VERIFIED（本次只读设计范围）**。文档工作不触发UI或数据库写验收；不能把该范围理由作为未来实现交付的豁免。

[index]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/README.md:5
[library-readme]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/README.md:5
[library]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:9
[library-practices]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-sim-ab.svg
[library-rounds]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-rounds-a.svg
[library-replay]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/hcr06-final-replay-a1.svg
[replay]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:3
[replay-identity]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:94
[replay-layout]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:102
[replay-time]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:114
[replay-math]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:140
[replay-storage]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:164
[elements]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui-elements.md:83
[elements-layout]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui-elements.md:110
[images-readme]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/README.md:3
[image-pre]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png
[image-hold]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/04-holding-stage.png
[image-post]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/05-final-review.png
[image-export]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/06-export-storyboard.png
[image-states]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/designs/2026-09-25-chart-first-review/07-interaction-states.png
[old-replay]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-19-review-workspace.md:19
[old-decisions]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-19-review-workspace-decisions.md:3
[domain-update]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-19-trading-room-domain.md:15
[broker]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/superpowers/specs/2026-07-29-multi-broker-import-metadata-design.md:4
[monthly]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/superpowers/specs/2026-09-07-monthly-statement-import-design.md:5
[screenshot]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/superpowers/specs/2026-07-31-broker-screenshot-trade-recovery-design.md:4
[screenshot-fix]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/superpowers/specs/2026-08-02-screenshot-ocr-review-fixes-design.md:4
[tv]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-07-tradingview-simulated-trade-import.md:3
[tv-rules]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-07-tradingview-simulated-trade-import.md:45
[tv-check]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-13-simulated-replay-import-reconciliation.md:3
[cms]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-09-cms-a-share-import.md:29
[cms-check]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-13-a-share-page-import-reconciliation.md:9
[code-actions]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/import-actions.tsx:15
[code-drawer]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/import-management-drawer.tsx:15
[code-tv-context]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/tradingview-context-dialog.tsx:37
[code-monthly]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/monthly-statement-review.tsx:20
[code-confirm]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/import-confirm-dialog.tsx:139
[code-plan]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/trade-import-plan.tsx:10
[code-history]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/import/import-history-dialog.tsx:26
[backend-index]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/README.md:8
[backend-candidate]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:3
[historical-readme]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/chart-first-review-implementation/README.md:3
[historical-final]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/chart-first-review-implementation/FINAL-ACCEPTANCE.md:3
