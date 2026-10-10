# 公共样式组件固化与数据闭环边界

ID: review-visual-baseline-component-promotion-20261011
Parent: [TradeReview 复盘视觉基线：开发与独立验收路线图](00-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root

## Sharp question

在真实图表旅程、紧凑布局和 Text/绘图验收证据齐备后，哪些规则应从设计样板迁移到公共主题/组件，哪些应继续留在预览入口，哪些应延后？推荐以“已通过真实调用链、同态视觉、保存/返回/reload 的最小垂直切片”为迁移门槛，而不是一次性把预览 CSS 全站复制。

## Scope / What to build

建立 `promote / preview-only / defer` 三栏清单，至少覆盖：

- 公共颜色语义、暗色中文字体/回退、字号/行高、间距、边框/焦点/选中动效、icon hit area、cursor 语义。
- Review workspace 的阶段/截止、左右面板、底部执行组、图表工具栏、Text/价格锚点、风险标签和错误/保存反馈。
- 真正的组件和样板入口、数据/历史/离页保护、保存失败和版本冲突；不迁移交易数据结构。

## Refs

- [设计覆盖矩阵 V01–V15](../DESIGN-COVERAGE.md)
- [状态与回放转移契约](../STATE-TRANSITIONS.md)
- [2026-10-10 视觉基线的迁移提醒](../../../docs/design-system/versions/2026-10-10/README.md)
- [项目开发流程的数据和组件边界](../../../docs/agents/development-workflow.md)
- [前端控件审计范围](../CONTROL-AUDIT-SCOPE.md)

## Blocked by

- [首条真实图表旅程与状态门槛](02-real-chart-journey-gate.md)
- [紧凑布局与侧边/底部控件空间预算](03-compact-layout-budget.md)
- [Text、价格锚点与绘图控件验收契约](04-text-anchor-drawing-contract.md)

## 验收标准与反例

- [ ] 每条公共规则都有来源、elementID、使用入口、允许状态、反例、迁移 owner 和回归证据；没有以“全局统一”掩盖未测页面。
- [ ] `promote` 只包含真实调用链已走通、同视口同阶段视觉已复核、保存→返回→重开→刷新已闭环的项；preview-only/defer 明确原因和再次评估条件。
- [ ] 公共样式迁移不改变 S0/S1/S2、市场/成交截止、原判断/当前补充/复盘补记来源、计划/实际/盈亏颜色或原始交易数据。反例：公共组件为方便而删短固定评论、改默认比例或提前显示未来值。
- [ ] 失败/版本冲突/取消保留输入，选择/hover/preview 不写入；重开后派生值、几何、阶段和保存状态共同正确。反例：只验证 callback、fixture rerender 或单元测试。
- [ ] 迁移期间旧入口、预览入口和公共入口的差异有 manifest/截图记录；视觉回归按相同视口、阶段、文案密度和导航状态执行。

## 验收证据

- promote/preview-only/defer 清单及用户选择记录。
- 最终组件源码/主题变量指纹、受影响入口列表、构建/定向测试日志。
- 真实图表和隔离库闭环证据；公共入口和预览入口的同态截图/rect 差异。
- 独立视觉复核和数据保护结论，未验证项保留责任人。

## 派发说明

- HITL 决策完成前不得扩大公共样式影响面；实现者只能在批准的最小切片和指定文件范围内修改。
- 预计公共入口包括 Review workspace 的现有主题/组件和 ReplayChart 真实调用方，具体文件由实现者先从源码和调用链确认；禁止默认迁移首页或全站。
- root 负责选择结果和跨入口一致性；独立审查者负责检查“公共入口与预览入口是否同态”。

## 历史

- 2026-10-11：创建；把样板推广边界作为唯一待用户选择的迁移问题之一。
