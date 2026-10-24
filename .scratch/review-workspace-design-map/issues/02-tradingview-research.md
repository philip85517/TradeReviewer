# 核实 TradingView 工具与回放的参考能力

ID: review-design-02
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:research
Mode: AFK
State: closed
Status: accepted
Assignee: tradingview_reference_research
集成负责人: coordinator
Resolution comment: [研究验收](../comments/review-design-02/2026-10-24-resolution.md)

## Question

用户原图的各槽位和底部动作有哪些可核实的官方功能依据，Lightweight Charts 与其他官方产品分别能提供什么？

## Scope / What to build

目标：确定 1:1 设计可依据的事实、组件复用边界及待补证据，避免凭图标猜功能。

本票解决文档设计决定；供讨论的产物为：截图槽位清单、官方依据、复用边界和待核实列表。 不实施业务代码，不将候选方案当作用户决定。

元素：E03/E08/E19。预计影响章节：RV03、RV05、RV06。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV03、RV05、RV06，本次基线行 90、163、202。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [用户 TradingView 原图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)
- [已记录的用户直接要求](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)

## Blocked by

None

## 执行的主要思路

按截图位置编号，查官方帮助、官方库文档及必要源码；把已确认名称、候选名称和未确认分开。只形成证据与差距，不自行选择降级方案或实现库。

## 验收标准与反例

- [x] 原图每个工具槽位和底部入口均登记；名称不确定时注明候选及缺少的证据，不假称识别完毕。
- [x] 官方一手链接支持绘制/锚点/编辑与回放入口的已知事实，明确截图没有提供的悬停、菜单和快捷键状态。
- [x] 核实项目 lightweight-charts 5.2.0 与官方产品关系；复用、需自行建设、待核实分列，不能把 API 不同当成体验可以降级。
- [x] 研究结果在独立 research 分支留存，提供路径/分支/指纹及待补证据清单；研究完成不等于各工具功能验收。

以上四项的证据与协调者复核见[研究验收](../comments/review-design-02/2026-10-24-resolution.md)。

必须排除的反例：用相似 Lucide 图标替代；把底部关闭图标直接认定为退出整个复盘工作区。

## 验收证据

- 本票资产存放：`../evidence/tradingview-research/`；决定保存在 `../comments/review-design-02/<时间>-resolution.md`，关闭时更新上方链接。
- 当前状态：公开资料研究 accepted；工具身份补证、1:1实际功能与设计合同仍 NOT VERIFIED，详见 Resolution。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

2026-10-24：研究完成并提交协调者验收，保持 State open。报告：[事实与待核实边界](../evidence/tradingview-research/research.md)；[独立研究快照指针](../evidence/tradingview-research/context-pointer.md)。13 个工具槽位、拖动柄与 7 个底部入口全部登记；槽位未核实身份和交互明确保留 NOT VERIFIED。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV03）：整合既有研究；13 绘图槽、7 回放入口和 G01–G05 缺证进入正文。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：研究已接受，工具身份及实操证据未因此通过。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。
