# 期间盈亏的现有输入能否逐笔支撑设计公式

ID: homepage-v25-period-evidence
Labels: wayfinder:task
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

从 master 的真实账本、估值、费用与 FX 输入出发，能否给出 V2.5 期间结果和当前贡献的可追溯输入/输出证据？哪些是直接复用、需要新增投影、缺失即不可计算，哪些需要进一步产品决策？

## Scope / What to build

只做支撑代码设计的字段追踪与脱敏/合成算例表，不实施页面、生产投影或修复原始交易。已批准公式不在本票重开。

## Refs

- V2.5 HP02：191–252；HP05 当前贡献：395–431；公共缺失/异步：465–502。
- `app/lib/reviews/trading-room-history.ts:820`、`trading-room-portfolio.ts:24`、`trading-room-contribution.ts:1`、`trading-room-scope.ts:80`。
- 覆盖初表 HV25-14 至 HV25-20、HV25-38 至 HV25-43；批次 P0/P2/P4。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

None

## 验收标准与反例

- [ ] 列出期间开始/结束、开仓/平仓日期、部分平仓、做空、费用、FX、市场/账户/分类的字段来源和缺失策略；区分逐笔实现与整回合已平仓。
- [ ] 给出跨年100→实现150/期末0=50；部分平仓（2份成本各100，期初价150，卖1份180，期末剩余价160，费用0，期间净40）；空头与缺行情/缺汇率反例。
- [ ] 逐项列出输入、预期已实现/期初/期末/净额、coverage/reasons、对账来源；不能用日盈亏求和或旧 closed-only 贡献代替证明。
- [ ] 对比未合入估值分支的相关证据，明确是否值得提取；不默认采用或合入。
- [ ] 输出代码设计所需合同与剩余问题；如需选择尚未定义的业务口径，建立 HITL 票，不代用户决定。

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
