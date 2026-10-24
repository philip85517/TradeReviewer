# 确定全文论述结构与图示分工

ID: review-design-11
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

围绕新动线如何调整全文标题及章节边界，哪些图解释布局、尺寸、行为和异常？

## Scope / What to build

目标：正文先解释目标和取舍，再安排规则、参数与引用；每张图提供独立信息。

本票解决文档设计决定；供讨论的产物为：逐章扫描表、改写提纲、样章及图示清单。 不实施业务代码，不将候选方案当作用户决定。

元素：文档导言与RV01–RV10；映射E01–E22。预计影响章节：RV01–RV10。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV01–RV10，本次基线行 1–398。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [旧画板 01-entry-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 06-entry-1280.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [确定交易节点驱动的连续复盘动线](03-event-journey.md)

## 执行的主要思路

逐章建立问题—论点—目标—取舍—规则—参数—图示—引用的改写提纲；用一章样稿和尺寸图草样讨论表达，不先批量改写正文。

## 验收标准与反例

- [ ] 导言及原10章逐章有去向；跨章规则只定义一次，其他位置准确引用；不把旧冲突规则原样保留。
- [ ] 每章先回答标题对应问题，再给目标/选择/取舍，最后规则参数引用；技术变量先用用户语言解释。
- [ ] 重复1280画板转为带数字的空间说明图或有独立目的的状态图；整体图、尺寸图、状态图职责明确。
- [ ] “视口/视图/可见区域”按上下文改写；稳定评论锚点保留或有迁移映射，用户评论不自动标为解决。

必须排除的反例：只增加前言而规则表仍彼此冲突；同一图重复出现却没有新增论据。

## 验收证据

- 本票资产存放：`../evidence/document-argument/`；决定保存在 `../comments/review-design-11/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV01–RV10）：扫描原导言及十章，按目标→取舍→规则→参数→引用重写；五张解释图分工明确。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：候选制作已验收，不代表全部设计决定已通过。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
