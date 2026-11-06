# 首轮实施如何切片定责并设置扩展门槛

ID: homepage-v25-first-slice-gates
Labels: wayfinder:grilling
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

在已审定状态、导航和公共规范接入合同上，首轮派发哪些完整用户行为，由谁接线/接受，达到什么实际证据后才能扩展依赖实现？

## Scope / What to build

把 README 的候选批次转成可执行纵向任务和派发说明；不在本地图会话实施代码，不以工期或并行度取代真实依赖。搜索集合尚未决定时仅阻塞相应搜索切片。

## Refs

- 项目 docs/agents/development-workflow.md、task-decomposition.md、frontend-control-audit.md、ui-task-templates.md。
- README.md 候选 P0–P5；DESIGN-COVERAGE.md 与 CONTROL-STATE-COVERAGE.md。
- V2.5 HP10：550–568；普通入口与返回：432–464；必要库内接线 BT03/BT04/BT06。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

- [期间盈亏的现有输入能否逐笔支撑设计公式](01-period-evidence.md)
- [首页以怎样的提交快照保持整页范围一致](02-applied-snapshot.md)
- [URL 与来源恢复如何接入现有 workspace](03-navigation-contract.md)
- [首页共享规范采用哪些兼容接入点](04-shared-adoption.md)

## 验收标准与反例

- [ ] 首片明确实盘范围→持仓→详情→普通交易库→返回/刷新，是真实数据真实容器；列出可独立准备内容与真实阻塞，不能先全面并行页面碎片。
- [ ] 逐项展开初步覆盖表到原规范/图/必需状态/控件实例/键盘与反例，不使用不存在的原稿 elementID，不漏动态与条件入口。
- [ ] 明确 Luna 的有限且不重叠写入范围、共享文件集成人、整页视觉 owner 和完整数据持久化流 owner；主协调者独立接受。
- [ ] 每片功能/端到端状态和持久化/视觉三类证据分别验收；明确隔离数据库、固定版本数据、两个视口和当前chat预览，未验证项不能关闭。
- [ ] 如接线改变回放合同，先纳入真实主图最小旅程、双截止/未来暴露/视野/保存重开门槛。
- [ ] 独立 Resolution 链接经确认执行计划和实现票；不得把本票闭合作为 V2.5 产品交付完成。

## 验收证据

- 当前：NOT VERIFIED；本轮只建图，无领取/执行/解决记录。
- 结论只属于本票决策或准备证据，不代表产品功能、浏览器、视觉或持久化通过。
- 解决后独立写入 `../comments/<ID>/<时间>-resolution.md`，链接真实用户回答或 AFK 证据，独立接受后关闭，并在地图增加命名指针。
- 本票本身为规划/准备；产品 UI/数据库验收不适用。若研究中实际启动测试，另绑定代码版本、隔离数据与验证范围。

## 派发说明

- 本次未派发。下次先重新读取并填写 Assignee；按依赖状态领取，不抢改共享文件。
- AFK 只准备证据；HITL 一次讨论一个问题，用户本人回答；不要代用户作决定或直接改产品。

## 历史

- 2026-10-22：Wayfinder 建图，open / unassigned。依赖在全部票创建后的第二遍接线。
