# 00 — 策略台视觉验收与实施规划

ID: strategy-visual-acceptance-plan-20261011
Labels: wayfinder:map
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Destination / What to build

建立一份可以交给实现者、整页视觉负责人和独立审查者使用的视觉验收合同与实施路线。路线必须以已确认的 0.7 完整观察/滚动修复为证据基线，覆盖策略台的完整 Workbench 视图和图表优先的 RecallWorkspace：文字、字体、颜色、控件、图表空间、阶段/双截止、未来信息、长内容、响应式、真实主图旅程、持久化、回归和版本门禁。

到达终点时，后续实现者不需要猜测字号、间距、断点、主次动作、阶段来源、截图条件或 PASS 证据；每个上下文的例外都有理由、owner、退出条件和证据路径。终点不包括本回合的产品实现、生产 schema、远端推送、合并或发布。

## Parent / map context

- 项目术语：[CONTEXT.md](../../../CONTEXT.md)，特别是“Recall 复盘”和“策略研究”。
- 视觉归档：[0.7 视觉检查点](../../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md)。
- 规范和诊断：[视觉规范草案](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)、[diagnosis.md](../../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)。
- 执行规则：[开发工作流](../../../docs/agents/development-workflow.md)、[拆票标准](../../../docs/agents/task-decomposition.md)、[UI 任务模板](../../../docs/agents/ui-task-templates.md)、[本地 issue tracker](../../../docs/agents/issue-tracker.md)。

## Scope / constraints

- 规划语言：中文；使用深色环境和当前盈亏颜色配置。
- 工作台 A 保留固定空间预算，但不把首页 B 或策略 A 的列比例直接套入 RecallWorkspace。
- RecallWorkspace 保留 S0 入场前、S1 持仓中、S2 退出后同一工作区、图表主工作面、双截止和未来信息来源。
- 不删减固定评论、原判断、重要价格、数量、单位或形成阶段；不把样板内存状态当生产持久化。
- 真实主图的第一条实现切片必须通过“隐藏未来 → next/play → next decision → Text → 回看早期 → 保存/重开”。
- 规划期间不领取或关闭子票；所有决策票等待用户真实选择，Resolution 另存于 `comments/<ID>/`。

## Decisions so far

暂无。0.7 的完整观察画面和滚动修复是当前参考证据，用户尚未在本地图上决定生产基线、共享/例外边界、响应式密度、双截止动作表或发布门槛。

## Frontier / child tickets

| ID | 标题 | 类型 | Mode | 初始依赖 |
| --- | --- | --- | --- | --- |
| 01 | [冻结 0.7 基线与同状态比较矩阵](01-freeze-baseline-and-comparison-matrix.md) | `wayfinder:task` | AFK | None |
| 02 | [决定共享视觉合同与上下文例外](02-decide-shared-vs-context-specific-visual-contract.md) | `wayfinder:grilling` | HITL | 01 |
| 03 | [决定 S0/S1/S2 双截止与未来信息门槛](03-decide-stage-cutoff-and-future-information-acceptance.md) | `wayfinder:grilling` | HITL | 01 |
| 04 | [决定响应式、密度与长内容契约](04-decide-responsive-density-and-long-content-contract.md) | `wayfinder:prototype` | HITL | 01, 02 |
| 05 | [决定公共组件推广边界与例外登记](05-decide-shared-component-rollout-boundaries.md) | `wayfinder:grilling` | HITL | 02, 04 |
| 06 | [决定独立验收、回归和发布门槛](06-decide-independent-acceptance-and-regression-gates.md) | `wayfinder:grilling` | HITL | 01, 02, 03, 04, 05 |
| 07 | [汇总可执行实现任务图与版本门禁](07-synthesize-implementation-backlog-and-release-gates.md) | `wayfinder:task` | AFK | 02, 03, 04, 05, 06 |

## Acceptance / evidence

- [ ] `visual-contract.md` 明确参考图原始像素、CSS 视口、DPR/缩放、状态、授权差异和独立审查角色。
- [ ] `acceptance-standard.md` 把功能、端到端/状态安全、视觉还原分成独立门槛，并为每项写出可观察预期和反例。
- [ ] `DESIGN-COVERAGE.md` 覆盖现有 A/F/G/R/U 范围以及新规划的 owner、证据路径和初始 `NOT VERIFIED`。
- [ ] 01–07 每张票都有准确引用、一个问题/决策、模式、owner、依赖、验收、反例和证据计划；无实现者自签视觉通过。
- [ ] 依赖第二遍写入后无环：01 → 02/03/04；02+04 → 05；01–05 → 06；02–06 → 07。
- [ ] 图谱创建完成后停止，不领取、解决或关闭子票；用户决策和研究结果保留在独立 Resolution 文件。

## Evidence paths

- 规划合同：[visual-contract.md](../visual-contract.md)
- 验收标准：[acceptance-standard.md](../acceptance-standard.md)
- 覆盖矩阵：[DESIGN-COVERAGE.md](../DESIGN-COVERAGE.md)
- 后续决策：`.scratch/strategy-visual-acceptance-plan-20261011/comments/<ID>/<timestamp>-resolution.md`
- 后续实现/浏览器证据：由 07 票确定新 feature 目录和报告路径；不在本回合虚构。

## History

- 2026-10-11：根据用户要求，从 0.7 视觉归档建立验收合同和任务地图；未领取子票，未做产品改动。
