# 首页“图表区”风格库存（只读调查，2026-10-09）

> 目的：将旧完整 Workbench 的基础视觉角色尽量与已校准的“首页控件迭代｜图表区”统一；本报告只给迁移依据，不修改组件或源码。参考工作树：/Users/zhoulin/.codex/worktrees/0ff3/TradeReview；当前工作树：/Users/zhoulin/.codex/worktrees/facb/TradeReview。

## 结论与迁移边界

优先复用首页已实装的 token、DOM 图表工具栏、Lucide 语义和状态模型；只迁移按钮/字段/面板/图表周边的角色。首页候选规范明确要求保留复盘页原有图表面积、工具、币种、期间、粒度、坐标轴和交互，图表数据/Canvas/SVG 不受全局 SVG 样式改写（参考工作树 docs/design-system/TradeReview-首页拉齐-v0.2.md:13-23）。复盘页只迁移经过独立验证的基础角色，不能套首页网格、页头或首页内容顺序（同文件:45-50）。

参考候选仍是候选规格，并非全部已获最终验收；实际字号、字体命中和截图须重新验证（docs/design-system/TradeReview-首页拉齐-v0.2.md:1-3,39-43,59-63）。以下颜色/尺寸是最适合当前 facb 旧 Workbench 的起始 token，不能替代浏览器 computed/screenshot 验收。

## 1. 已校准、应优先复用的角色

### 颜色与字体 token

参考生产全局变量在 app/globals.css:3-29：

- page #0b1220，surface #111a2b，raised #182337，soft #182333；
- line #243145，soft line #1c2736，正文 #e7edf6，辅助 #adbbcf，faint #9cacc2；
- blue #2f80ed，blue-soft rgba(47,128,237,.14)，green #26a69a，red #ef5350，gold #f3ba2f，link #8cbdff；
- border-subtle #44546b。

首页校准契约的目标角色是：UI 字体 "Geist", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif；正文/控件 14/22、辅助 12/18、标题 20/28、模块 16/24、权重只用 400/500/600、金融数字 tabular nums；参考 .scratch/design-system-calibration-20261007/visual-contract.md:11-17。首页规范也规定主动作候选用 #2169cc 白字、焦点 2px #9ecaff offset2，盈亏语义继续走已有用户配置（docs/design-system/TradeReview-首页拉齐-v0.2.md:25-31）。

注意：参考生产 body 目前仍是 var(--font-geist-sans), "PingFang SC", "Microsoft YaHei", sans-serif（app/globals.css:44-48），推荐样板才明确把 generic 放最后（app/components/design-prototype/design-system-prototype.module.css:114-128）。因此 facb 不应把声明字体当作真实中文字形证据。

### 通用控件/状态

最接近目标的“薄角色”来自：

- Scope 控件 token 与状态：app/components/scope/scope-control-primitives.module.css:1-10 定义 selected #163d63、selected border #3797ff、focus #9ecaff；radio/segment/select 的标准高度、字号、圆角和 selected/focus 行为在同文件:41-104、106-137、149-180。标准高度 36px；粗指针和窄屏升至 44px。
- 推荐样板的明确尺寸：app/components/design-prototype/design-system-prototype.module.css:114-136。按钮/选择器 14/22、主动作 600；主动作背景 #2169cc、hover #1b58ad、active #174a91；图表工具按钮至少36×36，图标18px；绘图按钮图标20px；图标 stroke-width 1.75；粗指针/窄屏按钮至少44×44。
- 统一焦点候选：样板 root 的 2px #9ecaff/offset2（同文件:23-26），而全局生产焦点仍用 var(--blue)（app/globals.css:61-69）。迁移时应在组件作用域改成候选浅蓝，并检查真实 focus 与 selected 能同时存在。

### 图表周边最值得直接复用的组件

