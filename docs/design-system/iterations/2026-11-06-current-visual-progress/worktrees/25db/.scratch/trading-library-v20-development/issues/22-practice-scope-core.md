# 校验完整源记录只属于一个账户和一个标的

ID: TL20-I10-SCOPE
State: closed
Status: accepted
Assignee: practice_scope_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

从I10拆出已有用户规则的纯校验前置。准确接口、来源假设、反例和允许文件见[派发合同](../evidence/dispatch/practice-scope-brief.md)。本票不接受真实导入、UI或持久化，I10保持原依赖。

## Refs

[业务规范](../../../docs/design-system/trading-library-design-spec.md)、[V2.0原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)、[设计矩阵](../DESIGN-COVERAGE.md)：DOMAIN-FILE / TL20-ENTITY-PRACTICE；DUPLICATE-EQUAL / TL20-IMPORT-DUPLICATE；准确行号/图与旅程见矩阵及合同。[导入整票](10-import-practice.md)。

## Blocked by

None. 本纯函数只接受已有规则与显式输入，不为未决产品政策代答。

## 文件和接口

仅app/lib/trades/practice-scope.ts及同名.test.ts、evidence/I10-scope/。其他文件只读；精确export和边界在派发合同中冻结，实现者报告实际签名供root核对。

## 验收标准与反例

- [x] 派发合同全部行为反例通过；不能由合格子集冒充完整输入。[行为与TDD](../evidence/I10-scope/implementation-report.md)
- [x] 输入不可变、稳定失败原因、无隐式补值或未决政策；red→green日志、定向静态检查保留。[实现证据](../evidence/I10-scope/implementation-report.md)
- [x] 独立专属Luna 5.6 Max规格/质量双审及root检查完成。[独立审查](../evidence/I10-scope/review.md)、[root接受](../evidence/I10-scope/acceptance.md)
- [x] UI/DB明确NOT APPLICABLE（仅纯函数），完整产品adapter/持久化/交互仍NOT VERIFIED。[范围与门槛](../evidence/I10-scope/acceptance.md)

## 验收证据

ACCEPTED（仅纯归属核心）。[Sol实现与TDD](../evidence/I10-scope/implementation-report.md)、[专属另一位Luna规格/质量双PASS及7项独立反例](../evidence/I10-scope/review.md)、[root独立接受](../evidence/I10-scope/acceptance.md)。工人47项行为测试，root9文件253项回归、项目tsc及定向ESLint均通过。真实完整源行adapter、导入保存、返回/reload和I10/I14仍NOT VERIFIED；UI/DB对本纯函数NOT APPLICABLE。

## 历史

2026-10-26 root按用户授权准备Sol 6.1 Ultra独立前置及不同Luna 5.6 Max验收。

2026-10-26 专属Luna双PASS、冻结hash及root独立检查完成，关闭本纯函数票；上级真实导入与归属保存旅程保持open。
