# TradingView 工具与回放参考：事实与待核实边界

日期：2026-10-24（Asia/Shanghai）。范围：用户原图红框浮动工具栏、底部回放条、项目库复用边界。研究结论不是设计批准，也不是 1:1 功能验收。

结论：可以建立全部槽位的参考清单，并确认多个候选工具的官方功能；仅凭静态截图不能确认全部工具身份及隐藏交互。工具名称与槽位的对应仍须悬停提示或实际操作证据。Lightweight Charts 5.2.0 不能直接提供截图中的整套工具栏。

## 证据分级与原图

本报告使用“静态已见”“官方功能已知”“槽位身份候选/未知”三个独立维度。官方有某工具不等于原图该槽位已被识别；名称候选均是基于形态的推断，不作为实施契约。没有观察到用户参考环境中的创建、选中、拖动、菜单、快捷键、保存重开行为，所有对应交互验收均 NOT VERIFIED。

原图位于产品仓库 `docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png`。仅原图是外观基线，本文不复制图像进研究分支。图中红框是用户标记，不属于产品 UI；行情、报价、品牌标识不自动纳入需求。

## 浮动工具栏逐槽清单

从左至右编号，不含容器。官方收藏工具支持在图表上形成快捷条，[官方收藏帮助](https://www.tradingview.com/support/solutions/43000662392-how-to-favorite-indicators-financials-drawing-tools-and-timeframes/)与[官方教程](https://www.tradingview.com/chart/TSLA/qw8dRAeQ-TradingView-Masterclass-How-To-Use-Drawing-Tools/)说明了添加收藏和移动收藏条。原图是否采用完全相同版本、个性化列表仍未知。

|槽位|截图静态证据|候选名称与确认程度|官方功能依据与下一项证据|
|---|---|---|---|
|H00|左侧点阵柄|拖动柄候选；未操作|官方教程证明收藏条可移动；需验证拖动区域、越界限制与位置恢复|
|D01|多条水平线，端点交错|Fib retracement 候选|[Fib 帮助](https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/)确认两极值点、比例水平线、样式/坐标设置；需悬停确定身份|
|D02|独立 T|Text 候选|[官方绘图目录](https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/)列出 Text；需确认是否锚定、编辑入口和换行行为|
|D03|三条水平线及 L|Long position 高置信候选，未取得提示|[Long position](https://www.tradingview.com/support/solutions/43000517002-long-position-drawing-tool/)确认入场及上下目标/止损区域可调；需实际创建、锚点与默认值|
|D04|三条水平线及 S|Short position 高置信候选，未取得提示|[Long/Short 帮助](https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/)确认风险、账户、数量与盈亏比等设置；需验证截图版本的完整属性面板|
|D05|四角带圆点的矩形|Rectangle 候选|[官方绘图目录](https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/)列出 Rectangle；需锚点创建及缩放操作证据|
|D06|斜向空心箭头|Arrow / Arrow marker 候选，未区分|[Arrow marker](https://www.tradingview.com/support/solutions/43000791736-arrow-marker-drawing-tool/)确认两参考点与文字签注；不可用这条说明直接认定槽位身份|
|D07|两端圆点的斜线|Trendline 候选|[Advanced Charts 绘图目录](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/Drawings-List/)列出 Trendline，也列出其他线工具；需提示与延长线默认行为|
|D08|空心向上箭头|Arrow mark up 候选|[官方绘图目录](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/Drawings-List/)列出该名称；需落点、缩放与样式证据|
|D09|空心向下箭头|Arrow mark down 候选|同一[官方绘图目录](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/Drawings-List/)；需操作证据，不能作为实际买卖按钮|
|D10|倾斜四边形及多个控制点|Rotated rectangle 候选|[Rotated rectangle](https://www.tradingview.com/support/solutions/43000791738-rotated-rectangle-drawing-tool/)确认三次定位确定首边、角度和宽度；需图标提示和编辑锚点匹配|
|D11|多个节点交错连线|身份未知；形态/路径类候选|[官方绘图目录](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/Drawings-List/)同时列出 Path、Polyline、Head and shoulders、波浪等多种工具；没有证据唯一命名，需悬停或工具菜单|
|D12|框内 T，下接线和圆点|注释工具候选，身份未知|[官方绘图目录](https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/)含 Note、Pin、Callout、Signpost 等；不能凭锚点形状认定 Anchored Text，需提示和滚动/缩放验证|
|D13|左圆点起始的水平线|Horizontal ray 候选|[Horizontal ray](https://www.tradingview.com/support/solutions/43000518121-horizontal-ray-drawing-tool/)确认单一起点向右延伸，并可设置文字/价格标签/坐标；需验证槽位身份|

上述功能说明仅用于候选消歧。后续每个工具均应记录创建手势、锚点数、拖动、属性、取消、删除、撤销重做、时间/价格归属、保存重开。通用相似图标不能成为 1:1 验收依据。

## 底部回放条逐入口清单

[官方回放开启帮助](https://www.tradingview.com/support/solutions/43000474024-how-do-i-turn-bar-replay-on/)及[官方回放教程](https://www.tradingview.com/support/solutions/43000712747-bar-replay-how-and-why-to-test-a-strategy-in-the-past/)支持以下功能存在，但原图未显示菜单和悬停。分隔线属于视觉布局，无独立动作。

|槽位|截图静态证据|可确认与待核实|
|---|---|---|
|R01|日历/回退图标、“选择日期”、下拉箭头|文本已确认；官方支持日期/柱选择起点。截图版本菜单内容、点击文字与箭头是否同一入口未知|
|R02|右向三角|播放候选；官方确认 Play 自动播放及暂停控制。暂停图标、悬停态未见|
|R03|右向三角加竖线|Forward 单步候选；官方确认逐步前进。步长与下一项周期的关系仍需观察|
|R04|1x|速度设置候选；官方确认速度可在播放前/中调整。倍率集合、1x 的实际时间间隔未知|
|R05|天|周期/更新间隔候选，身份未唯一确认；不能直接写成“切换图表周期”| 
|R06|分隔线后，右向三角加双竖线|Jump to real-time 候选；官方确认该动作结束回放并回到实时。需悬停证据；不能替换成“下一笔交易”却沿用原图标|
|R07|最右侧 X|官方明确 X 关闭回放面板。不是关闭浏览器或整个复盘工作区的证据；与 TradeReview 工作区关闭必须分开定义|

官方回放教程列有播放/暂停 Shift+↓、前进一步 Shift+→。这证明官方快捷键存在；并不证明本项目已经支持，也不解决输入框/IME 抢键冲突。回放条外观 1:1 是用户明确要求；将上述候选行为接到 M/X/D 和未来信息边界，需要后续设计票决定。

## 组件复用边界

本仓库 `package.json:27` 与 `package-lock.json` 均锁定 `lightweight-charts` 为 `5.2.0`，不是 Advanced Charts。依据[官方 5.2 产品对比](https://tradingview.github.io/lightweight-charts/docs/product-comparison)：

|分类|研究事实|对后续设计的含义|
|---|---|---|
|可复用基础|Lightweight Charts 绘制金融数据；静态注释可用系列标记、价格线，交互扩展使用插件|可承载现有图表，不能据此认定原工具已经可用|
|需另建或评估扩展|完整工具栏、交互绘图、数据获取、状态保存由应用建设|逐工具登记缺口；不能因库限制降低用户 1:1 要求|
|不同产品|Advanced Charts 提供工具栏/绘图/布局保存，通过 Datafeed 接数据；需申请访问，非 npm 包，与 Lightweight Charts API 不通用|可形成后续选型候选；本研究不授权迁移，不证明它的版本与截图完全一致|
|仍需核实|截图图标的确切资源/版本；Bar Replay 在拟选产品中的可用性；全部交互和保存行为|不能将 tradingview.com 的帮助页当成某个 SDK 自动提供该能力的证明|

[Advanced Charts Drawings](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/)确认收藏绘图工具栏、绘图 API 与部分功能开关；这证明产品能力存在，不代表项目已有使用权限或完成集成。

## 待补证据与交接

1. 优先获取 D11、D12 的悬停名称，再核对 D06 与 R05、R06。其余候选同样需要完整提示清单。
2. 记录参考环境的版本/日期、系统缩放和语言；同尺度截取默认、悬停、选中、属性及拖动状态，避免把不同版本拼成单一规范。
3. 完整工具行为逐项测试；外观、功能、保存重开分别验收。截止本报告，13 个工具实际功能均 NOT VERIFIED。
4. 关闭回放与关闭工作区分别定责，保持原工具语义；原图外新增交易导航单独设计。
5. 本研究可关闭的仅是“有哪些公开官方依据、哪些仍未知”；工具身份补证、设计取舍及 1:1 达成不能随研究票关闭而宣称完成。

研究报告仅包含公开资料的简要归纳和本地版本事实，未复制用户私有成交或数据库。独立分支/提交/指纹见同目录 context-pointer.md。
