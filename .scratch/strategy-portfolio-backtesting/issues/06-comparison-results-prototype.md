# 确认多个策略组合的比较与结果回看方式

ID: strategy-visual-06
State: open
Status: ready-for-agent
Labels: wayfinder:prototype, ready-for-agent
Mode: HITL
Assignee: unassigned
集成负责人: 领取本票的主协调者
Parent: [策略观察者：从视觉原型确认完整使用动线](02-visual-journey-map.md)
Resolution comment: 未解决

## Question

观察者如何在两个策略之间同步观察、解释分歧并比较期末结果？对比视图应突出哪些差异，如何从结果回到某次调仓而不迷失或泄漏未来？

## Scope / What to build

本票解决上述设计问题，不是生产组件实现票。以用户实际讨论与原型反馈作答；产物和截图链接到票，结论只保存在独立 resolution 中。出现超出问题的新不确定性，加入地图 fog 或新票。

## Refs

- [桌面 UX v2 提案](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD09、DD12 结果/比较与 E08、T09–T10；完整桌面旅程验收已确认，新布局仍待用户反馈；窄屏暂不修改。

- [需求底稿](../../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)：R03–R05；S05–S08；D07。
- [地图 Notes](02-visual-journey-map.md#notes)：角色、原型范围与技能约定。
- [UI 模板](../../../docs/agents/ui-task-templates.md)：适用的场景、视觉、浏览器证据要求。
- 尚无批准的参考图；处理时先读前置票的原型与真实 resolution，并参考现有应用视觉，不把底稿 S 区域当已批准页面。

## Blocked by

- [确认自动回测的播放、持仓与调仓解释工作台](05-observation-rebalance-prototype.md)

## 验收标准与反例

- [ ] 沿用已选观察工作台，用两个共享时点的组合演示同步比较、组合切换与某日差异解释。
- [ ] 展示净值/回撤/仓位与费用的层级，以及已平仓净盈亏、持仓浮盈亏的区分；用户选择默认可见指标。
- [ ] 包含完整、部分区间、失败组合、已看未来及不同口径不可直接排名；结果到调仓再返回的路径可点击。
- [ ] 用户真实反馈及选定/拒绝理由记录于独立 resolution；反例：原型能运行就自动代表用户同意。

## 验收证据

尚未处理，NOT VERIFIED。原型链接、浏览器操作与截图在处理时记录；生产数据/真实回测/数据库持久化不属于本决策票的通过声明。

## 派发说明

本次不领取、不派发。领取时指定唯一负责人；代码原型须按项目流程界定文件范围、状态流与整页视觉所有权。使用合成数据，不写正式业务库，不把原型代码未经审查直接转为产品实现。

## 历史

- 2026-09-29：基于用户选择策略观察者角色建立决策票；未解决。
