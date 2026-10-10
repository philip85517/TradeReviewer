# 策略台视觉来源审计

审计人：独立只读审查者 `design_audit`。记录时间：2026-10-08 00:28（Asia/Shanghai）。本轮只创建本报告；没有实现、启动服务、操作业务数据库或重新渲染 UI。

## 1. 结论与证据边界

远端设计基线是 **A 固定组合工作台**，不是 10 月 7 日的个股复盘 React 草稿。两者可以共用主题、字体角色、图标和状态语言；其布局职责必须分别保留。A 的 320px 组合/事件检查区不能被解释成复盘的固定栏数或比例；个股复盘 S0/S1/S2 应在同一工作区按阶段揭示，完整保留原判断、形成阶段和补记来源。

可直接复用的方向是：Geist 加明确中文 fallback、中文正文 14/22、控件 13/20、18px Lucide 配 36px 点击框、单一主要动作、深蓝实心动作候选、浅蓝焦点、完整年月日与独立行情/成交截止、可展开的同源原文。不能直接搬用的是：复盘草稿的自然页面流、18px 全局标题、360–460px 图表高度、额外 OHLC 行、松开的回放条及窄屏规则。它们必须按对应业务上下文重新比较，而非作为远端批准尺寸。

以下数值均为**源码声明或明确标注的数学计算**，不是本轮浏览器 computed/rect。旧图片经直接目视阅读，但仅作为设计来源。真实浏览器、点击覆盖、阶段安全、返回/刷新持久化及新样板视觉接受均 **NOT VERIFIED**；由协调者另行验收。源码审计完成不代表 UI 交付完成。

## 2. 冻结的来源版本

| 来源 | 实际版本 / 状态 | 权威边界 |
| --- | --- | --- |
| facb | `/Users/zhoulin/.codex/worktrees/facb/TradeReview`；`codex/strategy-visual-system-20261008`；HEAD `9c2b3d209a202422c3d5aeab5969a9b093cfda92` | 从 `origin/codex/strategy-workbench-v1-design` 建立；下列审计源文件在读取结束时 `git status --short` 为空。未自行 fetch，远端来源身份按协调者冻结的 ref。 |
| f42e | `/Users/zhoulin/.codex/worktrees/f42e/TradeReview`；`codex/strategy-workbench-v1-design`；HEAD 同为 `9c2b3d2…` | A HTML、真实 chart/recall/page 等存在本地未提交修改。10-07 README 与 `app/components/design-prototype/` 为 untracked；10-06 功能稿也为 untracked。不能称这些内容已经远端批准。 |
| 前端审计规范 | 工作分支内缺 `docs/agents/frontend-control-audit.md`；实际读取本地 ref `origin/master:docs/agents/frontend-control-audit.md`，commit `7a5d137da3dcdf0f133a29714ee269693746472b` | 单独记录版本来源，不声称基线分支自带该文件。它要求源码/DOM/AX 普查与真实操作分离，功能、状态链、独立视觉分开放行。 |
| 开发约束 | facb 的 `docs/agents/development-workflow.md`、`task-decomposition.md`、`ui-task-templates.md` | 全部阅读。协调者拥有整页视觉与完整状态链；局部 worker PASS 不等于功能接受。 |
| 设计规范启动包 | 尚未定位 | **NOT VERIFIED**，旧交接包、旧 README 和当前规格不能冒充。 |

源文件 SHA-256（只读内容指纹，记录的是本次来源，不是未来最终构建）：

```text
facb
15d53141389bb3ec615100083a412f88fbbedddaf18636562d2171c87be8c2a7  .scratch/strategy-portfolio-backtesting/workbench-design/index.html
34d47a33cde3840971a866d1464c768c28ec634f563ae5465cf8a5a8e88a95fa  docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md
949a4136243d0c8e9ffa4299d2f9156fae75593bab51770d80815bec19d241c6  app/globals.css
7b5c2b2c898f35cb725e13a6ce0b173217ecc4424d030a5570efb52b71216c3e  app/layout.tsx
0910ed81c75c29473b842feafd0c3c61401a4070c33cc9d7090bd134fd188d87  app/components/recall/recall.css
2b24280ebf4d2c914ca8cc7d1866883ab6d41c4c27e203859b10431972ceb6a4  app/components/chart/replay-chart.tsx
f42e local draft
1dad60ed6118a5209aec35033571eda73dd22025edde23ca82aa9b27270d76ad  docs/designs/2026-10-07-strategy-design-system/README.md
256361bb1defc11f302423ca7d5afc895d71e15792fad5744b7dfd06cf335496  app/components/design-prototype/recall-design-prototype.tsx
97498a2481eec61739f1fd5318154a3096a4071c7967a2326cedbe848578fc76  app/components/design-prototype/recall-design-prototype.css
a625100ff26f09085e3221f064b924397da70c1ade0a94ed21f77780295dccb1  docs/specs/2026-10-06-strategy-workbench-review-functional-design.md
```

