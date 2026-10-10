# 07 — 汇总可执行实现任务图与版本门禁

ID: strategy-visual-acceptance-plan-20261011-07
Labels: wayfinder:task
Mode: AFK
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / What to build

在 01–06 的基线、用户决策和门槛证据齐全后，综合为可派发的纵向实现任务图。每票要有准确的规格/参考图、elementID、实现文件 owner、接口/数据来源、允许写入范围、禁止项、真实浏览器路径、证据目录和依赖。第一条必须是最小真实主图回放切片，然后才扩展到完整 Workbench、RecallWorkspace 响应式、公共组件 token、Canvas/导出、真实保存/重开和文档规则固化。

本票不直接实现功能；它负责把决策转换为顺序、责任和版本门禁，避免横切“底栏/侧栏/统计”或让多个 agent 同时改共享样式。

## Refs

- [01 基线矩阵](01-freeze-baseline-and-comparison-matrix.md)
- [02 共享合同](02-decide-shared-vs-context-specific-visual-contract.md)
- [03 双截止状态合同](03-decide-stage-cutoff-and-future-information-acceptance.md)
- [04 响应式原型](04-decide-responsive-density-and-long-content-contract.md)
- [05 推广边界](05-decide-shared-component-rollout-boundaries.md)
- [06 验收/回归门槛](06-decide-independent-acceptance-and-regression-gates.md)
- [开发工作流的纵向切片规则](../../../docs/agents/development-workflow.md)
- [DESIGN-COVERAGE P01–P10](../DESIGN-COVERAGE.md)

## Blocked by

- [02 — 决定共享视觉合同与上下文例外](02-decide-shared-vs-context-specific-visual-contract.md)
- [03 — 决定 S0/S1/S2 双截止与未来信息门槛](03-decide-stage-cutoff-and-future-information-acceptance.md)
- [04 — 决定响应式、密度与长内容契约](04-decide-responsive-density-and-long-content-contract.md)
- [05 — 决定公共组件推广边界与例外登记](05-decide-shared-component-rollout-boundaries.md)
- [06 — 决定独立验收、回归和发布门槛](06-decide-independent-acceptance-and-regression-gates.md)

## 验收标准与反例

- [ ] 生成一张无环任务图，第一条真实主图切片含隐藏未来→推进/播放→下一决策→Text→回看早期→保存/重开及独立视觉对照门槛。
- [ ] 每个实现票有单一写入 owner、整页视觉 owner、状态/持久化 owner、准确 refs/elementID、视口/状态、证据路径和反例。
- [ ] 任务图明确 expand–migrate–contract：先 token/组件候选和 opt-in，再迁移经过接受的上下文，最后移除重复样式或登记保留例外。
- [ ] 版本门禁包含：视觉合同已接受、双截止状态安全、真实保存/重开、独立视觉审查、关键宽度和最终预览 URL；失败或 NV 阻塞整体完成。
- [ ] 反例：先全局改 CSS 再找证据；先做静态图表再补真实状态；把完成样板当生产 DB；把组件票 accepted 当整页 accepted。
- [ ] 地图 Decisions so far 链接 07 的综合 Resolution；未满足前保持 open。

## 验收证据

- 新任务图/README、实施顺序、文件 owner 表、状态转移和 `DESIGN-COVERAGE.md` 映射。
- 规划票不产生产品 PASS；实现票必须自己生成 UI/功能/端到端 acceptance record，并由协调者独立复核。

## 派发说明

这是综合任务票。允许读取并整理 01–06 Resolution，写入本规划目录或新建实现期 feature 目录；禁止越过用户决策直接改生产文件、派发未覆盖的需求、关闭依赖或推送远端。

## 历史

- 2026-10-11：创建，等待 02–06 决策后综合。
