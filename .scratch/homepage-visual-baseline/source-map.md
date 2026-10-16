# 首页来源图与当前契约（master 7a5d137d）

## 版本与证据边界

本记录冻结于 `master`、`HEAD=7a5d137da3dcdf0f133a29714ee269693746472b`，该提交与 `origin/master` 一致。研究对象是当前源码组合，不是旧合成样板，也不是其它 worktree 的工作树画面。

本票明确不启动服务、不使用浏览器、不读写业务库。因此下面的 source evidence 只证明 JSX/CSS/状态实现；控件、键盘、触摸、真实数据持久化、截图和 computed style 均记为 `NOT VERIFIED`，不能据此宣称浏览器 PASS。视觉比较的目标视口仍按 DESIGN-COVERAGE：1440×1000 与 390×844；响应式还须检查 1280、1055/1054、820/821、760/759、320px 边界。

来源：

- 组装入口：[review-dashboard.tsx](../../app/components/dashboard/review-dashboard.tsx:1138)，样式：[review-dashboard.module.css](../../app/components/dashboard/review-dashboard.module.css:1262)。
- 子模块：`room-portfolio-summary.tsx`、`room-holdings-history.tsx`、`room-allocation.tsx`、`room-holdings.tsx`、`room-performance.tsx`、`room-contribution.tsx`、`room-pending-reviews.tsx`、`trading-room-global-tools.tsx`。
- 业务默认值：[trading-room-scope.ts](../../app/lib/reviews/trading-room-scope.ts:219)。批准意图：[2026-09-19 首页规格](../../docs/specs/2026-09-19-trading-room-homepage.md)、[2026-09-21 反馈规格](../../docs/specs/2026-09-21-trading-room-homepage-feedback.md)。

## 页面组合和可复用文案

渲染顺序是：`UnifiedPageHeader`（我的交易室）→ 收起的共享筛选条 → `持仓照看`工作区 → `历史交易与复盘`工作区。页头的副标题是“持仓照看 · 复盘总结 · 持续进化”，右侧状态是“数据更新：{时间}”，没有时间时为“不可用”（`review-dashboard.tsx:1139-1148`）。筛选条展开后显示“交易室共享范围”、进入范围的回合数、市场分类、可选模拟运行和“更多筛选”。

持仓区固定显示“关注当前仓位，回看历史持仓变化”和“当前时点 · {asOf}”。有权限时依次显示当前持仓概览、历史持仓曲线与当前持仓资产分布、当前持仓表；模拟盘未选运行时显示“请选择一个模拟运行查看独立持仓与历史，不会跨运行合并。”（`review-dashboard.tsx:1188-1260`）。

历史区显示“回顾已完成的交易，总结经验 · {startDate} 至 {endDate}”，可进入交易库；摘要四卡为“已平仓回合净盈亏 / 完整回合数 / 合计胜率 / 待复盘”，并有“查看口径说明 → 查看统计口径 / 查看收益率解释与参考 / 查看原币与汇率详情”。金额的源码文案明确“按平仓日期统计，已扣费用，不含浮盈亏”；未知资产和排除样本保留单独提示；无行时为 `emptyRoomMessage`（`review-dashboard.tsx:1262-1345`）。其后是趋势、贡献分解、盈亏日历和“待复盘的已完成交易”（`review-dashboard.tsx:1346-1369`）。

## 默认值和状态契约

`createDefaultRoomScope()` 的默认值是：性质 `live`（实盘）、资产分类 `all`（全部市场）、资产类型 `all`（全部资产）、统计期间 `ytd`（今年至今，起点为当年 1 月 1 日、终点为今天）、`simulationRunId=null`、账户/标的/市场/币种/复盘状态数组均为空（`trading-room-scope.ts:219-231`）。报告计价由共享 scope 决定，若无共享值使用本地 `original`；选项为原币/HKD/CNY（`review-dashboard.tsx:600-602,1104-1115`）。首屏筛选默认收起，浏览状态是持仓搜索空、持仓页 1、待复盘页 1、日历当前月且无选中日期（`review-dashboard.tsx:251-264,562`）。