## 3. 设计契约与实际参考

优先级来自 [融合规格第16行](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md:16)：用户最新反馈 → 融合跨页决定 → 最新局部契约 → 历史提案。A/B/C 不再重新选型；早期“回放全部只用图标”已被可读动词要求覆盖。

| 精确来源 | 应保留内容 | 本轮用途 |
| --- | --- | --- |
| [融合规格 IF05/06，第81行起](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md:81) | 54/200 应用导航共用状态；工作台不再叠加40px业务 tab；单一主题；A 固定预算；正文/控件可读 | 当前 A 设计权威 |
| [融合规格 IF08，第105行起](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md:105) | 行情、组合执行、结果截止分别约束整页；真实新 K/成交可见；范围和已看后续来源保留 | 视觉修改不能破坏的状态边界 |
| [稳定工作台规格，第3–28行](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-30-strategy-stable-workbench-design.md:3) | A 已选；最新 REPAIR03/STYLE04 覆盖初稿尺寸；TV 参考用于分组/层级，非像素复刻 | 避免采纳历史拟定值 |
| [REPAIR03](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/REPAIR-03-CONTRACT.md:15) | 固定框架、清晰动词、独立 OHLC/净值、回看/推进分组、约12px初始 K 间距、真实推进及返回范围 | 行为和空间底线 |
| [STYLE04](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md:10) | 原站 Geist、主题、品牌、36px控件；保持 A，不变成旧生产页宽度 | 原站风格来源 |
| [TV 用户参考图](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/references/2026-09-30-round1-tradingview-reference.png) | 上方标的/周期、左绘图、图主体、下方紧凑回放；不同职责有分隔，装饰较少 | 已直接看图；截图2864×1662，浏览器 chrome 包含在图中；CSS视口/缩放未知，不反推字号 |
| [STYLE04 完成1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/complete-1440.png)、[事件1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/event-1280.png) | 上方三个紧凑带、38px上下文、主图与320检查区、底部固定日期/推进两组；事件原因与权重/成交/费用仍完整 | 已直接看图；仅历史同态设计参考。事件图含历史诊断文字，不是本轮证据。 |

TV 图中的浅蓝图底、蓝橙 K 线、买卖按钮、绘图全集、品牌、浏览器地址栏均不应照搬。其成熟感主要来自稳定工具轨道、控件尺寸一致、低装饰主面和职责分组；TradeReview 的背景、收益口径和用户升降配置有自己的语义。

## 4. A 固定工作台：精确源码来源

以下行号均指 facb 基线 [index.html](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/index.html:8)，并以其**后置修订声明**为准，不把前面的历史规则当最终值。

