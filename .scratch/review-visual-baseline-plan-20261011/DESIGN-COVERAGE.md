# 设计覆盖矩阵：TradeReview 视觉基线开发与验收路线

本矩阵是派发前的完整范围登记，初始状态全部为 `NOT VERIFIED`。它把当前视觉契约、用户旅程、状态和控件入口映射到任务及证据位置；实现票通过后必须把结果回填到同一行，不能用“组件已存在”代替交互或视觉验收。

## 版本与参考条件

|字段|本路线基线|
|---|---|
|版本|`39b97e7c`（2026-10-10 视觉归档）|
|服务/预览|`http://127.0.0.1:3046/design/review`；最终实现必须新鲜启动并重新检查|
|视口|`1440×900`、`1280×800`、约 `390px`；另测导航展开态。截图像素与 CSS 视口分开记录|
|阶段|S0 入场前、S1 持仓中、S2 退出后；每个阶段同时记录市场截止和成交截止|
|数据|合成样板/真实图表状态；写入型浏览器检查显式设置 `TRADEREVIEW_DB_PATH` 隔离库|
|证据状态|历史截图只作基线；新结论必须对应最终内容指纹、服务、数据、视口和动作证据|
|排除|真实 IME、软件键盘、物理触控、系统原生光标逐帧暂为 `NOT VERIFIED`，不计入 PASS 分子|

## 覆盖登记

