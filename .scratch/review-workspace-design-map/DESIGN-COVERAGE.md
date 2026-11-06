# 设计要求与任务覆盖

## 2026-11-06 自由 Text 的用户取舍与复核范围

用户明确：持仓时自行布置图上文字；如果遮挡影响阅读，由自己调整文字控件的范围。无需为文字之间或文字与成交标记的重叠专门设计自动避让。下表约束本轮契约澄清和只读检查，不授权把候选直接写入正式视觉规范。

| 要求及来源 | 元素与用户旅程 | 范围、负责人及证据 | 当前状态 |
| --- | --- | --- | --- |
| 本轮用户原话；[持仓自由 Text R03](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md) | E08；D02 / I13–I19，持仓图表选择 Text、放置、编辑及确认 | 协调者记录取舍并用真实浏览器检查隔离 v5；独立审阅者只读核对已确认文字的调整能力。[范围与证据](evidence/systematic-fixes-20261105/task-04-direct-text-stage/coord-manual-check-20261106-v2/REPORT.md)。 | 限定路径已检查；不推及其他版本 |
| 用户不要求特殊处理重叠 | E08；Text 与 Text / 成交标记 | **范围 EXCLUDED**：自动避让、同点时所有文字同时清晰可读、额外防碰撞控件排除本轮验收；用户自行调整。历史截图及当时判定保留，不等于本轮仍要求修复。 | N/A（用户明确排除，非 PASS） |
| 已有 Text 的数据与回放边界 | I15–I19；创建、编辑、取消与回看 | 对象不能因新建或编辑其他文字而意外丢失或被改写；未来信息截止等仍需按冻结版本验证。 | NOT VERIFIED（整体；既有限定样本见各版本记录） |

### 后续独立验收：第 2 回合旅程

| 要求/参考 | 元素、旅程及负责人 | 证据和范围 |
| --- | --- | --- |
| [R01/R02/R05 及时间视野合同](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)；[I11 原台账](evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)；参考 [入场](evidence/immersive-layout/screenshots/final-A-entry-1440.png)、[持仓](evidence/immersive-layout/screenshots/final-step-holding.png)、[退出](evidence/immersive-layout/screenshots/final-replay-exit.png)，用户后续反馈覆盖旧稿冲突 | E02/E22、I11；从当前股票切到第 2 次交易，检查回合身份、买入前起点、回放揭示 K 线/成交与侧栏职责，比较 1440×900 和 1280×800。协调者拥有整页视觉和内存链；未参与实现的独立审阅者实操并出具证据。 | 冻结 candidate-45 与 3091 服务；仅合成数据和内存草稿；[独立检查记录](evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106/REPORT.md)。第 2 回合在 1440/1280 的指定 28→29→33→34→41→49 及第 2/3 回合单字段内存隔离已独立实操，限定 PASS；[身份提示缺口](issues/26-review-round-identity.md)待隔离候选。物理触控、真实交易持久化、Text 重叠专项排除；其余未覆盖项保留 NOT VERIFIED。 |

2026-11-04：用户要求补齐独立 Agent 未完成的验收；本轮 candidate-v37 的逐项需求、元素、控件、来源、负责人和证据映射见 [独立验收覆盖合同](evidence/independent-acceptance-20261104/DESIGN-COVERAGE.md)。该计划不修改正式规范，也不把计划状态当作验收通过。

2026-10-24 视觉恢复补充：下表保留初始建图对应关系，基线行号为历史位置。当前正文版本、完整工作区、规范样例、状态和责任映射以[视觉覆盖补充](visual-recovery-20261024/DESIGN-COVERAGE.md)及[迭代计划](visual-recovery-20261024/PLAN.md)为准。原文字覆盖不能证明视觉完整性；完整界面与公共应用样例当前缺失，相关视觉门槛未通过。

触发：用户请求将复盘工作区设计问题拆成文档设计任务。当前交付为任务地图；业务UI/数据库验收不适用。后续原型或画板的审查范围以各票为准，整体由整合票接受；本表不声称功能PASS。

