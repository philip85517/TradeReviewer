# R1 — 逐K和快进在真实主图可见且不泄露未来

ID: chart-first-repair-R1
State: open
Status: integration-pending
Assignee: root (luna_replay_chart + luna_replay_state + luna_frame_contract)
集成负责人: root；独立验收：astra_repair_acceptance（历史）＋ astra_r1_gate（最终门槛）

2026-09-27 R7 当前状态：R1核心真实逐K/播放/同K分笔/返回早期已接受；R5/R6补充手动价窗、低价成交及live/retained边界已通过。当前布局state改动后由root复核resize和双截止；尚不扩大为全feature接受。 证据：[R7覆盖审计](../reports/R7-coverage-audit.md)、[R7证据定位](../reports/R7-evidence-gaps.md)、[R6集成](../reports/R6-integration.md)。此前段落为历史。

## Scope / What to build

从入场前逐根/播放/下一决策，真实主图展示当前已知行情和成交；Text 后回看、保存重开不泄露未来。对应原01票及 E01/E02/E04/E05/E06/E07/E19/E20。先收敛顶底框架满足首张视觉门槛；侧栏内容和代表图详细交互仍归 R3。

## Refs

- [覆盖矩阵](../../DESIGN-COVERAGE.md)、[状态合同](../STATE-CONTRACT.md)、[执行与文件所有权](../PLAN.md)
- [准确画板02](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)、[04](../../../../docs/designs/2026-09-25-chart-first-review/04-holding-stage.png)
- [根因及既有反例](../../reports/iteration-root-cause.md)

## Blocked by

None。2026-09-26 19时首次核心旅程已获 Astra scoped pass，R2–R4 可继续。整票扩展验收仍待 R5，不等同 accepted。

## 验收标准与反例

- [ ] 全新回合→下一根/每秒播放→跨出初始视野：K线、时间轴、当前仓位一致，暂停保持。
- [ ] 推进较远→回看买入前→下一决策：到首笔成交而非旧holding末尾；同K决策独立。
- [ ] 盲看不显示已平仓/后续退出/最终盈亏；直接看末笔/未来快照后返回标记已看后续，重开保留。
- [ ] resize/侧栏/刷新不推双游标、不跳窗口；输入/Text/IME不推进，Text归属不随普通逐K改变。
- [ ] 成交为菱形+动作文字，受显示设置与成交截止约束，截图一致。
- [ ] 末尾有原因与回看入口；已完成成果可非破坏性回到买入前，不清空记录。
- [ ] Astra逐项审查及root真实主图浏览器证据；相关回归测试/typecheck通过。

## 证据

Luna A报告 [R1-chart.md](../reports/R1-chart.md)；Luna B报告 [R1-state.md](../reports/R1-state.md)。状态独立诊断 [6/6 通过](../reports/diagnostic-after.txt)，仅为自动化层。

2026-09-26：真实首帧 [截图](../reports/R1-frame-intermediate-1440.png) 的 E19 占高不通过，见 [Astra 二次报告](../reports/R1-astra-frame-followup.md)。frame/state owner 正在将次级动作收进同一个记录入口。图表尚未完成真实浏览器验收，R2–R4 保持阻塞。原 F1–F3 静态问题局部解除，不代表本票接受。

后续进展（不覆盖上述失败历史）：默认底栏已在 1440×900 浏览器实测为 48px、图表为 750px，见 [尺寸记录](../reports/R1-frame-measurements.md)。状态实现冻结，39 项 workspace 与 30 项 integration 定向测试通过；首笔买入返回事前仍保留已看后续来源。图表 C1–C3 返修和真实完整旅程尚待独立复验，票状态保持 acceptance-failed。

17时真实连续播放新增失败：当前K/截止已推进9月4日，实际主图只到8月20日，Astra确认 cutoff 与 K 开盘时间不一致导致错误回退到最后成交，返原 chart owner；同时主条关键持仓值被省略号截断，返 state/frame owner。见 [最新 gate](../reports/R1-astra-final-gate.md) 与 [真实旅程](../reports/R1-browser-journey.md)。R2–R4 继续等待。

18时进展：连续播放已实测推进至9月24日并停止；早期缩窗的chart修复和阶段恢复修复待整条真实复验。999997同K三笔逐步揭示正确，但清仓菱形右缘裁切、工作区成交点击接线/边界恢复仍需修正，A/B正在收尾；Astra未解除门槛。
