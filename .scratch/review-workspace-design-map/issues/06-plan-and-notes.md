# 确定节点计划与持仓标注的协作方式

ID: review-design-06
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

每次开仓/加仓的入场、止损、目标、规模与图上线条如何关联，持仓Text和形态观察归属于哪个对象？

## Scope / What to build

目标：开仓时顺畅补记计划，持仓时围绕图表记录，不重复填表。

本票解决文档设计决定；供讨论的产物为：计划/标注故事板、字段及对象绑定表。 不实施业务代码，不将候选方案当作用户决定。

元素：E06/E08/E09/E10/E11/E12/E13/E14/E22。预计影响章节：RV04、RV06。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV04、RV06，本次基线行 131、139、202。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 01-entry-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 02-holding-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 04-records-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [明确交易单位、配对与复盘完成边界](01-trade-identity.md)
- [确定交易节点驱动的连续复盘动线](03-event-journey.md)

## 执行的主要思路

用开仓填计划—继续回放—某bar标注—再次加仓的故事板验证；原计划冻结、后续修订与普通绘图对象分别标明。

## 验收标准与反例

- [ ] 入场/止损/目标及预期R依赖清楚；只有买卖两价不能伪造风险分母；做空、缺项和无效值有说明。
- [ ] 数量/金额/仓位模式、资金来源与币种不丢失；每次加仓的风险基准独立，调整计划不覆盖旧记录。
- [ ] 表单与关联计划线双向更新的规则明确；普通多空绘图工具是否导入计划需显式动作，不能默默改计划。
- [ ] Text、形态标注、锚点、长文、历史快照和跨批次共享/独立归属清楚；录入焦点暂停、重开恢复、重复进入节点均有状态稿。

必须排除的反例：同一段心态要求图上与侧栏重复填写；为每根bar感想生成虚构成交。

## 验收证据

- 本票资产存放：`../evidence/plan-and-notes/`；决定保存在 `../comments/review-design-06/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV06）：计划版本冻结、计划线与图形分离；补齐 Text 默认归属、共享、撤销共享及历史引用。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：归属默认、共享入口和真实保存待确认/验证。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。

## 2026-10-24 原型反馈对本票的约束

用户已选 A 连续表单，明确右侧仅“买入前”和“结束之后”，不再拆出加仓/减仓表单或持仓“当前判断”。后续补充确认：买入、平仓记录分别绑定对应成交 Bar；持仓过程中右侧不出记录，交易者直接在图上自由放置 Text。原型据此在持仓阶段收起右侧记录区，并支持回合内多条独立图形 Text，不要求选择单根 Bar 或连续区间，不生成右侧记录。上述规则覆盖本票旧候选中冲突的侧栏分类与 Text 默认归属；不据此更改交易配对等业务计算口径。先在[完整工作区反馈修订](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)实现原型，正式规范暂不回填。

## 2026-11-05 计划规模原型：candidate 29 补测失败

浏览器回归覆盖常规规模换算、无效值、极小值和跨回合单次切换；独立静态审查继续提出的连续三模式与不同回合各用不同模式两条路径，经真实浏览器复现失败：无效原文经第三个模式后无法恢复；回合 3 金额 70000／风险 5000，在回合 2 选择仓位后返回回合 3，错误显示旧仓位 28／风险 4000。详见 [candidate 29 记录](../evidence/systematic-fixes-20261105/task-09-candidate29/REPORT.md)及对应观察截图。此票保持 open；当前候选并非用户已批准的业务计算合同或产品验收。

2026-11-05 candidate 31：计划规模按交易回合保存模式和来源；常规、异常、极小值、连续切换、不同回合往返、三价线和回放的限定真实浏览器样本及独立静态视觉复核通过。证据见 [限定验收](../evidence/systematic-fixes-20261105/task-09-candidate31/REPORT.md)。此为合成数据、内存草稿原型的局部结果，金额/仓位语义、真实持久化及整页验收仍待确认，本票保持 open。