| 角色 | 基线源码值 / 行号 | 影响与建议 |
| --- | --- | --- |
| UI 字体 | 8–9：本地 `geist-latin.woff2` / `geist-mono-latin.woff2`，可变100–900。30：`Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif` | 泛型/系统字体在明确中文字体前；候选应将具体中文 fallback 放在 generic 前。不能凭名字断言实际汉字字体。 |
| 基础正文 | 33：13px；34：button/select 继承 | 基线已有紧凑密度；不要全页放大至14或整段中文等宽。完整说明可局部14/22。 |
| 实验身份 | 59：17px/700；60：小字12px/400；264：≤1300实验名15px，小字隐藏 | 18/24/600 是个股复盘候选，不应全局覆盖 A。长实验名还需完整可见入口。 |
| 摘要 | 71：标签12px；72：数值16px/700 Geist Mono；233：注释修正为12px | 数字对齐和财务精度保留；不能因金额长而改变摘要带高度。 |
| 图头 | 271：44px；273：标题14px；274：副文12px | 图头的身份与行情截止必须可扫读；不扩大图头挤掉绘图区。 |
| 主/次控件 | 54、64、90、107：36px高，圆角6；276：tab/soft/toolset字13px；280：日期130px宽×36px；112：速度58px宽×36px | 当前主要按钮已有文字动词；统一字重和图标可用，但不回退到难猜的纯图标。 |
| 图标 | 230：18×18 SVG、stroke1.7；41：品牌19×19/stroke2；383–384：手写工具 SVG；81及312菜单使用 `⌄` | 可以统一 Lucide 图形与18px视觉槽；品牌/状态图标是合理例外。箭头 Unicode 的外观依赖字体，应统一同语义工具。 |
| 检查区 | 83：320px；119/227：头46px；123：头文字14px；124/228：内容内部滚动；125–127：tab36px | 这是组合/事件检查职责，不是对个股复盘强制320栏。不能删掉事件依据、权重、成交/费用来减密度。 |
| 详情层级 | 128：区分标签12px；130：持仓名15px/700；141：事件标题600；135：数值Mono | 标题少量600/700、正文正常字重；避免所有行都强调。 |
| 焦点 | 37：2px蓝色outline，offset2 | 候选浅蓝焦点更清楚；必须真实Tab检查且不被overflow裁切。 |
| 图表 API | 406–412：背景101722、字adbbcf、细网格1c2736、强网格243145、升26a69a/降ef5350、净值2f80ed/对比f3ba2f；createChart没有fontFamily/fontSize；初始barSpacing12/min4/rightOffset3 | UI 字体不会自动进入 Canvas。可增加明确图表字体候选；保持实际OHLC和净值身份、初始自然间距与视野合同。 |

A 的固定空间预算是顶部48 + 实验身份48 + 摘要48 + 上下文38；图壳内部为图头44 + 绘图区弹性且最低320 + 回放44 + 状态28；检查区320。融合合同要求1440×900绘图区≥360、1280×800≥320，内部模式非预期位移≤1 CSS px；不能把“最小高度320”当成所有视口仅需320。

旧 A 仅实现54px导航；融合合同另要求200px展开态并继承同一应用状态，两态仍需本轮实际验证。`body min-width:1100px`（33）意味着390px不能直接声称已响应；新窄屏样板需要明确自己的探索范围及可达性证据。

## 5. 生产公共组件：可复用与级联风险

