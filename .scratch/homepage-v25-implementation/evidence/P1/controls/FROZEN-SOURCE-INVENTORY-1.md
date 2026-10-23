# P1 freeze-1 实际源码控件登记与验收边界

触发：P1整页控件/布局/数据接线开发，适用 frontend-control-audit。版本：`source-manifest.freeze-1.json` 的29个owner文件，集合SHA `766c4cc69c7075be36ef61abe772129c04950b3cb7c5a2ce6966563a8a0fed9f`。本文只记录冻结源码实际入口及缺失入口，不能代替root的AX/DOM普查或真实操作。实现owner integration_g61；浏览器/视觉/持久化独立验收owner root。

根参考：visual-contract.md、55项DESIGN-COVERAGE、A/CONTROL-STATE-MAP（96行=85适用/11原NA）、V2.5正文/图及current manual。公共96分母保持；P2–P4尚未派发不计P1通过，也不从最终分母删除。P1设计映射为HV25-01..06、11..12原子范围、23..30、44..46、47..51适用状态、53..55。

服务由root管理：`http://127.0.0.1:3333/home?live=true&market=a&accounts=p1-count-09&range=all`；root已确认显式隔离`.data/tradereview-test.sqlite`。本owner未操作浏览器、服务、数据库。两桌面CSS视口1440×1000/1280×800、100%缩放；390px边界、实际DPR/scroll/rect/截图时间与真实数据集由root本轮采集，当前均NOT VERIFIED。

## 实际控件与动态实例规则

以下每行是稳定入口规则，不能以表格行数充当所有账户/行/页/值的执行分母。下游库/复盘沿既有真实控件逐实例展开；以进入旅程后AX真实集合为准，不能用省略的兄弟操作声明全量覆盖。定位H=home-surface.tsx，W=trade-review-workspace.tsx；两文件精确hash见manifest。

