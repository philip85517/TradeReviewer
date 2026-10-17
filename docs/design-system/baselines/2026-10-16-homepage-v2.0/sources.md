# 首页视觉规范 V2：来源与证据边界

本文件是 `2026-10-16-homepage-v2.0` 的来源登记。V2 是设计提案和验收契约，图稿是可读的静态设计板，不是已经上线的产品截图；任何“应当”“采用”“待决定”都不能被解读为产品已经实现。

## 权威输入

| 来源 | 用途 | 边界 |
| --- | --- | --- |
| `.scratch/homepage-spec-v2/README.md` | 视口、颜色、布局顺序、指标口径、状态、D01 和交付边界 | 是本轮契约；未列入的内容不能由 V1 推断成 V2 决策 |
| `.scratch/homepage-spec-v2/DESIGN-COVERAGE.md` | C01–C39 的原始评论、要求、负责人和验收旅程 | 评论逐字保留；本正文只交叉引用和转译，不替代原文 |
| `docs/design-system/baselines/2026-10-15-homepage-v1.0/visual-design.md` | V1 现状结构、已知数据语义、`:::state-demo` 语法 | V1 冻结；旧截图只用来理解问题，不作为 V2 的像素基线 |
| `docs/design-system/baselines/2026-10-15-homepage-v1.0/sources.md` | V1 的采集、代码和历史需求来源边界 | 证明 V1 的证据等级；不能把 V1 的实现事实升级为 V2 的批准方案 |
| `docs/design-system/baselines/2026-10-15-homepage-v1.0/reviews/2026-10-16/HOME-DOC.json` | 39 条原始评论、章节锚点和评论 ID | 是逐项引用的唯一评论 JSON；评论状态仍需独立 review |
| `docs/specs/2026-09-19-trading-room-homepage.md`、`docs/specs/2026-09-21-trading-room-homepage-feedback.md` | 范围、收益、简约、缺口和异常处理的背景 | 只用于核对语义；不能覆盖本轮 V2 的新边界 |

## 本轮外部参考

以下资料已实际打开，引用的是结构启发，不是对 TradeReview 产品的授权或视觉复制。

1. [TradingView：Mastering the TradingView watchlists](https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/)：借鉴列头排序、更多菜单调整列、图标打开搜索的组织方式。V2 只借鉴交互层级，字段、颜色、尺寸和文案由本项目决定。
2. [TradingView：Symbol search](https://www.tradingview.com/support/solutions/43000746682-symbol-search-find-any-symbol-on-tradingview/)：借鉴搜索结果中保留交易所身份、按类别筛选的可理解性。V2 要求标的身份包含交易所，不把交易所或类别隐在不可解释的代码里。
3. [TradingView Charting Library：chart overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides/chart-overrides/)：借鉴轴字号、网格和系列可配的技术事实。V2 的轴、网格、线宽和颜色是本项目 tokens 决定的，不声称 TradingView 使用了某个字体，也不把外部图表库当成实现依赖。

## V2 图稿清单

设计图统一以 1440px 宽绘制；`home-1280.svg` 用于第二个桌面边界。以下文件名是 Luna 交付的确定图稿名，正文引用时须保持稳定。

| 图稿 | 作用 | 证据等级 |
| --- | --- | --- |
| `home-1440.svg`、`home-1280.svg` | 整页布局和两个桌面视口 | V2 设计提案 |
| `market-all.svg`、`market-us.svg` | 全部市场与美股市场作用范围、币种和历史区变化 | V2 设计提案 |
| `search-open.svg`、`filter-open.svg`、`filter-applied.svg` | 搜索和筛选的前后状态 | V2 设计提案 |
| `chart-hover.svg`、`chart-gap.svg`、`history.svg` | 曲线选点、缺口、完整历史曲线和日期语义 | V2 设计提案 |
| `holdings-0.svg`、`holdings-5.svg`、`holdings-10.svg`、`holdings-20.svg`、`holdings-50.svg` | 持仓数量级、分页和密度 | V2 设计提案 |
| `contribution-0.svg`、`contribution-5.svg`、`contribution-10.svg`、`contribution-20.svg`、`contribution-50.svg` | 贡献分析数量级和展开 | V2 设计提案 |
| `state-loading.svg`、`state-updating.svg`、`state-stale.svg`、`state-no-fx.svg`、`state-partial.svg`、`state-error.svg` | 异常、更新、缺汇率、部分数据和失败 | V2 设计提案 |
| `tokens.svg`、`controls.svg`、`motion.svg`、`snapshot-options.svg` | 原子样式、控件、动效和 D01 候选 | V2 设计提案；不能替代浏览器验收 |

## 阅读和验收边界

标准视觉比对视口为 1440×1000 和 1280×800，100% 缩放，桌面鼠标/键盘路径分别检查。V2 排除窄屏设计与实现（对应 C34、C38）；不测业务数据库、不写入原始交易、不推送或发布。图稿完成后必须由独立审查者在真实渲染中检查尺寸、层级、状态和点击前后结果；仅有 SVG 文件、DOM 断言或静态截图都不能宣布 accepted。

金额和历史数据以示例数展示，必须在验收时核对计算规则而不是核对示例数字。跨市场全部视图使用 CNY 的统一换算口径；切换到 A 股、港股、美股后分别显示对应市场币种。没有现金和负债覆盖时，持仓市值不称为“总资产”。

## 版本和未决事项

文档日期为 2026-10-16（Asia/Shanghai）。D01“历史持仓日期”目前没有使用频次测量证据：建议作为图点详情的二级入口，保留“核对某日敞口”的能力；是否移除必须由用户确认，本规范不把任一方案写成已决。其余 V2 取舍是本轮提案契约，仍须通过图稿渲染、39 条评论 review 和独立验收。
