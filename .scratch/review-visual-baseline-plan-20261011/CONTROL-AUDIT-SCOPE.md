# 前端控件与视觉空间审计范围

## 触发与版本

- 触发：用户要求按当前视觉方案明确开发和验收任务；范围包含复盘页布局、图表绘图、选中/拖动、Text 编辑、阶段回放和保存闭环，因此按 `docs/agents/frontend-control-audit.md` 建立完整的受影响控件登记和独立视觉门槛。
- 规划基线：`39b97e7c` / 2026-10-10 归档；实现后必须以最终内容 manifest、服务进程和隔离数据一起重新冻结版本。
- 预览入口：`http://127.0.0.1:3046/design/review`；启动命令见视觉基线 README，写入检查必须覆盖 `TRADEREVIEW_DB_PATH`。
- 当前结果：这是派发前的 `NOT VERIFIED` 范围登记，不是本轮产品验收。历史 `64 PASS / 2 NOT VERIFIED / 0 FAIL` 仅支持已归档的有限桌面边界。

## 最终审计回填（2026-10-11）

本轮审计已由“派发前范围登记”推进到受影响桌面控件的真实操作检查。新的服务和隔离库证据记录在 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)。范围内的 1280px 鼠标/键盘控件包括：两侧收缩入口、底部五个回放动作、Text 锚点/编辑/移动/取消、横线/趋势线/RR 预览与选中/拖动。真实保存重载、1440/390、触摸、IME、系统原生光标逐帧仍明确为 `NOT VERIFIED`，不计入通过率。

## 范围与排除

|范围|包含的控件/状态|输入与证据|本轮排除或限制|
|---|---|---|---|
|页面框架|顶部阶段/截止、左侧面板及收缩、右侧计划/笔记及收缩、底部执行图标组|鼠标、键盘、open/closed/focus、before/during/after rect；1440/1280/≈390、导航展开|无授权的其他页面和首页方案 B|
|真实图表与回放|下一根、播放/暂停、下一笔决策、回看早期、末尾/无下一步|真实图表新 bar/成交/时间轴、阶段/截止日志、同态截图|mock chart、仅改变状态数字、只读源码均不算覆盖|
|绘图工具|Text、价格锚点、连接线、横线、趋势线、箭头、通道、盈亏比、更多工具|创建/preview/commit/cancel、点击/拖动/释放、历史计数、价格/bar 关联|新工具或 TradingView 全量复制不在范围|
|选中与编辑|选择轮廓/短动效/手柄、拖动、光标、Text 展开/收起/编辑、长中文|鼠标与键盘动作、选中前中后、Escape、正文几何和 cursor 记录|系统原生光标逐帧、真机物理触控暂为 NOT VERIFIED|
|数据闭环|保存、离页等待、返回、重开、刷新、失败/版本冲突/重试/显式重载|隔离库真实写入、逻辑摘要/hash、返回和 reload 截图|共享业务库、数据迁移和未授权 API 改动|
|响应式/内容|长中文、长价格、密集标签、空/错误状态、断点两侧|同状态截图、空间测量、滚动/动作可达性|软件键盘必须单独设备证据；桌面窄屏不能代替|

## 控件全集登记计划

