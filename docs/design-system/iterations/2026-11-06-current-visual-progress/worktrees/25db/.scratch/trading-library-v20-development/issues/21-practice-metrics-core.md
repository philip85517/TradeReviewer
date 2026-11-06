# 在未知输入下准确计算独立练习指标

ID: TL20-I16-CORE
State: closed
Status: accepted
Assignee: practice_metrics_sol
集成负责人: root
Owner role: STATS
Priority: P0

## Scope / What to build

从模拟统计整票拆出不依赖数据来源的独立前置：调用者显式提供已经确认的值与资格，纯函数计算金额、收益率、练习级计数/胜率和最差练习回撤。不得接UI、来源provider、SQLite/HTTP/bootstrap，不改变其他页面episode算法。精确值、反例、范围和报告合同见[派发要求](../evidence/dispatch/practice-metrics-brief.md)。本票不替代或关闭I16；未来DATA适配、真实输入和UI独立验收仍由整票负责。

## Refs

- [交易库设计规范](../../../docs/design-system/trading-library-design-spec.md)，L83–109。
- [V2.0原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L187–208、401–408。
- [矩阵](../DESIGN-COVERAGE.md)：SIM-STATS-UNIT、PNL-GROSS-NET、WIN-EMPTY-BREAKEVEN、RETURN-CAPITAL、MDD-VALID、MDD-PARTIAL、MDD-EMPTY-ZERO；元素TL20-SIM-STATS、TL20-METRIC-PNL/WIN/RETURN/MDD。
- [模拟统计整票](16-simulation-metrics.md)及[资金估值来源决策](02-valuation-authority.md)。本票接受显式输入而不实现这些未决来源政策。

## Blocked by

None. 计算公式已有批准；未决来源不进入本票，不以自行假定数据解除整票依赖。

## 文件和接口

允许仅`app/lib/trades/practice-metrics.ts`及同名`.test.ts`、`../evidence/I16-core/`。实际export签名由实现者写入报告后冻结给DATA/STATS消费者；输入显式含gross/net、残余是否存在/结束估值、正初始资本及路径完整性；未知保留原因，未定义币种混合/重复ID拒绝或报告，不隐式计入。所有原有文件只读。

## 验收标准与反例

- [x] gross100 + float(-30) - fee10 =60；已含费不重扣；残余缺估值不能用已实现部分冒充整体；无残余不要求估值。[证据](../evidence/I16-core/review.md)
- [x] 缺/零/负本金只使收益率未知；盈亏资格独立；2赢1亏1平1未知的练习胜率为2/4，无样本返回未知。[证据](../evidence/I16-core/review.md)
- [x] V2的6/5/1、388、60%及A残余缺估值/显式假设浮动2800两路计算正确。[证据](../evidence/I16-core/review.md)
- [x] MDD逐练习计算，25%与10%取25%，部分路径仅coverage、空集、完整0%分别可区分；无序/损坏/现金流明确排除；不拼接权益。[证据](../evidence/I16-core/review.md)
- [x] Decimal精度、输入不变性、重复ID及币种边界有行为测试；保存red→green与定向测试结果。[工人报告](../evidence/I16-core/report.md)、[独立反例](../evidence/I16-core/review-counterexamples.log)
- [x] 独立Luna 5.6 Max分别给出spec/quality结论，root审实际差异及检查证据；不能据此接受整页功能。[独立审查](../evidence/I16-core/review.md)、[root接受](../evidence/I16-core/acceptance.md)

## 验收证据

ACCEPTED（纯核心）；[实现报告](../evidence/I16-core/report.md)、[独立SPEC/QUALITY双PASS](../evidence/I16-core/review.md)、[root接受](../evidence/I16-core/acceptance.md)。root独立6文件111项回归及项目tsc通过。UI/数据库验收NOT APPLICABLE，原因是本票不改任何控件/交互或保存链；整票后续消费者接线仍NOT VERIFIED。

## 历史

- 2026-10-26 用户授权并行开发；root裁定将计划已允许的纯计算准备独立为本票，已派practice_metrics_sol / gpt-6.1-sol / ultra；独立验收另配gpt-5.6-luna / max。
- 2026-10-26 专属metrics_acceptance_luna完成独立SPEC/QUALITY双PASS；root复核准确差异、111项回归和项目类型检查后仅接受本票。TL20-MET-001在1轮修复后通过，未触及5轮上限；I16及完整产品未接受。