切换性质到 `simulation` 会显示“模拟运行”选择；未选运行且没有规范模拟范围时，持仓区不渲染数据并显示独立运行提示，历史区显示“请选择一个模拟运行后查看该运行的独立统计；不会跨运行合并。”；`unknown` 保留来源未知范围，但不并入实盘/模拟参考资本。`roomFilterCount` 只计算附加标的、账户、资产类型、市场、币种、复盘状态和模拟运行，清除附加筛选不重置性质、账户和计价。日期编辑是草稿，点击“应用期间/应用观察期间”才更新，取消恢复旧范围；无效区间进入 `role=alert` 错误状态。

所有财务值区分可信、部分覆盖、缺少 FX、未知资产、未来、无样本和错误。源码中的 `不可用`、`暂无样本`、`范围外`、`数据不足`、`多币种无法合计`、`现金数据加载中…`、`现金数据读取失败：…`、`现金数据暂不可用` 等文案必须保留，不把未知转换成 0。

## 控件、交互与源行号登记

下表是当前首页完整的源码控件清单。`NOT VERIFIED` 是本票限制下的状态，不是实现失败；root 仍须在真实浏览器补做 DOM/AX、鼠标、键盘、粗指针和持久化旅程。

| 区域/元素 | 源位置与可见标签 | 默认/动作/状态 | 证据 |
| --- | --- | --- | --- |
| 页头性质 | `review-dashboard.tsx:1075-1085`，`交易性质` | 实盘；实盘/模拟盘/来源未知；改变范围并联动数据 | `NOT VERIFIED` |
| 页头账户 | `:1086-1094`，`账户范围` | 全部账户；切换单账户 | `NOT VERIFIED` |
| 页头模拟运行 | `:1095-1103`，`模拟运行` | 仅模拟盘相关时出现；“请选择运行”或运行列表 | `NOT VERIFIED` |
| 页头计价 | `:1104-1116`，`报告计价` | 原币；原币/HKD/CNY；FX 缺失需保留原因 | `NOT VERIFIED` |
| 全局标的搜索 | `trading-room-global-tools.tsx`；`搜索标的`、`搜索已导入标的` | 空搜索、加载、错误、无结果、结果 listbox；清除搜索和打开结果 | `NOT VERIFIED` |
| 通知/用户菜单 | `trading-room-global-tools.tsx`；待处理事项、账户与计价 | 铃铛 badge、待处理 dialog、关闭、Esc/外点关闭、用户菜单 | `NOT VERIFIED` |
| 页头筛选 | `review-dashboard.tsx:1148`；`筛选` | 默认收起；`aria-expanded` 展开/收起；数字表示附加筛选数 | `NOT VERIFIED` |
| 市场分类 | `:1154-1156`；全部市场/A股/美股/港股 | 单选；变更会清空 markets 细分 | `NOT VERIFIED` |
| 模拟运行（展开筛选） | `:1156`；请选择运行/运行项 | 仅模拟盘条件出现 | `NOT VERIFIED` |
| 标的附加筛选 | `:1159-1163`；名称或代码 | details 默认收起；search 输入 | `NOT VERIFIED` |
| 账户/资产/市场/币种/复盘 | `:1163-1175`；全部账户、全部资产/股票/ETF、全部市场、全部币种、全部状态 | radio/select；选中后生成 filter chip | `NOT VERIFIED` |
| 清理范围 | `:1177-1183`；清除附加筛选、恢复默认范围、移除…筛选 | 清附加不改共享性质；恢复默认回到 `createDefaultRoomScope` | `NOT VERIFIED` |
| 持仓历史期间 | `:1204-1217`；近1月/近3月/今年/全部 | 默认同首页当前期间；切换历史观察曲线 | `NOT VERIFIED` |
| 持仓自定义日期 | `:1218-1231`；起始日期/结束日期/应用观察期间/取消观察期间 | details 草稿；错误 alert；可重试历史计算 | `NOT VERIFIED` |
| 持仓曲线指标/粒度 | `room-holdings-history.tsx:187-205`；市值/未实现盈亏/收益率，日/周/月 | 默认 `marketValue`、`day`；切换曲线，选点显示 tooltip/详情 | `NOT VERIFIED` |
| 持仓曲线日期 | `room-holdings-history.tsx:252-285`；关闭持仓详情、历史持仓日期 | SVG 交互、tooltip 关闭、日期 select；无日期提示 | `NOT VERIFIED` |
| 资产分布维度 | `room-allocation.tsx:22-24,241-267`；按市场/按资产类型 | 默认按市场；`aria-pressed`；原币多币种出现币种 tab | `NOT VERIFIED` |
| 现金诊断 | `room-allocation.tsx:195-209` | 加载/读取失败/暂不可用/有数据；现金基准详情 details | `NOT VERIFIED` |
| 当前持仓排序 | `room-holdings.tsx:431-440`；最近成交/浮盈亏 | 默认最近成交；不可比较币种时禁用浮盈亏并给出原因 | `NOT VERIFIED` |
| 当前持仓搜索/导出 | `room-holdings.tsx:440`；搜索持仓、导出当前筛选 CSV | 输入重置页 1；空筛选禁用导出 | `NOT VERIFIED` |
| 持仓行详情/诊断 | `room-holdings.tsx:344-361`；详情、估值说明、核对持仓证据、重试行情、看图·记录 | 行级 details；估值不可用时可核对/重试；重试中禁用并报告状态 | `NOT VERIFIED` |
| 持仓分页 | `room-holdings.tsx:453`；上一页持仓/第 N 页/下一页持仓 | 每页 5；当前页 disabled + `aria-current` | `NOT VERIFIED` |
| 历史统计期间 | `review-dashboard.tsx:1271-1297`；近3月/今年/全部 | 当前默认 YTD；自定义统计日期可应用/全部历史/取消 | `NOT VERIFIED` |
| 交易库入口 | `review-dashboard.tsx:1264-1270`；进入交易库 | 传递关闭日期、全部复盘状态、pending source snapshot | `NOT VERIFIED` |
| 口径 details | `review-dashboard.tsx:1312-1337` | 查看统计口径、收益率解释与参考、原币与汇率详情 | `NOT VERIFIED` |
| 趋势视图 | `room-performance.tsx:451-467,650-850` | 默认 `trend`、P&L、趋势层级按期间推导；SVG 点命中区、键盘 Enter/Space、重合点候选、趋势数据 details | `NOT VERIFIED` |
| 日历层级与翻页 | `room-performance.tsx:855-878` | 月/年/全部年份；上一月/下一月或上一年/下一年；未来 disabled；范围路径返回上一范围 | `NOT VERIFIED` |
| 日历单元格/详情 | `room-performance.tsx:879-916` | 无样本、范围外、未来、可信/排除状态；点击日期展开汇总、交易行和打开复盘 | `NOT VERIFIED` |
| 贡献分解 | `room-contribution.tsx:43-67` | 市场/标的/账户；原币/折算/FX 不可用；无可信样本文案 | `NOT VERIFIED` |
| 待复盘列表 | `room-pending-reviews.tsx:123-155` | 按最近平仓日期；空列表文案；查看全部待复盘；开始复盘；页码 | `NOT VERIFIED` |

