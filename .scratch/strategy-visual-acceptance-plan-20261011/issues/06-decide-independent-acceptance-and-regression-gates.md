# 06 — 决定独立验收、回归和发布门槛

ID: strategy-visual-acceptance-plan-20261011-06
Labels: wayfinder:grilling
Mode: HITL
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / Decision question

把功能正确性、真实端到端/持久化、视觉还原、可访问性/对比度、版本回归和最终预览检查转换为发布门槛。决定每个门槛的 owner、最小证据、PASS/FAIL/NOT VERIFIED 语义、失败后的重开范围、独立视觉审查角色和可保留的已知例外。

这张票不接受“总体感觉 OK”“测试全绿”“无溢出”“HTTP 200”作为整页通过，也不让实现者自签视觉 PASS。

## Refs

- [验收标准草案](../acceptance-standard.md)
- [UI 任务与验收模板](../../../docs/agents/ui-task-templates.md)
- [本地 issue tracker 生命周期](../../../docs/agents/issue-tracker.md)
- [开发工作流独立门槛](../../../docs/agents/development-workflow.md)
- [严格回归历史记录](../../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)
- [DESIGN-COVERAGE P08/P09/P10](../DESIGN-COVERAGE.md)
- [01–05 票据](00-map-strategy-visual-acceptance.md)

## Blocked by

- [01 — 冻结 0.7 基线与同状态比较矩阵](01-freeze-baseline-and-comparison-matrix.md)
- [02 — 决定共享视觉合同与上下文例外](02-decide-shared-vs-context-specific-visual-contract.md)
- [03 — 决定 S0/S1/S2 双截止与未来信息门槛](03-decide-stage-cutoff-and-future-information-acceptance.md)
- [04 — 决定响应式、密度与长内容契约](04-decide-responsive-density-and-long-content-contract.md)
- [05 — 决定公共组件推广边界与例外登记](05-decide-shared-component-rollout-boundaries.md)

## 验收标准与反例

- [ ] Resolution 明确三道门槛分别需要什么证据，明确纯文档票与 UI/写入票的适用范围。
- [ ] 规定截图/录制必须对应最终版本，并包含 CSS viewport、DPR/缩放、数据、状态、滚动和导航信息。
- [ ] 规定独立视觉审查者不得参与被审 UI 实现；缺少直接看图、真实主图或持久化证据时保持 `NOT VERIFIED`。
- [ ] 规定回归时保留旧图/FAIL/NV，受影响 issue、README、DESIGN-COVERAGE、FINAL-ACCEPTANCE 同步重开。
- [ ] 规定最终交付必须有真实浏览器仍运行的可点击预览 URL和启动/重启方式；纯文档票明确不适用浏览器门槛。
- [ ] 反例：实现者自己截图自己签视觉 PASS；一次组件测试替代整个 Workbench；刷新后状态丢失但因保存 callback 返回成功而通过。
- [ ] 用户确认结论写入独立 Resolution，并链接到 `acceptance-standard.md` 的对应条目。

## 验收证据

- 门槛表、角色分工、重开规则、证据命名约定和一份失败示例/未验证示例。
- 本规划回合不运行产品验收；后续实现票必须按 Resolution 生成 acceptance record。

## 派发说明

这是验收策略决策票。允许修改规划验收文档、覆盖矩阵和 Resolution；禁止关闭历史 FAIL/NV、修改生产实现或将用户选择外推到未覆盖的上下文。

## 历史

- 2026-10-11：创建，等待 01–05 的合同。