|ID|对象/重复规则|前置条件|动作/输入方式|预期状态链与视觉对象|责任票|初始状态|
|---|---|---|---|---|---|---|
|`review.phase`|阶段标签，每个工作区一项|页面加载|鼠标/键盘切换阶段|只更新阶段/截止契约，图表证据对应|基线契约、真实旅程|NOT VERIFIED|
|`review.left-panel-toggle`|左边缘收缩按钮|左侧面板 open/closed|点击、Tab/Enter、Escape|左侧宽度和图表 rect 按预算变化，焦点可回|紧凑布局|NOT VERIFIED|
|`review.right-panel-toggle`|右边缘收缩按钮|右侧面板 open/closed|点击、Tab/Enter、Escape|右侧宽度和图表 rect 按预算变化，焦点可回|紧凑布局|NOT VERIFIED|
|`review.execution-dock`|底部居中执行图标组|工作区加载|鼠标、Tab/Enter、hover/focus|中心线稳定，动作反馈不吞图表|紧凑布局|NOT VERIFIED|
|`review.replay-next-bar`|下一根动作|S0/S1/S2 且有下一根|点击/键盘|真实新增 bar/截止；末尾有原因|真实旅程|NOT VERIFIED|
|`review.replay-play`|播放/暂停|有可播放行情|点击/键盘|连续真实推进，可暂停，中间帧可见|真实旅程|NOT VERIFIED|
|`review.next-decision`|下一笔决策|有后续决策|点击/键盘|图表定位目标 bar/成交，不泄露未来|真实旅程|NOT VERIFIED|
|`drawing.text-tool`|工具栏/更多菜单入口|绘图工具可见|点击/键盘|进入 Text 创建态，不穿透画布|Text/绘图|NOT VERIFIED|
|`drawing.text-anchor`|图表价格/bar 热点|Text 创建态|图表点选/按住拖动|锚点价格和时间准确，预览可见|Text/绘图|NOT VERIFIED|
|`drawing.text-connector`|Text 与锚点连线|已定首点，指针移动|移动、第二点/释放|动态预览，取消无残留|Text/绘图|NOT VERIFIED|
|`drawing.text-box`|Text 正文框|已固定位置或已有文字|点击、移动、展开/收起、编辑|正文完整，框/锚点分离，布局不重排|Text/绘图|NOT VERIFIED|
|`drawing.line-family`|趋势/横线/箭头/通道/风险回报，每个实例按业务键|对应工具态|首点、拖动、第二点/释放|预览→确认，一次历史，零长度阻断|Text/绘图|NOT VERIFIED|
|`drawing.selection`|所有可选绘图实例|画布已有对象|点击、短确认、Escape|轮廓/手柄/动效清晰，焦点作用域正确|Text/绘图|NOT VERIFIED|
|`drawing.handles`|对象端点/移动柄|对象 selected|点击/拖动/释放|8px 视觉、24/44 命中，光标对应轴向|Text/绘图|NOT VERIFIED|
|`drawing.more-menu`|更多工具浮层及 7 项|工具栏可见|点击、Tab、外点、Escape|视口内、可达、关闭还焦点|Text/绘图|NOT VERIFIED|
|`review.save`|保存入口|dirty 草稿|点击/键盘|真实隔离库写入，错误留页|公共组件闭环|NOT VERIFIED|
|`review.leave-guard`|离页/返回保护|dirty 或 saving|点击返回/关闭/刷新|等待保存或提示重试，不丢输入|公共组件闭环|NOT VERIFIED|
|`review.reload`|重开/刷新入口|已保存或失败态|返回、重新进入、浏览器刷新|恢复正文、几何、阶段、截止和派生值|公共组件闭环|NOT VERIFIED|

## 证据与覆盖口径

每个登记项都要由 DOM、可访问性树和源码交叉定位，再做真实操作。每个关键动作保存 `before / during / after`：控件和父容器 `getBoundingClientRect()`、舞台/图表高度、价格轴/侧栏/页下游位置、DPR/缩放/滚动偏移、截图或录屏。正常动效不能以禁用动画代替。

覆盖和通过分开报告：

```text
执行覆盖率 = 有真实操作且有结果证据的登记项 / 本范围应执行的登记项
点击覆盖率 = 有真实点击/按键且有结果证据的登记项 / 本范围应点击/按键的登记项
状态覆盖率 = 有真实状态/选项操作且有结果证据的登记项 / 本范围应验证的状态/选项登记项
结果通过率 = PASS 登记项 / 已执行且有结果证据的登记项
```

`FAIL` 是实际测过且不符合预期；`NOT VERIFIED` 不计入覆盖分子；工具存在、HTTP 200、mock state、callback 或单测不能替代真实作用。没有应执行项时写 `NOT APPLICABLE` 并解释分母为空。

## 独立复核门槛

- 功能正确性：真实鼠标/键盘动作、创建/选择/拖动/编辑/取消和回放有可观察结果。
- 端到端状态链与数据保护：隔离库真实保存→返回→重开→刷新；阶段/截止、图形关联、错误/取消保持契约。
- 独立视觉：非实现者在同一最终版本、同一视口、同一阶段、近似文案密度下，对照基线和用户 TradingView 参考，复核层级、间距、对齐、控件重量、命中反馈、长内容和窄窗口。

任一适用门槛为 `FAIL` 或 `NOT VERIFIED`，不能声称整体完成；回归必须同步更新本目录的矩阵、报告和最终接受记录。