|需求/规格|elementID / 控件范围|准确参考|阶段/状态|任务与 owner|交付/观察|浏览器动作与反例|证据位置|初始结论|
|---|---|---|---|---|---|---|---|---|
|V01 图表优先与紧凑框架；顶部不吞图表空间|`review.workspace`, `review.header`, `review.chart`|[视觉基线 README](../../docs/design-system/versions/2026-10-10/README.md)；E149/E146|S0/S1/S2；normal|紧凑布局票；实现 owner 待派发，root 集成|顶部、图表、页下游 rect 与同态截图|打开/刷新/切阶段；反例：顶部回流、图表被无故压缩|[CONTROL-ACCEPTANCE.md](../../docs/design-system/versions/2026-10-10/CONTROL-ACCEPTANCE.md)；新报告待填|NOT VERIFIED|
|V02 左、右收缩入口贴对应侧，状态可逆|`review.left-panel-toggle`, `review.right-panel-toggle`|视觉基线固化范围；E149|S0/S1/S2；open/closed/focus|紧凑布局票；root 复核|左右面板宽度、按钮位置、焦点、图表可用宽度|真实点击、键盘焦点、Escape/再开；反例：按钮跑到另一侧或穿透图表|`CONTROL-AUDIT-SCOPE.md`、新几何 JSON|NOT VERIFIED|
|V03 底部执行控件居中且紧凑，图标仍可识别|`review.execution-dock`, `review.execution-action.*`|视觉基线 README；用户 TradingView 对照图|S0/S1/S2；normal/hover/selected/disabled|紧凑布局票；root 复核|图标组中心线、命中区、间距、键盘可达性|点击/Tab/Enter/Escape；反例：大按钮块、底部动作移出视口|新截图+rect+控件登记|NOT VERIFIED|
|V04 阶段与市场/成交截止永远可见且不泄露未来|`review.phase`, `review.market-cutoff`, `review.execution-cutoff`|[STATE-TRANSITIONS.md](STATE-TRANSITIONS.md)；design-contract 规则 8|S0/S1/S2；normal/early/future-review|基线契约票、真实旅程票；root|阶段标题、截止值、可见 K 线/成交/未来来源|下一根/播放/下一决策/回看；反例：提前显示买入、退出或最终盈亏|状态日志+同态截图|NOT VERIFIED|
|V05 计划、实际成交、原判断、当前补充和复盘补记有来源区分|`review.plan`, `review.execution`, `review.original-judgment`, `review.supplement`, `review.post-review-note`|视觉基线 README；design-contract 规则 8|S0/S1/S2；normal/longtext|基线契约票；root|标签、颜色和文案来源一致，固定评论不被缩短|切阶段、展开笔记、长中文；反例：把补记渲染成当时已知信息|新截图+文案断言|NOT VERIFIED|
|V06 Text 先价格/bar 锚点，再放文字框，连线动态预览|`drawing.text-tool`, `drawing.text-anchor`, `drawing.text-connector`, `drawing.text-box`|design-contract 规则 3–4；E133/E132|S0/S1/S2；create/preview/placed/edit|Text/绘图票；绘图 owner 待派发|锚点价格和 bar 时间准确，框与锚点可分开移动|点锚点→移动预览→第二点/释放→编辑；反例：点击直接生成突兀孤框或无法关闭|新鲜浏览器操作日志+before/during/after 截图|NOT VERIFIED|
|V07 Text 普通/选中/展开/编辑/取消不重排正文，保留完整长文|`drawing.text-body`, `drawing.text-chevron`, `drawing.text-editor`|design-contract 规则 4；E132|S0/S1/S2；normal/selected/expanded/editing/cancel/longtext|Text/绘图票；独立视觉 owner|14px/1.5 候选值实测；正文宽度与换行稳定，折叠目标≥24/44 CSS px|点击、拖动、Chevron、Escape、编辑再保存；反例：选中后缩字、重复正文、按钮挤压|同态截图+rect+状态日志|NOT VERIFIED|
|V08 双点工具先第一点和动态预览，第二点确认；Esc/切工具/零长度安全|`drawing.line`, `drawing.trend`, `drawing.channel`, `drawing.risk-reward`|design-contract 规则 1–2；E140/E133|S0/S1/S2；idle/first-point/preview/committed/cancel|Text/绘图票；root|释放/第二点只提交一次；<3px 不落零长度；通道先基线再宽度|按住拖放、单击两点、Esc、切工具；反例：首击无反馈、线突然出现、重复历史命令|动作视频/截图+history 计数|NOT VERIFIED|
|V09 线段和文字选中有短确认动效、持久轮廓、合法手柄和正确光标|`drawing.selection`, `drawing.handles`, `drawing.cursor`|design-contract 规则 5、7；E140/E142|S0/S1/S2；selected/dragging/cancel|Text/绘图票、前端控件审计票；独立视觉 owner|8px 可见柄、24/44 hit target、move/grabbing/ns-resize/ew-resize 对应作用域|点击前/中/后、拖动中、释放、取消；反例：点中不知是否生效、误选相邻对象、光标不变|before/during/after 截图+几何+光标记录|NOT VERIFIED|
|V10 风险/回撤/标签密集情况下保留价格、比例、风险百分比并避让手柄|`drawing.risk-label`, `drawing.price-label`, `drawing.dense-label-group`|design-contract 规则 7；E142|S0/S1/S2；normal/selected/longvalue/dense|Text/绘图票；独立视觉 owner|新建盈亏比默认1:1，旧自定义值不变；标签不截断重要值|选中/拖动/窄屏/长数值；反例：用圆柄代替箭头、把价格或比例藏掉|对照截图+文本/数值断言|NOT VERIFIED|
|V11 更多工具浮层在视口内，7 项可达，外点/Esc 关闭并还焦点|`drawing.more-menu`, `drawing.tool-option.*`|design-contract 规则 6；基线工具栏证据|S0/S1/S2；closed/open/focus|Text/绘图票；root|不被 overflow 裁切、不穿透画布、不改变图表游标|真实打开、选择、Tab、外点、Esc；反例：工具不可见、焦点丢失|控件登记+截图+键盘日志|NOT VERIFIED|
|V12 选择/hover/动画/preview 不持久化；完成动作保存一条历史|`review.save`, `review.leave-guard`, `review.reload`|design-contract 规则 8；E146|S0/S1/S2；saved/dirty/error/retry|公共组件与数据闭环票；root|保存→返回→重开→刷新后正文、几何、阶段和派生值一致|正常保存、失败/冲突、离页、显式重载；反例：mock callback 成功但 reload 丢数据|隔离库摘要+返回/reload 截图|NOT VERIFIED|
|V13 最小真实图表旅程揭示目标 bar/成交，不能只变游标|`review.replay-next-bar`, `review.replay-play`, `review.next-decision`, `review.restore-stage`|开发流程状态要求；[STATE-TRANSITIONS.md](STATE-TRANSITIONS.md)|S0→S1→S2；early/end/no-next|真实旅程票；root|推进后真实主图出现新 K 线/成交/时间轴，末尾有原因和下一步|真实点击/暂停/回看早期/刷新；反例：只更新 mock 状态、图表不变|视频/截图+状态日志|NOT VERIFIED|
|V14 响应式和窄窗口不删关键判断，不把桌面窄屏冒充手机键盘|`review.responsive`, `review.longtext`, `review.keyboard`|基线 README；前端审计规范|1440/1280/≈390；导航展开；longtext/empty/error|紧凑布局票、独立验收票；独立视觉 owner|长中文、长价格、空/错误状态有明确滚动和动作可达性|两侧断点、软件键盘单独记录；反例：隐藏评论/价格或意外撑大图表|同态截图+空间测量|NOT VERIFIED|
|V15 视觉验收必须与功能和状态链分开，由非实现者复核|全范围登记及 `E*` 证据|前端控件与视觉空间审计标准；独立三门验收票|最终版本；所有适用状态|独立验收票；root 组织、独立复核者执行|功能、端到端/数据、视觉三门分别 PASS/FAIL/NV|同视口同阶段并排/叠图；反例：单测/HTTP 200 被当作视觉通过|最终 `FINAL-ACCEPTANCE`、审计表、manifest|NOT VERIFIED|

