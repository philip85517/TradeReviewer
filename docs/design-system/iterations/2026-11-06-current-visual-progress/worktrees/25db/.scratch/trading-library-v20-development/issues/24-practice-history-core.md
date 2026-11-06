# 全量历史交易日期校验并定位全部坏行

ID: TL20-I10-HISTORY
State: closed
Status: accepted
Assignee: practice_history_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

从导入整票拆出用户已确认的纯函数前置：完整全源日期才给历史起止，缺失/无效报告全部对应输入索引，不以有效子集冒充完整文件。精确技术合同见[派发说明](../evidence/dispatch/practice-history-brief.md)。不承诺当前 parser 已提供全源记录或原行映射。

## Refs

- [业务规范](../../../docs/design-system/trading-library-design-spec.md) L7–25、47–61。
- [V2.0原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) L19–41、116、142–146、316。
- [真实用户确认](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-invalid-history-confirmation.md)。
- [覆盖矩阵](../DESIGN-COVERAGE.md) DATE-IMPORT / TL20-IMPORT-DATE、DATE-THREE / TL20-PRACTICE-DATE、DOMAIN-FILE / TL20-ENTITY-PRACTICE。无独立数据画板，未来单练习参考 hcr06-final-sim-ab.svg，准确路径与范围见合同。

## Blocked by

- [校验有效练习日期并拒绝含糊候选](23-practice-date-core.md)

该已接受 helper 只复用严格日历校验，不使用练习日推断历史日期；原日期票其他 HITL 不属于本纯核心的政策依赖。

## 派发说明

仅 app/lib/trades/practice-history.ts 及同名 .test.ts 和 evidence/I10-history/；practice_history_sol / gpt-6.1-sol ultra，另配专属 history_acceptance_luna / gpt-5.6-luna max。root 独占共享文档、集成和接受。冻结签名、diagnostics 顺序及 typed DTO 边界见合同。

## 验收标准与反例

- [x] 全部源日期完整有效方可给起止；任何坏行不产生部分区间；固定顺序全部定位；[69项行为与TDD证据](../evidence/I10-history/implementation-report.md)。
- [x] 无猜测、不可变、日历/长输入/重复无序边界、静态检查和冻结产物；[Luna核验](../evidence/I10-history/review.md)、[root复核](../evidence/I10-history/acceptance.md)。
- [x] 专属另一位 Luna SPEC/QUALITY 双PASS及5项独立反例；[审查报告](../evidence/I10-history/review.md)与[root接受](../evidence/I10-history/acceptance.md)。
- [x] UI/DB/浏览器/视觉 NOT APPLICABLE 的纯函数范围原因及真实 adapter/原行UI/持久化/I10旅程 NOT VERIFIED，见[分项门槛](../evidence/I10-history/acceptance.md)。

## 验收证据

2026-10-26 root 已[签署接受](../evidence/I10-history/acceptance.md)，仅本票 typed DTO 纯函数合同。专属Luna双PASS、5项独立反例，root6文件283项相关回归、项目tsc、四文件ESLint与4项合成组合检查均通过。真实导入、原行UI、持久化、返回/reload及产品门槛全部 NOT VERIFIED。接受前14工人/20参考hash匹配；本次仅更新任务生命周期和证据。

## 历史

2026-10-26 root 在用户确认历史时间异常处理后冻结有界合同并领取派发；保留同问题最多5轮规则，不修改其他人工决策。

2026-10-26 root 接受并关闭本纯核心票，无产品返修；未关闭I10或原日期HITL票。
