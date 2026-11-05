# 复盘工作区文档设计任务汇总

> **2026-11-06 用户取舍（当前有效）：** 自由 Text 由用户放置，阅读受影响时由用户自行调整文字控件范围；不再为文字相互重叠或与成交标记重叠专门设计自动避让，也不要求同点文字同时可读。下面保留的是各候选在旧验收假定下的历史判定，重叠本身不再单独构成当前失败；其他未完成事项仍需分别核验，原型尚未获整体确认。

> **2026-11-06 回合身份候选：** 3099 为独立候选，在顶栏显示当前交易次数；3091 的 candidate-45 未覆盖。协调者在 1280×720 使用 computer use 操作第二回合的关键回放并与原稿同态比较；[非实现者独立审阅](evidence/systematic-fixes-20261105/task-10-identity-stage/independent-review/REPORT.md)提供四视口视觉对照与 CDP 模拟输入样本，不代替相应视口的实际输入。详见[限定复核](evidence/systematic-fixes-20261105/task-10-identity-stage/coordinator-review/REPORT.md)与[问题 26](issues/26-review-round-identity.md)。原型待用户审阅，正式规范未回填；已放置 Text 目前不能单独移动或调整显示宽度，保留为待完善项。

> **2026-11-06 独立补验：** candidate-45 的第 2 回合在 1440×900 和 1280×800 通过 CDP 模拟输入走通指定回放节点；第 2/3 回合一个计划字段保持内存隔离。1280 左栏收起、继续回放后缺少稳定回合身份提示，作为[问题 26](issues/26-review-round-identity.md)制作隔离设计候选；这不是已观察到的草稿串用。详见[版本绑定报告](evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106/REPORT.md)，其余未验证项仍保留。

> 2026-11-05 更新：3091 仍为 candidate-45；3098 另提供尚待审阅的[自由 Text 轻量隔离候选](evidence/systematic-fixes-20261105/task-04-direct-text-stage/REPORT.md)。v5 的两条创建、指定键盘选取和编辑提示有局部证据，但文字与成交标记的归属及完全重合仍为视觉 **FAIL**；不将局部结果算作整页通过，正式规范尚未回填。

> 2026-11-05 当前状态：3091 工作区预览绑定冻结 candidate-45。系统排查后的短高布局、价格视野、回放与场景、计划数值、焦点、部分图标及 Text 圆点居中均有各自限定的复测记录；Text 与成交标记的视觉区分仍为 **FAIL**。candidate-44 为未并入预览的隔离试验，尚未解决遮挡与密集空间反例。40 组当前版本覆盖、失败和未验证边界见[当前验收](evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)；问题 17 保持开放，正式视觉规范仍需在原型获用户确认后再回填。

> 2026-11-05 Text 碰撞 candidate-14 的[复测](evidence/systematic-fixes-20261105/task-04-candidate14/REPORT.md)为 **FAIL**：单条连线恢复，但多条仍关联不清，编辑器和密集卡片仍会遮挡。问题 17 继续开放。

> 2026-11-05 Text 碰撞 candidate-13 的[复测](evidence/systematic-fixes-20261105/task-04-candidate13/REPORT.md)为 **FAIL**：引线隐藏导致标注与锚点的对应关系不清，编辑器及密集卡片仍被工具栏遮挡。限定操作无异常、脚本开销下降，问题 17 继续开放。

> 2026-11-05 Text 碰撞 candidate-12 的[复测](evidence/systematic-fixes-20261105/task-04-candidate12/REPORT.md)为 **FAIL**：首条 Text 的布局发生运行时变量错误，已退回修订。问题 17 继续开放。

> 2026-11-05 Text 碰撞 candidate-11 的[复测](evidence/systematic-fixes-20261105/task-04-candidate11/REPORT.md)仍为 **FAIL**：引线穿过成交标签和其他卡片，密集标注的卡片有遮挡，连续鼠标操作脚本开销需优化。问题 17 保持开放，方案继续调整；不代表整页验收或用户设计确认通过。

> 2026-11-05 Text 碰撞 candidate-05 复测 **FAIL**：辅助标记被样式隐藏，两个同点 Text 的辅助位置与引线重叠，已记录并退回修订；[复测证据](evidence/systematic-fixes-20261105/task-04-coordinator/REPORT.md)。场景原生下拉经[独立补测](evidence/systematic-fixes-20261105/task-03-select-independent/REPORT.md)可聚焦，但 headless 无法完成选项提交，仍为 NOT VERIFIED。