## 交付映射

- 规则和阶段矩阵：`01-baseline-contract-and-coverage.md`、`STATE-TRANSITIONS.md`。
- 真实图表状态门槛：`02-real-chart-journey-gate.md`。
- 顶部/左右/底部与断点：`03-compact-layout-budget.md`。
- Text、价格锚点、线段、选中反馈和游标：`04-text-anchor-drawing-contract.md`。
- 公共主题/组件、保存/返回/刷新：`05-public-component-promotion.md`。
- 最终控件全集、三门结果和放行：`06-independent-acceptance-package.md`。

## 回填规则

每次回归保留旧证据和旧结论，追加 `版本、数据、视口、动作、actual、证据、PASS/FAIL/NOT VERIFIED`。`NOT VERIFIED` 不能计入覆盖分子；功能通过不能覆盖视觉或状态链失败。视觉改动涉及的相邻上下游控件必须重新登记。

## 2026-10-11 实现回填

本次实现以 commit `d1fc0e6f` 为最终源码基线，浏览器使用新启动的本工作树服务和隔离库路径，在 `1280×720`、DPR 2 下完成了框架、回放、Text、线段和盈亏比的鼠标/键盘检查。详细证据见 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)。

|ID|最终回填|证据|
|---|---|---|
|V01|PASS（1280 桌面）；1440/390 NOT VERIFIED|顶部 `48px`、图表优先截图和几何|
|V02|PASS|左右入口实际收缩/重开，入口分别贴左/右边缘|
|V03|PASS（1280 桌面）|五个 `36×36` 图标按钮，组中心 `x=750`，Tab 焦点可见|
|V04|PARTIAL / NOT VERIFIED|下一根与下一笔决策揭示截止；全阶段和刷新未完成|
|V05|PARTIAL / NOT VERIFIED|原计划、当前执行、原判断可见；完整长内容闭环未完成|
|V06|PASS|Text 先锚定 `53.78 + 2026-01-20T00:00:00.000Z`，再放框，连接线保留|
|V07|PASS（鼠标桌面）|两行中文编辑、完成/取消、正文框移动与 Escape|
|V08|PASS（本轮覆盖工具）|横线、趋势线、RR 释放前动态预览；其余工具未逐个覆盖|
|V09|PASS（鼠标/键盘桌面）|选择轮廓、端点、move/ns-resize、焦点 ring、取消|
|V10|PASS（RR 创建态）；密集窄屏 NOT VERIFIED|新建显示 `1.00R`，拖动入场柄后数值动态变化|
|V11|NOT VERIFIED|更多工具浮层完整键盘/外点流程未逐项记录|
|V12|NOT VERIFIED|真实保存→返回→重开→刷新未完成；mock 旅程不能替代|
|V13|PARTIAL|真实下一根/下一笔决策已观察；连续播放和刷新未完成|
|V14|NOT VERIFIED|1440/390、触摸、IME、原生光标未覆盖|
|V15|PASS（记录纪律）|功能、状态/数据、视觉门槛分开，未验证项保留|
