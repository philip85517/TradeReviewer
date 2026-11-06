# URL 与来源恢复如何接入现有 workspace

ID: homepage-v25-navigation
Labels: wayfinder:grilling
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

如何在现有 activeView 工作区中落实真实 /home、/trades URL，并使目标范围以 URL 为准、来源快照只承担返回恢复，同时兼容原来的库/复盘入口？

## Scope / What to build

决定路由接入方式、URL codec、账户与 symbolIdentity 编码、版本化来源快照存储和浏览器 back/refresh 的行为。交易库只补必要接线，不改完整内部设计。

## Refs

- V2.5 HP06：432–464；附录二：646–668；交易库 V1.0 BT01/BT03/BT04/BT06/BT07。
- `app/page.tsx`、`trade-review-workspace.tsx:4554/4599/4640/5249`、`trading-room-pending.ts:50`、`app/components/library/library-browse-state.ts:407`。
- 参考 `journeys-library-entry.svg`、`hcr06-final-return.svg`、`library-return.svg`；库内 `journeys-date.svg`/`handoff.svg`。覆盖初表 HV25-44 至 HV25-46、HV25-53；P1/P3/P4。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

- [首页以怎样的提交快照保持整页范围一致](02-applied-snapshot.md)

## 验收标准与反例

- [ ] 保留规定 URL 参数、显式账户、实际起止日；普通入口无 queue，非法/缺少参数提示并明确回退，不静默放大全部。
- [ ] 到达直接应用来源条件；按日期显示当日成交，包含未平仓，不沿用 closed-only 或平仓日期过滤。范围外开仓上下文不扩大结果归属。
- [ ] 定义普通/日期/标的入口、直达/刷新、浏览器返回、详情关闭、复盘返回和来源消失场景；恢复后重读数据。
- [ ] 来源快照包含期间/历史范围/市场/账户/额外筛选、持仓搜索排序页、贡献当前及双模式局部状态、滚动和稳定焦点键。
- [ ] 真实用户确认设计选择，Resolution 保留字段 schema、兼容策略、相关控件/数据流 owner 及完整旅程证据计划。

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