> 2026-11-05 场景 URL 候选修复：三阶段切换回合、回放和日期跨阶段的限定实测见[验收](evidence/systematic-fixes-20261105/task-03-final/REPORT.md)，独立静态视觉审查已归档；场景下拉的原生选项选择仍待验证，问题 25 保持开放。

> 2026-11-05 逐项修复中：短窗口布局已调整；日期、顶栏与第 2 次交易左栏记录入口的采样见[局部复测](evidence/systematic-fixes-20261105/task-01-coordinator/REPORT.md)。预览服务阻塞已修复并安全恢复，见[复验](evidence/systematic-fixes-20261105/task-01a/ACCEPTANCE.md)。侧栏价格视野与手动缩放后回放裁切已在[候选 03 的限定路径](evidence/systematic-fixes-20261105/task-02-coordinator-final/REPORT.md)和[独立视觉对照](evidence/systematic-fixes-20261105/task-02-final-independent-visual/REPORT.md)复测；先前失败证据保留。历史工具条瞬态、键盘及其余场景和其他问题仍待处理，本条不代表整页验收或用户设计确认通过。

> 2026-11-05 最新：candidate-v37 的独立功能、状态链和视觉验收均为 FAIL，且仍有必需项 NOT VERIFIED；用户已授权依次定位和修复。见[独立验收归档](evidence/independent-acceptance-20261104/ACCEPTANCE.md)与[逐项修复计划](evidence/systematic-fixes-20261105/PLAN.md)。历史版本的通过结论不适用于当前版本；原型方案仍须用户审阅后再进入正式视觉规范。

> 2026-10-28 独立审阅更新：当前原型发现日期回放反馈、Text 状态及 1280 回合切换／1292 价格轴遮挡等问题。下方 2026-10-24 的通过结论仅代表当时已检查的路径；相关功能与视觉整体门槛现为 FAIL，须修复后重验。当前证据不足以判断问题何时引入，不能认定为已证实回归。详见[独立审阅汇总](evidence/independent-design-review-20261028/REPORT.md)；原验收证据保留。

> 2026-10-29 candidate-v10 更新：[独立视觉复审](evidence/review-fixes-20261028/final-review-v10/REPORT.md)判定 FAIL：成交文字标签遮挡成交箭头；Text 卡片遮挡加仓箭头并造成标签与 Bar 脱节。问题 17、20 重新打开。该轮冻结清单为 [candidate-v10/manifest.json](evidence/review-fixes-20261028/candidate-v10/manifest.json)。复审仅判定冻结版 v10；审阅期间运行目录源码已变化，因此不把结果扩展到后续文件。v3–v9 各版失败记录继续保留，任何历史 PASS 不替代 v10 复验。

> 2026-10-29 candidate-v11 更新：据协调者提供的独立审阅发现，所审图中成交箭头遮挡已有改善，但 Text 卡片仍与 52.60 锚点重叠（1280×800 第34/49根、1440 平移前后），视觉仍未通过；问题 17 保持重新打开。1291 初次截图的工具条为空白、复测图标可见，可能是瞬态，仍需排除渲染问题（问题 14）。冻结清单为 [candidate-v11/manifest.json](evidence/review-fixes-20261028/candidate-v11/manifest.json)；当前尚未找到 `final-review-v11/REPORT.md`，独立报告归档待补。以上不构成最终通过。

当前进度：用户已确认**完整工作区原型优先**并于 2026-10-24 确认推进。[独立原型 v0.1](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/workspace-v0.1/index.html?variant=A&scene=entry)在首轮审阅后选定 A，已有同股交易次数列表、持仓无右侧记录、自由多条 Text 和工具条缩小的候选修订。[10 月 24 日修订验收](evidence/immersive-layout/revision-01/acceptance.md)仅代表当时记录的版本和范围，不适用于后来发现问题的 candidate-v37；[首稿记录](evidence/immersive-layout/acceptance.md)保留。完整画面确认后再补公共控件、状态与参数样例，并回填正式规范。根因、十章视觉补齐方案、每轮目标与验收见[视觉迭代计划](visual-recovery-20261024/PLAN.md)，精确材料与元素映射见[视觉覆盖](visual-recovery-20261024/DESIGN-COVERAGE.md)。公共样例尚未补齐，整套视觉包仍未通过；以下全文制作 PASS 仅保留其原文档检查范围。

