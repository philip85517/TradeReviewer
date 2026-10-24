# 确定保存、完成、导出与关闭的职责

ID: review-design-09
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

新批次和节点记录怎样沿用草稿/快照/正式成果，顶栏保存导出更多及两个关闭动作如何分工？

## Scope / What to build

目标：用户知道什么已保存、哪笔已完成、导出了什么，以及关闭后回到哪里。

本票解决文档设计决定；供讨论的产物为：动作与版本合同、异常路径、导出及返回示意。 不实施业务代码，不将候选方案当作用户决定。

元素：E01/E20/E21/E22。预计影响章节：RV07、RV09。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV07、RV09，本次基线行 245、324。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 05-conflict-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/05-conflict-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 09-export.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/09-export.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 04-records-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [明确交易单位、配对与复盘完成边界](01-trade-identity.md)
- [确定交易节点驱动的连续复盘动线](03-event-journey.md)
- [确定节点计划与持仓标注的协作方式](06-plan-and-notes.md)
- [确定退出归因与五星评价卡](08-exit-ratings.md)

## 执行的主要思路

建立动作—对象—版本—反馈表，再走保存中离开、冲突恢复、部分完成、多批次导出与重开；将三阶段保留为成果叙事的候选方式。

## 验收标准与反例

- [ ] 自动保存、快照、单笔评价完成、回合完成分开；与既有完成条件的变更逐条引用用户决定。
- [ ] 保存/导出/更多有职责与状态，导出范围含全部必要决策及评分来源；快照冻结组合、草稿是否包含和缺阶段均明确。
- [ ] 失败/冲突保留输入；比较/重载/取消后字段和派生值一致；不得显示未经确认的已保存。
- [ ] 退出回放、退出工作区、切交易和重开分别规定进度、M/X、观察窗口、未来暴露来源与返回交易库状态。

必须排除的反例：关闭按钮同时退出两层；导出成功被视为完成复盘；旧图配新评分。

## 验收证据

- 本票资产存放：`../evidence/save-export-return/`；决定保存在 `../comments/review-design-09/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV09）：保存/快照/评价/回合完成分开；补齐冲突、两层关闭、导出及 PPTX 边界。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：真实持久化、重开和导出文件尚待实现验收。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
