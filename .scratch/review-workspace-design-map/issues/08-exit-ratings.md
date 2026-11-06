# 确定退出归因与五星评价卡

ID: review-design-08
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

减仓/平仓节点展示什么摘要，评价属于哪个对象，系统建议分与人工修改如何共存？

## Scope / What to build

目标：让实际退出、主观原因和规则评分可解释地对应，支持后续归因。

本票解决文档设计决定；供讨论的产物为：退出摘要与评分卡状态稿、规则候选及归属表。 不实施业务代码，不将候选方案当作用户决定。

元素：E15/E16/E17/E18（新增评分卡）。预计影响章节：RV04、RV06。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV04、RV06，本次基线行 147、222。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [明确交易单位、配对与复盘完成边界](01-trade-identity.md)
- [确定持仓过程指标与可比较的风险口径](07-process-metrics.md)

## 执行的主要思路

用计划内退出、提前退出、无原计划、一次退出匹配多批次的卡片对照；设计四维五星卡、依据入口和人工修订，默认规则作为待确认候选。

## 验收标准与反例

- [ ] 区分触及价格线、实际成交退出与用户退出原因；提前是/否/不确定/未评价不混合，提前不自动等于错误。
- [ ] 纪律、机会、仓位、体验四维均有未评分/资料不足/系统建议/人工修改状态，显示依据、规则版本、修改原因。
- [ ] 默认计算规则与阈值明确“已定/候选/待定”，不把盈亏正负当纪律评分；说明规则变化后是否重算历史。
- [ ] 部分退出、多批次、无计划、未平仓均不会显示错误的最终结果；结构性感想和证据标注可关联。

必须排除的反例：盈利自动五星；人工改分覆盖系统原分；资料不足显示0星。

## 验收证据

- 本票资产存放：`../evidence/exit-ratings/`；决定保存在 `../comments/review-design-08/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV07）：区分退出事实与原因；四维 V0 规则、四种评分状态、人工修订和版本追溯。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：阈值和输入仍待批准，不将缺失评分填成三星。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