原 12 项任务继续使用，新增[公共视觉样例与参数标注](issues/13-visual-specimens.md)，依赖用户选定的整页结构。[沉浸式工作区与左右区域职责](issues/04-immersive-layout.md)已由 coordinator 领取，以候选场景先完成原型讨论，不等待所有业务细则定稿。具体布局仍须用户审阅；本轮没有关闭设计票。

2026-10-24：12 项任务对应的全文候选改写已完成，整合为 10 章正文和 5 张解释图。用户本次要求授权全部候选制作；未确认的设计决定仍待审阅。范围仅复盘工作区，不涉及业务实现或数据库。

[阅读新版](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/visual-spec.html) · [逐章扫描](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/scan-and-rewrite.md) · [本轮验收](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)

[决策地图](issues/00-design-map.md)是权威索引；开放任务与依赖从 `python3 .scratch/review-workspace-design-map/frontier.py --all` 查询，默认不加参数只显示可领取任务。每个任务的决定只保存在对应 Resolution 中。

|任务|要解决的目标|验收重点|执行主要思路|
|---|---|---|---|
|[明确交易单位、配对与复盘完成边界](issues/01-trade-identity.md)|让“一笔交易”、部分退出及复盘完成有唯一含义，避免列表、盈亏和评价串属。|覆盖买100、加60、卖80：匹配后加60及前批20，前批余80；明确这是一组待用户确认的数量例证。|以现有术语为起点，用逐笔数量账验证用户提出的配对方向；区分用户已确定原则与尚未确定的批次、拆单和完成规则，形成候选关系图后逐项讨论。|
|[核实 TradingView 工具与回放的参考能力](issues/02-tradingview-research.md)|确定 1:1 设计可依据的事实、组件复用边界及待补证据，避免凭图标猜功能。|原图每个工具槽位和底部入口均登记；名称不确定时注明候选及缺少的证据，不假称识别完毕。|按截图位置编号，查官方帮助、官方库文档及必要源码；把已确认名称、候选名称和未确认分开。只形成证据与差距，不自行选择降级方案或实现库。|
|[确定交易节点驱动的连续复盘动线](issues/03-event-journey.md)|让用户沿逐根回放完成复盘，阶段成为状态说明和资料分类。|每个动作列前态、M行情截止、X成交截止、记录归属、可见/不可见内容、未来暴露来源、视野及恢复状态。|分别走普通开平仓、加仓后部分退出、继续未完成复盘三条故事；用动作迁移表拆清下一根、下一成交节点、下一待复盘交易。|
|[确定沉浸式工作区与左右区域职责](issues/04-immersive-layout.md)|让图表获得主要空间，同时让交易选择、绘图和节点记录各有位置。|1440×900与1280×800明确每区职责、常驻高度、展开宽度、绘图区及价格轴预算；截图像素不直接视作CSS像素。|以用户指定全网页覆盖、关闭返回交易库、左右可收缩为约束；先制作入场、持仓、退出完整视觉原型及四种开合组合，比较未定的记录区结构，再校准空间预算。|
|[确定 TradingView 绘图与回放的逐项对齐契约](issues/05-tradingview-contract.md)|把“图标与功能1:1、底部按钮形态1:1”变成可逐项核验的设计合同。|原图工具逐项对应名称、图标轮廓、排序、线宽、容器、间距及参考比例；不以通用相似图标替代。|用研究的槽位表制作图标及状态对照板、操作故事板；围绕同一工具完成创建—编辑—取消/删除—撤销—保存重开的完整设计描述，不交付无功能依据的装饰图标。|
|[确定节点计划与持仓标注的协作方式](issues/06-plan-and-notes.md)|开仓时顺畅补记计划，持仓时围绕图表记录，不重复填表。|入场/止损/目标及预期R依赖清楚；只有买卖两价不能伪造风险分母；做空、缺项和无效值有说明。|用开仓填计划—继续回放—某bar标注—再次加仓的故事板验证；原计划冻结、后续修订与普通绘图对象分别标明。|
|[确定持仓过程指标与可比较的风险口径](issues/07-process-metrics.md)|为止损宽窄、入场后风险和体验分析沉淀可靠且不泄露未来的数据。|每指标明确对象、公式、冻结风险分母、币种、价格/费用口径、行情周期、可知截止与计算时间。|用合成价格序列手算正常、加仓/减仓、做空样例；分清最大不利波动与从峰值回落的回撤，确定基准、采样时点和缺失语义。|
|[确定退出归因与五星评价卡](issues/08-exit-ratings.md)|让实际退出、主观原因和规则评分可解释地对应，支持后续归因。|区分触及价格线、实际成交退出与用户退出原因；提前是/否/不确定/未评价不混合，提前不自动等于错误。|用计划内退出、提前退出、无原计划、一次退出匹配多批次的卡片对照；设计四维五星卡、依据入口和人工修订，默认规则作为待确认候选。|
|[确定保存、完成、导出与关闭的职责](issues/09-save-export-return.md)|用户知道什么已保存、哪笔已完成、导出了什么，以及关闭后回到哪里。|自动保存、快照、单笔评价完成、回合完成分开；与既有完成条件的变更逐条引用用户决定。|建立动作—对象—版本—反馈表，再走保存中离开、冲突恢复、部分完成、多批次导出与重开；将三阶段保留为成果叙事的候选方式。|
|[确定窄屏、键盘及异常状态的空间规则](issues/10-responsive-and-states.md)|新工作区在尺寸变化、输入和异常时仍保留图表、当前操作及返回路径。|不得沿用旧应用导航宽度与1102断点；给出新预算、侧栏互斥/折叠规则及长文本/价格轴边界。|按新全屏空间预算重算断点，用同态画板比较1440/1280/390及断点两侧；区分工具1:1的已批准参考与必须讨论的触控适配。|
|[确定全文论述结构与图示分工](issues/11-document-argument.md)|正文先解释目标和取舍，再安排规则、参数与引用；每张图提供独立信息。|导言及原10章逐章有去向；跨章规则只定义一次，其他位置准确引用；不把旧冲突规则原样保留。|逐章建立问题—论点—目标—取舍—规则—参数—图示—引用的改写提纲；本轮按用户追加授权制作全篇候选，未确认的规则标明效力。|
|[确定整份规范的整合与独立验收方案](issues/12-integrated-acceptance.md)|确定后续全文与画板修订的完整交付边界，防止局部通过掩盖整体缺失。|原4条评论与本次截图约束逐项对应任务、章节、画板、owner及验收证据；E01–E22和新增元素均有去向。|把三条核心旅程贯穿全文、图示和元素矩阵，逐项检查来源/对象/时间/状态/保存/视觉；形成后续制作顺序与独立审查合同。|
|[确定公共视觉样例与参数标注](issues/13-visual-specimens.md)|让公共规范在复盘页面中可见、可比较，与整页使用同一套资源。|实际组件、适用状态、尺寸标注、来源及独立视觉比较齐全；用户确认后关闭。|先从已选完整工作区提取七组样例，再补状态与长内容，最后讨论标注样章。|

