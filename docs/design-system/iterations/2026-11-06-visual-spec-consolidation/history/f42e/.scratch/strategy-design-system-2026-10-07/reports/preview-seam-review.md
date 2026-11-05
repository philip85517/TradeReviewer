# 推荐样板 opt-in 接口独立源码审查

日期：2026-10-07。审查者：preview_seam_review（未实现本轮 UI）。状态：**源码范围已审；整页验收未签署**。

本报告只读检查本轮 development-only 接入和共享组件参数，不操作浏览器、不访问业务数据库、不修改源码、不提交。已读任务 README、DESIGN-COVERAGE、01-native-design-sample 和设计规范草案。实现者报告完成后及 root 宣告 FROZEN/READY 后分别重读最终 diff，并复核外置实际 OHLC、全文证据位置、桌面折叠行为和最后小范围修订（受控 summary、≤1100px 三行头部、计划字段边界与标签、body 滚动、中宽壳高度及 More 展开自然流）；以下保留初审问题与冻结版本的关闭依据，root 负责最终画面复核。最终 source scope 为 `app/page.tsx`、`ReplayChart`、`DrawingCanvas`、`RecallWorkspace` 与 `app/components/design-prototype/*`；本审查没有接受或覆盖工作区其他历史改动。

## 生产默认兼容性

|检查|源码结果|依据与限度|
|---|---|---|
|开发入口|PASS（源码）|`app/page.tsx` 的 review-design 条件包含 `NODE_ENV !== "production"`；普通入口仍返回原 TradeReviewWorkspace。导入本身仍会进入构建依赖，不能据此宣称样板完全不在生产 bundle 中。|
|CSS 影响范围|PASS（源码）|组件规则以 `.design-prototype` 开始，推荐覆写以 `[data-mode="recommended"]` 约束；最终新增 body 滚动例外为 `body:has(.design-prototype[data-mode="recommended"])`，只在推荐样板 DOM 存在时命中。未发现普通正式页面或 baseline 即可命中的推荐覆写。|
|RecallWorkspace 默认调用|PASS（源码）|`designPreview` 可选；未传入时 `visibleDecisions === document.decisions`，成交统计保留旧全量分母和原数字语义，短截止保留旧文本，不渲染新 context 和 Text 原文 JSX。新增 save class 没有正式 CSS 命中；新 Text evidence effect 在未 opt-in 时直接返回。默认阶段、回放、保存逻辑没有被此 diff 改写。|
|ReplayChart 默认布局|PASS（源码）|fontFamily/fontSize 仅在显式值存在时追加；未传参不会覆盖 LWC 既有默认。新增 effect 依赖是两个 primitive 可选值，普通调用均稳定为 undefined。最后新增外置 OHLC 仅在 designPreview 存在时渲染；未传参仍渲染原 chart-stage 内 chart-ohlc，Fragment 不增加 DOM 包装。|
|DrawingCanvas 默认字重|PASS（源码）|paintDrawingScene 参数默认仍 600；编辑 textarea 只有显式 textFontWeight 才追加 fontWeight，没有覆盖原有默认编辑样式。原先 root 发现的 textarea 默认覆盖已修复，不重复作为未修问题。|
|Text 几何|PASS（源码）|`app/lib/chart/text-geometry.ts` 无 git diff；14px 默认文本仍按 21px 行高、原始宽度/锚点和原换行估算。样板 paint 400 与默认 600 的字体度量差异仍需真实画面校准。|
|参数调用者|PASS（源码）|检索全部 app TSX，只发现 RecallDesignPrototype 对推荐模式传入参数；baseline 为 undefined，其余正式入口未启用。|

生产默认兼容性结论只覆盖改动分支的源码可见差异。未运行正式页面回归、键盘/触控、截图比较或构建，不能给这些门槛签 PASS。

## 完整 fixture 与安全投影

两种 mode 调用同一个 makeFixture，均保留 96 根合成日 K、首笔买入 1000 股、减仓 600 股、最终退出 400 股，以及同一计划价格/数量/资金和两段完整 Text。推荐没有删减未来数据以掩盖投影问题。fixture 通过显式传入的内存 repository structuredClone 保存，刷新重置已明确写入横幅。该 repository 的 load/fetch/save 均为内存方法，没有网络或数据库调用；RecallWorkspace 保存/载入均走传入 repository，默认 createRecallRepository 在创建时只构造函数、不立即 fetch。本结论是源码依赖审查，浏览器请求和数据库保护核对由 root 负责。