来源原文行号为建图时正文快照位置，变更后须重定位。原稿图仅供差异比较；TradingView截图按用户最新要求作为两个区域的直接参考。

|要求/规格与位置|元素|准确参考图|旅程/状态|责任任务（领取者owner；集成coordinator）|产物与核对操作|可观察预期与反例|证据计划|状态|
|---|---|---|---|---|---|---|---|---|
|[正文 RV04、RV06、RV07](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行127、214、245|E07/E15/E16/E22|[04-records-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)<br>[03-final-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)|让“一笔交易”、部分退出及复盘完成有唯一含义，避免列表、盈亏和评价串属。|[明确交易单位、配对与复盘完成边界](issues/01-trade-identity.md)|术语关系、数量算例、完成条件与新旧契约差异。 按票内故事板逐步核对。|减仓80却将前批100全部结束；把券商拆成两条成交误当两次独立决策。|evidence/trade-identity/ + comments/review-design-01/|NOT VERIFIED|
|[正文 RV03、RV05、RV06](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行90、163、202|E03/E08/E19|[2026-10-24-tradingview-toolbar-reference.png](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)|确定 1:1 设计可依据的事实、组件复用边界及待补证据，避免凭图标猜功能。|[核实 TradingView 工具与回放的参考能力](issues/02-tradingview-research.md)|截图槽位清单、官方依据、复用边界和待核实列表。 按票内故事板逐步核对。|用相似 Lucide 图标替代；把底部关闭图标直接认定为退出整个复盘工作区。|evidence/tradingview-research/ + comments/review-design-02/|Research ACCEPTED; tool identity/interaction NOT VERIFIED|
|[正文 RV04、RV05](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行127、163|E02/E04/E07/E09/E19/E22|[01-entry-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)<br>[02-holding-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)<br>[03-final-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)|让用户沿逐根回放完成复盘，阶段成为状态说明和资料分类。|[确定交易节点驱动的连续复盘动线](issues/03-event-journey.md)|三条故事板、状态迁移表与入口/返回合同。 按票内故事板逐步核对。|仅阶段文字变化而目标K仍不可见；回到早期抹去已看结果的来源。|evidence/event-journey/ + comments/review-design-03/|NOT VERIFIED|
|[正文 RV01、RV02](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行11、51|E01/E02/E03/E04/E05/E09/E19/E22|[01-entry-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)<br>[06-entry-1280.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)<br>[04-records-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)|让图表获得主要空间，同时让交易选择、绘图和节点记录各有位置。|[确定沉浸式工作区与左右区域职责](issues/04-immersive-layout.md)|空间方案、尺寸说明、开合状态稿及选择依据。 按票内故事板逐步核对。|以全屏为由用表单遮价格轴；把工具栏和交易列表塞入同一个可替换区域。|evidence/immersive-layout/ + comments/review-design-04/|NOT VERIFIED|
|[正文 RV03、RV05、RV06](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行90、163、202|E03/E06/E08/E19|[2026-10-24-tradingview-toolbar-reference.png](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)|把“图标与功能1:1、底部按钮形态1:1”变成可逐项核验的设计合同。|[确定 TradingView 绘图与回放的逐项对齐契约](issues/05-tradingview-contract.md)|逐项工具合同、外观对照板、行为证据及功能验收用例。 按票内故事板逐步核对。|样式1:1但改为另一种工具；浮动图形R与侧栏计划绑定不明；以静态板宣称真实功能完成。|evidence/tradingview-contract/ + comments/review-design-05/|NOT VERIFIED|
|[正文 RV04、RV06](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行131、139、202|E06/E08/E09/E10/E11/E12/E13/E14/E22|[01-entry-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)<br>[02-holding-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)<br>[04-records-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)|开仓时顺畅补记计划，持仓时围绕图表记录，不重复填表。|[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)|计划/标注故事板、字段及对象绑定表。 按票内故事板逐步核对。|同一段心态要求图上与侧栏重复填写；为每根bar感想生成虚构成交。|evidence/plan-and-notes/ + comments/review-design-06/|NOT VERIFIED|
|[正文 RV04、RV06](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行139、222|E13/E14/E15（新增过程指标）|[02-holding-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)<br>[03-final-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)|为止损宽窄、入场后风险和体验分析沉淀可靠且不泄露未来的数据。|[确定持仓过程指标与可比较的风险口径](issues/07-process-metrics.md)|指标字典、合成算例、可见性与未来分析边界。 按票内故事板逐步核对。|以第一次小仓风险做整个回合R分母；把MAE直接叫最大回撤。|evidence/process-metrics/ + comments/review-design-07/|NOT VERIFIED|
|[正文 RV04、RV06](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行147、222|E15/E16/E17/E18（新增评分卡）|[03-final-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)|让实际退出、主观原因和规则评分可解释地对应，支持后续归因。|[确定退出归因与五星评价卡](issues/08-exit-ratings.md)|退出摘要与评分卡状态稿、规则候选及归属表。 按票内故事板逐步核对。|盈利自动五星；人工改分覆盖系统原分；资料不足显示0星。|evidence/exit-ratings/ + comments/review-design-08/|NOT VERIFIED|
|[正文 RV07、RV09](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行245、324|E01/E20/E21/E22|[05-conflict-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/05-conflict-1440.svg)<br>[09-export.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/09-export.svg)<br>[04-records-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)|用户知道什么已保存、哪笔已完成、导出了什么，以及关闭后回到哪里。|[确定保存、完成、导出与关闭的职责](issues/09-save-export-return.md)|动作与版本合同、异常路径、导出及返回示意。 按票内故事板逐步核对。|关闭按钮同时退出两层；导出成功被视为完成复盘；旧图配新评分。|evidence/save-export-return/ + comments/review-design-09/|NOT VERIFIED|
|[正文 RV02、RV03、RV07、RV08](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行51、90、267、288|E01–E22（受影响状态全量）|[06-entry-1280.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)<br>[07-entry-390.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/07-entry-390.svg)<br>[08-boundaries.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/08-boundaries.svg)<br>[10-nav-expanded.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/10-nav-expanded.svg)|新工作区在尺寸变化、输入和异常时仍保留图表、当前操作及返回路径。|[确定窄屏、键盘及异常状态的空间规则](issues/10-responsive-and-states.md)|响应式及异常状态板、尺寸规则和输入方式验收表。 按票内故事板逐步核对。|弹出错误把图挤走；字号缩小掩盖拥挤；拿旧导航展开图证明新全屏响应式。|evidence/responsive-and-states/ + comments/review-design-10/|NOT VERIFIED|
|[正文 RV01–RV10](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行1–398|文档导言与RV01–RV10；映射E01–E22|[01-entry-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)<br>[06-entry-1280.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)|正文先解释目标和取舍，再安排规则、参数与引用；每张图提供独立信息。|[确定全文论述结构与图示分工](issues/11-document-argument.md)|逐章扫描表、改写提纲、样章及图示清单。 按票内故事板逐步核对。|只增加前言而规则表仍彼此冲突；同一图重复出现却没有新增论据。|evidence/document-argument/ + comments/review-design-11/|NOT VERIFIED|
|[正文 RV01–RV10](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)；基线行346–398|E01–E22及新增批次/过程指标/评分卡|[01-entry-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)<br>[02-holding-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)<br>[03-final-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)<br>[04-records-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)<br>[05-conflict-1440.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/05-conflict-1440.svg)<br>[06-entry-1280.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)<br>[07-entry-390.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/07-entry-390.svg)<br>[08-boundaries.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/08-boundaries.svg)<br>[09-export.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/09-export.svg)<br>[10-nav-expanded.svg](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/10-nav-expanded.svg)|确定后续全文与画板修订的完整交付边界，防止局部通过掩盖整体缺失。|[确定整份规范的整合与独立验收方案](issues/12-integrated-acceptance.md)|完整交付清单、后续制作顺序、独立审查与最终验收标准。 按票内故事板逐步核对。|各组件票通过后直接宣布整页通过；沿用旧manifest及旧截图验收新布局。|evidence/integrated-acceptance/ + comments/review-design-12/|NOT VERIFIED|

## 原元素逐一归属

- E01：[确定沉浸式工作区与左右区域职责](issues/04-immersive-layout.md)。
- E02：[确定交易节点驱动的连续复盘动线](issues/03-event-journey.md)。
- E03：[确定 TradingView 绘图与回放的逐项对齐契约](issues/05-tradingview-contract.md)。
- E04：[确定交易节点驱动的连续复盘动线](issues/03-event-journey.md)。
- E05：[确定沉浸式工作区与左右区域职责](issues/04-immersive-layout.md)。
- E06：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E07：[明确交易单位、配对与复盘完成边界](issues/01-trade-identity.md)。
- E08：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E09：[确定交易节点驱动的连续复盘动线](issues/03-event-journey.md)。
- E10：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E11：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E12：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E13：[确定持仓过程指标与可比较的风险口径](issues/07-process-metrics.md)。
- E14：[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)。
- E15：[确定退出归因与五星评价卡](issues/08-exit-ratings.md)。
- E16：[确定退出归因与五星评价卡](issues/08-exit-ratings.md)。
- E17：[确定退出归因与五星评价卡](issues/08-exit-ratings.md)。
- E18：[确定退出归因与五星评价卡](issues/08-exit-ratings.md)。
- E19：[确定 TradingView 绘图与回放的逐项对齐契约](issues/05-tradingview-contract.md)。
- E20：[确定保存、完成、导出与关闭的职责](issues/09-save-export-return.md)。
- E21：[确定保存、完成、导出与关闭的职责](issues/09-save-export-return.md)。
- E22：[明确交易单位、配对与复盘完成边界](issues/01-trade-identity.md)。

## 必需状态与新要求

- S01选中、S02展开、S03加载、S04无数据/错误、S05末尾、S06同K候选、S07长文/长值、S08缺项、S09保存/冲突、S10历史/快照编辑：由窄屏与异常票整合；各业务归属票定义状态语义。
- 新批次/退出匹配：交易单位票；过程指标：风险口径票；四维评分：退出评价票；沉浸式全屏：空间票；TV工具1:1：研究及逐项对齐票。
- 普通开平仓、加仓后部分退出、继续未完成：动线票主责，整合票端到端反查。M/X/记录归属/未来来源/视野/重开均不可省略。
- 文档逐章论述与重复图：全文结构票；同态画板比较与设计包验收：整合票。不得用任一局部通过代替整份规范通过。


## 2026-11-05 Text 冲突新候选的派发与审阅映射

范围仅为复盘工作区原型。用户明确选择持仓期在图上自由放置 Text，买入和平仓绑定成交 Bar，持仓期间不新增右侧记录。保持真实时间/价格锚点、成交与 Text 的独立身份、已知/未来截止及当前回合隔离。新候选以[合同复核与反例](evidence/systematic-fixes-20261105/task-04-contract-review.md)为实施和验收参考，属于待用户审阅的设计解释，不回填正式规范。

|要求和元素|准确参考及对照状态|负责人|用户旅程|验收证据与当前状态|
|---|---|---|---|---|
|R03 / W06 / E08 / I15–I19、I40：自由 Text、编辑取消、平移缩放、未来截止|[首轮反馈合同](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)、[问题17](issues/17-review-text-overlay-state.md)、[同点复现](evidence/independent-acceptance-20261104/visual/reproduce-anchor-overlap.jpg)、[candidate-15 密集失败](evidence/systematic-fixes-20261105/task-04-candidate15-stress/exit-confirmed.png)；1200×569 DPR2、1280×800、1440×900，对照相同回放阶段|Luna 实现；coordinator 统筹整页与真实浏览器复验；非实现者独立视觉审阅|31根同点创建/编辑/取消两条；增加同点和交易节点文字；28→31→49回看；跨回合；平移、缩放、鼠标及键盘|冻结文件清单后记录文字/真实锚点/成交标签/焦点、未来截止与同态截图；当前为 NOT VERIFIED，问题17仍 FAIL / open|
|持仓期间不新增右侧判断/记录；其余当前可知文字可见可达|[R02/R03](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)及[合同复核](evidence/systematic-fixes-20261105/task-04-contract-review.md)|同上|编辑某条时其他已知文字仍有可读、可编辑入口；空间不足时的取舍须明确|候选的图表内紧凑行/单条详情解释需用户审阅；不宣称全部长正文同时展开，不能以隐藏数据或未来项泄露换取无重叠|

### 2026-11-05 Text 短窗口替代布局候选

依据 [candidate-37 右栏开启实测失败](evidence/systematic-fixes-20261105/task-04-candidate37-stress/REPORT.md)：1200×569 下图表 798×296，列表与编辑器在图内无可靠公共安全位置。应探索图表底部的独立、临时 Text 操作区；它不是右侧持仓记录，交易人仍在图表上选择真实时间和价格，成交标记继续与成交 Bar 绑定。单条与有空间的普通态优先保留图上的正文表达；密集或编辑态如需摘要索引 / 单条详情及图表高度取舍，明确为候选设计，需用户审阅，不回填正式规范。不得只把警告覆盖在不可操作的按钮上，也不得改变用户存放的真实锚点。

2026-11-05 补充：candidate-38 证明固定一屏的底部操作区虽然能完成六条创建，但短图高度压至 151px、单条正文不在图上，视觉 FAIL。下一候选仅探讨**短窗口滚动**的取舍：单条正文恢复图中，保留可读图高；密集或编辑态的临时操作区可通过局部滚动到达，不进入持仓右栏。不能用滚动掩盖无法找到的控件、改变真实锚点、隐藏已知文字或泄露未来文字；固定回放与审阅控件、图表、工具条、记录在不同滚动位置的可达性均需实际验证。正常高度不得无端引入滚动或压缩。该方案仅为可审阅候选，需记录其一屏无法同时显示全部区域的代价，不回填正式规范。实现 owner 为 Luna；coordinator 负责整页和状态链、真实浏览器实测，非实现者负责同态视觉对比。参考和元素仍为 R03 / E08 / I15–I19、I40，以及上述 candidate-37/38 证据；验收视口 1200×569、1280×800、1440×900。

|要求/元素|参考和实测状态|责任|路径|冻结版验收|
|---|---|---|---|---|
|R03 / E08 / I15–I19、I40：真实锚点、已揭示 Text 的识别与编辑|[R03](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)、[合同和反例](evidence/systematic-fixes-20261105/task-04-contract-review.md)、[candidate-37 实测](evidence/systematic-fixes-20261105/task-04-candidate37-stress/REPORT.md)|Luna 实现；coordinator 整页、状态链与实操验收；非实现者视觉复核|1200×569 右栏开启、同点三条，再在加仓/部分退出/结束各加一条；真实鼠标/键盘确认、取消、逐条找回；28↔49、平移缩放|记录底部操作区、图表、工具条、价格轴、时间轴、成交标记及其可用尺寸和命中；六条及未来截止逐一核验；紧凑摘要与全文显示差异列为待用户确认|
|R02 / E09、回放与右栏|同上及[工作区基准截图](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)|同上|买入前、持仓、退出；回放和左右栏开合；图表高度变化|右栏不增加持仓记录；回放按钮及交易表单可操作；图表与工具条不能被操作区截获；对照 1200×569、1280×800、1440×900 画面，压缩后可读性由独立审阅者判断|

### 2026-11-05 同点身份分组隔离试验

针对当前恢复版 candidate-31 的[两条同点反例](evidence/systematic-fixes-20261105/task-final-candidate31/text/buy-conflict-B-confirmed.png)，以及 candidate-41 的[真实操作与视觉失败](evidence/systematic-fixes-20261105/task-04-candidate41-scrolled/REPORT.md)，在独立目录试验同点 Text 的身份分组。复用 candidate-41 可滚动的临时操作区，仅作尚未确认的原型设计，不影响当前预览或正式规范。真实时间/价格坐标与成交 Bar 不变；同点 Text 只能以显示层聚合，必须明确每条身份、独立于成交标记，不泄露未来标注，也不得新增持仓右栏记录。单条普通态保留图上正文；密集态可显示可滚动摘要和单条详情，全文是否同时展开仍需用户审阅。

|要求/元素|参考与对照|责任|路径及验收证据|
|---|---|---|---|
|R03 / E08 / I15–I19、I40：真实锚点、同点识别、编辑与截止|[R03](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)、[合同审查](evidence/systematic-fixes-20261105/task-04-contract-review.md)、candidate-31/41 同态画面；1200×569、1280×800、1440×900|Luna 隔离候选；coordinator 整页/状态与浏览器验收；非实现者视觉复核|同点三条及 buy/add/partial/exit 各一条，图中成交箭头和 Text 分组可分辨，全部已知条目可找到、查看与编辑；未来截止、取消、回合隔离、平移缩放和键鼠焦点分别取证。不得以脚本无异常替代真实画面；存在遮挡/歧义则 FAIL|
|R02 / E09：持仓独立标注与回放|同上及 candidate-41 固定回放条遮挡反例|同上|无需图表外永久记录；保留主图可读高度、回放及工具条可达；明确滚动造成的可见性取舍；试验不代表用户确认|

### 2026-11-05 Text 冲突标识可见性隔离试验

candidate-43 的代码复查发现：冲突标识的 CSS 默认 `display:none`，定位时先读取隐藏元素的零宽高，随后设置空的内联 `display` 并不会覆盖该默认值；因此标识无法正确参与避让，也不能显示。此前自动观察脚本使用了错误的冲突标识选择器，其 `badges: []` 不能作为节点缺失的证据；同态截图中看不到独立标识的视觉结论仍成立。新候选只在隔离副本尝试先显示并测量标识、再计算避让，同时审视引线与单条卡片的语义和遮挡；保留 candidate-43 证据与当前 3091 预览。图表内标识、聚合及短窗口临时区仍是待用户审阅的方案，不回填正式规范。

|要求/元素|参考与对照|责任|旅程与验收|
|---|---|---|---|
|R03 / E08 / I15–I19、I40：真实锚点、独立身份、已知和未来文字|[用户反馈合同](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)、[candidate-43 视觉反例](evidence/systematic-fixes-20261105/task-04-candidate43-stage/INDEPENDENT-VISUAL.md)、[candidate-31 预览基线](evidence/systematic-fixes-20261105/task-final-candidate31/ACCEPTANCE.md)|Luna 只修改隔离候选；coordinator 负责整页、状态链和真实浏览器验收；非实现者比较截图|1200×569 DPR2 及 1440×900；在买入点创建三条、在加仓/部分退出/结束各一条；核对每组可见 Text 身份、成交箭头与锚点关系，编辑、回看、平移缩放；保留待审阅的空间取舍，真实锚点不移动，未来文字不提前出现。引线、标识或正文仍遮挡或误导则 FAIL。|

### 2026-11-05 Text 锚点中心的独立小修

| 合同、参考与视口 | 所有者 | 旅程与验收证据 |
| --- | --- | --- |
| R03 / E08 / I15、I19：保留用户选择的时间、价格，图上锚点与其几何位置对应。参考 [candidate-31 坐标复测](evidence/systematic-fixes-20261105/task-final-candidate31/text-coordinate-diagnosis/observations.json)，1440×900 入场和结束；1200×569、1280×800 补充视觉/回归。 | Luna 在 candidate-31 的隔离拷贝仅修改圆点定位；coordinator 负责状态与整页、版本绑定的实际图表复测；非实现者审阅同态截图。 | 在入场与结束分别定位、确认及取消：编辑态和确认态的 8px 圆点中心应对齐图表真实锚点，价格由实际点击像素反算，不能更改锚点数据、图表视野、引线、信息截止或其他设计。再次平移与缩放并复测既有受影响旅程。密集 Text 视觉 FAIL 保持开放，不因 1px 修正声称整体验收通过。 |

### 2026-11-05 自由 Text 直接呈现的隔离视觉探索

新证据：[TradingView Text 官方说明](https://www.tradingview.com/support/solutions/43000516983-text-drawing-tool/)说明文字直接放在图上、可在图上编辑并随图表移动；其[价格注释说明](https://www.tradingview.com/support/solutions/43000791741-price-note-drawing-tool/)另定义带价格和连线的工具。现有大卡片及连线容易混淆二者。用户要求持仓自由放置 Text，并要求交易工具对齐 TradingView；本探索不是用户对新样式的确认，不回填正式规范。此前“任何重叠即失败”是探索时的严格反例，并非用户明确要求：同时放在同一像素的两个自由对象可能物理遮挡，是否接受该取舍仍须通过可见样张审阅；问题 17 的编辑时其他文字可见约束仍保留，不能据此关闭历史失败。

|需求 / 元素|参考 / 状态 / 视口|负责人|旅程与证据门槛|
|---|---|---|---|
|R03 / E08 / I15–I19：图上自由多条 Text；取消及编辑不覆盖其他文字|[首轮反馈](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md) R03、[candidate-45 两条同点画面](evidence/systematic-fixes-20261105/task-final-candidate45/text/buy-conflict-B-confirmed.png)、上述 TradingView 说明；持仓 31 根，1200×569 DPR2 / 1280×800 / 1440×900|隔离原型实现者负责本地 Text 视图；coordinator 负责整页、跨区域状态链和实际浏览器操作；非实现者对同态截图独立视觉复核|普通分散位置直接显示文字；选中/编辑与取消；创建另一条时先前已知文字保留；长文、重叠、窗口边缘与焦点/工具条可达性另记。自然重叠、选择/拖动方案为待审设计，不擅自认定 TV 1:1。|
|R03 / I19 / I40：真实坐标、回放可知截止及回合隔离|同上；入场→持仓→结束→回看与平移、价格缩放|同上|真实图表中的日期/价格随显示投影变化而不被自动改写；真实成交标记独立；未来 Text 不进入图、计数或焦点；若支持用户显式移动则仅移动指定对象且回放语义仍需验证。|
|R02 / E09 / I20：持仓信息架构和回放|同上；持仓左右栏开合，结束态评价|同上|无新增持仓右栏记录或常驻列表；主图和回放可访问；本试验仅为隔离候选，3091 保持已冻结版本，尚无整体验收。|

当前运行环境未提供项目默认模型 `gpt-5.6-luna`，子代理使用当前会话的继承模型，协调者保留独立验收。该试验使用内存合成样本，不访问业务数据库。初始探索时以上各行为 NOT VERIFIED；v5 现已冻结，限定操作与独立静态复核见[隔离候选报告](evidence/systematic-fixes-20261105/task-04-direct-text-stage/REPORT.md)。相关视觉仍为 FAIL，全部状态及独立浏览器操作仍未完成，3091 与正式规范未被该候选替换。

## 2026-11-06：侧栏收起时的交易回合身份补充

| 依据 / 元素 | 状态 / 设计补充 | 负责人 / 验收 |
| --- | --- | --- |
| [R01/R02/R05](evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)、[问题 26](issues/26-review-round-identity.md)；E02/E22 / I11 | 1280×800 展开右栏收起左栏，现有切换提示随后被回放状态替换，主区只显示证券身份；候选在顶栏原有副标题常驻当前回合名，不更改阶段和时间截止。原稿未指定此状态，属于设计补充待审阅。 | 实现者修改隔离候选，coordinator 在 1280×720 以 computer use 操作第二回合并同态比较，非实现者提供四视口视觉对照；[限定复核](evidence/systematic-fixes-20261105/task-10-identity-stage/coordinator-review/REPORT.md)。1291/1292/1440 的实际输入、整页验收仍为 NOT VERIFIED；不改变正式规范。 |