## 初始决策依赖顺序（历史；视觉原型顺序以上述更新为准）

1. 先明确交易单位；TradingView 官方参考研究可独立并行。
2. 交易单位确定后，推进连续动线和过程指标；参考研究完成后讨论工具对齐合同。
3. 根据已定动线讨论沉浸式空间、节点计划及全文提纲；指标口径确定后讨论退出评分。
4. 汇合计划、评分和动线后决定保存/导出/返回；再整合响应式、异常与键盘规则。
5. 最后确认整份规范及高保真制作方案。本轮候选全文已完成；高保真状态与产品实现随后按批准合同推进。某一前沿可领取不表示其 HITL 问题已被用户回答。

## 关闭门槛

- 本图现有13张子票：1张AFK研究、12张HITL决策/原型；新增的是公共规范应用样例，本轮不手动解决HITL票。
- 每票须有问题、明确目标、范围、来源、依赖、执行思路、可勾选验收、反例和证据位置。
- HITL只依据用户真实反馈解决；研究只确认事实及缺口。研究中未确认的图标/交互仍阻止工具对齐合同定稿。
- 功能与视觉分开：文档可以规定真实功能验收用例，但静态图不能证明1:1功能已实现。
- 普通开平仓、加仓部分退出、继续未完成复盘三条完整旅程贯穿最终设计。独立审查者不得是同一画板作者。
- 全文已按本图重写；旧画板归档，当前用五张解释图说明设计关系。历史验收仅适用于历史版本，高保真状态稿仍待制作。

