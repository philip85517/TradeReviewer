# 视觉规范样板 · 接受记录

状态：已形成可评审规范和可逆样板；已验证的旅程与视觉比较局部PASS，完整交互接受仍有NOT VERIFIED。范围为本轮样板，不是生产UI推广或100%控件通过。功能、状态安全/持久化、视觉比较分别记录，FAIL/NOT VERIFIED不相互抵消；总体任务票保持open，不能据局部通过关闭完整UI接受。

## 触发、范围与来源

用户要求主动检查策略台、中文暗色视觉、TradingView参考、真实组件样板、完整阶段与来源、运行测量与较窄窗口；因此触发前端控制与视觉空间审计。遵循用户给定AGENTS、当前远端development/task-decomposition/UI模板/issue流程；远端checkpoint缺少frontend-control-audit文件，读取`origin/master@7a5d137:docs/agents/frontend-control-audit.md`并沿用其版本覆盖和独立接受规则。

基础是`origin/codex/strategy-workbench-v1-design@9c2b3d209a202422c3d5aeab5969a9b093cfda92`，工作分支`codex/strategy-visual-system-20261008`。f42e未提交草稿未被改动。批准来源为：

- `docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md` IF05/IF06。
- `.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md`。
- `docs/specs/2026-09-25-chart-first-review-ui-elements.md` E01–E22。
- `docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`、`04-holding-stage.png`、`05-final-review.png`、`07-interaction-states.png`。
- `.scratch/strategy-portfolio-backtesting/references/2026-09-30-round1-tradingview-reference.png`。这张含浏览器外框的参考图不作为CSS尺寸实测。

“设计规范启动包”未在本次可访问附件/项目资料中定位，专项符合性**NOT VERIFIED**。采用上述实际批准资料继续工作，不声称阅读了缺失资料。

## 环境与版本绑定

本机macOS、Codex in-app browser、DPR1。运行Node26.0.0，LWC5.2.0、原生RecallWorkspace/ReplayChart/DrawingCanvas。业务数据库路径仍为`conf/runtime.json`的绝对路径；浏览器服务显式覆盖到`.data/strategy-visual-acceptance.sqlite`，它是通过SQLite在线backup获得的独立副本。样板合成行情及独立`trade-review:prototype:recall:v1`键保存计划/批注/评价；图表设置由SQLite HTTP client GET权威配置，不PUT设置、不写SQL。

服务：基线静态3068；样板服务3069。3069由`scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1`启动。标准开发3333被其他服务占用，本轮按自动接受的隔离数据库/显式空闲端口例外操作。未停止其他服务、推送、合并或发布。

源文件与最终截图的SHA256、尺寸、用途以及排除证据见[版本清单](../../../.scratch/strategy-visual-system-20261008/evidence/version-manifest.json)。旧截图保留，不用于冒充最终证据。特别排除`native-review-current-900.jpg`、`workbench-before-running-1440-fresh.jpg`的未稳定视口；`workbench-final-running-1440.jpg`是在1280装载后放到1440，其图范围与基线不同，只作过程记录。正式前后使用`before-running-1440-confirmed`和最终冻结版`workbench-review-final-running-1440`；`final-running-range-1440`亦是同范围复验。新tab默认1280装载的`workbench-review-transient-1280-excluded`排除。

## 策略台控制覆盖

完整scoped inventory按源ID和条件集合记录。日期集合随场景/模式变化，不把一个日期测试当170项测试；实测覆盖T0、运行、回看、完成、loading、error、长中文，以及observe/results/compare/event四种投影。

