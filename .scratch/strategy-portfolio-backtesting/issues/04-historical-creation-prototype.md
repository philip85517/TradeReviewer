# 确认历史时点与策略组合创建的可视化流程

ID: strategy-visual-04
State: closed
Status: accepted
Labels: wayfinder:prototype, ready-for-agent
Mode: HITL
Assignee: Codex 主协调者
集成负责人: 领取本票的主协调者
Parent: [策略观察者：从视觉原型确认完整使用动线](02-visual-journey-map.md)
Resolution comment: [用户反馈](../comments/strategy-visual-04/2026-09-29-resolution.md)

## Question

在已选动线中，历史时间、盲看、数据范围、策略包、资金与期限应怎样逐步呈现，才能让用户理解候选、目标仓位与尚未成交的区别，并创建一个或多个组合？

## Scope / What to build

本票解决上述设计问题，不是生产组件实现票。以用户实际讨论与原型反馈作答；产物和截图链接到票，结论只保存在独立 resolution 中。出现超出问题的新不确定性，加入地图 fog 或新票。

## Refs

- [需求底稿](../../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)：R01、R02、R06；S02–S04；D02、D03、D04。
- [地图 Notes](02-visual-journey-map.md#notes)：角色、原型范围与技能约定。
- [UI 模板](../../../docs/agents/ui-task-templates.md)：适用的场景、视觉、浏览器证据要求。
- 尚无批准的参考图；处理时先读前置票的原型与真实 resolution，并参考现有应用视觉，不把底稿 S 区域当已批准页面。

## Blocked by

- [用完整故事板选择策略观察者的主导航与操作顺序](03-observer-journey-prototype.md)

## 验收标准与反例

- [x] 从策略入口实际操作至组合准备运行，支持回退修改与两个策略包；展示规则解释而非通用条件搭建器。
- [x] 用可点击状态展示无候选、必需数据缺失、部分覆盖及非交易时点；策略卡直接说明不可用原因。
- [x] 确认首屏层级、字段顺序、默认展开与预览信息，避免把后续财报/走势或目标权重伪装为已发生事实。
- [x] 用户真实反馈及选定/拒绝理由记录于独立 resolution；反例：原型能运行就自动代表用户同意。

## 验收证据

技术原型PASS，设计决定待用户。见[独立验收](../creation-acceptance.md)及[当前预览](http://127.0.0.1:3047/?prototype=strategy-create&variant=A)；生产数据/真实回测/数据库持久化不属于本决策票的通过声明。

## 派发说明

2026-09-29 用户确认沿用 A 与现有风格后说“继续”，主协调者领取；代码原型须按项目流程界定文件范围、状态流与整页视觉所有权。使用合成数据，不写正式业务库，不把原型代码未经审查直接转为产品实现。

## 历史

- 2026-09-29：基于用户选择策略观察者角色建立决策票；未解决。

## 本轮派发契约

- [创建视觉与状态契约](../creation-visual-contract.md)，[逐项覆盖](../DESIGN-COVERAGE.md) C01–C10、V01–V02。
- Luna实现；主协调者负责全页与独立验收；允许修改 app/page.tsx、app/components/strategy-prototype/creation-prototype.tsx、creation-prototype.css 与 creation-implementation.md。旧A/B保留不改。
- 新开发原型入口 /?prototype=strategy-create&variant=A。真实引擎、持久化、行情图不在本票；不得接旧固定演示假装新参数已执行。

## 文件所有权调整

首轮审查失败后，分为不重叠修复：creation_prototype（gpt-5.6-luna）只写 creation-prototype.tsx、app/page.tsx 和 creation-implementation.md，负责所有内存状态与C01–C10；creation_visual（gpt-5.6-luna）只写 creation-prototype.css 和 creation-visual-implementation.md，负责V01/V02样式实现。主协调者不写UI实现，继续负责整页一致性、完整旅程和独立视觉接受。此调整不改变产品范围与设计门槛。

状态修复接管：creation_prototype 已停止，保留其失败产物与审查记录；creation_state_repair（gpt-5.6-luna）接管唯一 TSX 文件，按同一契约完整整理状态，禁止与旧owner同时写入。CSS仍由creation_visual负责。
