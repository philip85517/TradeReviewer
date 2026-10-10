# 05 — 决定公共组件推广边界与例外登记

ID: strategy-visual-acceptance-plan-20261011-05
Labels: wayfinder:grilling
Mode: HITL
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / Decision question

在共享视觉合同、上下文例外和响应式原型确定后，决定哪些变化可以推广到公共样式/组件，哪些必须 opt-in 或保留在策略 A、RecallWorkspace、Canvas/导出层。范围包括 `app/globals.css` token、Button/Input/Select/Popover、ChartToolbar/DrawingToolbar、RecallWorkspace、ReplayChart/DrawingCanvas、策略台正式实现和 `docs/agents` 规则。

每项推广必须指向一个已接受的视觉/状态证据；每个例外必须有 owner、版本、验证视口和退出条件。静态样板内存状态不能直接成为业务实现接口。

## Refs

- [0.7 选定后推广范围](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [共享视觉候选](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md)
- [UI 任务与验收模板](../../../docs/agents/ui-task-templates.md)
- [拆票标准](../../../docs/agents/task-decomposition.md)
- [DESIGN-COVERAGE P03/P06/P08/P10](../DESIGN-COVERAGE.md)
- [02 共享视觉合同](02-decide-shared-vs-context-specific-visual-contract.md)
- [04 响应式原型](04-decide-responsive-density-and-long-content-contract.md)

## Blocked by

- [02 — 决定共享视觉合同与上下文例外](02-decide-shared-vs-context-specific-visual-contract.md)
- [04 — 决定响应式、密度与长内容契约](04-decide-responsive-density-and-long-content-contract.md)

## 验收标准与反例

- [ ] Resolution 建立组件/文件 → 可推广 token/行为 → 依赖证据 → 禁止范围的映射。
- [ ] `globals.css` 只承载共享文字/色彩/focus/尺寸 token；公共组件分别登记状态、aria、命中框和键盘行为。
- [ ] RecallWorkspace、ReplayChart、DrawingCanvas 和策略 A 保留各自上下文契约；Canvas/导出字体、触摸/软键盘、marker 碰撞等未验项不被静默清除。
- [ ] 例外登记包含组件、理由、影响、owner、引入版本、验证视口、退出条件和证据路径。
- [ ] 反例：全局选择器重写图表布局；把 A 的 320px 检查区移给复盘；用一张静态截图证明真实保存和导出一致。
- [ ] 用户确认推广边界后写入 Resolution；未确认的文件不得进入 07 的可派发实现清单。

## 验收证据

- 组件/文件推广矩阵、例外清单、依赖的视觉和状态证据链接。
- 本票本身不修改生产组件；如果需要测量，报告源码候选与 computed 实测的差别。

## 派发说明

这是推广边界决策票。允许修改规划合同、覆盖矩阵和 Resolution；禁止提交公共 CSS/组件、切换业务配置或直接修改项目指令。07 只能引用已确认条目。

## 历史

- 2026-10-11：创建，等待 02/04 的决策。