|控件/集合|检查与结果|证据/边界|
|---|---|---|
|rail 工作台/策略库/实验、listBtn|导航占位；业务导航NOT VERIFIED|样板明确未接入，200px展开导航未实施|
|portfolioSelect|长文场景6选项、选第6项、完整名称title、1440/1280布局PASS|比较模型仍3个组合，不声称六组合真实计算|
|configBtn/modalClose/modalCancel|完整只读版本/中文配置、关闭、Escape与返回焦点PASS|浏览器实际操作|
|prototypeBtn/aboutBtn/aboutScenario、视觉/复盘链接|场景与模式入口检查；页面公开标合成/刷新重置|七场景；baseline是同数据样式对照|
|模式tab observe/results/compare|切换、不同截止、共同截止与失败身份保留PASS|compare/event截图及DOM|
|overlayBtn/closeInspect/inspect三tab|概览/调仓/统计、关闭/打开PASS|固定320检查区不迁移框架|
|navyBtn/candleBtn|净值/K线切换、OHLC与可见日期PASS|真实LWC，不是mock图|
|zoomBtn、LWC拖动/缩放/Tooltip|视野说明PASS；实际wheel/拖动/Tooltip NOT VERIFIED|源码按可知序列过滤；不把说明按钮当缩放证据|
|prevBtn/dateSelect/latestBtn|回看禁推进、回到最新恢复；compare仅4日期、event仅3日期PASS|修复过event日期170项泄漏，终版projected图保留|
|playBtn/stepBtn/speedSelect|T0逐日可见bar；Jun18→Jun19；2x播放/暂停到Jul5 PASS|实际图/状态；结束态禁用PASS|
|moreBtn/expandBtn/cancelExpandBtn|展开前二次确认入口、取消不变截止PASS|最终确认展开未执行，NOT VERIFIED|
|事件行/nextEventBtn/closeEventBtn/returnSourceBtn/headerReturn|Jun18事件真实定位、权重/费用完整、关闭仍停事件日、返回来源PASS|事件原数据不省略|
|detailBtn/collapseDetail|完整指标/PnL/费用与比较口径展开/收起PASS|价格、费用、正负号完整|
|lastGoodBtn/retryBtn/excludeBtn|最后完整日Jun19、重试仍失败原因、排除仍保留身份PASS|error图是重试后状态|
|所有可见button/select状态|36px/13px/20px/500，selected与disabled、Tab焦点实测PASS|hover/active源码对比计算；真实hover/active NOT VERIFIED|

## 原生复盘 E01–E22 覆盖

精确元素规格来源统一为`docs/specs/2026-09-25-chart-first-review-ui-elements.md`第5节；每行对应的批准图为02/S0、04/S1、05/S2、07/交互状态。实现owner为recall Luna（TS/仓储/阶段），CSS Luna（作用域视觉）；root整页与持久化独立接受，design_audit直接图像比较。生产默认行为不由本轮样板测试替代。

|ID/范围|旅程/样板接受状态|证据/例外|
|---|---|---|
|E01 顶栏|1440/1280/900/390名称/来源可读PASS；修正来源残字|本地数据桌面93×36、390为93×44；部分工具/周期31×36登记例外；禁用周期仅日线|
|E02 阶段|S0→下一决策→S1真实bar/成交；返回S0双截止|阶段/行情/成交完整紧邻图，截图+DOM|
|E03 绘图工具|文字创建/多行提交；选中/焦点；其他工具存在|趋势/通道/RR完整绘制与拖动NOT VERIFIED|
|E04 图表|S0未知bar不显示；S1逐根OHLC更新|真实LWC截图；Tooltip/wheel未来检查NOT VERIFIED|
|E05 轴/标签|56/52/68保留；真实Tab入场标签2px焦点、点击止损定位52输入PASS；390完整角色读数S0/S1/S2 PASS|透明命中112×36；原390同值角色遮挡FAIL保留，最终正常流补完整计划名/值与阶段已知实际角色；图内marker仍可能被全文遮挡，拖动/触摸NOT VERIFIED|
|E06 计划线|与52→51.5实际输入同步；虚线金色区别实际|持久化截图；做空方向NOT VERIFIED|
|E07 成交|首次推进买1000@56、列表0→1；关网格/量/成交再恢复PASS|SQLite设置GET；关成交去实际买标签、计划仍在；不写设置|
|E08 Text|多行原判断/S1补充、真实新增文字并提交|图上全文；IME/拖动/编辑全流程NOT VERIFIED|
|E09 侧栏|关闭计划/底部计划侧栏重开PASS|root实际点击；专注布局全部旅程NOT VERIFIED|
|E10 价格输入|52→51.5修改、风险4000→4500、保存/返回/刷新PASS|只读原始留存，原文不被自动改写|
|E11 规模|数量/名义/仓位入口及单一主输入|换算/取整/未知资本所有边界NOT VERIFIED|
|E12 资本|完整20万元与来源/时点保留|原始留存只读摘要，手填参考并非账户净值|
|E13 派生指标|3R/3:1与≈2.666667R完整精度入口|持久化截图和DOM；精度不隐藏|
|E14 S1原计划|只读原计划、当前持仓/浮盈亏，不含最终结果|March2行情/March1成交分开，已知成交1笔|
|E15 S2摘要|实际S2完整3笔、持仓0、净6800 CNY PASS|行情Apr10/成交Mar15分别截止；原判断与S1补充保留|
|E16 退出决策|下一笔依次Mar1/Mar9/Mar15，持仓1000→400→0 PASS|真实目标bar可见；S2需点击事后复盘，不把清仓写成自动切S2|
|E17/E18 退出评价|退出2@61、按计划/计划内分批→保存→S0→刷新→S2仍保留PASS|刷新DOM；所有标签/关联图证/判断组合NOT VERIFIED|
|E19 回放|下一barMar2/成交仍Mar1；真实播放→暂停Mar9、OHLC/qty400变化PASS|真实LWC；图层选中浮层遮阶段尾部/上轴登记，文字编辑全状态未验|
|E20 保存|独立仓储实际保存→阶段返回→刷新PASS|SQL生产、浏览器受阻存储UI失败NOT VERIFIED；受阻仓储unit test通过|
|E21 导出|入口保留；生成文件与未来过滤NOT VERIFIED|不称三阶段导出通过|
|E22 记录/快照|未知决策0→1、留存快照与更多列表PASS|最终完整历史入口与返回待记录|

