# 最小实验选哪条路线及如何处理已暂停任务

ID: homepage-one-second-experiment-choice
Labels: wayfinder:grilling
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

根据基线、读模型和启动合同，选择哪个有限实验来证伪 A/B/C 的关键假设？若实验需要财务接线、历史曲线或Bars等已暂停内容，具体授权恢复什么、保留哪些失败及轮次？此处仅决定实验授权，不等于正式优化全面开工。

## Scope

- 推荐以一个默认真实范围验证服务端紧凑输出→桌面真实指标/持仓/所需曲线；是否先B、直接C或只做A控制组由用户选择，不将研究推荐当批准。
- 写明实验需要的旧问题前置条件；历史not-wired或未授权的暂停内容不能由fixture或占位图代替。无法获得完整旅程就如实标NOT VERIFIED，停止扩大实验。
- 列出原任务身份、原轮次、最新接受证据和需要的新授权。不得把 P1/F07、Bars 改名后重获三轮。用户若明确恢复，记录恢复范围及新的最多3轮预算；否则保持暂停。
- 明确实验输入、候选改动边界、可丢弃资产位置、独立验收人、每轮证据及成功/失败后的决策分支；不提前实现所有组合或整套持久化系统。
- 指定记录候选实现和轮次的原实现票或实验执行票，保持原任务身份与恢复约束。后续Wayfinder原型票接受的是完整实验协议与用户反馈所形成的决策证据，不接受或关闭候选实现；不得用此区分绕过原暂停或新增修复轮次。

## Refs

- [候选比较](../README.md)与[验证关卡](../VALIDATION-ROUTE.md)。
- [最新整体验收与暂停](../../homepage-v25-implementation/FINAL-ACCEPTANCE.md:3)、[根验收及3/3边界](../../homepage-v25-implementation/evidence/resume-2026-10-24/ROOT-ACCEPTANCE-3.md:60)。
- [历史未接线证据](../../homepage-v25-implementation/evidence/resume-2026-10-24/ROOT-ACCEPTANCE-3.md:33)、[Bars视觉失败](../../homepage-v25-implementation/evidence/P4/bars/ROOT-ACCEPTANCE-3.md:9)。

## Blocked by

- [建立同源可比的生产导航基线与非零对照](02-comparable-baseline.md)
- [首页读模型与新鲜度的对外合同如何确定](03-read-contract.md)
- [首页启动如何隔离并保留进入交易库及返回旅程](04-startup-boundary.md)

## 验收标准

- [ ] 用户明确选定实验路线、假设、边界和停止条件；不作架构达标承诺。
- [ ] 对每项暂停内容记录“继续暂停”或具体恢复授权及轮次；不得含糊沿用旧的恢复授权重置最近3/3暂停。
- [ ] 说明依赖缺失如何阻断真实实验，完整首屏/真实图表条件无缩水。
- [ ] 协调者独立核对授权及原失败，保存Resolution；本票关闭仅允许所选实验。

## 反例与证据

以新地图、基线接受、worker PASS或“必要重构”为理由自动恢复第四轮，均拒绝。完整正式实施范围留到实证后的优化迭代决策。
