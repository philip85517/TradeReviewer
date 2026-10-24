# 确定交易节点驱动的连续复盘动线

ID: review-design-03
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

最近待复盘入口、各交易节点暂停、记录展开、完成后继续及历史回看如何形成一条不冲突的动线？

## Scope / What to build

目标：让用户沿逐根回放完成复盘，阶段成为状态说明和资料分类。

本票解决文档设计决定；供讨论的产物为：三条故事板、状态迁移表与入口/返回合同。 不实施业务代码，不将候选方案当作用户决定。

元素：E02/E04/E07/E09/E19/E22。预计影响章节：RV04、RV05。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV04、RV05，本次基线行 127、163。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 01-entry-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 02-holding-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [明确交易单位、配对与复盘完成边界](01-trade-identity.md)

## 执行的主要思路

分别走普通开平仓、加仓后部分退出、继续未完成复盘三条故事；用动作迁移表拆清下一根、下一成交节点、下一待复盘交易。

## 验收标准与反例

- [ ] 每个动作列前态、M行情截止、X成交截止、记录归属、可见/不可见内容、未来暴露来源、视野及恢复状态。
- [ ] 覆盖开仓前/开仓/加仓/减仓/清仓；同K多决策、未完成K、缺行情、末尾、主动揭示完整历史均有入口与结果。
- [ ] 节点自动暂停/展开与普通推进收起明确；用户主动展开、回退重复经过节点和稍后补记不会被反复打断。
- [ ] 说明阶段导航移除后的替代入口与资料可达性；输入、Text及IME阻止播放；用户确认三条连续旅程。

必须排除的反例：仅阶段文字变化而目标K仍不可见；回到早期抹去已看结果的来源。

## 验收证据

- 本票资产存放：`../evidence/event-journey/`；决定保存在 `../comments/review-design-03/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV04–RV05）：三条连续旅程及逐动作 M/X/D、隐藏信息、节点暂停和恢复合同。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：真实图表逐根揭示和恢复尚待实现验收。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
