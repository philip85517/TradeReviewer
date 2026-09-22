# 交易室首页反馈修复

状态：in-progress（逐条复验未通过）  
功能编号：`trading-room-homepage-feedback-20260921`  
来源：第二版首页问题 review PDF（2026-09-21）  
规格：[交易室首页反馈修复规格](../../docs/specs/2026-09-21-trading-room-homepage-feedback.md)

本功能把 PDF 中的反馈收敛为一条简约、聚焦、清晰的首页修复路径：

- 顶部范围/视图切换与市场分类；
- 更多期间的可见交互；
- 收益概览与趋势合并；
- 趋势点详情、坐标和日历可读性；
- 当前持仓的负持仓与行情不可用诊断。

任务：[01 — 首页反馈修复设计与实施](issues/01-homepage-feedback-fixes.md)

实施计划：[交易室首页反馈修复实施计划](../../docs/superpowers/plans/2026-09-21-trading-room-homepage-feedback.md)。

首轮实现及自动化检查已完成，但 2026-09-21 对原 PDF 的逐条浏览器复验发现图表坐标与比例、月历窄屏、文本密度、负持仓证据判断等未完成项，不能视为全部通过验收。最新结论见 [acceptance-review.md](acceptance-review.md)；首轮执行记录保留于 [verification.md](verification.md)。
