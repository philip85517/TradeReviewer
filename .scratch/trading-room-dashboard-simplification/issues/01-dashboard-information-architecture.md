# 01 — 交易室首页信息架构与统计呈现

What to build：重组“我的交易室”首屏，让用户先看到统一口径的收益结果与可读趋势，再查看当前持仓；将完整数据质量明细、本金配置迁移到“数据管理”，并统一数字精度、空样本语义和视觉层级。

Blocked by：无。现有交易室范围、回合净盈亏、持仓、数据质量、本金和趋势模型可作为实现基线。

Status: ready-for-agent

Priority: P0

## Problem Statement

当前“我的交易室”进入后先展示一个较大的“统一统计范围”面板，面板占据首屏空间，却主要呈现性质、分类、期间和回合数等控制信息，用户不能第一时间判断收益情况。实盘/模拟盘、资产分类、期间筛选的布局也不够直观，尤其期间选择没有形成用户能快速理解的核心浏览路径。

首屏后续又把业绩摘要、趋势/日历、当前持仓、数据质量、收益质量、本金与参考收益率拆成多个并列模块。结果是：

- 关键的已平仓回合净盈亏、胜率和累计变化不够突出。
- “不可计算”反复出现，用户无法区分暂无样本、数据不足、跨币种不能合计和成本证据不足。
- 趋势图缺少清晰的横轴、纵轴、零基线和点值，无法读出某个月发生了什么以及累计到哪里。
- 收益质量与上方摘要存在重复；数据质量是运维/证据问题，不应在首页占据一个完整面板。
- 本金与参考收益率的输入表单属于配置，却和首页统计并列，削弱了首屏的判断路径。
- 说明文字、辅助文案和低优先级状态过多，数字精度不一致，视觉层级不紧凑。

用户需要的是：默认查看实盘，直接切换“本月 / 近3个自然月 / 今年至今”，先读懂当前范围的收益结果，再通过一张有坐标和数据点的图理解自然月或自然周变化，最后查看当前持仓和需要处理的数据问题。

## Solution

将首页重组为“范围控制条 → 核心业绩摘要与累计趋势 → 当前持仓”的单一主路径。

范围控制不再使用占据大片空间的统计范围卡片，而改成紧凑的两层控制：

1. 第一层用分段开关切换“实盘 / 模拟盘”，默认实盘。模拟盘选中后立即要求选择一个模拟运行，不能跨运行合并财务结果。
2. 第二层提供轻量资产分类选择和三个显眼的期间 Tab：“本月 / 近3个自然月 / 今年至今”。自定义日期、账户、标的、币种、复盘状态、ETF市场等低频控制放入折叠的“更多筛选”。来源未知继续独立，不悄悄归入实盘。

控制条下方首先展示核心业绩摘要：已平仓回合净盈亏、可信已平仓回合、胜率，以及当前适用的交易成本收益率或本金参考收益率。摘要使用统一的当前范围和期间，不再通过单独“统计组”让用户二次选择。没有样本时显示“暂无样本”，证据不足时显示“数据不足”，跨币种无法合计时显示原币小计或明确的“无法合计”，不把这些状态伪装成 0。

摘要下面是一张与摘要完全共享数据范围的累计净盈亏趋势图。默认按自然月分桶；近3个自然月显示三个月，年初至今显示年内自然月，本月可显示日级变化。用户可以在图表内切换“月 / 周”（本月可用日级桶），图表必须提供横轴标签、纵轴金额刻度、零基线、数据点值和累计值；悬停/聚焦数据点时显示该桶的期间净盈亏、累计净盈亏、胜负样本和覆盖日期。月/周切换只改变图表分桶，不改变顶部统计范围或期间。

当前持仓保留现有记录结构和复盘入口，放在趋势图之后。持仓按照当前状态和最近成交排序，不因业绩期间 Tab 被错误地过滤掉；它仍响应实盘/模拟盘、资产分类和高级筛选，并显式标明“当前持仓，截至某日”。

首页移除完整的数据质量、收益质量和本金录入面板：

