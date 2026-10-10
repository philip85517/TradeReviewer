# 04 — 决定响应式、密度与长内容契约

ID: strategy-visual-acceptance-plan-20261011-04
Labels: wayfinder:prototype
Mode: HITL
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / Decision question

用固定数据、固定多行中文批注、完整计划/实际字段和同一图表范围，做一个可并排评审的响应式密度原型。用户只需选择实际画面的焦点、密度、阅读感受和操作清晰度；实现者随后按决定拆解 CSS/组件。原型必须比较 1440×900、1280×800/720、1024/980、760/759、600、390，覆盖策略 A 与 RecallWorkspace 的不同布局合同。

必须保留图表、主要动作、完整正文、重要价格和计划标记可达；不能用首页 B 的列数/比例，也不能通过删短文案解决拥挤。

## Refs

- [0.7 响应式与滚动规则](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [滚动修复](../../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)
- [严格回归](../../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)
- [完整 Workbench](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)
- [DESIGN-COVERAGE P05/P06](../DESIGN-COVERAGE.md)
- [01 基线矩阵](01-freeze-baseline-and-comparison-matrix.md)
- [02 共享视觉合同](02-decide-shared-vs-context-specific-visual-contract.md)

## Blocked by

- [01 — 冻结 0.7 基线与同状态比较矩阵](01-freeze-baseline-and-comparison-matrix.md)
- [02 — 决定共享视觉合同与上下文例外](02-decide-shared-vs-context-specific-visual-contract.md)

## 验收标准与反例

- [ ] 原型数据、文案、阶段、图表范围和视口记录固定；推荐方案和候选方案只在确有密度/流式差异时提供。
- [ ] ≤1330、≤600、390 的图表高度、计划下移、文档流、回放换行、工具栏滚动和底部可达性有具体参数/画面。
- [ ] 长中文、多行原判断、当前补充、复盘补记、长金额和计划/实际均可完整阅读；批注层与 marker/轴标签碰撞要么解决要么登记例外。
- [ ] 选中、focus、disabled、展开长文和回放六控件状态在关键宽度可辨。
- [ ] 反例：固定高度 `overflow:hidden` 裁掉底轴；只在 390 首屏显示两个回放按钮；通过横向裁切隐藏重要价格；把桌面窄屏当真实触摸。
- [ ] 用户选择与原型截图保存到独立 Resolution/证据目录，未选择的候选不写成默认。

## 验收证据

- 可打开的原型/截图并列、测量表、固定数据清单和用户观察结论。
- 原型是可逆设计探针，不作为生产实现或持久化证据；真实手机触摸/软键盘单列 `NOT VERIFIED`，除非确有设备证据。

## 派发说明

允许写入本规划目录的原型证据、`visual-contract.md` 和 `DESIGN-COVERAGE.md`；禁止先改公共 CSS、RecallWorkspace 生产代码或业务数据库。原型必须标注 viewport/DPR/滚动，不得用缩放截图伪造断点。

## 历史

- 2026-10-11：创建，等待 01/02 的基线和共享合同。