## 独立与综合接受

- 根协调者直接浏览器操作、截图实看、计算与源码审核；不是仅接受worker报告。
- 独立设计审核：[visual-acceptance.md](../../../.scratch/strategy-visual-system-20261008/reports/visual-acceptance.md)。策略台1440/1280、1301/1299与批准固定框架对照局部PASS；900/390横滚明确为未适配。原生阶段/长文/窄屏直接图像比较及修复记录在报告；最终390三阶段完整价格角色由未实现该UI的design_audit直接看图，按实际源码绑定局部PASS。桌面fit/focus与窄屏回放初始位置回归另行保留，不沿用旧静态截图接受。
- 技术：root独立最终`npm run typecheck` PASS，9文件193项相关测试PASS（35.05s），包括仓储/设置/投影与新增S0成本屏蔽、S1成本角色、S2清仓、baseline无节点4项。前一轮8文件189项及样板6项通过证据保留；diff检查PASS。本轮不为CSS数值编写镜像测试。[根代理验证摘要](../../../.scratch/strategy-visual-system-20261008/evidence/root-verification.txt)记录命令、结果与未重跑边界。
- 全量历史运行：293文件，31测试失败/2694通过/6跳过（5失败文件）。本轮settings运行时import边界回归已修正；持仓日期、storage DOM等待失败在干净9c归档同样复现；refresh7、deploy58、主workspace79隔离复跑通过。并行资源争用只属原因推断；未重跑全量，不声称全量通过。见[test-failure-audit.md](../../../.scratch/strategy-visual-system-20261008/reports/test-failure-audit.md)。
- 字体加载、computed链已测；逐汉字glyph/Windows、真实hover/active、物理触摸、模拟触摸、实际wheel/Tooltip、生产SQL链路仍分别NOT VERIFIED。

## 代表画面与取舍