1. ChartToolbar：app/components/chart/chart-toolbar.tsx:5-33,90-196。已包含标的、搜索、周期、行情数据、图层、全屏、设置及互斥 popover；每个操作有 aria-label/expanded/pressed，禁用项带 title/aria-description 原因（尤其同文件:115-168）。这比 facb 旧 Workbench 自写一套 toolbar 更可靠。配套 CSS 位于 app/globals.css:937-1003,1028-1089：icon button 31×31/radius6，周期按钮最小宽31、高27、mono12/600，active 用淡蓝底；若迁移到校准版，保留 DOM/语义，把按钮容器升级为 36×36（窄屏/粗指针44×44），不改变工具栏信息顺序。
2. DrawingToolbar：app/components/chart/drawing-toolbar.tsx:27-45,81-132。工具均为 Lucide，19px 主工具、18px 锁/撤销/重做/清空，按钮有 aria-label/title/pressed/disabled。生产 CSS 在 app/globals.css:1163-1200，现为31×31、active 暗底+左内描。复用行为与图标命名；按候选样板升级视觉为20px/1.75、按钮36（触摸44），不要把 chart SVG/坐标轴当 icon 统一缩放。
3. ReplayControls：app/components/replay/replay-controls.tsx:24-90。上一根/播放/下一根/下一成交/速度已经有可读状态、disabled 原因和 live phase；生产 CSS app/globals.css:1402-1450 现在控件高29、播放34宽、radius6。可以保留控件语义并迁移到 36/40 的标准/主动作高度；不要为了统一外观删除“已在回放起点/没有尚未揭示成交”等解释。
4. Scope/全局工具：app/components/dashboard/trading-room-global-tools.module.css:13-84 提供搜索字段36px、radius6、14/20 输入、focus-within 蓝边+18% ring，以及 icon/user button 36px。清除搜索当前只有 padding2（同文件:69-70），不应直接照搬；应给它独立的36/44命中框。
5. 真实图表 stage：app/components/dashboard/room-tradingview-chart.module.css:1-21。legend/选中数据已是14px、辅助12px/tabular nums；stage 360px、背景 #101722、border #2a3546、radius4、focus 2px。迁移仅复用颜色/数据文字角色和 focus 语义；保持真实 chart 的数据/轴/命中层。

## 2. facb 当前旧 Workbench 对照

### 最高风险的旧值

- app/components/strategy-prototype/running-prototype.css:1-19,93-153：旧根仍使用自己的 #438cf4/#357dda/#52d5b5、generic fallback、14/1.45，按钮38px、部分 weight 650/700。建议改为全局 token、14/22、400/500/600，primary 使用 #2169cc；保留页面实际业务状态颜色，不把 mint/红色固定成通用状态色。
- running-prototype.css:341-398 的 summary 只有 16px 数值；首页诊断把旧摘要14px视为层级问题，候选是主要金融数值20/28/500、tabular（.scratch/design-system-calibration-20261007/DIAGNOSIS.md:15-18）。迁移数字角色，不照搬首页卡片布局。
- running-prototype.css:515-704 的 running chart 是 minmax(0,1fr) minmax(296px,320px)、图表 clamp(320px,40vh,360px)、固定 radius6；可保留 chart stage 的色/边界角色，但不要把该侧栏比例当作批准契约。视觉契约明确反对预设回放栏比例/旧300–320px侧栏（参考 .scratch/design-system-calibration-20261007/visual-contract.md:3-17）。
- running-prototype.css:706-897,917-1061 的 side blocks/holding/event cards 是旧密集内容；只迁移 14/22、12/18、border/panel token 和状态表达，长中文/完整价格必须保留。
- running-prototype.css:1081-1268 的 drawer width clamp(420px,33.34vw,480px) 和固定结构不可作为图表工作区布局基准；保留内容完整性与可滚动行为，按真实图表空间重新验收。
- running-prototype.css:1270-1519 的响应式 759/1059 分界与全堆叠策略属于旧页面行为；首页规范要求复盘保持自身交互/面积，仅可移植“粗指针/窄屏至少44px”的命中规则。

### 旧合成样板不应复用的布局

