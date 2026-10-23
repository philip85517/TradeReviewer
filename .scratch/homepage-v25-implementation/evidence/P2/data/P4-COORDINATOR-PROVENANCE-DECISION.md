# P4 来源归因：协调者裁定（派发准备）

2026-10-23 02:36 CST。root 已逐行审查 P4-MIXED-PROVENANCE-ORACLES.md（SHA256 2565c7ee8de0768412b1a97923206a1f6aa741d81d0d83085c88cbeb8263b787），并核对 HP05 的互斥来源及逐组件守恒要求。此文仅明确数据政策，不授权 P4 产品实施，P4 仍 0/3。

1. 唯一 canonical 平均成本与 F 费用池保持权威，不按类别重放账本。类别数量来源可以观察既有 transition；成本、实现与开放费用必须分配同一 transition 的金额，不能替换为独立 lot 利润。
2. 在实际可信、截止时点已知且完整的 disposal link 存在时，批准“来源数量份额 × 单一 canonical 平均池”贡献语义。类别账面成本/费用重分配必须留下零和 transfer 证据，不能改写取得成本和实际费用事实。批准字面 trusted 算例作为未来测试 oracle，不代表现有输入具备该链接或 observer 已实现。
3. **不采用无链接 pro-rata 默认政策。** 原批准规格没有定义无链接匹配，不能用推定小数份额填补来源事实。混合持仓发生缺失、冲突、未来或不足覆盖的处置链接时，受影响类别金额为 unknown + provenance-ambiguous；原 instrument 总财务可保持已知。不得自动 FIFO、整证券归 IPO，或用“其他”新分类掩盖问题。
4. 纯来源、实际明确链接与未知混合分开验证。类别合计只在全部必要分项已知时发布可核算总和；任何相关类别未知时保留全范围 canonical 总额及不可归因说明，不能求已知子集冒充全量合计。各类别未知不能填0。
5. 必须逐项核对 quantity/cost/grossR/realizedFee/openFee/openingUF/closingUF/net，并独立核对实际费用的原始来源与发生日。无费用 trusted t1净20+20=40、t2净20+30=50；非零费用 trusted t1净18+20=38、t2净18+28=46。期间实际费用仍2/4，不能用实现费用5/10替代。
6. 后续候选接口必须先证明真实数据是否携带可信 link、canonical observer 的可用边界和费用池事实；如需要修改 canonical ledger，先提交最小只读提取提案供 root 明确授权，不得借 P2-A 修改。缺字段须如实 unknown，不能伪造链接。

P4 正式派发前仍需完整历史/贡献边界合同和真实 entries 反例；本文不是视觉、功能或领域接受记录。

## 真实输入核查补充

root 已直接读取 `app/lib/trades/types.ts` 的完整 TradeExecution/TradeEpisode、`app/lib/import/monthly-statement.ts` 的 StatementPosition/StatementEvent，以及 `app/lib/import/statement-evidence.ts:620–670`。当前公开模型没有处置到取得批次的可信链接；`ipoCostEvidence` 是取得现金链，`positionEffect` 是方向，均不提供混合持仓处置归属。`sourceTradeId` 在现有 `isExecutionBackedIpoAllocation` 中用于佐证买入与 IPO 分配是同一取得事实，不能据此推断后续卖出来自 IPO。全仓仍由 `replayPositionAtPrice` 统一平均成本核算。

因此后续实施必须以实际可观察证据为界：纯来源可以归因，混合处置缺链接保持未知。不能为了通过 trusted oracle 人工给真实来源补造 link。若未来需要扩展数据输入，另行明确证据来源、知识截止和持久化边界；本次核查不授权 schema 或导入器改造。