- 策略台同running/Jun18范围前后：[前](../../../.scratch/strategy-visual-system-20261008/evidence/workbench-before-running-1440-confirmed.jpg)、[后](../../../.scratch/strategy-visual-system-20261008/evidence/workbench-review-final-running-1440.jpg)。
- 复盘同fixture、S0、1440×900、实际“适应全部”后的同日期范围样式对照：[基线](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-baseline-s0-1440.jpg)、[推荐](../../../.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-s0-1440.jpg)。baseline含双方共享的阶段安全seam；基线内部scroll21使阶段行被裁，这是保留的失败现象。原生产页面新截图为native-review-current-1440，不能把fixture对照叫未经修改的生产原图。旧comparison-baseline/recommended未fit时图范围不同，排除正式前后比较。
- 修复后桌面：[S0](../../../.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-s0-1440.jpg)、[S1](../../../.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-s1-1440.jpg)、[S2原判断与S1补充](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-s2-1440.jpg)。旧accepted-s1-1440与comparison-fit-recommended两个scroll0图仍是祖先scroll28的FAIL，不能用于完整阶段PASS。
- [实际键盘焦点](../../../.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-price-focus-1440.jpg)、[900全文复验](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-900-full.jpg)、[390完整角色与回放复验](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390-full.jpg)。桌面实际Tab命中112×36、outline2/offset2，阶段y139高28，shell clientHeight=scrollHeight=674、scrollTop0，图782×646；S1/S2因底部内容高度不同，图高随可用空间变化。900图822×480、390图328×720，无页面横滚；390旧横滚行的主要动作在初始位置仍右裁，历史FAIL保留。最终67e CSS下未点击的六控件正常换行，宽356/clientWidth=scrollWidth、高94px、各44px，均在页面横向边界内；[实测JSON](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390.json)与[实际推进Mar9/持仓400](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-action-390-full.jpg)分别支持静止可辨和功能。
- 390完整价格角色：[S0尚未揭示](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s0-390-full.jpg)、[S1计划56与实际成本56 CNY](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s1-390-full.jpg)、[S2清仓与双截止](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s2-390-full.jpg)。三阶段角色证据绑定ad14 CSS/3fd workspace；后续桌面flex与回放wrap未改≤600角色样式，67e的S1另实测复验。最终S0/S1/focus桌面截图绑定67e；S2/900证据绑定f41e，最后改动仅≤600回放，不把旧图称作67e重拍。900/1440角色区display:none，不能沿用旧696图高作为flex修复后尺寸。
- ≤1330按内容下移计划/chart480；≤600 chart720/页面纵向阅读完整中文。这是最新用户授权探索，与旧200–240趋势区/列表自身滚动的合同有差异，不能标旧布局忠实PASS。
- A最低宽1100，900/390横滚；54导航实施、200展开导航未实施。Windows glyph、真实hover/active、Tooltip/wheel/拖动、模拟/物理触摸、生产SQL保存、导出文件NOT VERIFIED；live Canvas400而canonical capture600是导出一致性缺口。
- 只提供一套推荐系统的两个业务上下文。用户评审焦点、桌面密度、中文阅读感、窄屏长页面及操作辨认，不需要先指定字号/圆角。

## 启动与预览

运行中的推荐策略台：[3069工作台](http://127.0.0.1:3069/design-system-20261008/workbench/index.html?scenario=running)。推荐复盘：[3069原生复盘](http://127.0.0.1:3069/?prototype=review-design&mode=recommended)。复盘基线将mode换为baseline；同一浏览器key固定数据，比较前可用“重置样板”。

服务仍运行时无需重启。之后在该工作树用Node26启动；先对`conf/runtime.json`中的业务库做WAL-aware SQLite在线backup到新的测试文件（不可覆盖正在运行的库），然后显式传入测试路径：

```sh
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" \
WRANGLER_LOG_PATH=.wrangler/strategy-visual.log \
PATH="/usr/local/Cellar/node/26.0.0/bin:$PWD/node_modules/.bin:$PATH" \
node scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1
```

3069占用时先确认是否本轮服务；端口冲突不得回落业务数据库或自动换端口。标准`make dev/npm run dev`使用3333在线备份方案属于当前用户工作流，但这个远端checkpoint尚无完整最新native配置；本轮命令明确Node/端口/隔离数据库。

## 后续：完整 Workbench 视图恢复

用户指出丰富动态切面未展示，新增开发专用完整观察/结果/比较直达和当前A“全部视图”导览。独立范围、真实截图、原创建与T0/播放/来源恢复证据、最终源码身份、已修历史FAIL、全仓lint仍FAIL和启动方式见 [full-workbench-preview.md](full-workbench-preview.md)。本段不重写上述历史接受，不关闭整体票，不声称完整旧分析已融合进A。
