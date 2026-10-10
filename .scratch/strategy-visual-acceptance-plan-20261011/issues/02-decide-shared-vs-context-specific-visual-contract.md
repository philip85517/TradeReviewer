# 02 — 决定共享视觉合同与上下文例外

ID: strategy-visual-acceptance-plan-20261011-02
Labels: wayfinder:grilling
Mode: HITL
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / Decision question

在 0.7 样板、首页控件迭代“图表区”和 RecallWorkspace 之间，决定最小共享视觉合同，以及必须保留的上下文例外。一次只询问一个决策面：文字角色/字体链、语义色/对比度、控件/图标/焦点、图表主次、导航和间距。最终要能判断一个 token 或组件改动能否进入全局，还是只在策略 A/复盘 opt-in。

用户选择必须保留对照画面、具体参数和原因；“更高级”“更统一”不能作为验收结论。

## Refs

- [0.7 视觉规范](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [首页/Workbench 共用视觉候选](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md)
- [诊断问题](../../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)
- [UI 任务模板的视觉合同](../../../docs/agents/ui-task-templates.md)
- [DESIGN-COVERAGE P03/P08/P10](../DESIGN-COVERAGE.md)
- [01 基线矩阵](01-freeze-baseline-and-comparison-matrix.md)

## Blocked by

- [01 — 冻结 0.7 基线与同状态比较矩阵](01-freeze-baseline-and-comparison-matrix.md)

## 验收标准与反例

- [ ] Resolution 逐项指出共享规则：字号/行高/字重/字体链、page/surface/elevated、盈亏/计划/实际语义、控件高度/圆角/间距、Lucide 槽和 focus。
- [ ] Resolution 逐项指出上下文规则：策略 A 固定预算和最小宽、Recall 图表优先/自然流、首页 B 不迁移的列比例。
- [ ] 每个例外有组件/上下文、理由、影响、视口、owner、引入版本和退出条件；没有“全局先改再看”。
- [ ] 反例：把 31×36 原生工具直接写成所有控件标准；用品牌色替换用户盈亏配置；把复盘固定成首页两栏。
- [ ] 用户决策被保存到 `comments/strategy-visual-acceptance-plan-20261011-02/<timestamp>-resolution.md`，地图只链接摘要，不复制整段答案。

## 验收证据

- 视觉合同表、并排截图/测量和 Resolution 链接。
- 若只完成源码审查，视觉门槛为 `NOT VERIFIED`；完成决策不等于产品实现 PASS。
- 协调者检查共享规则不会删除已有原判断、重要价格、阶段或完整批注。

## 派发说明

这是用户决策票，不派发产品实现。允许修改本规划目录的 `visual-contract.md`、`acceptance-standard.md`、`DESIGN-COVERAGE.md` 和 Resolution；禁止修改公共 CSS/组件或将未经决定的候选提交到生产。

## 历史

- 2026-10-11：创建，等待 01 基线和用户选择。