## 当前研究状态

[TradingView参考研究](issues/02-tradingview-research.md)已独立验收；13个绘图槽位及7个底部入口已登记，未确认项明确保留。[工具对齐合同](issues/05-tradingview-contract.md)已推进至v0.1审阅提案：含13绘图槽、7回放入口、缺证与适配方案；等待用户反馈和参考补证。研究完成不代表1:1功能完成。现有12张HITL设计决策票均未关闭。

## 与现有任务的关系

[既有TradingView制作跟踪](../review-visual-v1/issues/03-tradingview-toolbar-alignment.md)保留原图归档记录；决策和研究统一进入本图，避免两个任务各自规定不同工具语义。本轮候选制作与决策状态分开记账；后续高保真及实现切片仍以用户批准的决定为依据。

## 本轮十二项制作结果

以下每项均通过候选文档覆盖检查；不表示 HITL 决议或产品实现通过。原目标、验收与思路见上表，独立审查和浏览器证据见本轮验收。

|任务|正文|本轮完成|仍待确认/证据|
|---|---|---|---|
|01|RV04、RV07|补齐对象关系、100+60−80 配对、旧完成规则差异及缺省状态。|批次聚合、同秒排序、费用及单笔完成仍待决议。|
|02|RV03|整合既有研究；13 绘图槽、7 回放入口和 G01–G05 缺证进入正文。|研究已接受，工具身份及实操证据未因此通过。|
|03|RV04–RV05|三条连续旅程及逐动作 M/X/D、隐藏信息、节点暂停和恢复合同。|真实图表逐根揭示和恢复尚待实现验收。|
|04|RV02|按全幅工作区重算四种侧栏组合、1440/1280 尺寸和断点；配图 A。|尺寸与固定侧栏行为是候选；全量高保真状态待制作。|
|05|RV03、RV06|逐槽外观/功能边界、D01–D13/H00 生命周期和底栏语义进入合同。|每个 TV 实际操作仍 NOT VERIFIED；不以相似图标代替。|
|06|RV06|计划版本冻结、计划线与图形分离；补齐 Text 默认归属、共享、撤销共享及历史引用。|归属默认、共享入口和真实保存待确认/验证。|
|07|RV07|补齐风险分母、MAE/MFE/峰值回撤、费用、缺失语义及多批次/做空算例。|公式为候选口径；未验证业务计算实现。|
|08|RV07|区分退出事实与原因；四维 V0 规则、四种评分状态、人工修订和版本追溯。|阈值和输入仍待批准，不将缺失评分填成三星。|
|09|RV09|保存/快照/评价/回合完成分开；补齐冲突、两层关闭、导出及 PPTX 边界。|真实持久化、重开和导出文件尚待实现验收。|
|10|RV08|补齐新断点、390/键盘布局、14 类区域状态与数据承诺；配图 D。|触控适配和设备证据未验证；本轮只验文档阅读。|
|11|RV01–RV10|扫描原导言及十章，按目标→取舍→规则→参数→引用重写；五张解释图分工明确。|候选制作已验收，不代表全部设计决定已通过。|
|12|RV10|汇总 12 任务、E01–E22/N01–N04、四条评论、内容/视觉/功能分开的验收门槛。|最终产品整合验收仍须独立执行；不关闭其余 HITL 票。|

> 2026-10-29 candidate-v12/v13 追记：v12 的独立视觉报告判定 FAIL：1440 边缘编辑态中成交引线穿过另一条 Text 锚点，详见 [v12 报告](evidence/review-fixes-20261028/final-review-v12/REPORT.md) 与 [原图](evidence/review-fixes-20261028/coordinator/v12-edge-editor.jpg)。v13 独立审阅仍在整理，尚无正式报告；现有 [1280×800 第49根编辑截图](evidence/review-fixes-20261028/coordinator/v13-1280-text-edit.jpg)、[第49根态](evidence/review-fixes-20261028/coordinator/v13-1280-text-49.jpg)及[局部裁图](evidence/review-fixes-20261028/final-review-v13/v13-1280-edit-line-crop.png)显示边缘态有所改善，但编辑态自由 Text 引线穿过首次买入箭头，仍为 FAIL，问题17保持开放。1291 工具条初次空白仍仅属瞬态疑点，根因和复现性 NOT VERIFIED，问题14保持开放。v13 报告待归档；本记录不代表 v14 或最终验收通过，旧版证据不迁移。

