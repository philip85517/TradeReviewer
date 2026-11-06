# 01 — 隔离非财务源模型更新与发布

ID: update-publication-experiment-01
State: closed（仅本次隔离实验）
Status: accepted（产品和完整首屏验收仍未通过）
Assignee: update_experiment
集成负责人: 主协调者

## Scope / Refs

见 [DESIGN.md](../DESIGN.md)、[DESIGN-COVERAGE.md](../DESIGN-COVERAGE.md)、[PLAN.md](../PLAN.md)。输入冻结 run-02 非财务投影；输出只含脱敏计数、摘要、CPU/耗时/大小。源模型变化 synthetic，不触及真实导入流程；无 UI/画板/控件，浏览器检查不适用。允许文件本目录；数据库仅 .data/update-publication-worker；共享产品文件及冻结证据禁止写。

## Blocked by

None；协调者已批准并接受隔离重复性能运行 run-review-approved-01，运行已退出 0。此任务的完成只覆盖隔离实验，不改变上层完整页面实验的未完成状态。

## 验收标准

- [x] TDD RED→GREEN、原始日志可复查（14/14，实现者自验）。
- [x] 新增/修订/withdrawn/复活后 full、incremental 与独立 source oracle 全页及统计相等；旧全量 prepare 实现逐页对照。
- [x] 三失败点回滚源/投影/摘要/版本，迟到v1 CAS冲突和旧游标/identity失效覆盖。
- [x] 双连接真实 WAL 重叠事务观测旧/旧与新/新、metadata/rows屏障，无快照 mixed 负例。
- [x] 冻结源前后hash、空WAL复核，机器非独占，单次更新/首次读CPU时间与空间分列，限定不外推产品。
- [x] 协调者独立接受并签署；范围限本次隔离非财务实验，见 [验收记录](../benchmark/reports/run-review-approved-01/COORDINATOR-ACCEPTANCE.md)。

## 验收证据

见 [RESULTS.md](../RESULTS.md)、[RUN-HISTORY.md](../RUN-HISTORY.md)、[SNAPSHOT.json](../SNAPSHOT.json)。候选01单次轻量验证PASS（5,478个检查、147范围阶段、12单次更新样本）；该冻结证据保持原样。产品UI/视觉/真实导入/完整首屏 NOT VERIFIED 或范围不适用，不代替产品验收。

## 已批准重复性能运行（2026-10-29）

独立工具 tool-01 曾因入口未验证工具自身冻结身份而 FAIL；该失败及 TDD RED 保留，tool-02 修复后另行冻结。协调者已批准并完成 run-review-approved-01：28样本、14对全量/增量对照全部PASS；每样本21范围，累计588范围实例，pageSize=8/17分别核对19,992/9,604页。这里记录运行结果，不替代独立审查或协调者最终签署。

见独立新建的 [通俗结果报告](../benchmark/reports/run-review-approved-01/REPORT.md)、[28样本原始值CSV](../benchmark/reports/run-review-approved-01/raw-samples.csv)、[一次性准备原始值CSV](../benchmark/reports/run-review-approved-01/raw-preparation.csv)及[只读核对记录](../benchmark/reports/run-review-approved-01/READ-ONLY-RECONCILIATION.json)。原始运行回执在 [FINISHED.json](../benchmark/results/run-review-approved-01/FINISHED.json)。整理阶段只读取JSON和代码/支持文件身份，没有重跑、打开数据库或访问正式数据库，也没有修改 tool-02 冻结文件及原始结果。

历史新增发布wall中位数：full 72.405ms、incremental 3.983ms；跨组修订：72.796ms、3.832ms。首次读中位数full约0.44–0.46ms、incremental约0.71ms，不能声称增量改善首次读取。首建157.501ms仅为提取后实验源模型/投影/摘要准备；复制、输入提取、checkpoint、close、首次读及逐页核对均分别列出。机器非独占，不能外推生产SLA、冷缓存、长时尾延迟或完整首页1秒。

真实冻结投影作为初始事实，变化为合成；source_facts是实验源模型，同库事务不证明真实产品源与投影原子一致。本轮性能测量未重跑失败回滚、旧游标、双连接并发或崩溃恢复。名称、localized_name、accountLabel和完整页面版本仍在10字段范围外；bookVersion不能单独作为完整页面版本凭据。财务P1/F07、Bars、重复导入及真实导入继续暂停。
