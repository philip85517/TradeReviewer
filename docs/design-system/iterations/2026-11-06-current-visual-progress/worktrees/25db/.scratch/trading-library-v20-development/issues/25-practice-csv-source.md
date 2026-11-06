# 保留完整CSV记录并定位原文件物理行

ID: TL20-I10-CSV-SOURCE
State: closed
Status: accepted
Assignee: practice_csv_source_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

为I10完整源文件与错误原行建立严格CSV词法前置；保留表头、空行、重复、坏业务值及未配对记录，不使用 accepted executions 反推原文件。不改变现parser或产品接线。准确接口/语法/原始UTF-16 offset/物理行规则见[冻结合同](../evidence/dispatch/practice-csv-source-brief.md)。

## Refs

[业务规范](../../../docs/design-system/trading-library-design-spec.md) L7–25、31–37、47–61；[V2原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) L19–41、116、146；[用户历史异常确认](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-invalid-history-confirmation.md)。[矩阵](../DESIGN-COVERAGE.md) DOMAIN-FILE、DUPLICATE-EQUAL、DATE-IMPORT 与对应 elementID；无词法数据画板，未来入口参考 hcr06-final-sim-ab.svg，精确路径见矩阵。

## Blocked by

None. 只处理CSV词法，无账户/标的/日期/历史区间政策或未冻结函数消费。

## 派发说明

仅 app/lib/import/practice-csv-source.ts、同名.test.ts、evidence/I10-csv-source/。practice_csv_source_sol / gpt-6.1-sol ultra；专属不同 csv_source_acceptance_luna / gpt-5.6-luna max，root集成。接口见冻结合同。与历史日期核心无共享文件/未冻结调用依赖，可并行。

## 验收标准与反例

- [x] 完整记录不裁切，空/重复/坏业务值保留；三类坏CSV失败无子集；TradingView格式源例子及[TDD证据](../evidence/I10-csv-source/implementation-report.md)。
- [x] 引号、各换行、BOM、UTF-16、原物理行/offset及长输入；[独立审查与冻结检查](../evidence/I10-csv-source/review.md)、[root复核](../evidence/I10-csv-source/acceptance.md)。
- [x] 专属另一位Luna SPEC/QUALITY双PASS及9项独立反例，root独立检查后[签署接受](../evidence/I10-csv-source/acceptance.md)。
- [x] UI/DB/浏览器/视觉因纯词法范围NOT APPLICABLE；真实解码/业务adapter/保存返回reload及I10旅程NOT VERIFIED，见[门槛表](../evidence/I10-csv-source/acceptance.md)。

## 验收证据

2026-10-26 root 已[签署接受](../evidence/I10-csv-source/acceptance.md)，仅本票词法合同。专属Luna双PASS、9项独立反例；root6文件283项相关回归、项目tsc、四文件ESLint、4项合成组合检查，以及对修正后Luna9项反例独立复跑均通过。审查oracle错误及原始不可恢复元数据明确记录，未改产品。现生产parser未改变，FULL-CONTENT-001未因此修复；完整I10与所有产品门仍NOT VERIFIED。

## 历史

2026-10-26 root 冻结完整源CSV词法合同并派发，与历史日期核心并行，无共享写入；业务决策仍由原日期票处理。

2026-10-26 root 接受并关闭本纯词法票；44个工人文件保持冻结，仅更新本票生命周期与证据。无产品返修，不关闭完整导入票。