`safeStageProjection` 改变决策导航已知集合、导航数量、统计分母、未揭示统计语义、可见截止格式和新增 context。已知集合取当前 `chartExecutions` ID，另允许首个开仓决策作为 S0 当前计划占位；不修改三笔成交、原判断、计划、原生 `visibleDrawings`、回放与阶段数据。对于本 fixture，当前首笔计划可达；随真实成交揭示，相应导航条目可出现。完整历史主动揭示时其 chartExecutions 投影自然完整。此处 **PASS（源码）** 不证明原生图表实际揭示。

未发现本轮新增代码提前把未来成交价格/数量显示在导航标题，或重新计算最终盈亏到 S0。以下已有路径需 root 实测，不宜把参数名理解为“整页未来安全已通过”：

- 全部记录与快照仍迭代 document.snapshots；三阶段代表图和已有全局留存也没有新增截止过滤。用户已主动看过后续后返回 S0，这些历史留存应可以对照，同时未来信息/补记来源必须明确。原生 editSnapshot 有判断更晚行情/成交并设置 hasSeenFuture 的源码；列表、图像和返回后新增/改 Text 的实际结果仍 **NOT VERIFIED**。
- 初审 S0 统计零值语义问题已 **RESOLVED（源码）**：最终候选增加 `previewMetricsPending = safeStageProjection === true && chartExecutions.length === 0`；推荐态的持仓、平均成本、净盈亏、费用显示“待揭示”，取消盈亏色。已揭示成交显示实际已知数量且无未来分母。未传参数仍保留正式路径旧行为。浏览器最终显示仍由 root 检查。
- safe 导航重排后的 index 来源是过滤数组。当前 fixture 连续按执行顺序揭示，序号一致；合并/非连续决策再返回早期等通用场景仍未验证，未来公共固化不应直接复制该样板接口当作全域投影实现。
- 完整 fixture 属合成日历日数据，不能据此证明真实交易日、停牌、跨时区、多成交同 K 或真实行情源的安全。没有发现样板冒充真实行情的文字。

## 冻结版本复核与初审问题关闭

1. **保存 hover/active 覆盖已 RESOLVED（源码）。** 初审 normal 已为 secondary，但 hover/active 被通用 primary 覆盖。冻结版本为通用 primary 的 hover/active 增加 `:not(.recall-save-action)`，并给 save 显式 secondary hover 与 active；保存和更新快照都带 `recall-save-action`。源码上不再参与主动作蓝的 hover/active。浏览器 computed 与画面仍由 root 记录。
2. **粗指针条件及方形范围已 RESOLVED（源码）。** 冻结版本保留 `@media (pointer: coarse)` 的控件 min-height44，另为 recall-icon-button、chart-toolbar icon-button、local-data-badge 和 drawing-toolbar 直接 button 显式 width/min-width/height44。初审缺少条件及 36×44 的问题均已修。浏览器模拟与物理触控分别仍 NOT VERIFIED。
3. **新 context 编辑快照阶段依赖已 RESOLVED（源码）。** 冻结版本新增 `previewPhase = editingSnapshotId ? sidebarPhase : phase`，编辑时使用来自 retained bundle captureContext / viewedSnapshot 的真实 sidebarPhase；完整历史仅在未编辑快照时取事后复盘标签。已有 provenance 在编辑时明确“正在编辑已留存快照”。新 context 不再把工作区 S0 静态套到 S2 快照。实际 S0→S2 快照→返回旅程仍由 root 检查。
4. **阶段/截止共同可扫读仍需画面。** 新 context 已将阶段和完整 `YYYY-MM-DD HH:mm:ss · Asia/Shanghai` 放在同组；完整日期/时区源码符合。长度、窄屏换行、与原阶段控件之间的视觉关系及主要动作可达须由截图/实测验收。

上述三项仅在重新读取冻结源码后关闭，未凭实施者说明签 PASS。其对应浏览器状态不由本报告代签。

## 新增同源 Text 原文审查

**PASS（源码范围）。** 推荐 Text evidence 的 JSX 由 `designPreview?.safeStageProjection` 显式守卫；未传 preview 的正式调用和 baseline 不出现新增原文区。新的 state/useMemo 在正式路径不改变已有业务 state；matchMedia effect 在未 opt-in 时不注册监听，推荐时按 max-width900 展开/收起并清理监听。