- 数据质量明细、受影响数量、原因、重试和补充动作集中放入“数据管理”。首页最多保留一条紧凑的“数据状态：部分结果不可用 / 数据待检查”提示，并能直接打开数据管理。
- 收益质量不再作为独立大模块展示。它的必要结果进入核心摘要或趋势点详情；成本收益率的样本与排除原因通过简洁的辅助入口查看。
- 本金与参考收益率的四类本金配置、币种选择、保存/清空和错误提示放入“数据管理”的配置模块。首页只在有意义时展示参考收益率结果，不展示配置表单。

整个页面沿用现有主题，但重新建立文本和卡片层级：主要数字和结论使用高对比度，辅助说明缩短为一行或折叠详情；不使用白色背景上的白色文字或低对比度灰字；金额、百分比和数量的展示最多保留两位小数，底层计算精度不变。

## User Stories

1. As a 实盘交易者, I want to enter the trading room and immediately see the selected period’s closed-episode net P&L, so that I can understand performance before reading filters or diagnostics.
2. As a 实盘交易者, I want the page to default to 实盘, so that simulated results never appear in my first view by accident.
3. As a trading-room user, I want a clear 实盘 / 模拟盘 segmented switch, so that changing trade nature is a deliberate and visible action.
4. As a 模拟盘用户, I want to choose one simulation run immediately after selecting 模拟盘, so that different runs cannot be silently combined.
5. As a trading-room user, I want prominent 本月 / 近3个自然月 / 今年至今 tabs, so that I can change the main reporting period with one click.
6. As a trading-room user, I want the active period to show exact start and end dates, so that “今年至今” and partial current months are not ambiguous.
7. As a trading-room user, I want asset category selection to be compact and visually secondary to the period tabs, so that category filtering does not overpower the performance result.
8. As a trading-room user, I want advanced filters such as account, symbol, currency, review status and ETF market hidden by default, so that frequent actions stay visible without crowding the first screen.
9. As a trading-room user, I want a single unified scope to drive cards, trend, and any detail, so that the same selection never produces contradictory totals.
10. As a trading-room user, I want the primary summary card to show closed-episode net P&L with its period and currency basis, so that I do not confuse it with account equity or unrealized P&L.
11. As a trading-room user, I want the summary to show trusted closed-episode count and wins/losses, so that I can judge how much evidence supports the headline result.
12. As a trading-room user, I want the win rate shown with a concise sample denominator, so that a percentage without sample size cannot mislead me.
13. As a trading-room user, I want the applicable return metric to be shown in one stable summary slot, so that I see either principal reference return or cost return without duplicate large panels.
14. As a trading-room user, I want “暂无样本”, “数据不足”, and “无法合计” to be distinct states, so that “不可计算” does not hide the reason or imply a broken calculation.
15. As a trading-room user, I want a cumulative P&L line chart under the cards, so that I can understand the direction of performance across the selected period.
16. As a trading-room user, I want the chart to show x-axis dates, y-axis money ticks, zero baseline, point values and cumulative values, so that the visualization is readable without guessing its scale.
17. As a trading-room user, I want to switch the chart between natural-month and natural-week buckets where the period supports it, so that I can inspect both broad trend and recent changes.
18. As a trading-room user, I want each chart point to expose period P&L, cumulative P&L, win count, denominator and coverage dates, so that I can explain a change instead of only seeing a line.
19. As a trading-room user, I want mixed-currency charts to use one explicit FX snapshot or show separated original-currency values, so that the chart never adds incomparable amounts.
20. As a trading-room user, I want the current holdings section to remain visible after the trend, so that performance review can lead directly to the positions that need attention.
21. As a trading-room user, I want current holdings to remain current-state data rather than being cut off by the closed-performance period, so that “本月” does not hide a position opened earlier.
22. As a trading-room user, I want each holding to retain its market, asset type, account, quantity, cost, quote status and review entry, so that I can move from summary to a precise episode.
23. As a trading-room user, I want the home page to show only a compact data-status notice, so that data problems are visible without competing with performance.
24. As a data steward, I want transaction credibility, holdings valuation, historical candles, FX status and affected records in 数据管理, so that data repair has one operational home.
25. As a data steward, I want each data-quality issue to expose its reason and supported action, so that I know whether to retry, supplement data, inspect evidence or accept a source limitation.
26. As a trading-room user, I want the principal input forms in 数据管理, so that configuration is separate from reading the performance result.
27. As a trading-room user, I want the home page to retain a concise principal reference return only when its denominator and scope are valid, so that moving configuration does not remove a useful conclusion.
28. As a trading-room user, I want all visible amounts and percentages rounded to at most two decimal places, so that long decimal strings do not obscure the result.
29. As a trading-room user, I want primary numbers and actions to have strong contrast and consistent visual hierarchy, so that the page remains readable in both desktop and narrow layouts.
30. As a reviewer, I want the homepage to distinguish closed-episode net P&L, holdings unrealized P&L, cost return and principal reference return by label, so that no metric is mistaken for a complete account return.

