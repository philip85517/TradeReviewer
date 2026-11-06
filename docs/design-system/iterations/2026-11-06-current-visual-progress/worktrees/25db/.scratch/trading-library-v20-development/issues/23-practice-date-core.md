# 校验有效练习日期并拒绝含糊候选

ID: TL20-I10-DATE
State: closed
Status: accepted
Assignee: practice_date_policy_sol
集成负责人: root
Owner role: DATA
Priority: P0

## 当前变更与重开

2026-10-26 用户要求文件名只识别一个有效日期，否则导入失败，取代候选确认/人工补填。旧接受仅保留历史；旧 resolvePracticeDateCandidate 不满足当前导入合同，重开由 practice_date_policy_sol 修改同一对源码/测试，独立 date_policy_acceptance_luna 验收，root 集成。最新要求见[派发摘要](../evidence/dispatch/task-26-date-policy-brief.md)及[完整合同](../evidence/dispatch/date-policy-requirements.md)。validatePracticeDate 的严格日历接口保持，历史核心只依赖此接口，需定向回归。当前新合同已独立接受，见[本次 root 接受](../evidence/I10-date-policy/acceptance.md)；原接受历史保留。

## Scope / What to build

从I10拆出已有用户规则的纯校验前置。准确接口、来源假设、反例和允许文件见[派发合同](../evidence/dispatch/practice-date-brief.md)。本票不接受真实导入、UI或持久化，I10保持原依赖。

## Refs

[业务规范](../../../docs/design-system/trading-library-design-spec.md)、[V2.0原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)、[设计矩阵](../DESIGN-COVERAGE.md)：DATE-IMPORT / TL20-IMPORT-DATE；ERROR-INVALID-DATE / TL20-STATE TL20-RETRY；准确行号/图与旅程见矩阵及合同。[导入整票](10-import-practice.md)。

## Blocked by

None. 本纯函数只接受已有规则与显式输入，不为未决产品政策代答。

## 文件和接口

仅app/lib/trades/practice-date.ts及同名.test.ts；本次证据evidence/I10-date-policy/，原evidence/I10-date/只读。其他文件只读；精确export和边界在派发合同中冻结，实现者报告实际签名供root核对。

## 当前验收标准与反例

- [x] 文件名严格一个有效日期，所有出现次数与坏日期/边界反例、严格日历兼容通过。[当前实现/TDD](../evidence/I10-date-policy/worker/task-26-date-policy-report.md)
- [x] 无候选/人工/历史/今日补值，旧 API 无生产消费者，source/test 与冻结 diff 绑定。[专属 Luna](../evidence/I10-date-policy/review/acceptance-review.md)
- [x] 不同专属 Luna 规格/质量双 PASS，8项独立反例；root336项回归、项目 tsc 及55 payload复算。[root接受](../evidence/I10-date-policy/acceptance.md)
- [x] UI/DB只对无接线纯模块 N/A；真实导入/日期保护/编号/返回/reload仍 NOT VERIFIED。[门槛与版本](../evidence/I10-date-policy/acceptance.md)

## 当前验收证据

ACCEPTED，仅修订后的文件名日期核心。[完整接受记录](../evidence/I10-date-policy/acceptance.md)。DP-TYPE-01 第1轮已解决；没有未解产品 finding。I10/I14 仍 open，不能据此关闭完整旅程。

## 原版本接受（历史）

旧候选 DTO 核心的[原实现](../evidence/I10-date/implementation-report.md)、[原专属 Luna](../evidence/I10-date/review.md)、[原 root 接受](../evidence/I10-date/acceptance.md)保持不变；候选导入政策现已被用户明确覆盖。旧版本92项与root253项是历史证据，不冒充当前文件版本。

## 历史

2026-10-26 root按用户授权准备Sol 6.1 Ultra独立前置及不同Luna 5.6 Max验收。

2026-10-26 专属Luna双PASS、冻结hash及root独立检查完成，关闭本纯函数票；上级真实导入/日期旅程保持open。

2026-10-26 用户文件名政策修订后重开；Sol6.1Ultra完成，专属不同 Luna5.6Max双PASS，root复核当前冻结版本并重新接受，仅关闭此纯模块票。