| 来源 | 精确源码值 | 审计判断 |
| --- | --- | --- |
| [layout.tsx:5](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/layout.tsx:5) + [globals.css:44](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/globals.css:44) | next/font 的 Geist/Mono均`subsets:[latin]`；body `var(--font-geist-sans), PingFang SC, Microsoft YaHei, sans-serif`，antialiased；表单继承 | 应检查 next/font 变量实际展开是否已带generic；不能仅在变量后追加字体便称中文 fallback 顺序有效。字体集合 loaded 也不证明逐字 glyph 来源。 |
| [globals.css:3](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/globals.css:3) | page0b1220、surface111a2b、elevated182337、soft182333、line243145/1c2736、text e7edf6/adbbcf/9cacc2、blue2f80ed、green26a69a、redef5350、goldf3ba2f | 是共同语义色权威；保留用户收益色，不另造近似深蓝系统。 |
| [ChartToolbar:27](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/chart-toolbar.tsx:27) | 周期可见文本15m/1H/4H/1D/1W；ChevronDown14、CloudOff14、Search/Layers/Maximize/Settings17；中文aria/禁用原因已有 | 全中文样板可显示15分/1小时/4小时/日线/周线，内部周期值保留；不必新组件库。状态图标14属于角色例外。 |
| [globals.css:851](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/globals.css:851) | 早期chart工具栏44；symbol32高、mono12/700；icon31×31；timeframe31×27、mono12/600；disabled opacity.35 | 与Recall后置min36叠加后可能出现31×36；这是源码风险，不是本轮rect。需量最终外框、padding、图标中心。 |
| [DrawingToolbar:81](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/drawing-toolbar.tsx:81) + [recall.css:239](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall.css:239) | 工具Lucide19，lock/undo/redo/trash18；Recall轨道48、按钮36方；选择/文本/趋势/水平/通道/风报比与更多菜单 | 不应把“18图标”误写成所有原生实例已是18；统一光学尺寸需直接看图。中文名称、aria-pressed、Escape返回焦点可复用。 |
| [ReplayChart:1007](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/replay-chart.tsx:1007) | 背景101722、文字8392a7、网格1c2634；没有显式fontFamily/fontSize；价格轴min84、top.08/bottom.2；barSpacing8/rightOffset4；locale zh-CN | 原生图与 A 的12px初始间距、文字/网格不同。可以按上下文校准，但不把某一既有值推广为全站默认；保留用户范围。 |
| [ReplayChart:1585](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/replay-chart.tsx:1585) + [chart-settings.ts:2](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/lib/storage/chart-settings.ts:2) | 默认teal-red26a69a/ef5350；用户green-red22c55e/ef4444、blue-orange3b82f6/f97316；动态applyOptions；plan线金色虚线 | 用户chart setting是权威，视觉候选不得反转或另存第二权威。计划/实际还需形状和文字区分。 |
| [recall.css:214](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall.css:214) | 原生Recall头48、h1字14/最大180省略；phase36、选中淡蓝和边框；provenance12；controls48；drawing36 | h1这里没显式weight，不能只看这一条声称computed400/700。阶段选中需600候选及非色标识。完整名称需要实际可读入口。 |
| [recall.css:100](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall.css:100) | 原生primary为浅蓝文字配rgba蓝淡底；complete为绿色淡底；后置按钮min36，≤700则44 | 原生primary不是白字实蓝，不得把A的3.866比值套到Recall；如样板改成实蓝，应按最终合成色重算并保持动作角色。 |
| [recall.css:339](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall.css:339) | chart/plan gap14；plan-open侧栏变量默认320；sidebar字体14、h2 16/h3 14、说明12；输入36/14；max-height可滚动 | 320是当前实现，不是用户批准的复盘固定比例。14pxgap可作已存在局部例外，勿为4px节奏破坏流程。 |
| [recall-workspace:2935](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:2935) | 已有“复盘补记·买入事实尚未揭示 / 持仓过程·仅展示当前已知事实 / 事后复盘·完整历史已主动揭示”及已看后续补记 | 可复用来源表达，须实测阶段推进/返回不洗掉已看未来。 |
| [recall-workspace:3043](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:3043) | 可见截止使用短日期，完整日期在title/aria；3052起有prev/play/nextbar/nextdecision/save；3117显示已揭示/全量成交计数 | 跨年应可见完整年月日；全量分母可能成为未来提示，须实测安全投影，不能凭源码宣布已发生泄漏。保存等多primary需按当前角色收敛。 |

`globals.css`有多轮覆盖：例如4716的通用动作min40/14、4785播放40、4817工具栏wrap/min48、6047以后的B2桌面侧栏clamp(148,14vw,208)。这些不能用一次搜索出的早期31px/44px或clamp导航作为实际computed。B2生产侧栏也不能自动覆盖融合合同54/200。

## 6. 对比度：独立静态计算

方法：将下面**不透明源码RGB色**转为sRGB线性相对亮度，计算`(L亮+.05)/(L暗+.05)`，保留三位。这里只证明给定颜色对的数学结果，不证明浏览器最终背景、opacity、hover命中或alpha合成。

| 前景 / 背景 | 计算结果 | 当前含义 |
| --- | --- | --- |
| 白 / #2f80ed | 3.866:1 | A 13px实心按钮静态组合未达10-07草稿采用的普通文字4.5目标。 |
| 白 / #4a91ed | 3.199:1 | A hover静态组合更低；不能只修normal。 |
| 白 / #2469c8 | 5.344:1 | 深蓝normal候选。 |
| 白 / #2b72d3 | 4.719:1 | 深蓝hover候选，须浏览器确认最终computed。 |
| 白 / #205bac | 6.659:1 | 深蓝active候选。 |
| #e7edf6 / #111a2b | 14.789:1 | 原主文字。 |
| #adbbcf / #111a2b | 8.940:1 | 原次文字。 |
| #9cacc2 / #111a2b | 7.537:1 | 原辅助文字，不需因“暗色”降得更灰。 |
| #44546b / #111a2b | 2.260:1 | 弱分隔候选；不能称唯一必要控件边界已达3。 |
| #58708f / #111a2b | 3.423:1 | 必要边界候选。 |
| #243145 / #111a2b | 1.326:1 | 原结构线可作装饰，不独自承担输入边界/选中含义。 |
| #2f80ed / #111a2b | 4.502:1 | 保留动作/净值蓝语义，并不要求所有用途改深蓝。 |
| #8cbdff / #111a2b | 8.983:1 | 浅蓝focus候选。 |
| #26a69a、#ef5350 / #101722 | 5.998、5.158:1 | 默认K线升降色静态形状；仍需颜色以外的业务解释。 |

