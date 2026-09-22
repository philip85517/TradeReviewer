# 首页验收缺口修复

状态：completed（本次修复范围已验收；完整测试的历史BOC fixture缺失单独记录）

交付：[验收及重启说明](acceptance-report.md) · [独立审查](independent-review.md) · [预览](http://127.0.0.1:3003/)

来源：[逐条验收记录](../trading-room-homepage-feedback-20260921/acceptance-review.md)。用户已确认开始迭代（2026-09-21）。

1. [修正趋势图坐标、比例与点详情](issues/01-trend.md)
2. [修复日历可读性和窄屏布局](issues/02-calendar.md)
3. [核实负持仓证据并修正状态判断](issues/03-position-evidence.md)
4. [精简收益卡片并提供可操作的详情](issues/04-summary.md)
5. [完善持仓行情诊断与处理反馈](issues/05-quotes.md)
6. [修复期间切换造成的视图重置](issues/06-view-state.md)
7. [按PDF完成整体验收与交付](issues/07-acceptance.md)

1–6无业务阻塞，7依赖全部修复。按文件所有权分三组实施，共享组件由单一负责人顺序处理。

不新增赔率、夏普或行情源，不修改原始交易数据，不提交/推送/合并。既有工作区改动全部保留。