> 2026-10-29 candidate-v34/v35 回归更新：协调者真实浏览器观察到 v34 在 1280×800 28→29 时信息行保持 49px、chart y=154px，play 仅 x=540.24→540.57px；但 1108×800 和 1280×800 右栏展开均有回放操作区与关闭按钮重叠，故 v34 整体 FAIL。v35 修正间距后，1108×800 首屏完全裁出“下一回放停点”，未滚动原生滚动条不可见，鼠标水平滚动后才出现，可发现性 FAIL。问题14仍开放、修复中；独立复审和最终验收尚未完成，任何历史版本 PASS 均不迁移。详见[问题14](issues/14-review-responsive-collision.md)、[版本覆盖与验收记录](evidence/review-fixes-20261028/DESIGN-COVERAGE.md)及[验收草稿](evidence/review-fixes-20261028/REPORT-DRAFT.md)。


> candidate-v36/v37 阶段追记（2026-10-29）：v36 因样式优先级导致 1108px 宽“下一回放停点”裁切，记 FAIL，保留 v29–v36 全历史。v37 最初有协调者 203 条 AX 观察，当时的控件登记为 40 组：PASS 0、FAIL 0、NOT VERIFIED 36、N/A 4。此为当时记录，后续补测及更新口径见下方，不将历史证据迁移为其他版本的通过。


> v37 最新状态（2026-10-29）：协调者已完成多视口、真实图表回放和部分键盘/鼠标路径的补测，并记录 238 条 AX 观察；最新控件组结果以 [v37 控件表](evidence/review-fixes-20261028/CONTROL-INVENTORY-FINAL.md) 为准。非实现者的 [独立静态复审](evidence/review-fixes-20261028/final-review-v37/REPORT.md)在已查看画面未发现新的 P1/P2 静态视觉阻断，保留三项 P3。两位独立审核者均无法连接各自浏览器，独立交互实操 NOT VERIFIED；协调者操作不等同于独立审核者实操。完整交互、整体视觉与用户确认仍 NOT VERIFIED；模拟/物理触控及正式产品持久化亦未验证。原型使用合成数据和内存草稿，刷新重置；仍需用户审阅后才回填正式视觉规范。详见 [覆盖记录](evidence/review-fixes-20261028/DESIGN-COVERAGE.md)、[验收记录](evidence/immersive-layout/revision-01/acceptance.md)及 [独立实操受阻记录](evidence/review-fixes-20261028/final-review-v37-interaction-2/REPORT.md)。

> 2026-11-05 系统排查进度：短高度布局、侧栏/价格视野、场景 URL 同步已有各自限定范围的通过证据；Text 锚点冲突的 [candidate-05](evidence/systematic-fixes-20261105/task-04-coordinator/REPORT.md) 与 [candidate-06](evidence/systematic-fixes-20261105/task-04-candidate06/REPORT.md) 视觉验收失败，问题 17 保持开放并继续修订。场景下拉的键盘原生选择尚未验证，不能将局部通过扩展为整页验收通过。

> 2026-11-05 candidate-07：Text 避让候选在[真实浏览器复测](evidence/systematic-fixes-20261105/task-04-candidate07/REPORT.md)中发生引线终点异常，第二条 Text 无法进入编辑，功能 FAIL，问题 17 保持开放。

> 2026-11-05 candidate-08：修正引线终点后，[真实浏览器复测](evidence/systematic-fixes-20261105/task-04-candidate08/REPORT.md)发现第二条 Text 流程长时间无响应，问题 17 仍为 FAIL；性能修订与复测中。

> 2026-11-05 candidate-09：两条 Text 的限定实操、编辑取消与回放前后切换已走通，但[视觉复测](evidence/systematic-fixes-20261105/task-04-candidate09/REPORT.md)发现远距离长引线与成交标签遮挡，问题 17 仍为 FAIL。