建议保留`--blue:#2f80ed`用于链接/选中/净值等既有语义，仅另设实心primary三态。10-07草稿已给出[文字/非文字对比依据及透明色合成规则](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/docs/designs/2026-10-07-strategy-design-system/README.md:75)；本轮比值由本审查者重新计算，没有复制其“实测”结论。disabled例外不能用来掩盖可用控件。

## 7. f42e 10-07 草稿：复用边界与具体风险

| 草稿位置 | 可以复用 | 不可直接继承 / 需要证明 |
| --- | --- | --- |
| [README:5](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/docs/designs/2026-10-07-strategy-design-system/README.md:5) | 自称草稿0.1、可逆实际组件样板；不用第二组件库；承认未批准生产 | 其本地身份和历史验收不能升级为远端A契约。 |
| [README:42](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/docs/designs/2026-10-07-strategy-design-system/README.md:42) | 18/24/600工作区、16/24/600分区、14/22正文、13/20控件500、阶段600、12/18辅助；混排测试串 | 这是复盘推荐候选；A图头14/实验17与IF06禁止无故放大仍优先。整段中文不能Mono，价格/截止/原判断不能靠省略。 |
| [CSS:56](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css:56) | scope内深蓝三态、显式Chinese栈、focus，36平方框、18 SVG、stroke1.75 | `.recall-workspace svg`的全覆盖包含状态/装饰例外；小图标角色不必一律拉18。显式文字family仍需核对加载和glyph证据。 |
| [CSS:220](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css:220) | 保存另作secondary，避免与当前主要推进动作竞争 | broad primary同时匹配complete与多推进项，必须按阶段/用途实测主次层级；不能只靠一个class认为仅一主动作。 |
| [CSS:67、93、264、281](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css:67) | 复盘可允许纵向内容流与长文可达 | body overflowauto、Recall heightauto、chart clamp360–460改变整页和回放Y；与A固定图壳不同，不可迁移。不要将其候选高度再固化为固定比例。 |
| [CSS:286](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css:286) | 将OHLC读数与图上文字竞争分开思考 | 新增26px外置OHLC行改变图壳预算，A已有overlay读数；不能无说明叠加一行。 |
| [CSS:482、516](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css:482) | 窄屏动作换行、计划自然高度及完整原文 | replay heightauto、≤900单列、240图高是旧样板局部决定；新样板须证明主要动作、价格轴、长文实际可达，而不只检查无横溢出。 |
| [TSX:144](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.tsx:144) | 原判断全文；入场56、止损52、目标68、1000股、20万；pre-trade、createdAtCursor、hasSeenFuture与图锚点；holding补充独立 | 不能为排版截短原文；holding补充创建在D58却锚到D60（171），须检查定位范围和可知锚点，不凭样板状态声称安全。 |
| [TSX:210](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.tsx:210) | 初始plan包含录入阶段、knowledgeCutoff、独立executionCursor | source明确`retrospective`（218）；不能在视觉中包装成当时真实原始计划。演示“原判断”也须说明合成来源。 |
| [TSX:227](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.tsx:227) | 真RecallWorkspace/Chart/Drawings、完整fixture可用来比较；96K线和三笔成交可验阶段揭示 | 旧repository只有进程内存与revision，刷新重置；不是持久化闭环。当前覆盖表的新localStorage样板要单独保存→返回→reload验证，不能继承旧证据。 |

README中31×36工具、标题weight400、约780px阶段/截止距离、baseline625.7→469图壳、390长页面等值均是 **f42e历史报告声称的旧测量**，本审查者未重新测；不能写成当前facb缺陷实测。旧报告已承认1280主要动作曾在800视口下方、完整图上文字仍可能重叠，这些风险不能用“视觉得分”消除。

