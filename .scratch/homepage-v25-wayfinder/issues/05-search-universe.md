# 全局搜索覆盖哪些标的并如何保留身份

ID: homepage-v25-search-universe
Labels: wayfinder:grilling
Parent: [V2.5 首页代码设计决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

V2.5 全局实体搜索首期覆盖已导入标的，还是也覆盖已有元数据目录中尚无交易的标的？后者进入详情/交易库时的空结果和唯一身份如何表达？

## Scope / What to build

澄清搜索数据集合和无交易结果的业务合同；设计已定的搜索舞台、详情、局部搜索区别、300ms/IME、返回查询/焦点均不重开。当前不预设外部搜索供应商。

## Refs

- V2.5 HP03：130–160；HP04：295–322；附录二 symbolIdentity 与 IME：646–668。
- `app/lib/reviews/trading-room-global-entries.ts`、`trading-room-global-tools.tsx:90`、`trade-review-workspace.tsx:4554`。
- `search-overlay-open.svg`、`search-detail.svg`、`search.svg`；覆盖初表 HV25-07 至 HV25-10、HV25-28；P3。

本票图稿相对 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/`；具体可点击路径见 [设计覆盖](../DESIGN-COVERAGE.md)。代码文件均相对仓库根，标题缩写以该表/README的完整链接为准。

## Blocked by

None

## 验收标准与反例

- [ ] 向用户明确现状只搜索已导入标的，比较两种集合的收益/数据需求，记录真实选择；不从“全局”二字推断必须联网全市场。
- [ ] 标的身份包含交易所、代码及必要资产类别，账户/市场边界明确；同代码跨市场不能串标的。
- [ ] 无匹配、数据失败、有标的无交易与身份消失分别定义；不把 placeholder 或固定首行详情当接通。
- [ ] 查询/结果滚动/选中项/焦点返回合同与全局详情唯一主动作保持；持仓局部过滤不调用全局舞台。
- [ ] 若选择需要外部知识，再开 research 子票；本票不直接上线新数据源。

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
