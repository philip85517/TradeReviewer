# 首页共享规范采用哪些兼容接入点

ID: homepage-v25-shared-adoption
Labels: wayfinder:grilling
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

在用户已确认的首页先迁移范围内，哪些控件可通过现有 Module 的 Adapter 接入，哪些必须替换，如何避免首页 token 和新交互扩散改变其他页面？

## Scope / What to build

选择首页局部视觉根、控制层接入和迁移/回归方式；不讨论是否同时迁移全站，该范围已明确。原设计的尺寸、层级、状态和手势不在本票重画。

## Refs

- V2.5 HP11：40–110；HP08：516–549；公共手册及 inherited-contract.current.json。
- `app/globals.css:3`、`review-dashboard.module.css:1`、`trading-room-global-tools.tsx:1` 与真实调用方。
- 覆盖初表 HV25-03 至 HV25-10、HV25-50/51；CONTROL-STATE-COVERAGE.md 全96状态（85适用/11不适用）。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

None

## 验收标准与反例

- [ ] 列出12类控件的复用/适配/替换选择与真实调用方，明确不适用项依据及受影响页面回归范围。
- [ ] 核对手册、源图与状态 JSON：JSON 仍标 CURRENT_DERIVATION_NOT_ACCEPTED，96条 evidence.asset 使用旧 integration-assets 路径；正式派发需建立可定位的当前图/状态引用，不能机械当作已验收资产。
- [ ] 保持36px命中、16px通用/18px页头图标、日期图标语义、数字右对齐/完整值、系统字体与 reduced motion；持仓汇总 C、徽章24px为既有约束。
- [ ] 指定整页视觉一致性 owner、共享文件单一集成人、每片数据流 owner，并确定首帧1440/1280截图和空间预算。
- [ ] Resolution 只记录经用户确认的迁移选择；不能用组件故事/缩略图证明整页或真实状态通过。

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