## 精确 CSS 与响应式来源

`review-dashboard.module.css` 前段保留旧的浅色变量和通用规则，后段 B2 规则从 1262 行开始覆盖它们；因此源码基线的最终级联值以较后规则为准。根容器在 B2 规则中是 `max-width:none; padding:0 24px 34px; background:#0b1220`（`1262-1270`），页头宽度 `calc(100% + 48px)`、左右负 24px（`1272-1275`）。

最终桌面主题（`@media (min-width:821px)`，`1462-1476`）：正文 `#edf5ff`，辅助 `#9ab0ca`，分隔 `#2a4667`/软分隔 `#203955`，软面 `#172b44`，卡片 `#101d31`，raised `#142740`，蓝色 `#168dff`，链接 `#53a9ff`；盈亏正/负强制为 `#00d5b6`/`#ff6b78`。全局 B2 规则的顶栏高约 54px、底部边线 1px `#243145`、间距 12px（`1277-1285`）；标题 19px/1.1，说明 10px（`1288-1292`）。

关键几何：共享工具条边框 `#243145`、圆角 8px、内距 `6px 9px`，无阴影（`1328-1335`）；radio 36px、14px，更多筛选 summary 36px/圆角 6px（`1336-1343`）；chips 高 36px，删除按钮 36px（`1343-1359`）；工作区 margin-top 16px、内距 12px、圆角 9px、边框 `#2a4d73`（`1368-1374`）；工作区标题 19px，间距 6px（`1375-1377`）；持仓总览两列 `2fr/1fr`、gap 8px（`1398`）；历史摘要四列（`1233`）；桌面历史区摘要与口径细节使用三列、gap 7px/6px，卡片最小高 76px，数值 18px（`1492-1578`）。

