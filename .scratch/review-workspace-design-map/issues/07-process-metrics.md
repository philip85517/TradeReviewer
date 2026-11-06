# 确定持仓过程指标与可比较的风险口径

ID: review-design-07
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

批次和回合的过程盈亏、R、最大不利/有利波动及回撤如何定义，何时可见、哪些留作未来统计？

## Scope / What to build

目标：为止损宽窄、入场后风险和体验分析沉淀可靠且不泄露未来的数据。

本票解决文档设计决定；供讨论的产物为：指标字典、合成算例、可见性与未来分析边界。 不实施业务代码，不将候选方案当作用户决定。

元素：E13/E14/E15（新增过程指标）。预计影响章节：RV04、RV06。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV04、RV06，本次基线行 139、222。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 02-holding-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [明确交易单位、配对与复盘完成边界](01-trade-identity.md)

## 执行的主要思路

用合成价格序列手算正常、加仓/减仓、做空样例；分清最大不利波动与从峰值回落的回撤，确定基准、采样时点和缺失语义。

## 验收标准与反例

- [ ] 每指标明确对象、公式、冻结风险分母、币种、价格/费用口径、行情周期、可知截止与计算时间。
- [ ] 同一序列可复算；加减仓后批次与整体不混算，费用不重复扣；缺止损/费用/行情不是0。
- [ ] 过程展示只用已揭示数据；单根OHLC无法确定高低发生顺序时注明限制；不显示未发生的最终最大回撤。
- [ ] 入场X根后的亏损概率明确为跨交易统计需求，当前只定义数据字段及样本/缺失口径，不伪造概率或新建分析大屏。

必须排除的反例：以第一次小仓风险做整个回合R分母；把MAE直接叫最大回撤。

## 验收证据

- 本票资产存放：`../evidence/process-metrics/`；决定保存在 `../comments/review-design-07/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV07）：补齐风险分母、MAE/MFE/峰值回撤、费用、缺失语义及多批次/做空算例。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：公式为候选口径；未验证业务计算实现。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
