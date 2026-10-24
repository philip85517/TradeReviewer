# 确定 TradingView 绘图与回放的逐项对齐契约

ID: review-design-05
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: integration-pending
Assignee: coordinator
集成负责人: coordinator
Resolution comment: 待解决

## Question

每个原图工具如何对应图形对象、操作状态和复盘数据，哪些必须补实机参考后才能定稿？

## Scope / What to build

目标：把“图标与功能1:1、底部按钮形态1:1”变成可逐项核验的设计合同。

本票解决文档设计决定；供讨论的产物为：逐项工具合同、外观对照板、行为证据及功能验收用例。 不实施业务代码，不将候选方案当作用户决定。

元素：E03/E06/E08/E19。预计影响章节：RV03、RV05、RV06。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV03、RV05、RV06，本次基线行 90、163、202。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [用户 TradingView 原图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)
- [已记录的用户直接要求](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)

## Blocked by

- [核实 TradingView 工具与回放的参考能力](02-tradingview-research.md)

## 执行的主要思路

用研究的槽位表制作图标及状态对照板、操作故事板；围绕同一工具完成创建—编辑—取消/删除—撤销—保存重开的完整设计描述，不交付无功能依据的装饰图标。

## 验收标准与反例

- [ ] 原图工具逐项对应名称、图标轮廓、排序、线宽、容器、间距及参考比例；不以通用相似图标替代。
- [ ] 每工具列创建手势、锚点、选择/拖动、属性、取消/删除、撤销重做、重开表现；未核实行为保留 NOT VERIFIED 并取得后续证据后才能关闭。
- [ ] 底部日期、播放/暂停、步进、速度/周期与末端动作分别列外观与语义；退出回放、退出工作区不混用。
- [ ] 列桌面/键盘状态和保存归属；回放适配不得越过M/X，说明与动线票集成的对应点；用户确认对照稿。

必须排除的反例：样式1:1但改为另一种工具；浮动图形R与侧栏计划绑定不明；以静态板宣称真实功能完成。

## 验收证据

- 本票资产存放：`../evidence/tradingview-contract/`；决定保存在 `../comments/review-design-05/<时间>-resolution.md`，关闭时更新上方链接。
- 当前状态：已提供v0.1逐项契约、缺证清单和静态对照稿，独立审阅记录已归档，审阅页交互可用；最终设计决定与1:1真实功能仍 NOT VERIFIED。HITL 票关闭需引用用户真实选择；研究票只接受有来源和限制说明的研究结论。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

2026-10-24：用户指定推进本票，coordinator领取。交付逐项对应、缺证清单及可审阅原型；未授权业务实现，未取得最终设计确认。原型视觉制作由gpt-5.6-luna负责，coordinator负责契约、集成及独立浏览器视觉审阅。

## 本轮审阅资产（2026-10-24）

- [逐项对齐方案](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/tradingview-alignment-v0.1/contract.md)：目标与取舍、13绘图/7回放映射、生命周期、M/X/D适配、六类缺证与验收。
- [可审阅原型](http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/tradingview-alignment-v0.1/index.html)：原图对照、工作区语境、状态与契约三视图。
- [覆盖与负责人](../evidence/tradingview-contract/DESIGN-COVERAGE.md)、[独立审阅记录](../evidence/tradingview-contract/audit.md)。
- 候选建议：R06核实为返回实时后保留语义，无实时数据时禁用；改成完整历史属于另案。未取得用户选择，未生成Resolution，任务保持开放。
- G01/G02身份与菜单、G03生命周期、G04精确视觉、G05适配决定、G06真实图表与持久化证据待补，详见方案§5。

- [原型快照与待决问题](../evidence/tradingview-contract/context-pointer.md)：独立throwaway分支已捕获v0.1，未提升为最终设计。

2026-10-24红框反馈：重新打开D08/D09、D10、D12的几何缺陷；完成轮廓、间距、控制点和共享SVG比例修正。独立视觉与限定交互验收见[本次修订记录](../evidence/tradingview-contract/icon-correction-20261024/audit.md)。此次局部PASS不替代整套1:1验收，任务保持open / integration-pending。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV03、RV06）：逐槽外观/功能边界、D01–D13/H00 生命周期和底栏语义进入合同。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：每个 TV 实际操作仍 NOT VERIFIED；不以相似图标代替。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