原文数据严格来自现有 `visibleDrawings`，然后仅筛 Text 且非 hidden；没有读取 document 全量 Text 或 fixture 常量绕过截止。现有 visibleDrawingsAtCursor 已按 `createdAtCursor <= replay.cursor`、当前 timeframe 与 hidden 过滤；新原文区与当前图层/绘图共享投影，不能提前显示 holdingSupplement。真实渲染与返回早期是否一致，仍属浏览器门槛。

每条原文按真实 drawing.stage 分组；`data-drawing-id`、`data-drawing-stage` 保留真实 ID 和阶段作为证据。全文直接读取 drawing.text，以 pre-wrap/overflow-wrap 显示，不替换、截短或改写存储文本。来源标签逐条读取 `drawing.recallHasSeenFuture`，最终版明确“已看后续 · 复盘补记”或“未看后续”，不以全局未来标志错误地把原判断洗成新补记；“未看后续”只表达该绘图的已保存来源标志，不证明原文确为历史当时撰写。分组、入口、空态和选择动作均中文。

“选择图上文字”调用已有 `setSelectedDrawingId(drawing.id)`，`aria-pressed` 使用同一 selectedDrawingId；没有新建独立假选择，也没有改 drawing 对象/锚点/历史。是否在真实 canvas 中可见选中、键盘焦点与窄屏全文可达由 root 独立验证。

最后冻结版将 details 移到整个 `recall-chart-and-plan` 之后、回放栏之前，已不作为 chart-shell / chart-column 的网格子项影响计划或绘图区宽度。CSS 桌面 `display:block`，初始 state 为 false；推荐 effect 在 ≤900px 设置 open=true，在较宽窗口设置 false。最终小修订移除该 details 的 onToggle，summary 的 onClick preventDefault 后用函数式 setState 切换 open，aria-expanded 读取同一 state。因此源码现在支持“桌面可见入口默认折叠、窄屏默认展开”，此前 display:none 的文档/源码差异已关闭；也不再由原生 toggle 事件回写已受控状态。窗口跨断点会重置 open，这是此样板当前行为；用户阅读中切换宽度的实际感受仍需画面判断。

## 新增外置实际 OHLC 审查

**PASS（源码范围）。** 外置 `recall-preview-ohlc` 读取现有 `displayCandle = crosshair ?? candles.at(-1)`，显示实际 open/high/low/close 及该 candle 的时间，没有新建静态价格或读取完整 fixture。父级传入的 candles 仍为原 `chartCandles`（编辑快照的 snapshotCandles，或 replay.revealedCandles；载入守卫后才渲染工作区），crosshair 值仍来自已安装 candle series 的 OHLC。已有 fitAll、揭示定位和 viewport 切换路径清空 crosshair，新增 JSX 未改变其状态或图表数据；返回早期、空白 hover、快照退出之后是否始终显示当前已知 candle，仍须 root 浏览器验收，不能仅凭源码清空路径宣称全部 Tooltip 未来安全。

推荐读数被放在真实 chart-stage 外，其 CSS 使用 flex-wrap 和每项 nowrap，未截断或隐藏任何开高低收价格；计划价格按钮、命中区域和 canvas 仍位于原 chart-stage 内，坐标投影逻辑未改。`positive/negative` class 保留，现有全局语义色规则带 !important，未被样板 b 的中性色覆盖。默认正式调用继续使用原图内读数；最后 diff 忽略空白后的额外变化只有该 opt-in 分支和 Fragment，没有删除计划操作 handler。实际图表高度、OHLC 与计划标签是否冲突、缩放和键盘状态均未在本报告中实测。

## 最后小范围修订复核

默认生产路径兼容性 **PASS（源码）**。受控 summary 的新 handler 只位于 `designPreview?.safeStageProjection` JSX 内；正式调用不渲染它，既有 `RecallPlanSecondaryDetails` 和其 onToggle 未被改动。此次仅改变推荐原文区的本地显示 state，不触碰 replay、保存、图形、截止或 repository；原文仍复用此前已审的 visibleDrawings。

≤1100px 三行头部全部由 `.design-prototype[data-mode="recommended"]` 限定：三行 44px，标题/额外操作在第一行，阶段第二行，真实 ChartToolbar 第三行并允许横向滚动。它没有修改共享 recall.css 或正式调用；1101px 起继续遵循原桌面头部规则。隐藏标的/回合 select 的 label 与原 ≤900px 规则一致，fixture 固定单一标的和回合；这不构成多标的正式工作流已验证。断点两侧、长标题和三行真实高度仍 **NOT VERIFIED（浏览器）**。