10-06本地功能稿仍明确A预算与只做设计/样板的边界。它也是untracked，不能以日期更新自动覆盖远端融合契约或用户最新“不预设复盘栏数”的要求。

## 8. 当前 DESIGN-COVERAGE / PLAN 范围审查

已读取本轮 [DESIGN-COVERAGE](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/DESIGN-COVERAGE.md) 和 [PLAN](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/PLAN.md)。两个限定正确：一套推荐视觉系统对应组合台/个股复盘两个业务上下文；f42e未提交内容只是实现参考。A320检查区与个股复盘不定栏也已分开，样板持久化没有冒充生产SQL。

审查建议已发送协调者：

1. **U02标题角色需收窄。** 覆盖表统一18/24/600不能全局套A；应写为复盘标题候选，A保留既有尺寸/固定budget，或记录当前授权的具体偏差及同态比较。IF06明确“不以统一为由扩大工作台标题”。
2. **U01/U07明确A接受矩阵。** 1440/1280、54/200导航、1300断点两侧仍分别验证。900/390属于本次新增探索，不能用探索样板通过取代原A桌面接受。
3. **U05/U06把原形成阶段与事后来源分别验。** 行情/成交截止不能合并；S0→真实新bar/成交→S1最小链先过关，S2返回S0后已看未来仍保留；原判断全文未覆盖、补充按形成阶段出现、retrospective持续标补记。
4. **U08按样板存储而非fixture重置计证据。** 唯一样板key、实际save→离开/返回→reload、失败/取消/重置及无业务DB写入分别记录；本地样板通过不等于生产SQL验证。

## 9. 后续独立视觉接受清单

本报告之后，只用对应最终版本的新截图做独立比较。要求baseline/recommended的fixture、阶段、视口、DPR/缩放、chart range、选中/展开、滚动位置可比；保存内容manifest，截图像素尺寸与CSS视口分别列。

| 上下文 / 状态 | 需直接看图的证据 | 不能替代它的证据 |
| --- | --- | --- |
| A：待开始/运行暂停/完成、结果/比较/事件、长名/六组合/失败 | 固定矩形与控制位置、12px以上辅助、金融数字、320检查区完整层级、两组回放；1440/1280及1300两侧，54/200导航 | worker报告、旧STYLE04图、HTTP成功、仅rect无图 |
| 复盘：S0、S1、S2、S2返回S0 | 图上完整原文/独立补充、来源和双截止靠近图、计划/实际区分、原判断保留；选中与focus/disabled | fixture阶段值变化、仅按钮存在、仅DOM文本有全文 |
| 长中文/900/390 | 价格轴、主动作、输入/全文/底部实际可达；图上文字遮挡和缩放可用性；断点两侧 | 无horizontal overflow、滚动高度、旧样板得分 |
| 主动作/次动作/工具状态 | normal/hover/active/focus-visible/selected/disabled的真实画面与最终computed颜色；焦点不裁切 | 源码三态颜色、SVG属性stroke=2、CSS点击框声明 |

功能与状态安全需另有实际鼠标/键盘操作、tooltip/统计/列表/fit投影、推进目标真实可见、视野保存及返回/reload证据。模拟触控不能冒充物理触控；纯源码比值不能冒充已实测hover。任何本轮已知在范围内的FAIL或必需NOT VERIFIED仍阻止样板接受。

## 10. 本轮审计状态

| 门槛 | 状态 | 说明 |
| --- | --- | --- |
| 源码 / 精确设计来源审计 | 完成 | 来源版本、具体值、级联风险、历史图与本地草稿边界已记录。 |
| 当前覆盖表 / 计划范围审查 | 完成，需协调者吸收建议 | U02标题限定和A接受矩阵建议已发送；本报告没有修改覆盖表。 |
| 新实际样板独立视觉比较 | NOT VERIFIED | 等最终新截图，独立直接看图。 |
| 实际功能 / 阶段安全 / 持久化 | NOT VERIFIED | 本任务只读，不执行这些用户旅程。 |
| 生产SQL、真实交易数据、物理触控 | NOT APPLICABLE于本次源审计 | 没有实施或写入；未来样板和产品门槛仍由各自范围决定，不据此排除。 |
| 启动包专项符合性 | NOT VERIFIED | 尚无确切来源。 |

