# R5 — 逐功能验收三阶段复盘与三图一表

ID: chart-first-repair-R5
State: open
Status: integration-pending
Assignee: root；astra_r1_gate (gpt-6-astra / low)
集成负责人: root；逐点验收 Astra Light

2026-09-27当前：桌面/窄屏及全部当前已发现缺陷已限定复验；最终R10 chart43/runtime5/type/lint/build通过；整体仍因真实手机键盘unverified待集成接受。 见[最终记录](../../FINAL-ACCEPTANCE.md)、[R10](../reports/R10-integration.md)。下方旧轮次当前/失败描述均保留作历史。


2026-09-27 R7 当前状态：R7工作区最终128/128通过，首轮14fail与中间1fail日志保留。R6实际PPTX、完成→交易库→刷新、Text与价格标签反例已闭环。当前等待More修复后最新build/真实图/浏览器错误与数据摘要；最终整体仍未接受。 证据：[R7覆盖审计](../reports/R7-coverage-audit.md)、[R7证据定位](../reports/R7-evidence-gaps.md)、[R6集成](../reports/R6-integration.md)。此前段落为历史。

## Scope / What to build

对R1–R4进行功能、状态、视觉、持久化和导出独立验收，已知失败回交原owner；不把历史模块通过当本次整体完成。

## Refs

[Astra逐点计划](../astra-acceptance-plan.md) · [覆盖矩阵](../../DESIGN-COVERAGE.md) · [准确导出参考图](../../../../docs/designs/2026-09-25-chart-first-review/06-export-storyboard.png)

## Blocked by

- [R1 首次集成门槛](R1-core-gate.md)（closed / accepted）

R2–R4是本票的被验收对象，不是必须先关闭的依赖；各自产品冻结后即可逐项验收并将失败交回owner。整体接受仍要求所有范围内实现和必需验收完成。该拆分避免“实现票等待验收、验收票等待实现票已接受”的循环依赖，不改变任何验收标准。

## 验收标准与反例

- [ ] E01–E22、US01–44和Astra J01–J10逐项有范围明确的结果及证据，无遗漏。
- [ ] root真实浏览器贯通新回合→计划→Text→回放→修订→退出评价→回看→保存重开→选图→PPTX，原成交摘要不变。
- [ ] 新鲜导出三图和可编辑表可离线打开，图形/批注/轴/冻结版本正确，缺阶段明示。
- [ ] 1440/1280/390/导航展开的同状态图及测量；真机键盘单列，不假称通过。
- [ ] 自动化、类型、构建、代码审查分别确认，范围内fail或必需unverified阻止整体accepted。
- [ ] 运行中已实测的预览有从头体验样本与完成成果，启动说明及当前聊天链接齐备。

## 证据

初始 unverified。最终记录同步原README、FINAL-ACCEPTANCE和矩阵，保留历史。