计划侧栏真实 input/select 的 border-color 为 #58708f，仍继承原 1px solid 边界，文字 14/22、min-height36；其标签的后置 `.recall-plan-sidebar label` 为 13/20，覆盖同 specificity 的早期 12/18 分组规则，保留字段布局与完整值。这些 CSS 均只命中推荐祖先，没有改全局 token 或正式页面；实际 computed、边界对比度和焦点状态仍 **NOT VERIFIED（浏览器）**。

**新增键盘风险已 SOURCE ADDRESSED（原 P2，保留历史原因）。** 前一版 summary 未拦截冒泡 keydown，`handleWorkspaceKeyDown`（当前 :1985）只跳过 input/textarea/select/contenteditable；S0/S1、非 history/快照编辑且未到末尾时消费 Space 并切换 playing。最终版为新 opt-in summary 增加 `onKeyDown`，仅 Space 调用 stopPropagation，不 preventDefault，不改变生产父级快捷键。键盘原生 click 仍经过现有受控 onClick 开关，因此源码上的回放误触路径已阻断；Enter 未被新 handler 消费。root 报告真实键盘 Space 展开、Enter 收起且播放状态不变，本报告只记录这项来自 root 的运行证据，本审查者未独立操作浏览器。

**样板自然滚动默认兼容性 PASS（源码）。** `body:has(.design-prototype[data-mode="recommended"]) { overflow:auto; }` 只在推荐样板存在时解除 body 锁定，普通正式页和 mode=baseline 均不满足选择器；开发入口仍有 NODE_ENV 守卫。它不更改 html、正式 overflow token、回放容器或数据库状态。root 报告实际鼠标 wheel 使页面 scrollY 从 0 到 516，属于 root 的浏览器证据；本审查者未独立验证滚动、触控或其他浏览器的 :has 支持。

**普通 plan-open 壳裁切已 SOURCE ADDRESSED，默认兼容性 PASS（源码）。** 历史问题是共享 container 规则把 chart-shell 限制在220px，而推荐实际stage至少360px。初次修复只覆盖901–1200px；最终D12修复将plan-open shell/rail的自然高度规则扩至全部≥901px，见下面回开与closure。shell/rail为height:auto、max-height:none、min-height360，shell为position:relative、top:auto；901–1200 stage为height/min-height360，≥1201 plan-open stage明确原推荐clamp/min360且max-height:none。新选择器高于旧plan-open220规则；≤900已有的240px壳/绘图区规则保持。正式/baseline不满足祖先，公共text-geometry仍无改动。实际壳尺寸、轴线完整和viewport画面仍由root复测，本报告不将源码closure当作截图PASS。

**More 展开已确认的中宽裁切已 SOURCE ADDRESSED（D14，历史 FAIL 保留）。** 前一版的源码预警随后由 root 的真实 901px 点击确认：More 按原契约关闭计划，但共享 `recall.css:1336` 的展开 grid/flex 预算及 `:1626` 的 container 规则把 chart-and-plan、壳和 stage 限在220px，外置读数另占27px，回放记录只露摘要。原生失败证据为 `screenshots/recommended-boundary-901-more-pre-fix.jpg` 与同名报告 JSON；这是 root 的运行证据，本审查者未操作浏览器，原始失败不被本次 closure 覆盖。

收到此轮 READY 后已重新读取 `recall-design-prototype.css:753` 起完整状态覆写。所有新规则都要求推荐祖先和真实 `More[data-open="true"]`：main、chart-and-plan、replay-bar、More 及其 body 解除 bounded flex/height/max-height/overflow 预算；回放栏改为纵向自然流，原 grid-column/row 位置归零，记录 body 使用自然高度 grid 和 max-content 行。壳/rail 为 height:auto、max-height:none、position:relative、top:auto；stage 的旧 max-height220 被显式解除，≤900px 的 stage 为240px，901–1200px 的 stage 为360px，选择器高于旧 More container 规则。源码因此处理了已确认901px失败的两条成因，不隐藏控制、摘要、快照记录或关键价格。More 的开合、关闭计划、双截止、保存及图表数据 handler 均未被改写；正式和 baseline 不满足推荐祖先，关闭 More 不满足 data-open 条件，继续原路径。**默认兼容性 PASS（源码）。**