## Implementation Decisions

- Keep one authoritative room scope containing trade nature, simulation run, asset category, period and advanced filters. Do not create separate scope state for cards, trend, holdings or quality details.
- Preserve the existing domain boundary: closed-episode net P&L is based on trusted closed episodes and close-date attribution; current holdings are a separate current-state projection; principal reference return is not account equity return.
- Replace the large scope card with a compact control strip. The primary controls are the trade-nature segmented switch and the three period tabs. Asset category remains visible but compact; custom dates and low-frequency filters remain in a collapsed advanced area.
- Keep the default scope as live / all categories / current natural month / trend view. Unknown-source records remain an explicit separate state and are never included in live totals.
- When simulation is selected, require a simulation run before showing simulation performance. All cards, trend points, and drilldowns use the selected run only.
- Create one overview projection for the page that contains summary metrics, chart buckets, current holdings reference, and short status flags. It should receive one FX snapshot and expose consistent money views to all consumers.
- Extend the performance model with chart points containing bucket label, start/end coverage, period P&L, cumulative P&L, trusted sample count, wins, losses and availability state. The chart must not derive display values independently from the summary.
- Use natural-month buckets by default for three-month and year-to-date periods. Use daily buckets for the current month when that is the most useful resolution, and offer a month/week resolution control without changing the selected scope. If weekly bucketing is used, weeks must have a stable timezone and explicit coverage labels.
- Render a visible zero baseline and axes. Point labels may be selectively shown to avoid overlap, but every point must remain available through hover, keyboard focus or an accessible data table/description.
- Keep cumulative P&L as the main line. Expose each bucket’s period P&L and cumulative value in the point detail; do not label cumulative P&L as account net value.
- Reuse existing trusted episode, FX, cost-return, principal-return and holdings calculations. Simplify their presentation before adding new financial semantics.
- Replace the home-page standalone “收益质量” section with compact sample/exclusion details attached to the relevant card or chart point. The full cost-return exclusion breakdown may remain available from a concise detail action, but it must not be a large default panel.
- Remove the full data-quality dimensions from the homepage. Keep at most one compact status banner or badge with a single action to open 数据管理. Move transaction credibility, holdings valuation, historical candles, FX state, affected records, reasons and actions into a data-management module.
- Move all principal-category input, currency selection, save/clear behavior, validation and persistence controls into 数据管理. The homepage may display the resulting principal reference return as a summary metric only when the scope and denominator are valid.
- Define explicit display states: `available` shows the formatted value; `empty` shows “暂无样本”; `insufficient` shows “数据不足” with a short reason; `not-combinable` shows original-currency subtotals or “无法合计”. Do not replace any state with zero.
- Add shared presentation formatters for money, percentage, quantity and counts. Display precision is at most two fractional digits; calculation precision remains unchanged. Percentages must never expose raw Decimal precision.
- For mixed-currency results, use the same FX snapshot for summary, chart and details. If a complete conversion is unavailable, do not draw a false aggregate line; show separate original-currency series or a concise unavailable state with the original subtotals.
- Keep holdings independent from the performance period. Holdings still respond to trade nature, simulation run, category and advanced filters; they are labeled with the current “as of” date and preserve the direct review action.
- Reduce explanatory text in the default view. Keep one-line scope/coverage text near the relevant result and move longer definitions, exclusion reasons and repair instructions behind details or 数据管理.
- Use existing theme tokens and identity colors. Trade nature identity colors must remain distinct from P&L positive/negative colors, and all text/background combinations must meet the project’s readable contrast expectations in dark and light surfaces.
- Do not change transaction records, episode identity, review identity, source evidence or SQLite schema unless implementation discovers a strictly necessary persistence gap. This change is primarily a view-model and presentation reorganization.

