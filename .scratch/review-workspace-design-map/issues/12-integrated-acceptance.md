# 确定整份规范的整合与独立验收方案

ID: review-design-12
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

所有决定如何汇成可执行的文档设计包，哪些证据足以接受设计、哪些必须留到业务实现验证？

## Scope / What to build

目标：确定后续全文与画板修订的完整交付边界，防止局部通过掩盖整体缺失。

本票解决文档设计决定；供讨论的产物为：完整交付清单、后续制作顺序、独立审查与最终验收标准。 不实施业务代码，不将候选方案当作用户决定。

元素：E01–E22及新增批次/过程指标/评分卡。预计影响章节：RV01–RV10。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV01–RV10，本次基线行 346–398。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [用户 TradingView 原图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)
- [已记录的用户直接要求](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)
- [旧画板 01-entry-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 02-holding-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 04-records-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 05-conflict-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/05-conflict-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 06-entry-1280.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 07-entry-390.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/07-entry-390.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 08-boundaries.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/08-boundaries.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 09-export.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/09-export.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 10-nav-expanded.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/10-nav-expanded.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [确定沉浸式工作区与左右区域职责](04-immersive-layout.md)
- [确定 TradingView 绘图与回放的逐项对齐契约](05-tradingview-contract.md)
- [确定节点计划与持仓标注的协作方式](06-plan-and-notes.md)
- [确定持仓过程指标与可比较的风险口径](07-process-metrics.md)
- [确定退出归因与五星评价卡](08-exit-ratings.md)
- [确定保存、完成、导出与关闭的职责](09-save-export-return.md)
- [确定窄屏、键盘及异常状态的空间规则](10-responsive-and-states.md)
- [确定全文论述结构与图示分工](11-document-argument.md)

## 执行的主要思路

把三条核心旅程贯穿全文、图示和元素矩阵，逐项检查来源/对象/时间/状态/保存/视觉；形成后续制作顺序与独立审查合同。

## 验收标准与反例

- [ ] 原4条评论与本次截图约束逐项对应任务、章节、画板、owner及验收证据；E01–E22和新增元素均有去向。
- [ ] 三条完整旅程、必需状态及交易配对反例贯穿全文；旧规则冲突有明确替换决定，不存在互斥描述。
- [ ] 规定非画板作者独立同态视觉对照，工具图标逐项比对，正文与图链/目录/评论锚点/manifest验证；失败与未验证阻止设计包接受。
- [ ] 交付包清楚区分已批准决定、候选、待定项；不把静态设计当真实回放或数据库通过，不把任务地图完成当全文已改写。

必须排除的反例：各组件票通过后直接宣布整页通过；沿用旧manifest及旧截图验收新布局。

## 验收证据

- 本票资产存放：`../evidence/integrated-acceptance/`；决定保存在 `../comments/review-design-12/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV10）：汇总 12 任务、E01–E22/N01–N04、四条评论、内容/视觉/功能分开的验收门槛。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：最终产品整合验收仍须独立执行；不关闭其余 HITL 票。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
