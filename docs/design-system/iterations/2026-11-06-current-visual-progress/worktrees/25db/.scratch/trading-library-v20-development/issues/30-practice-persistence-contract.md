# 冻结独立练习保存与重读的技术接口

ID: TL20-I10-CONTRACT
State: closed
Status: accepted
Assignee: practice_persistence_contract_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

为已批准的“完整文件作为独立练习、等价重导打开原练习”冻结下一条真实保存→读取→返回/reload切片的精确技术接口与事务边界。此票只产出可审查技术合同和合成兼容证明；不修改产品，不代答人的动作识别、估值、更新冲突或真实旧数据迁移政策。

## Refs

- [业务规范 L9–79](../../../docs/design-system/trading-library-design-spec.md)
- [V2.0 正文 L116–159、L365–369](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)
- [模拟盘参考图](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-sim-ab.svg)
- [完整导入旅程](10-import-practice.md)、[覆盖矩阵](../DESIGN-COVERAGE.md) DATE-IMPORT / TL20-IMPORT-DATE 及 I10 各行
- [旧链路事实准备](../evidence/decisions/TL20-D01/report.md)、[候选接口](../evidence/decisions/TL20-D01/candidate-contracts.ts)
- [已接受完整来源合同](../evidence/dispatch/tradingview-practice-source-requirements.md)、[日期决策](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)
- 当前 AGENTS、docs/agents/development-workflow.md、task-decomposition.md；归档副本不替代当前规则。

## Blocked by

- [旧数据怎样映射为独立练习并保留复盘引用？](01-legacy-contract.md)
- [一次练习的账户与标的边界是什么？](04-multi-scope.md)
- [完整来源预检](27-tradingview-practice-source.md)

## 验收标准与反例

- [ ] 精确声明 practiceId / revisionId、有效日期及来源、历史区间、全部源行与多重集、编号及历史、旧执行/复盘引用的提供者/消费者；完整 prepared 来源不能冒充财务投影资格。
- [ ] preview/commit/read/重复打开结果、失败与冲突返回、事务输入和实际 HTTP/UI 消费点明确；取消/失败不写，重复不占号；更新文件不静默覆盖。
- [ ] 合成旧库只读/dry-run 与新存储兼容策略保留旧ID/作品，不自动猜日期/配对；迁移未决明确阻止相关生产动作，不以猜测填补。
- [ ] 提供可运行合成接口/兼容反例，列出下一票实际允许文件集合和最小纵向旅程，不能只拆更多无消费者纯模块。
- [ ] 独立不同 Luna 5.6 Max 审查，root 读源码/接口并接受后才可冻结为生产合同。

## 派发说明

实现者实际 gpt-6.1-sol / ultra；独立验收者由 root 后续明确派发实际 gpt-5.6-luna / max。只允许写 `../evidence/I10-atomic-contract/worker/` 自有技术产物；不改产品、其他证据、共享文档、Git、服务、DB、依赖，不再派代理。root 独占整页视觉与完整持久化接线协调。

## 验收证据

待实现者冻结；本票无运行产品变更，UI/数据库写入验收 NOT APPLICABLE（仅技术合同准备），不解除 I10 产品的 UI/持久化/独立视觉门。禁止把本票关闭解释为 I10 完成。

## 历史

- 2026-10-27 root 领取并准备派发；用户指定模型沿用，生产写入前置合同未冻结。

2026-10-28 root [接受技术合同](../evidence/I10-atomic-contract/acceptance.md)，不同专属 Luna SPEC/QUALITY PASS、9反例与 root 21合成/strictTS/冻结核验通过；F-01正式逐行诊断纳入后续真实adapter。仅关闭技术准备，不接受生产功能。