**D14 宽窗口与窄内容 More 组合已 SOURCE ADDRESSED（回开历史保留）。** 上一版只在≤1200px覆写 stage 的 height/min-height，>1200px且 recall-work≤1105px 的导航组合仍受旧 container220约束；root 已实测1201px + More + 导航，main981px、stage220px，回开D14并保留 fit-nav-fail 图及JSON。最终冻结CSS新增 `@media (min-width:1201px)`，使用完整的推荐祖先和More展开选择器，stage明确 height:clamp(360px,calc(100dvh - 460px),460px)、min-height360px。其 specificity 高于旧 More container stage 选择器；≤900及901–1200的240/360规则继续分别命中。源码上的该组合漏覆写已关闭，root 对最终1201/1280导航状态的复测仍不是本审查者的直接浏览器证据。

**D15 “适应全部”定位锚点已 SOURCE ADDRESSED，默认兼容性 PASS（源码）。** root 与独立视觉审查者在390px真实画面看到按钮落在More/回放末尾遮挡；初版推荐壳的position:static解除原绝对定位锚点。最终冻结版将≤900 plan-open、901–1200 plan-open及More展开壳改为position:relative、top:auto。适应全部按钮仍是chart-shell直接子项，保留原absolute bottom:8px/left:52px及原fitAll handler；因此源码重新建立图壳内定位，同时解除sticky，不用隐藏或挪走该操作。所有覆写仅命中推荐祖先，未改默认按钮位置、业务或图表坐标。390原文滚动与More、901/1201/1440状态的实际遮挡和点击可达须由root复验。

**D12 >1200px导航+普通计划组合已 SOURCE ADDRESSED（回开历史保留）。** 上一版More修复要求More展开，普通plan-open壳解限只覆盖≤1200px，故>1200px且导航使recall-work≤1105px时，旧 `recall.css:1428` 的壳height/max-height220仍有效。随后root真实1201px导航+计划开+More关确认main981、stage440、shell220/scroll467，保留 `screenshots/recommended-boundary-1201-plan-nav-fail.jpg` 与同名JSON；这是root证据，未由本审查者重现。

最终冻结源码已把plan-open shell/rail解限media由901–1200改为全部≥901（`:702`），选择器仍明确推荐祖先和真实plan-open状态：壳height:auto/max-height:none/min360，relative/top:auto保留fitAll锚点；rail同样自然增长。新的≥1201 stage规则（`:852`）同时列出普通plan-open和More两个选择器，明确clamp(360px,calc(100dvh - 460px),460px)、min360、max-height:none；它不再要求More打开才修复普通计划。901–1200的360px规则、≤900的240px规则各保留原范围。源码上的容器预算漏覆写已关闭；未改变栏数、导航/计划/More state、截止、数据、保存或原图形，未隐藏内容/按钮。**默认/baseline兼容性PASS（源码）。** root的普通→More→关闭→计划开、1201导航与断点回归及独立截图比较仍须单独通过。

**截图工具差异仍 NOT VERIFIED。** root 报告原生 viewport screenshot 保持原文展开，但 fullPage screenshot 会折叠且原因未确认；需要采用与真实画面一致的状态证据，不凭截图工具现象修改生产业务状态。本报告未独立重现该截图差异。

## 结论

最后版本中未发现共享opt-in改动破坏未传参生产默认路径的明确源码回归；也未发现样板通过删数据/改文本掩盖未来信息。已知三项源码问题已重新读取并关闭；新增同源Text原文与外置实际OHLC未扩大已有未来可见投影，不写领域/数据库/网络状态，Text桌面可见折叠现已与描述一致。summary Space风险已在源码阻断，body自然滚动保持推荐态隔离；D12普通计划壳（含>1200导航组合）、D14 More冲突、D15 fitAll锚点均在源码范围关闭，历史失败证据保留。最后重新读取完整3个seam与开发入口diff，且 `recall.css`、`text-geometry.ts`、`recall/repository.ts` 均无git diff，仍只有样板CSS加上已列出的opt-in接入；没有新增业务/持久化路径。**最终源码门禁PASS；未发现本范围剩余必须修改的明确源码问题。** 所有实际图表、状态安全、响应式旅程、视觉、构建和服务运行仍由root实测，本报告不代签完整UI验收。
