# 非法范围和缺失账户参数怎样恢复到可修正状态？

ID: TL20-D05
Labels: wayfinder:grilling
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Resolution comment: 未产生

## Question

直达/刷新 URL 的日期不全、倒序或非法，或账户缺失且没有已确认默认值时，应用怎样保留可用条件、解释未应用状态并让用户修正？

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。HITL结论须与用户实时交流后记录。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L95–120
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L306–321
- [docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)，L650–661
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/components/library/library-browse-state.ts；app/components/trade-review-workspace.tsx；app/lib/reviews/shared-scope.ts。

## Blocked by

- [市场与账户选择器的规则](../../trading-library-v11-design-decisions/issues/03-market-account-selectors.md)

## 验收标准与反例

- [ ] 沿用非法 market 回 all 并提示、非法/不完整范围不静默扩大、未知账户不伪造默认的已确认边界。
- [ ] 与用户决定无旧有效结果和有旧有效结果两种恢复状态、可编辑字段、应用/取消/返回与 URL 更正时点。
- [ ] 区分目标 URL 生效范围、来源返回快照和失败请求目标；不能用来源快照冒充目标范围。
- [ ] 记录账户选项读取失败、已删除账户、浏览器后退/刷新等反例；不重开已批准的普通首页入口。
- [ ] 独立Resolution记载事实/用户原话、理由、影响边界和待同步位置；协调者接受证据后才可closed。

## 验收证据

NOT VERIFIED；本轮未领取、未解决。未来事实/草稿放 `../evidence/decisions/TL20-D05/`，Resolution放 `../comments/TL20-D05/`；不存在的证据目录不代表已生成。纯决策不要求产品UI/DB验收；prototype若创建只验证讨论材料，不冒充产品。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。
