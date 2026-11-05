# 用完整故事板选择策略观察者的主导航与操作顺序

ID: strategy-visual-03
State: closed
Status: accepted
Labels: wayfinder:prototype, ready-for-agent
Mode: HITL
Assignee: Codex 主协调者
集成负责人: 领取本票的主协调者
Parent: [策略观察者：从视觉原型确认完整使用动线](02-visual-journey-map.md)
Resolution comment: [采用 A 分步向导](../comments/strategy-visual-03/2026-09-29-resolution.md)

## Question

用户从“策略”入口开始，怎样最容易理解并走通历史建仓→观察自动运行→查看调仓解释→比较结果？创建向导、连续工作台等备选信息结构中，哪一种应成为后续原型的骨架？

## Scope / What to build

本票解决上述设计问题，不是生产组件实现票。以用户实际讨论与原型反馈作答；产物和截图链接到票，结论只保存在独立 resolution 中。出现超出问题的新不确定性，加入地图 fog 或新票。

## Refs

- [需求底稿](../../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)：R01–R06；S01–S08；Solution 核心路径。
- [地图 Notes](02-visual-journey-map.md#notes)：角色、原型范围与技能约定。
- [UI 模板](../../../docs/agents/ui-task-templates.md)：适用的场景、视觉、浏览器证据要求。
- 尚无批准的参考图；处理时先读前置票的原型与真实 resolution，并参考现有应用视觉，不把底稿 S 区域当已批准页面。

## Blocked by

None

## 验收标准与反例

- [x] 以一个组合经历首次建仓、一次自动调仓、期末结果为最小故事，保留第二组合的进入位置；覆盖已保存实验的返回入口。
- [x] 用低成本可点击故事板比较至少两种不同信息结构，明确完整用户动作；不先固定每个区域必须独立成页。
- [x] 用户明确选择主导航结构；未提供口述理解或选择理由，接受范围限定为结构选择，见 [Resolution](../comments/strategy-visual-03/2026-09-29-resolution.md)。
- [x] 用户真实选择与未说明事项记录于独立 [Resolution](../comments/strategy-visual-03/2026-09-29-resolution.md)；不把技术通过当作用户同意。

## 验收证据

两方案旅程及视觉证据见 [独立验收](../prototype-acceptance.md)；用户明确选择见 [Resolution](../comments/strategy-visual-03/2026-09-29-resolution.md)。生产数据/真实回测/数据库持久化不属于本决策票的通过声明。

## 派发说明

2026-09-29 用户说“继续”后由主协调者领取。代码原型须按项目流程界定文件范围、状态流与整页视觉所有权。使用合成数据，不写正式业务库，不把原型代码未经审查直接转为产品实现。

## 历史

- 2026-09-29：基于用户选择策略观察者角色建立决策票；未解决。

- 2026-09-29：开始首轮两方案可点击原型，用户尚未选择结构；子票保持 open。

## 本轮原型派发记录

- 主协调者领取；实现代理 `/root/observer_prototype`，实际模型 `gpt-5.6-luna`。
- 允许写入：`app/page.tsx`、新建 `app/components/strategy-prototype/*`、`prototype-implementation.md`；主协调者维护文档和浏览器验收，未参与原型代码实现。
- 场景契约：[视觉与操作契约](../visual-contract.md)；[逐项覆盖](../DESIGN-COVERAGE.md)；[独立验收](../prototype-acceptance.md)。
- 验收发现须由实现者修正；用户尚未选定结构，不能将技术检查通过视作 HITL 决策完成。

## 原型试用入口

- [A：分步向导](http://127.0.0.1:3047/?prototype=strategy&variant=A)
- [B：连续工作台](http://127.0.0.1:3047/?prototype=strategy&variant=B)
- [独立验收与修正证据](../prototype-acceptance.md)

2026-09-29：用户在预览链接提供后明确回复“A”；主协调者据此接受 A 主导航决策，保存独立 Resolution 后关闭。此前“尚未选择”的条目为历史记录。
