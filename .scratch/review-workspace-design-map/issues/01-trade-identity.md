# 明确交易单位、配对与复盘完成边界

ID: review-design-01
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

开仓/加仓批次、最近建仓优先的数量匹配与现有交易回合/交易决策如何共存，哪些对象可以独立标记已复盘？

## Scope / What to build

目标：让“一笔交易”、部分退出及复盘完成有唯一含义，避免列表、盈亏和评价串属。

本票解决文档设计决定；供讨论的产物为：术语关系、数量算例、完成条件与新旧契约差异。 不实施业务代码，不将候选方案当作用户决定。

元素：E07/E15/E16/E22。预计影响章节：RV04、RV06、RV07。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV04、RV06、RV07，本次基线行 127、214、245。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [当前领域术语](../../../CONTEXT.md)：交易回合、交易决策、成交明细、已完成复盘。
- [旧画板 04-records-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

None

## 执行的主要思路

以现有术语为起点，用逐笔数量账验证用户提出的配对方向；区分用户已确定原则与尚未确定的批次、拆单和完成规则，形成候选关系图后逐项讨论。

## 验收标准与反例

- [ ] 覆盖买100、加60、卖80：匹配后加60及前批20，前批余80；明确这是一组待用户确认的数量例证。
- [ ] 覆盖部分退出、多批次退出、同K多笔、券商拆单、做空与反手；明确排序相同时间的依据及费用分摊，不静默改写成交。
- [ ] 明确回合/决策/成交/建仓批次/退出匹配及各自计划、记录、评分、完成归属；列出与 CONTEXT.md 和旧完成规则的冲突。
- [ ] 用户确认术语及边界后记录原话与 Resolution，再更新领域词汇；本轮建图不替用户确认。

必须排除的反例：减仓80却将前批100全部结束；把券商拆成两条成交误当两次独立决策。

## 验收证据

- 本票资产存放：`../evidence/trade-identity/`；决定保存在 `../comments/review-design-01/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV04、RV07）：补齐对象关系、100+60−80 配对、旧完成规则差异及缺省状态。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：批次聚合、同秒排序、费用及单笔完成仍待决议。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