## Testing Decisions

- Test external behavior at the highest existing seam: render the complete `ReviewDashboard` with deterministic trade-library fixtures and assert the visible default controls, summary order, scope synchronization, chart content, holdings presence and removed/relocated panels.
- Extend the existing room performance component tests to verify visible axes, zero baseline, x-axis bucket labels, y-axis amount labels, point/cumulative values, month/week resolution and empty/insufficient states.
- Add model-level tests for the single overview projection: the same scope and FX snapshot must produce matching summary net P&L, chart cumulative endpoint and period detail totals; no sample must remain distinct from unavailable data.
- Add fixed-clock tests for the three period tabs, current-month daily buckets, three-natural-month coverage, year-to-date monthly buckets, cross-year boundaries and partial current months.
- Test simulation switching through the public controls: entering simulation requires a run; switching runs updates cards and trend together; returning to live does not retain an invalid run’s totals.
- Test category and advanced-filter changes clear invalid chart drilldowns and do not leave values from the previous scope visible.
- Test mixed-currency behavior with complete FX, incomplete FX and same-currency scopes. Verify no cross-currency aggregate or line is presented without a valid conversion basis.
- Test display formatting through rendered user-visible values: money, rates and quantities have no more than two fractional digits; counts remain integers; no raw long Decimal string appears.
- Test that the homepage no longer renders the full data-quality dimensions or principal input fields, while the data-management page renders both modules and preserves their retry, inspect, save and clear actions.
- Test that current holdings remain visible for a period with no closed episodes, and that the holdings section still routes to the correct episode.
- Reuse prior art from the existing dashboard integration tests, room performance tests, room quality tests, room principal tests and data-management slot tests. Prefer accessible roles, labels and visible text over implementation selectors.
- Browser acceptance must cover one desktop and one 390px/narrow viewport. Verify the first screen prioritizes period tabs and core results, the chart has readable axes, no horizontal overflow appears, holdings remain reachable, and the data-management entry works.
- Any browser flow that writes reviews, settings or data-management state must use a SQLite consistency backup, an isolated database and an isolated port. After acceptance, compare source and isolated database counts/integrity and confirm original trade data is unchanged.

## Out of Scope

- Building a complete account-equity, cash-balance or real-time portfolio-net-worth system.
- Adding benchmark/index comparison, “跑赢大盘” conclusions or a historical FX database.
- Changing the definition of trusted closed-episode net P&L, episode identity, execution identity or source evidence.
- Merging live trades, unknown-source trades, or different simulation runs into one financial result.
- Adding a historical daily holdings time-series product. The existing current holdings projection remains the first version.
- Adding new import formats, market-data providers or automatic repair algorithms.
- Removing the ability to inspect data-quality reasons, cost-return exclusions or principal configuration; those details move to the appropriate data-management/detail surfaces.
- Replacing the trade library, replay workspace or pattern-insights navigation.
- Introducing a new persistent settings schema unless required to preserve an existing behavior during the move to 数据管理.

## Further Notes

- The current baseline already contains the domain vocabulary and seams needed for this work: a unified room scope/model, performance calendar/trend, holdings projection, quality model, principal settings and a data-management page with injectable quality/FX slots.
- The design deliberately treats “首页更紧凑” as an information-priority change, not as a pure CSS shrink. The user should see fewer competing sections because the product answers one sequence: performance → change over time → current positions → data actions.
- “数据不足” must remain honest. A concise homepage does not justify converting missing fees, missing FX, incomplete history or unavailable quotes into zero or a fabricated aggregate.
- The user’s requested “三个切换的 Tab/周期” is resolved here as the primary period tabs 本月 / 近3个自然月 / 今年至今. Custom periods remain available under advanced controls rather than taking first-screen space.
- The implementation should preserve the active scope when navigating to and back from review, provided the scope is still valid. Invalid simulation runs or drilldowns must be cleared rather than displayed with stale totals.
- The first implementation pass should prioritize the new homepage information architecture and the shared trend/summary model. Visual polish follows the same pass, with desktop and 390px acceptance before claiming completion.