> 2026-11-05 candidate-10：进一步复测发现成交标签仍被辅助点覆盖，单条确认和取消状态仍有跨图引线；详见[复测记录](evidence/systematic-fixes-20261105/task-04-candidate10/REPORT.md)。问题 17 仍为 FAIL，正在诊断。


2026-11-05：Text 碰撞 candidate-15 [真实浏览器复测](evidence/systematic-fixes-20261105/task-04-candidate15/REPORT.md) 仍 FAIL；保留证据，问题 17 开放，预览恢复至 candidate-04 后继续处理其他已诊断问题。

2026-11-05：candidate-16 工具条普通 T/多节点轮廓及 Text 指定操作的限定复核通过；candidate-17 [单选语义与记录焦点限定复核](evidence/systematic-fixes-20261105/task-06-candidate17/REPORT.md)通过，读屏与全页验收仍未完成。问题 17 的 Text 密集遮挡仍为 FAIL。

2026-11-05：candidate-18 的[窄屏返回阅读页限定复测](evidence/systematic-fixes-20261105/task-07-candidate18/REPORT.md)通过；日期弹层背景和双隐藏焦点问题已在三个视口复现并进入修复。

- 2026-11-05：任务 08 日期弹窗背景焦点与双栏隐藏顺序完成 candidate-20 局部复核，保留 candidate-19 视觉 FAIL；三视口鼠标/键盘与非实现者静态对比见 [任务报告](evidence/systematic-fixes-20261105/task-08-candidate20/REPORT.md)。原型整体验收仍未通过，Text 遮挡等问题继续开放。

### 2026-11-05 计划规模复测

candidate 31 的计划规模与价格线限定样本已通过协调者真实浏览器复测和非实现者静态视觉检查；此前 candidate 21–30 的失败及脚本断言错误均保留，详见 [Task 09 报告](evidence/systematic-fixes-20261105/task-09-candidate31/REPORT.md)。这不意味着原型全页通过、交易数据已持久化或相关设计已获确认；Text 多标注仍为待解决问题 17。

2026-11-05：candidate-38 的六条 Text 限定操作可以完成，但短窗口图高压缩、单条正文离开图表及同点身份重合导致视觉 FAIL，见[复测](evidence/systematic-fixes-20261105/task-04-candidate38-stress-scrolled/REPORT.md)。原生场景选择在自包含下拉框中也不能通过当前无头浏览器提交，见[环境隔离实验](evidence/systematic-fixes-20261105/task-03-native-select-isolation/REPORT.md)；该选择路径仍为 NOT VERIFIED，不推定为产品缺陷。

### 2026-11-05 系统排查最新复核

当时 3091 原型与其范围、问题处理及 40 项结果见 [candidate-31 验收](evidence/systematic-fixes-20261105/task-final-candidate31/ACCEPTANCE.md)和[问题修复汇总](evidence/systematic-fixes-20261105/task-final-candidate31/USER-SUMMARY.md)。在无头浏览器中，原生下拉的鼠标弹出菜单及方向键仍未走通，但后续用真实 Tab 路径及模拟首字符提交了阶段、速度及评分，证据与未覆盖边界详见验收表；因此上段早期“该选择路径未验证”只适用于当时的鼠标/方向键实验。

[candidate-44](evidence/systematic-fixes-20261105/task-04-candidate44-stage/REPORT.md)是隔离设计试验，不是当前预览。非实现者认可其 Text 身份和成交箭头区分的局部改善，但仍以遮挡行情和密集空间判视觉 **FAIL**；[问题 17](issues/17-review-text-overlay-state.md)保持开放。圆点中心约 1px 的偏移之后在 candidate-45 得到限定修正。正式 V1.0 规范及用户确认不因上述局部结果自动更新。

### 2026-11-05 candidate-45 当前验收

当前 3091 与 [candidate-45 冻结清单](evidence/systematic-fixes-20261105/candidate-20261105-45/manifest.json)一致，完整的新版本抽样见[验收表](evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)与[问题和修复汇总](evidence/systematic-fixes-20261105/task-final-candidate45/USER-SUMMARY.md)。非实现者对同态截图的[独立视觉复核](evidence/systematic-fixes-20261105/task-final-candidate45/INDEPENDENT-VISUAL.md)确认密集 Text 遮挡和同点身份混淆仍 **FAIL**；该审查未能独立操作浏览器，不能以静态复核替代交互验收。用户对密集态取舍的决定尚未完成。
