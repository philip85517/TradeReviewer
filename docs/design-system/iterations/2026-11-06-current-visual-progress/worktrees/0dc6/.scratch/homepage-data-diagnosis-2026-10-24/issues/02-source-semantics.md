# 02 — 首页与普通库实盘资格及来源完整性不一致

ID: homepage-data-finding-02
State: open
Status: nature-protocol-accepted / financial-source-open
Assignee: unassigned
集成负责人: root

## Scope / What to build

记录已证实的语义差异与来源诊断。不是新的财务实施票，不接受以本票绕开暂停或重置轮次。

## Refs

- [D02](../DESIGN-COVERAGE.md)、[诊断第2节](../DIAGNOSIS.md)
- app/lib/trades/types.ts:207；trading-nature.ts:5；homepage-v25/attachment-groups.ts:50；holdings-model.ts:50；financial-acquisition.ts:191。
- [原财务票](../../homepage-v25-implementation/issues/10-financial-acquisition.md)、[原完整性票](../../homepage-v25-implementation/issues/13-stored-representation.md)

## Blocked by

后续实现需要确定历史数据资格策略；涉及原财务管线的实施依旧受P1/F07暂停3/3约束。本次不派发。

## 验收标准与反例（修复未执行）

- [ ] 受审计的历史券商性质策略在新旧页面一致可解释，不将未知/模拟无证据升级为实盘。
- [ ] 原始成交/回合身份保留；非零实盘及模拟、未知反例独立验证。
- [ ] carrier、月结归属、公司行为诊断可追踪，不伪造complete；完整金额另行验收。

## 当前证据/状态

[PROBE](../PROBE.json)：1784 unknown vs legacy live；严格selectedEntries0；无行情完整性探针unknown/3056 gaps。[桌面对照](../CONTROL-AUDIT.md)：普通库232/732，首页集合0/0。问题确认，修复NOT VERIFIED。Owner仅为后续协调，不代表已恢复原任务。

## 后续范围更新

用户随后要求“首先解决2的接口协议问题”。性质合同子范围在 [homepage-nature-contract](../../homepage-nature-contract/FINAL-ACCEPTANCE.md) 已由root首轮1/3独立验收。历史数据解析为1778live/84simulation/6unknown，764回合ID与成员保持；桌面首页入口进入交易库226标的726回合，刷新保持。上方原始诊断证据与修复前清单保留；其前两项由该子任务证据完成。财务来源carrier、月结归属、完整性与超时仍未修复，第三项仍开放，P1/F07与Bars维持暂停3/3，不将整张问题票关闭。

当前只读复查见[新漏斗](../../homepage-read-funnel-after-nature-2026-10-24/FUNNEL.md)：同一候选源码/构建，selectedEntries232、representation unknown/231 gaps、source universeComplete=false，scope与公司行为仍有完整性原因；不能因性质通过关闭财务来源部分。
