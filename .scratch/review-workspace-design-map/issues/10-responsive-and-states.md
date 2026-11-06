# 确定窄屏、键盘及异常状态的空间规则

ID: review-design-10
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

双侧收缩优先级、工具栏停靠/避让、窄屏输入及错误反馈怎样共享稳定空间？

## Scope / What to build

目标：新工作区在尺寸变化、输入和异常时仍保留图表、当前操作及返回路径。

本票解决文档设计决定；供讨论的产物为：响应式及异常状态板、尺寸规则和输入方式验收表。 不实施业务代码，不将候选方案当作用户决定。

元素：E01–E22（受影响状态全量）。预计影响章节：RV02、RV03、RV07、RV08。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV02、RV03、RV07、RV08，本次基线行 51、90、267、288。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [用户 TradingView 原图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)
- [已记录的用户直接要求](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)
- [旧画板 06-entry-1280.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 07-entry-390.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/07-entry-390.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 08-boundaries.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/08-boundaries.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 10-nav-expanded.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/10-nav-expanded.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [确定沉浸式工作区与左右区域职责](04-immersive-layout.md)
- [确定 TradingView 绘图与回放的逐项对齐契约](05-tradingview-contract.md)
- [确定节点计划与持仓标注的协作方式](06-plan-and-notes.md)
- [确定退出归因与五星评价卡](08-exit-ratings.md)
- [确定保存、完成、导出与关闭的职责](09-save-export-return.md)

## 执行的主要思路

按新全屏空间预算重算断点，用同态画板比较1440/1280/390及断点两侧；区分工具1:1的已批准参考与必须讨论的触控适配。

## 验收标准与反例

- [ ] 不得沿用旧应用导航宽度与1102断点；给出新预算、侧栏互斥/折叠规则及长文本/价格轴边界。
- [ ] 默认、hover、active、selected、disabled、expanded、loading、empty、error、saving、conflict、end、longtext与missing均登记。
- [ ] 字体基线、按钮命中、对齐、焦点顺序、Esc逐层关闭、IME与软件键盘状态完整；桌面窄屏不冒充真机验证。
- [ ] 用户参考工具的图标和能力不得在窄屏静默删减；适配差异需要明确依据，错误提示不得把主图推出可见区域。

必须排除的反例：弹出错误把图挤走；字号缩小掩盖拥挤；拿旧导航展开图证明新全屏响应式。

## 验收证据

- 本票资产存放：`../evidence/responsive-and-states/`；决定保存在 `../comments/review-design-10/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV08）：补齐新断点、390/键盘布局、14 类区域状态与数据承诺；配图 D。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：触控适配和设备证据未验证；本轮只验文档阅读。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
