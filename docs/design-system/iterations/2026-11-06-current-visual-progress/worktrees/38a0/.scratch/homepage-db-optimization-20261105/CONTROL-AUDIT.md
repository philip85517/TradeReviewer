# 首页读取优化：控件、状态与视觉审计

> 最新状态：恢复第5/5轮已结束，整体FAIL并暂停；下文早期轮次保留为历史。最新结果见[第5轮汇总](write-precompute/ROUND-5.md)。

**整体FAIL；本报告不声称所有控件或输入方式通过。** 触发原因是本轮改变首页及交易库的读取、等待和状态接线，按项目[审计规范](../../docs/agents/frontend-control-audit.md)执行。协调者负责整页一致性和完整数据流，Sol6.1 Ultra实现，Luna6 Max独立视觉审查。

## 1. 版本和范围

最终构建、数据、服务、源内容指纹及启动命令统一见[最终验收第6–7节](FINAL-ACCEPTANCE.md)。新最终预览1440×1000、1280×800，Chrome156、DPR1、100%缩放；真实鼠标/键盘旅程在早期第5轮构建1440×1000执行。最终生产代码只多一行eslint注释，差异及历史指纹保留，不冒称全部旅程已在新指纹重跑。

数据：隔离真实副本，默认live/all/全部账户/全部期间，无附加条件；目录236证券、7个实盘账户，持仓20行、8行一页、3页。每个选项及重复实例都视为独立状态；只测第一条详情不代表20条通过。

