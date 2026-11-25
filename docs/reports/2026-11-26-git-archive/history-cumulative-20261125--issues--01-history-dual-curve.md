> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 历史盈亏默认双曲线

State: closed
Status: accepted
Assignee: history_curve_impl
集成负责人: 主代理
Blocked by: 无

What to build / Scope：按上级README与PLAN，真实首页历史net模式默认显示各期和累计两条曲线；保留其余指标。实现文件所有权仅 full-history.tsx、history.css、full-cutover.test.tsx。禁止后端改动、业务库写入、提交及推送。

Refs：[契约](history-cumulative-20261125--README.md)、[逐项设计与验收](history-cumulative-20261125--DESIGN-COVERAGE.md)、[实施计划](history-cumulative-20261125--PLAN.md)。实现前阅读精确原稿及项目工作流。

- [x] HC01–HC05及少量定向测试通过。
- [x] 主代理独立浏览器验收与视觉对照，提供仍运行的预览。
- [x] 累计末值与范围总额一致；缺失与未来不补零。

2026-11-26 主代理独立接受，证据与范围限制见 [FINAL-ACCEPTANCE](history-cumulative-20261125--FINAL-ACCEPTANCE.md)。不提交、不推送，保留工作树所有原有修改。

反例：累计大于所有各期值时不被裁切；无成交月份保留累计线；未知累计断线；未来没有点。证据在 ../evidence/，实现报告写 ../IMPLEMENTATION.md。
