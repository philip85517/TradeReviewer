# 01 行情单证券窄查询

State: closed
Status: accepted
Assignee: /root/astra_narrow_query_impl (gpt-6-astra, ultra)
集成负责人: root
Blocked by: 无
验收轮次: 2/3

## What to build / Scope

按 ../PLAN.md Task01，仅修改 route及测试、sqlite-store及测试。复用 hasInstrument，覆盖筛选下推参数化 SQL，无参行为与所有响应保持。保留已有脏修改。

## Refs

../DESIGN-COVERAGE.md；../../homepage-one-second-feasibility-2026-10-24/SERVER-FEASIBILITY.md；项目当前 agents 工作流。

## 验收

- [x] 有关/无关损坏、ID/interval、多周期、多段、错误码、日期边界、排序及 no-store 契约通过。
- [x] 两连接修订即时可见；无缓存；窄 SQL 的真实数据库证据。
- [x] route/store/repository/client 定向测试与独立增量 review 通过。
- [x] root 在隔离真实副本核验查询结果与成本；不以本票证明一秒首屏。

反例：全表解析仍能被无关 metadata 损坏击穿；删除 dailyOnly.intervalCoverage；遗漏无参迁移读；错误吞成空数据。候选 01 证据见下，未独立接受不打勾。

## 候选 01 交接（2026-10-24）

实现者定向验证：baseline 93 项通过；新增真实临时 SQLite 反例先红（13 项失败、88 项通过）；最小实现后 route/store/repository/client 共 121 项通过。所有运行使用固定 native Node 与 `--maxWorkers=1`。无参读取、完整 dailyOnly 响应、两连接同记录数修订、参数化 SQL 及所选损坏仍报 503 已在自测中验证。

交接报告：`../../../.superpowers/sdd/PLAN/task-01-report.md`（仓库根 `.superpowers/sdd/PLAN/task-01-report.md`）；证据目录：`../evidence/task-01/`，包含红绿日志、相对实施前 `candidate-01.diff` 和四文件 SHA-256 清单。

本票保持 open；上方验收项须由 root 独立审查、隔离真实副本成本核验后签署。候选 01 已提交待验，验收轮次由 root 维护，未自增或重置。整页一秒目标、浏览器/视觉和完整首屏仍为 NOT VERIFIED，不能由本票测试代替。

Root 首轮已开始：独立重跑四文件 121 项全部通过（`ROOT-TESTS.log`，exit 0）；新独立 Astra Ultra reviewer 已派发。真实副本 HTTP 等价与成本待统一候选生产构建后验证，未提前关闭。

## Root 首轮结果与候选 02（2026-10-24）

第 1/3 轮：**FAIL**。Root 生产构建 PASS、独立 121 项测试 PASS、独立 review Approved，但 `route.test.ts:200` 新增 TS2345：异构 `it.each` 用例表推断出可选 `undefined` 属性，不能传给 `Record<string, string>`。原 `candidate-01/TYPECHECK.log` 与所有冻结候选 01 证据保留。

按 root 授权进入第 2/3 轮，唯一修改为给该参数表声明 `it.each<Record<string, string>>`，无类型断言、无产品逻辑变化。已对比 baseline/candidate-01 类型日志，本票新增错误仅上述一处；四个拥有文件的定向类型诊断先复现 1 错，再降至 0；原四文件定向测试 121 项 PASS（`--maxWorkers=1`）。最新证据：`../evidence/task-01/candidate-02/`，报告见原交接位置。

候选 02 已 implementation-ready，等待 root 独立接受；保留上方未完成验收项。全库类型检查、构建/服务/浏览器未由本轮实现者运行。

## Root 最终接受（第2/3轮）

局部PASS，见 ../evidence/task-01/candidate-02/ROOT-ACCEPTANCE.md。首轮FAIL保留；全仓原有8项类型错误、整页一秒/财务与Bars暂停均未关闭。