|稳定ID / 实际定位|进入与操作 / 预期状态链|状态、空间、公共状态族|当前证据/状态|
|---|---|---|---|
|NAV-HOME / W主导航“我的交易室”|鼠标/Enter回home，先原guard，再owned读恢复UI|default/hover/focus/pressed/active；72导航固定；IconButton/SegmentedTabs|真实浏览器NV|
|NAV-TRADES / W主导航“交易库”|普通集合，无queue/强选，沿当前范围|default/hover/focus/active；原导航位置|真实浏览器NV；旧Workspace受影响FAIL见readiness|
|NAV-EXISTING:{insights,data,settings} / W主导航|各自可达、既有guard与返回；settings仍原data/settings|逐个鼠标/键盘/取消，不只查handler|真实浏览器NV|
|NAV-STRATEGY / W disabled按钮|始终disabled，说明未开放|不可用原因可访问；不算点击成功|真实浏览器NV|
|NAV-MOBILE:{trigger,backdrop} / W导航按钮/条件遮罩|窄屏开关、Esc回trigger、导航后关闭|expanded/关闭/焦点；不遮核心动作|390px与触控NV|
|STORAGE-RETRY / W存储错误重试|storage error才渲染，重试bootstrap，不能显示假持仓|loading/error；EmptyState/RetryAction|真实浏览器NV|
|ALIAS-RETRY / W账户范围恢复重试|alias error才渲染，保留原因后重读|loading/error；RetryAction|真实浏览器NV|
|HEADER-MARKET:{all,a,hk,us} / H市场组四按钮|每个选项原子读；成功后新scope+完整bundle，失败旧scope保留|active/hover/focus/pressed/loading/error；SegmentedTabs|hook+模型定向PASS，真实四选项NV|
|ACCOUNT-TRIGGER / H .hp-account-trigger|开关listbox；loading禁用；Esc关闭回trigger；长名全文|176×36；Select八态|组件定向PASS，真实浏览器NV|
|ACCOUNT-OPTION:{accountId或*} / H role=option|每个真实账户+全部；方向键/Home/End移动焦点、Enter选择；选中记号独立|Select selected/longtext；数据更改账户目录动态展开|真实每选项NV|
|ACCOUNT-RETRY / H账户错误下拉“重试”|error展开后owned reload，不能重复提交pending|Select.error/RetryAction|真实浏览器NV|
|ACCOUNT-IMPORT（应存在、源码缺失）|空目录批准下一步“导入账户”应进入已有导入|Select.empty/EmptyState|实现缺口FAIL；不移除分母|
|HEADER-GLOBAL-SEARCH / H首个disabled图标|当前P1明确未接入；P3待派发|IconButton.disabled；不冒充P3通过|P3 NOT VERIFIED|
|HEADER-FILTER / H第二个disabled图标|当前P1明确未接入；P3待派发|IconButton.disabled；FilterPopover/Token待P3|P3 NOT VERIFIED|
|READ-RETRY / H inline-error“重试”|route/global read错误才渲染，pending禁用，owned读成功纠错|RetryAction/error/loading；旧范围数据一致|hook PS06 PASS；真实NV|
|HOLDING-SEARCH-ENTRY / H搜索持仓按钮|打开内联输入并转焦点，不开全局搜索|36高工具区，DataTable/default/focus|组件定向PASS，真实NV|
|HOLDING-SEARCH-INPUT / H input[aria-label=搜索持仓]|300ms、IME中不提交；query只改表格，回1页|DataTable loading/empty/longtext；8槽下游稳定|组件IME定向PASS，真实NV|
|HOLDING-SEARCH-CLEAR / H清除持仓搜索按钮|清query、保market/accounts、page1、focus回输入|empty/no-match入口；不清全局|真实NV|
|HOLDING-EXPORT / H导出CSV按钮|全量筛选结果非当前8行；0条或未ready禁用；完整精度/公式安全|IconButton.disabled/default/focus；下载反馈|模型CSV定向PASS，真实下载NV|
|HOLDING-SORT:{name,market-value,pnl} / H三个列头按钮|各自升降回page1；金额可比覆盖不足禁用+原因|DataTable selected/disabled；固定列/箭头|模型定向PASS，真实三控件NV|
|HOLDING-IDENTITY:{account+episode} / H .hp-instrument|行名称focus/hover查完整名称、可信身份、账户；未知明确原因|DataTable longtext；48行高不变|真实全文提示与键盘NV|
|HOLDING-VALUE:{rowId,column} / H .hp-value[tabindex=0]|每数量/成本/价格/MV/UF读完整精度及原因；成本暂无、报价待更新|DataTable/ChartTooltip适用读数状态；native title|组件unknown消费PASS；Enter/Esc/触控说明NV|
|HOLDING-DETAIL:{account+episode} / H id=holdingTriggerId(row.id)|每真实行末眼睛打开准确详情；不同账户同证券分别登记|36命中盒/48行；IconButton default/hover/focus/pressed|组件/首旅程定向PASS；真实每行NV|
|HOLDING-PREV / H上一页持仓|page1禁用，0条不渲染；回前页保query/sort|DataTable/IconButton；8槽固定|真实0/1/5/8/9/50页边界NV|
|HOLDING-NEXT / H下一页持仓|末页禁用；9条末1、50条末2；不推下游|DataTable/IconButton；8槽固定|真实页边界NV|
|HOLDING-EMPTY-NEXT（应存在、源码缺失）|真空持仓需适用下一步；no-match已有清query不得重复按钮|DataTable.empty/EmptyState；无伪页码|实现缺口FAIL；不移除分母|
|HOLDING-DETAIL-CLOSE / H关闭持仓详情|关闭/Esc回准确行；Tab约束；外侧不关闭；刷新保打开、消失回标题|dialog+背景inert；来源scroll/query/sort/page|组件刷新/移除PASS；真实鼠标/键盘NV|
|HOLDING-DETAIL-UPDATE / H详情“更新数据”|仅缺失原因存在时渲染；pending禁用，沿既有更新路径|RetryAction/error/loading；原因仍可查|真实数据更新与反馈NV|
|HOLDING-DETAIL-TRADES / H唯一主动作“查看交易”|可信identity且非pending可达；无证据禁用+原因；准确账户/证券普通集合|唯一主动作；不自动首回合|Workspace生产首旅程PASS；真实NV|
|HOLDING-ENTER-LIBRARY / H #hp-open-trades|按当前全范围普通集合；先存白名单UI+scroll/focus再导航|pending/未ready禁用；来源UI-only|真实NV|
|LIBRARY-SOURCE-RETURN / W .hp-library-source按钮|显式返回home，重读bootstrap/quote/FX后恢复来源非默认UI|S v2恢复，不存业务rows；focus+scroll|peer PS01/03/05/08/13 PASS；持久化NV|
|LIBRARY-ERROR-RETURN / W返回首页选择范围|非法target保明确URL和错误，主动回home纠错|catalog ready后验证；error无静默all|peer PS14/15 PASS；真实NV|
|LIBRARY-AFFECTED:{scope/filter/clear/mode/stock/episode} / TradeLibrary实际入口|按到达后AX逐个展开，execution-list含open且不截复盘账本；stats仍close-date|普通来源无queue；保显式pending/sim旧义|library模型+相邻3例PASS；真实全集NV|
|REVIEW-AFFECTED:{save,return,retry,guard-action} / 既有复盘真实入口|用户主动选episode后真实保存→返回→重读→reload；失败/取消留输入|每个guard动作、保存状态分别登记|Workspace3FAIL保留；真实写流NV|
|BROWSER-HISTORY:{back,forward,reload,direct} / 地址及浏览器控件|known hpIndex先真实补偿pop再guard；cancel地址/source不变；目标URL权威|前/中/后URL、页面、scroll与owned bundle；非DOM伪点击|owner补偿事件测试PASS；peer unindexed PS04 PASS；真实浏览器NV|
|EXPLANATION:{navigation-close,drawing-retry} / W已有条件提示|既有导航提示关闭/复盘状态重试，按实际出现逐个登记|错误/修复入口不可因首页替换丢失|真实NV|

只读几何另验：首页标题、截至时间、C inline标签+金额/币种/正号、48/40/48×8/48表格预算、固定空槽、计数=行数与unique标的数、详情证据与缺失原因、P2/P4明确未接入占位。旧底部状态条在首页隐藏的局部规则与其他页面保留分别比对。

## 当前执行记录与分母

本owner真实浏览器操作数为0；鼠标、键盘、emulated touch、physical touch、before/during/after rect及独立同态看图全部NOT VERIFIED。不能拿组件合成事件/只读源码、175/24自动测试或peer15探针当点击覆盖。root应从真实DOM/AX导出account、所有页account+episode、所有值/条件入口和下游已渲染控件的实例集合，再记录执行分母及逐实例结果；本文不填伪百分比。上述两个源码缺失动作保留FAIL；3个回归FAIL及完整不确定性见IMPLEMENTATION-READY-1.md。

独立state peer冻结复验：15/15 PASS，仅jsdom owned read/URL适配边界，见resume-2026-10-23/P1-state-peer/FROZEN-ROUND-1.md。未替代真实数据、浏览器history、持久化、视觉；M01 broad metadata merge旁路仍独立待修。F completed-session截点依赖重开，不能用此前F接受覆盖。
