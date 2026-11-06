# 变更文件的候选、冲突和部分失败怎样让用户处理？

ID: TL20-D03
Labels: wayfinder:prototype
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: HITL
State: open
Status: deferred-user-scope
Assignee: unassigned
集成负责人: root
Resolution comment: 未产生

## Question

2026-10-27 [用户决定](../USER-DECISIONS-2026-10-27.md)：复杂变更文件处理暂不纳入本轮，发生时作为独立异常，不用本票延误其他功能。具体异常交互另行确定；本票仍 open，不表示规则或功能已经完成。

多个候选原练习、交易增删改、人工内容无法对应、日期冲突和部分解析失败时，用户如何看差异、选择更新/新建/取消、查旧版本并重新核对受影响内容？

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。HITL结论须与用户实时交流后记录。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L31–45
- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L61
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L146–159
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L407–408
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/lib/import/tradingview-reimport.ts；app/components/import/{import-confirm-dialog,import-management-drawer,tradingview-context-dialog}.tsx；app/lib/storage/trade-revisions.ts。

## Blocked by

- [练习名称与日期口径](../../trading-library-v11-design-decisions/issues/02-practice-names-dates.md)
- [人的交易行为识别与配对范围](../../trading-library-v11-design-decisions/issues/07-action-identification.md)

## 验收标准与反例

- [ ] 用粗略流程稿逐项呈现多候选、同名不同内容、删除有笔记交易、分组变化、版本冲突、部分失败；每个提交/取消的写入与回滚边界明确。
- [ ] 与用户确认人工成果匹配证据、冲突入口、待核对粒度、历史只读查看和恢复动作；未受影响状态不重置，不能静默删除或强移。
- [ ] 变更确认前原练习及统计不变；更新身份/编号不变；新建独立身份；旧版本不增加样本；不能把原有成交级 reconciliation 当作整条链已存在。
- [ ] 产出状态流与数据影响表，用户真实反馈保存在独立 Resolution；原型与合成样本不修改正式产品或业务库。
- [ ] 独立Resolution记载事实/用户原话、理由、影响边界和待同步位置；协调者接受证据后才可closed。

## 验收证据

NOT VERIFIED；本轮未领取、未解决。未来事实/草稿放 `../evidence/decisions/TL20-D03/`，Resolution放 `../comments/TL20-D03/`；不存在的证据目录不代表已生成。纯决策不要求产品UI/DB验收；prototype若创建只验证讨论材料，不冒充产品。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。
