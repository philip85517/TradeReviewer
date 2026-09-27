# 主图优先复盘 · 当前交付状态

2026-09-27：**integration-pending，尚未整体接受**。当前发现的回放、布局、记录区、图表生命周期和冲突恢复缺陷均已修复，并由root实测、Astra独立复核。必需的真实手机软件键盘仍unverified，无豁免。

[最新预览](http://127.0.0.1:3049/) · [启动与体验](RUNBOOK.md) · [最终验收记录](FINAL-ACCEPTANCE.md) · [设计覆盖矩阵](DESIGN-COVERAGE.md)

| 已验范围 | 证据 |
| --- | --- |
| 逐K/播放/下一决策、隐藏未来、返回早期与重开 | [R1门槛](repair/reports/R1-astra-final-gate.md)、[R7集成](repair/reports/R7-integration.md) |
| 顶栏/字段尺度、主图与侧栏、390记录区真实滚动与恢复 | [R7集成](repair/reports/R7-integration.md)、[R7独立](repair/reports/R7-coverage-audit.md) |
| Text边缘编辑、图上/留存价标、正式完成状态、PPTX | [R6集成](repair/reports/R6-integration.md) |
| 图表销毁后的异步绘制异常 | [R8集成](repair/reports/R8-integration.md)、[R8独立](repair/reports/R8-astra-disposal.md) |
| 真实保存失败、双窗口冲突与显式重载 | [R9集成](repair/reports/R9-integration.md)、[R9独立](repair/reports/R9-astra-review.md) |
| 修订月结单导入、标签待确认、保存重开 | [真实重导](repair/reports/R10-real-reimport.md)、[独立核对](repair/reports/R10-astra-reimport.md) |
| 价格辅助动作不压右轴、36/44px命中 | [R10集成](repair/reports/R10-integration.md)、[独立核对](repair/reports/R10-astra-review.md) |

本轮实际模型：多个Luna `gpt-5.6-luna / max`实施，Astra `gpt-6-astra / low`验收，root负责集成与真实浏览器。原始合成成交25笔哈希未变；业务库和3022入口未改；未提交、推送、合并。

任务索引：[R1回放](repair/issues/R1-real-replay.md) · [R2文字](repair/issues/R2-text-cards.md) · [R3阶段布局](repair/issues/R3-phase-layout.md) · [R4评价](repair/issues/R4-evaluation.md) · [R5整体验收](repair/issues/R5-acceptance.md) · [R8](repair/issues/R8-chart-disposal.md) · [R9](repair/issues/R9-conflict-reload.md) · [R10](repair/issues/R10-plan-price-action.md)。

[原八票执行方案](PROPOSAL.md) · [前序完整记录（历史，不是当前待办）](README-HISTORY-THROUGH-R9.md) · [原设计交接包](../../docs/deliverables/TradeReview-ChartFirst-DevHandoff-v1.0.zip)