- app/components/strategy-prototype/strategy-prototype.css:1-4（单行大规则）：proto-shell 固定 sidebar、guided-main 900px + 45/60 padding；setup/package/preview/replay/results 卡片 radius12;padding32;box-shadow；标题25px、select42px、allocation 43px/800；workspace 220px minmax(380px,1fr) 235px、gap13、chart330px、旧 mint palette。它是旧引导式三栏样板，与“图表区优先”的真实工作台契约冲突，不能整体拷贝。
- app/components/strategy-prototype/full-workbench-preview.css:1：nav/context/scene 的旧 wrapper 规则（nav46px、context padding10 24、scene30px、radius4）可作为结构定位参考，不能覆盖真实 app nav 宽度、选中语义、图表布局。
- app/components/strategy-prototype/comparison-prototype.css:1-68,124-130、comparison-chart.css:1-46：旧 comparison 以 21px/650 标题、按钮36/620、图表 320–360px、轴57px和固定 #0d1726 frame 为核心；可取 chart line/grid 的低对比度原则和 tabular mono 轴角色，不取固定高度/轴宽或旧颜色。
- app/components/strategy-prototype/creation-prototype.css:1-18、recovery-prototype.css:1-189、results-prototype.css:1-327：这些 prototype CSS 各自重复 page/line/text、渐变卡片、11/12px说明、部分 38/42/44 控件和旧状态色；应先统一 token/字重/控件角色，再按各自流程保留内容顺序。creation 的 36px 按钮、radius6 与 mobile44（同文件:11,17）是可取的局部；不能把 creation card 的 padding/radius/布局迁移到 replay chart。

## 3. 推荐迁移表

| facb 现状 | 应复用的参考来源 | 建议动作 |
|---|---|---|
| 旧 palette #438cf4/#357dda/#52d5b5 | app/globals.css:3-29、docs/design-system/TradeReview-首页拉齐-v0.2.md:25-31 | 统一 page/surface/text/muted/line；primary 单独 #2169cc；盈亏保留业务配置，状态色分离 |
| 38/42px button/select、650/700 混用 | scope-control-primitives.module.css:41-137；design prototype:114-136 | 标准36、主动作40、touch44；值500、标题600、正文400；保留已批准大命中区 |
| 旧 toolbar 自绘/旧 icon 尺寸 | chart-toolbar.tsx:90-196、drawing-toolbar.tsx:81-132 | 复用语义 DOM/aria/Lucide；chart icon18、drawing20、stroke1.75；容器36/44 |
| chart frame/legend/axis | room-tradingview-chart.module.css:1-21、globals.css:1163-1200 | 复用 stage 背景/边线、legend14/selected14/meta12/tabular；不改数据轴/Canvas/SVG |
| selected/focus/disabled 混在一起 | scope-control-primitives.module.css:92-104,134-137、globals.css:61-69 | selected=淡蓝底+边框；focus=2px浅蓝 offset2；disabled 独立原因文本；不靠 opacity 表达所有状态 |
| 旧三栏/旧 drawer | visual-contract:7,15-17、首页规范:45-50 | 保持 facb chart-first 内容/行为和真实工作区面积；不复制首页 grid、旧预设栏比例或大卡片 |

## 4. 不能照搬的参数清单

1. 旧 Workbench 的三栏宽度 220 / 380+ / 235、旧 running 右栏 296–320px、drawer 33.34vw/420–480px。
2. 旧大引导卡 radius12 + padding32 + box-shadow、标题25px/23px、数值31–43px/800。
3. 旧 primary #357dda/#438cf4、固定 mint/red 状态色、旧 gradient/radial card backgrounds。
4. 生产 chart toolbar/drawing/replay 的 29–31px 控件可复用信息架构，但不可原样作为最终命中尺寸；迁移目标为36，粗指针/窄屏44。
5. 首页真实 dashboard 的大圆角卡片网格（参考 app/components/dashboard/review-dashboard.module.css:1-180）不可套回放页；视觉契约要求图表区优先、无预设栏比例、避免多层大框。
6. 图表 SVG/canvas 线、坐标轴、图上文本不能被全局 icon/font 规则强行覆盖；复盘的阶段、市场/成交截止、未来信息过滤和真实推进仍需独立行为验收（visual-contract:25-36）。

## 5. 给实现/评审的最小验收证据

- 同一业务数据和同一阶段，在 1440×900、1280×800、1024×768、759/760 边界、390×844、320×740 对照；不要通过换范围、删价格或截断长中文做“变紧凑”（visual-contract:19-36）。
- 直接检查 selected+真实 keyboard focus、disabled reason、loading/error/partial 文案、replay next bar/trade 可见性；DOM/HTTP/无溢出不足以证明图表播放。
- 生产图表周边只验 DOM toolbar/drawing/replay controls 的 computed style；Canvas/SVG 数据和坐标轴另验，不用全局 CSS 改写。
- 这份 inventory 是候选迁移依据，不能替代真实浏览器视觉比较或全量回归。