参考根目录：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`。准确文稿`visual-design.candidate.md`；整体`images/home-1440.svg`、`home-1280.svg`；账户`account.svg`，搜索`search.svg/search-detail.svg`，筛选`filter.svg`，曲线`chart-hover.svg/chart-gap.svg`；持仓`holding-option-C-normal-1440.svg/1280.svg`及`50-items--page-7.svg/holding-return.svg`；历史`home-history-1440.svg`；返回/异常`library-return.svg/error--update-failure.svg`。

用户要求桌面验收，本轮不改窄屏设计。窄屏作为本次版本范围排除记录，不能推广为后续默认；未覆盖断点两侧、移动键盘、模拟或物理触控，均未取得证据。财务/Bars开发与并发试验按用户要求暂停；这些排除不消除完整首页FAIL。

## 2. 控件登记边界

以下是受影响家族及明确实例边界；`Hxx`为本功能登记编号，不声称原视觉稿含有这些字面ID。DOM基线见`desktop-before.json`与`desktop-continued-inventory.json`，条件控件用对应open JSON和源码交叉核对。隐藏的数据管理全页不纳入首页按钮数量；进入它的入口状态仍须验证。下表不是100%点击声明。

|稳定登记ID / 定位|实例与前置状态|预期状态链 / 视觉影响|owner / 验证状态|
|---|---|---|---|
|H01 market；`.hp-market-tabs`|all/a/hk/us四项，当前all|切换范围、URL、目录和结果一致；旧响应不能覆盖|前端 / 全部选项应用NOT VERIFIED|
|H02 account-trigger及`account-option:{id}`|打开后全部＋7账户；原选择全部|选中范围生效；Esc不更改，焦点回触发器|前端 / 打开和Esc PASS，8个选项应用NOT VERIFIED|
|H03 catalog-trigger/input/clear/close|搜索标的弹窗、输入框、清除、关闭|实体查找不等于持仓过滤；输入后候选更新|前端 / 输入512480得1结果及Esc PASS；关闭按钮路径未测|
|H04 catalog-result:{key}/detail|236目录按实际查询返回的业务键登记|打开对应完整身份；详情进入交易库、返回保留查询|前端 / 结果选择、下钻和返回NOT VERIFIED|
|H05 attachment-trigger/checks/apply/clear/reset|stock、etf、fund、openOnly、pendingReview=true/false；基金禁用|草稿与生效分开；清附加不清主范围；取消不提交|前端 / 打开Esc PASS；各选择及提交NOT VERIFIED；基金缺可信分类禁用有说明|
|H06 attachment-token:{key}|有已应用条件才出现|移除正确条件，重读对应范围|前端 / NOT VERIFIED|
|H07 period-preset:{year,month,week}|当前全部；3快捷项|期间变更只影响期间区，持仓仍为当前时点|前端 / 真实应用NOT VERIFIED|
|H08 period-custom/start/end/apply/cancel|缺日期边界；两输入框、应用、取消及Esc|空日期不可提交；取消恢复已提交期间|前端 / 打开、禁用观察及Esc PASS；输入/应用/取消按钮未测|
|H09 metric-detail:{net,realized,floating,market}|4卡均未知|打开对应公式、覆盖、缺失原因；Esc回原页面|前端 / 第1卡PASS，另3卡NOT VERIFIED|
|H10 metric-value / chart-mode controls|精确值焦点/hover、图表切换，按源码条件出现|预览不改变提交；不把未知值当0|前端 / NOT VERIFIED|
|H11 chart-point:{date}/gap|当前曲线空；有效点实例数0|有数据时hover/键盘/固定详情/缺口；空态明确|前端 / 当前空态可见；有效曲线完整性FAIL，点交互NOT VERIFIED|
|H12 holdings-search/open/input/clear|20→0→20；同一主范围|只过滤持仓；8槽和容器稳定，清空恢复|前端 / PASS|
|H13 holding-value:{rowId,field}|20行；数量/成本/价格/市值/浮盈精确值及身份焦点|完整值、缺失原因、身份不混淆|前端 / NOT VERIFIED，不以文本可见判通过|
|H14 sort:{name,value,pnl}|名称可用；2金额排序禁用|按全筛选集合排序；缺覆盖时说明禁用|前端 / 名称切换NOT VERIFIED；金额禁用原因有源码和DOM，不等于排序PASS|
|H15 detail:{rowId}/close/library|20独立行，分页8/8/4；首条SSE:512480|身份一致；关闭回原页；全部字段和下钻正确|前端 / 首条打开Esc PASS；字段金额逐项/另19条/下钻NOT VERIFIED|
|H16 pagination:{previous,next}|页1/2/3，每页8固定槽|全范围汇总不被分页截断，末页空槽不跳高|前端 / 页1→2→1 PASS；第3页NOT VERIFIED|
|H17 export-csv|全筛选20行；空搜索结果禁用|导出全筛选集合、精确金额、完整列，不仅当前页|前端 / NOT VERIFIED|
|H18 empty-import/all-market|首读超时空种子、真0行时条件出现|错误不可混同真零；导入先完成完整启动|前端 / 超时空态FAIL；导入仅单测，浏览器保存未测|
|H19–H28 history/contribution|源码保留not-wired|历史统计、贡献与下钻完整|协调者 / FAIL；不能以无控件排除产品缺口|
|H29 nav-home/trades/analysis/data/settings|侧栏5入口；策略未开放禁用|进入按需加载、返回、刷新与URL一致|前端 / trades与home实际链FAIL；其余NOT VERIFIED|
|H30 footer-library|底部进入交易库，含当前范围|目标集合及返回正确|前端 / 与侧栏不同入口，NOT VERIFIED|
|H31 recovery/retry/restore|页头修复、异常重试、账户恢复；条件出现|明确pending/error，旧草稿不丢；修复写入需隔离保存闭环|前端 / 浏览器恢复NOT VERIFIED；版本冲突仅单测|
|H32 import-entry/loading-gate|空持仓导入及导航数据后导入|完整工作区就绪前不得开放文件输入；保存后重读|前端 / 状态接线单测PASS；真实导入保存/返回/reload NOT VERIFIED|

不是所有家族都已逐实例展开：236个候选、20详情及各字段、所有组合尚未完成普查分母。**全页面执行覆盖率、点击覆盖率、选项覆盖率均NOT VERIFIED，不报百分比。** 以下小表只统计固定的11条旅程，不冒充控件全集。

## 3. 实际操作结果

均是真实CDP鼠标/键盘输入，不调用React handler、不派发合成DOM事件。API名称修改单列为数据更新试验，不当作UI保存通过。

|旅程|输入与预期|实际 / 证据|状态|
|---|---|---|---|
|J01 账户取消|点击全部账户，Esc；保持原范围|8选项可见，Esc关闭且范围不变；`desktop-account-open/cancel`|PASS（仅取消）|
|J02 实体搜索|打开，清旧输入，键入512480，等去抖，Esc|1个候选，关闭；`desktop-search-before/during/after`|PASS（不含选中候选）|
|J03 首条详情|点首条眼睛，Esc|SSE:512480身份一致，关闭；`desktop-detail-open/close`|PASS（打开关闭；非金额审核）|
|J04 持仓0结果|点搜索，键入不存在标的|20→0，真0条/0标的，八槽保留；`desktop-holding-search-before/during/empty`|PASS|
|J05 清持仓搜索|点清除|恢复20条；`desktop-holding-search-clear`|PASS|
|J06 分页返回|滚动，点下一页，再上一页|1/3→2/3→1/3；`desktop-page-before/after/return`|PASS（不含末页）|
|J07 附加筛选取消|点击筛选，Esc|打开后取消，不应用条件；`desktop-filter-open/cancel`|PASS（仅取消）|
|J08 日期取消|点击日期，检查空输入/应用禁用，Esc|空范围无法应用；关闭；`desktop-period-open/cancel`|PASS（仅该状态）|
|J09 口径详情取消|点击第一张卡详情，Esc|公式/未知原因可见，关闭；`desktop-metric-open/cancel`|PASS（仅第一卡）|
|J10 交易库入口|真实点侧栏交易库，观察25秒|loading后显示目标交易集合超时；`desktop-trades-before/during/after`|FAIL|
|J11 返回刷新|点我的交易室，重新加载|返回及刷新仍在连接交易数据；`desktop-trades-return/return-reload`|FAIL|

这11条固定旅程执行11/11，结果9PASS/2FAIL；**仅旅程完成观察率100%，不是产品/控件覆盖100%**。更早`journey-*`曾有视口/去抖/旧滚动问题，已被`desktop-*`替代，不参与通过统计。一个旧target连接挂起在操作前终止，未当作应用失败；fresh target重试的J10/J11才是实际失败证据。

输入方式：鼠标按上述旅程；键盘文字输入和Esc有证据；Tab/Enter/Space/方向键整套路径未执行。模拟触控、物理触控、软件键盘未验，不与鼠标互换。正常动效未禁用。

## 4. 空间与状态

搜索及分页没有观察到容器跳高，但不能据此判定整体视觉符合参考。

|场景|before / during / after几何（CSS px）|结论与证据|
|---|---|---|
|持仓搜索20→0→20|1440×1000，scroll0；主图x96/y80/w1320/h560.109；持仓y680.109/h520；历史y1224.109/h558，各状态相同|局部容器稳定；`desktop-holding-search-*.json`|
|页1→2→1|scroll520；主图y−440/h560.109；持仓y160.109/h520；历史y704.109/h558，各状态相同|滚动造成的坐标变化与异常位移分开；`desktop-page-*.json`|
|两桌面整体|参考1440/1280与最终态分别比较|指标和曲线缺失；主图更高、持仓区更靠下，最终态FAIL；无优化前同数据同状态图，不能断言本轮引入|

允许：弹窗覆盖、正常滚动、合法筛选改变行内容、分页内部替换；禁止：改小字号/隐藏数据伪装加速、未知画零线、筛选撑高八行容器。独立视觉预算以批准V2.5为准，不把当前560px自动批准为新规范。

状态：normal/expanded/empty/loading/error已观察；selected仅原选中范围及页码，不覆盖所有选项；ambiguous、超长文本/数值、期满、跨日和断点两侧浏览器NOT VERIFIED。空曲线并不证明有数据时hover/键盘/tooltip通过。

## 5. 未通过问题与独立验收

|问题|可观察预期 vs 实际|分类/责任/后续|
|---|---|---|
|更新后首次读取|应新版本完整≤1秒；实际16.3秒200后UI45秒仍空|状态反馈/性能；实现故障；root；[问题票](issues/03-timeout-empty-state.md)|
|结果首次生成|应打开前准备；实际HTTP内同步约16秒|架构尚未完成；root；[问题票](issues/02-on-demand-rebuild.md)|
|交易库往返|应显示目标集合并可返回；实际超时且返回仍加载|端到端FAIL，根因未归属；[问题票](issues/04-trades-return.md)|
|汇总、曲线、历史|应完整终态；实际未知/空图/not-wired|基线已有缺口及持仓原因待查；[问题票](issues/05-complete-content.md)|

Luna6 Max未实现所审UI，直接对照参考和候选截图，独立判整体FAIL；细节见[independent-review.md](independent-review.md)。视觉最终态FAIL与本次优化回归归因NOT VERIFIED分开记录。原始数据保护见最终验收；只读/接口写回执不替代UI保存闭环。

|放行门槛|判定|
|---|---|
|范围及最终构建/服务/预览绑定|PASS；早期交互历史版本限制明确|
|完整控件普查、选项及所有相关旅程|NOT VERIFIED|
|功能正确性|局部PASS，完整内容FAIL|
|端到端状态链|FAIL|
|独立视觉|最终态FAIL；回归归因NOT VERIFIED|
|原始数据保护|四张权威表逻辑摘要PASS；副本变更明确|

任一必需FAIL或NOT VERIFIED均阻止整体交付。现在只是保留可运行候选及失败证据，性能试改5/5暂停，没有宣布修复完成。


## 8. 恢复第五轮最终版本审计

**整页FAIL，保留未验证项，不报告100%或总点击覆盖率。** 触发：本轮改变202读取、取消、状态及后台发布接线；不是单纯文档变更。root为整页视觉和数据流owner，Sol6.1 Ultra实施，非实施者Luna6 Max直接看截图与参考并给出Spec FAIL / Quality Changes requested。[独立报告](write-precompute/luna-desktop-review.md)。

### 8.1 当前版本、参考与范围

版本1198文件/34处变更，指纹`2a94e2aa6b58d5c15499581184ced492ab27bee103436c61dc1814b2c4e26ef0`，[冻结](write-precompute/final-prebuild-manifest.json)与[收尾](write-precompute/final-close-manifest.json)一致。生产4397、隔离真实副本、Chrome156 CDP，1440×1000/1440×900/1280×800、DPR1、100%缩放；Codex内置CUA两次连接失败，外部真实Chrome是替代证据，不计内置通过。

准确参考沿用本报告第1节最新V2.5根及对应images；没有授权扩大图表高度、减少首屏密度或移除历史。数据为默认live/all/全部账户，236目录、7个实盘账户、20持仓、8槽、3页。快态仍有四卡“—”、空曲线、历史not-wired，不能当作正常完整状态。较早第1–7节及J01–J11成绩为历史版本，不合并为本轮全通过。

用户仅桌面范围；本次窄屏排除不泛化为长期豁免。物理触屏、模拟触屏均未测，鼠标和键盘证据分开。所有选项/20条详情/组合未逐项验证，控件全集与分母NOT VERIFIED。

### 8.2 版本绑定的实际旅程

文件均在`write-precompute/`；JSON保留文本、URL、busy与几何，PNG保留真实绘制。通过仅覆盖表内操作。

|ID/对象|输入、预期|本轮证据与实际|状态|
|---|---|---|---|
|H02账户弹层|鼠标打开，键盘Esc；不改范围|journey-account-open/escape；全部+7账户，关闭并保留范围|PASS：取消；8选项应用NOT VERIFIED|
|H03标的搜索|鼠标打开，键入不存在代码，Esc|journey-symbol-empty/escape；无匹配后关闭|PASS：无结果/取消；候选选择及下钻NOT VERIFIED|
|H12持仓搜索|输入无匹配，再清除|journey-holdings-empty/clear；20→0→20，8槽保留|PASS：限定搜索|
|H15首条详情|鼠标打开SSE:512480，Esc|journey-detail-open/escape；身份正确、过期价格有说明|PASS：开关；金额全面核对/另19条/下钻NOT VERIFIED|
|H16分页|鼠标1→2→3→1|journey-page-two/three/one；8/8/4数据，末页4空槽|PASS：3页操作|
|H01市场与截止|鼠标全部→A股，15秒应结束等待|cancel-browser-pending/deadline/after-deadline；15.966秒仍忙，之后多次202|FAIL；切回全部恢复200不抵消失败|
|H29侧栏交易库|鼠标进入，≤1秒完整|journey-trades-after-one-second/after-deadline；1秒及16秒仍连接中|FAIL|
|H29错误后真实返回|交易库最终超时，点击返回首页并刷新|journey-trades-late、journey-real-return-during/after、journey-real-home-reload；2秒/重载2.2秒仍未完成|FAIL|
|PERF01最终首页预览|启用HTTP缓存，打开完整首页|final-http-warm-preview-1440及final-handoff-preview-1440；现有表面364.5/293.9ms，但四卡未知/无曲线/历史缺失|完整页FAIL|
|H32导入保存闭环|真实CSV上传→确认→持久化→返回→重载|本轮仅API改名/还原实验；没有实际UI导入证据|NOT VERIFIED|

[完整操作清单](write-precompute/final-ui-journey.json)、[真实取消网络记录](write-precompute/final-browser-cancellation.json)。`journey-home-reload`文件实际仍是交易库重载，不能用文件名当首页通过；最初加载页没有返回按钮，尝试点击未成功，不算真实返回。随后错误页的真实返回另有上述独立证据。交易库超时在约74.7秒快照已出现，未记录准确首次出现时刻，不把它称为精确deadline。

账户8选项应用、港美市场、期间/日期应用、附加条件与移除、排序/导出、其余详情、恢复写入、真实导入尚未齐备。本轮H04–H11/H13–H14/H17–H18/H30–H32未列明通过的项保持NOT VERIFIED或既有FAIL。H19–H28历史未接线FAIL；图表没有有效点，不能以0个点推定交互通过。全页功能未通过。

### 8.3 视觉、空间与独立接受

参考`home-1440.svg`及holding原稿，root和Luna分别直接查看实际1440/1280截图。1440图表区约y226–639，参考y226–547，超约92px；持仓标题实际约680，参考约585，首屏少约两行。属于主要信息密度差异，独立视觉FAIL。正常完整数据态未齐，旧版匹配状态未齐，回归归因NOT VERIFIED。无溢出或单测不能替代此门槛。

前中后截图见journey-final-before、cancel-browser-before/pending/deadline/after-deadline/return-all；对应JSON可查空间位置。未完成逐状态全部几何量化，不声称布局全通过。鼠标、键盘限定旅程有证据；触控没有。

最终独立审查已把107项受控测试通过与真实15秒截止FAIL分开。root不接受完整功能、性能或视觉交付。原问题达到恢复5/5后暂停，记录同步到README/FINAL与原票。
