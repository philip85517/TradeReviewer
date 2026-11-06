# 一次练习的账户与标的边界是什么？

ID: TL20-D04
Labels: wayfinder:grilling
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: HITL
State: closed
Status: accepted
Assignee: root
集成负责人: root
Resolution comment: [单账户、单标的用户确认](../comments/TL20-D04/2026-10-26-resolution.md)

## Question

一份练习允许多少账户和标的？该归属怎样约束命名、完整源记录校验、筛选和顶层计数？

原题曾假定一份练习可能跨范围，并混入方向分类。用户于2026-10-26明确排除该假设后，本票收束为账户/标的边界；混合方向问题转回既有方向票，保留未决，详见Resolution。

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。HITL结论须与用户实时交流后记录。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L9–25
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L101
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L136
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L198
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L401–408
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/lib/trades/types.ts；app/lib/trades/tradingview-account-identity.ts；app/components/library/library-filter-options.ts。

## Blocked by

None.

## 验收标准与反例

- [x] 确认唯一账户与唯一标的，沿用单标的名称；跨范围输入不得成为有效练习，不自动拆分/截取。[用户原话与合同](../comments/TL20-D04/2026-10-26-resolution.md)
- [x] 不从单标的约束推定多空方向；原混合方向问题继续由[既有方向票](../../trading-library-v11-design-decisions/issues/04-list-sort-review-direction.md)处理，该票仍open，未宣称方向政策通过。[范围调整理由](../comments/TL20-D04/2026-10-26-resolution.md)
- [x] 同代码不同市场、同账户同日两文件、多账户一文件及单向未配对成交均有反例结论；账户选择器联动仍回[原票](../../trading-library-v11-design-decisions/issues/03-market-account-selectors.md)。[反例表](../comments/TL20-D04/2026-10-26-resolution.md)
- [x] 不拼接权益、不跨练习配对、每文件至多一个顶层样本，完整源行参与归属核查。[边界](../comments/TL20-D04/2026-10-26-resolution.md)
- [x] 独立Resolution记载原话、理由、影响及同步位置，root核对后接受。[Resolution](../comments/TL20-D04/2026-10-26-resolution.md)

## 验收证据

ACCEPTED（单账户、单标的业务边界）；root依据真实用户答复签署[Resolution](../comments/TL20-D04/2026-10-26-resolution.md)。混合方向仍未决，运行时导入校验/筛选/持久化NOT VERIFIED。当前只改决策与文档，UI/数据库验收NOT APPLICABLE。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。
- 2026-10-26 用户明确答复“一份练习仅可能包含一个账户和一个标的”；root领取并同步该业务约束。此答复没有定义同一标的先多后空的方向分类，不推定该政策。
- 2026-10-26 root记录独立Resolution并接受单归属边界；撤回多标的建议，混合方向回既有方向票，保留未决与下游验收。