通用交互命中区仍由前段规则提供：`.segmentedButton` 最小高 44px、圆角 7px、左右 10px、字体 14px（`216-241`）；radio option 最小高 30px、radio 15×15（`264-280`）；日期编辑 input 36px，按钮 36px（`366-404`），但粗指针/窄屏强制日期、应用/取消和 summary 至少 44px（`1310-1315,1429-1436`）。筛选输入/普通 select 高 44px、圆角 9px（`695-731`）。

边界契约：`@media (max-width:1054px)` 将持仓总览改为单列（`1589-1591`）；`max-width:980px and min-width:760px` 允许顶栏工具换行（`1403-1409`）；`max-width:759px` 根 padding `0 16px 30px`、页头负 16px、顶栏纵向排列、工具满宽、workspace padding 10px（`1411-1422`）；`max-width:720px` 工作区 padding 12px/标题纵向排列（`1223-1226`）；`max-width:320px` 根 padding 12px、页头负 12px（`1424-1427`）；`max-width:820px` 仍将正/负色设为亮色（`1441-1446`）。这些是源码数值，未经过渲染截图验证。

全局工具样式：[trading-room-global-tools.module.css](../../app/components/dashboard/trading-room-global-tools.module.css:1)：搜索框 36px、圆角 6px、字体 14px；图标按钮 36×36、用户头像 27×27、badge 最小 16px；面板圆角 11px、内距 9px、宽度 `min(360px, calc(100vw - 28px))`；搜索结果弹层宽 `min(340px, calc(100vw - 28px))`、最大高 `min(420px, ...)`；`max-width:759px` 工具/输入至少 44px。

## 当前源码与批准设计的交叉核对

已实现且可从源码复用的规则包括：首屏实盘/YTD/全部市场默认；实盘、模拟盘、来源未知隔离；关闭交易净盈亏与当前持仓浮盈亏分开；不确定样本显示原因；原币和 FX 快照的可用性文案；日历月/年/全部年份和范围返回；持仓诊断动作；历史返回交易库携带筛选上下文。以上仍需真实数据流与浏览器验证。

规格中的“首页顺序：快捷筛选 → 业绩摘要与趋势 → 当前持仓 → 可折叠收益质量详情”是产品意图；当前 master 的实际组合是先“持仓照看”（概览/历史估值/资产分布/当前持仓），再“历史交易与复盘”（摘要/趋势/贡献/日历/待复盘）。制作基线图文时必须按当前 JSX 顺序标注，不能按旧稿重排。

## 历史候选差异（不可作为 master 基线）

- `/Users/zhoulin/.codex/worktrees/4ca2/TradeReview` 的 `codex/homepage-iteration-20261011`，HEAD `609889c0`，包含 2026-10-14 checkpoint；其 `docs/design-system/TradeReview-首页拉齐-v0.2.md` 明确标为“候选”，虽以 `7a5d137d` 为结构参考，却含工作树修复和预览规则。候选提出 14/22px 正文、12/18px 辅助、桌面控件 ≥36px、窄屏/粗指针 ≥44px、`#0b1220/#111a2b/#182337` 色板和 1440/1280/1055/760/390/320 视口；这些可作为待选视觉对照，不能改写当前基线。
- 4ca2 的 `609889c0` 还改动 `review-dashboard.tsx` 428 行、`review-dashboard.module.css` 99 行和 global tools 98 行；因此其截图、computed 值和控件行为均是未合并候选。候选 checkpoint 自己记录 acceptance-failed，不能当作已接受证据。
- `/Users/zhoulin/.codex/worktrees/0ff3/TradeReview` 的 `codex/holdings-valuation-repair`，HEAD `b95929ad`，改动首页 JSX/CSS 和持仓估值诊断；其历史 `.scratch` acceptance 文档保留了 FAIL/NOT VERIFIED，且报告指出浏览器、性能和视觉门仍开放。它可用于追溯“缺行情/现金/估值说明/持仓动作”的候选修复理由，不能当作 master 当前画面或状态事实。
- `.scratch/homepage-usability`、`.scratch/trading-room-homepage-feedback-20260921` 等旧稿/历史验收只用于决策背景。若与本文件 source line 冲突，以 7a5d137d 的当前源码为准，并在新证据中标明差异。

## 本票交付状态

本文件完成 source-only 研究；CSS 精确值、控件登记、状态文案和候选差异已覆盖 H01-H04。浏览器/截图/真实数据库旅程按要求未执行，全部保持 `NOT VERIFIED`，留待 root 独立验收。
