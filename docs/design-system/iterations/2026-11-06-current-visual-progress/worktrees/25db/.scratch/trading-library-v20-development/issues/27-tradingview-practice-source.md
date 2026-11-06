# 从完整 TradingView 文件预检全部原行并比较内容

ID: TL20-I10-TV-SOURCE
State: closed
Status: accepted
Assignee: tradingview_practice_source_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

真实文件 bytes→严格解码→完整CSV→文件名日期/全部历史时间/显式归属校验→完整记录内容多重集；未配对和重复行不能丢失。冻结精确类型、归属来源前提、数值格式与 raw 保留、全部异常与证据见[唯一技术合同](../evidence/dispatch/tradingview-practice-source-requirements.md)。只接受完整业务来源适配，不把 prepared 当成最终可保存或财务/配对有效；没有生产调用者，真实确认/保存/返回/reload 保持 NOT VERIFIED。

## Refs

[业务规范](../../../docs/design-system/trading-library-design-spec.md) L7–61；[V2原文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) L116–159；[当前用户命名/日期规则](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)。[覆盖矩阵](../DESIGN-COVERAGE.md)：DOMAIN-FILE、DUPLICATE-EQUAL、DATE-IMPORT、ERROR-INVALID-DATE 及其 elementID；未来入口[练习列表原图](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-sim-ab.svg)，本源适配无 UI 画板。

## Blocked by

- [校验有效练习日期并拒绝含糊候选](23-practice-date-core.md)
- [校验全部历史交易日期并定位坏原行](24-practice-history-core.md)
- [保留完整CSV记录并定位原文件物理行](25-practice-csv-source.md)
- [核对完整源文件的唯一练习归属](22-practice-scope-core.md)

## 派发说明

唯一实现者 tradingview_practice_source_sol / gpt-6.1-sol ultra；不同专属 tradingview_practice_source_acceptance_luna / gpt-5.6-luna max；root 集成实际 I10 入口和接受。仅两个新 import 源/测试文件及 evidence/I10-tradingview-source/worker/，精确路径以技术合同为准。禁止旧 parser/dispatcher、共享文档、DB、服务、依赖及 Git 写入。所有前置重新接受后才能派发，不以模型或优先级绕过门槛。

## 验收标准与反例

- [x] 完整 bytes 组合链及全部原行，未配对最早日期纳入历史；坏日期全量定位/列宽/UTF8/词法/header 失败不输出有效子集，TDD 日志。
- [x] 全17列、原始物理行及原文追溯；完整内容规范化可容忍格式/列序/行序而保留重复次数、未配对、raw 数值和信号变化；不能单靠内容相同认定同练习。
- [x] 专属不同 Luna SPEC/QUALITY 独立审查、版本 SHA/bytes 与实际 diff 绑定；root 独立源码、回归及反例接受。
- [x] UI/浏览器/视觉/DB对无接线模块 N/A；实际用户确认、生产来源认证、保存/重导、返回/reload 未验证，不能关闭 I10。

## 验收证据

见[root接受](../evidence/I10-tradingview-source/acceptance.md)。专属不同Luna SPEC/QUALITY双PASS与6独立反例，root430项相关回归、无增量tsc、冻结48产物24快照复算通过。97新增/443工人回归通过，4私有样本NOT VERIFIED。TVSRC-TEST-FIXTURE-001修复1轮解决，原失败保留。仅纯源模块范围，I10实际产品仍未接受。

## 历史

2026-10-26 root 在原日期与命名决策收口后冻结此 I10 技术前置，等待当前日期模块独立接受。

2026-10-26 四项依赖已 closed/accepted，root领取到唯一实现者，开始派发；源适配之外实际入口仍未实施。

2026-10-26 root 独立接受冻结纯源版本，关闭本票；实际拒绝/重试入口由独立票实施。
