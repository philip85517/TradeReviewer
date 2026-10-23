# 首页以怎样的提交快照保持整页范围一致

ID: homepage-v25-applied-snapshot
Labels: wayfinder:grilling
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

在现有 sharedScope、局部 reducer 和 worker 之上，选择怎样的 applied/pending/draft 合同，才能使市场/账户/筛选提交成功后整组替换，失败保留旧范围与旧数据，又保持当前期间、最新持仓和历史范围各自独立？

## Scope / What to build

比较集中提交快照与现有状态增量适配；决定唯一事实来源、scope key、generation、错误/超时/重试和旧偏好兼容方式。不得缩减已定状态行为。

## Refs

- V2.5 HP01：11–38；HP03：113–190；HP09：465–502；附录二：646–668。
- `review-dashboard.tsx:230`、`use-holdings-history-worker.ts:61`、`app/lib/reviews/holdings-history-worker.ts:104`、`shared-scope.ts:10`、`dashboard-browse-preferences.ts:1`。
- 覆盖初表 HV25-01/02、HV25-11 至 HV25-13、HV25-47 至 HV25-49；P1/P2/P3/P4。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

None

## 验收标准与反例

- [ ] 与用户逐个问题比较候选与取舍，记录真实选择及原因；不把推荐方案当作已批准。
- [ ] 提供状态转移表：范围/日期/历史年/本地搜索/贡献下钻/返回、成功/失败/15秒超时/重试/旧响应；注明哪些组合原子提交。
- [ ] 明确首页 live 投影如何避免污染库内模拟盘状态；期间切换不重置持仓与历史，局部下钻不回写全局。
- [ ] 明确应用旧偏好/来源快照的版本迁移、非法状态与对象消失策略。
- [ ] Resolution 包含审定合同、调用方和可观察反例；领域新术语有真实共识才更新 CONTEXT。

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
