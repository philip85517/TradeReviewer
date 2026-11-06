# 04 — 隔离测量入口的失败边界与真实回执

ID: combined-read-failure-boundaries
State: closed
Status: accepted
Assignee: finish_boundary (接续 risk_diagnosis)
集成负责人: 主协调者
Blocked by: 无；真实测量仍暂停

## Scope / Refs

用户经协调者确认：隔离入口及实际失败回执；未取得初始信息、main/sidecar 读取失败、复制中断、源变化、正常复制对照与相关逻辑分支覆盖。仅新 candidate-05 和新建合成数据，保留 candidate-04/旧记录，不访问真实数据库/固定事实源，不运行真实规模入口。见 [覆盖记录](../measurement/candidate-05/DESIGN-COVERAGE.md)、[计划](../measurement/candidate-05/IMPLEMENTATION-PLAN.md)。最多3轮；当前第2轮。

## 验收

- [x] 实际共享入口与落盘回执的逐片红绿证据。[独立验收](../reviews/measurement-05/ROUND-02.md)
- [x] 错误、失败核验和未验证逐项区分，原始安全错误语义保留。[独立验收](../reviews/measurement-05/ROUND-02.md)
- [x] 正常复制、main/三个日志边界、复制中断和收尾故障适当覆盖。[协调者验收](../reviews/measurement-05/COORDINATOR-02.md)
- [x] 仅新代码/新测试的实际分支覆盖分母、命令与缺口。[实现报告](../measurement/candidate-05/evidence/ROUND-02-WORKER-REPORT.md)
- [x] 协调者独立验收，限约定的合成 acquisition 路径。[协调者验收](../reviews/measurement-05/COORDINATOR-02.md)

## 第1轮实现交付（等待独立验收）

自测新增边界 41/41 PASS、继承回归单独执行 64/64 PASS；保全 115/115 文件无变。新增测试的五个修改文件 native V8 分支范围 253/312（81.09%），明确函数区域含嵌套 173/207（83.57%）；语句覆盖率 NOT MEASURED，未覆盖/排除项如实保留。见 [实现报告](../measurement/candidate-05/evidence/WORKER-REPORT.md)、[最终新增测试](../measurement/candidate-05/evidence/11-final-new-boundaries-coverage.txt)、[最终继承回归](../measurement/candidate-05/evidence/12-final-inherited-regression.txt)。

指标缺失使测量失败并记录 NOT VERIFIED；不放宽真实测量门槛。锁 owner unlink 后 rmdir 失败的无 owner 残留已经实际共享入口验证并报告，不自动删除未知锁。没有运行真实入口/固定事实源/业务数据库。以上是实现者证据，验收勾选由协调者独立确认；本票保持 open。

## 第1轮独立验收 FAIL / 第2轮修复

发现 reserveRun 之后 journal、合成文件、context 初始化在保护区外，可能泄漏锁及缺少 FAILED。前轮自测不构成接受；[失败记录](../measurement/candidate-05/evidence/16-round-01-acceptance-failed.md)。第2轮在同一已确认的合成共享入口做 TDD，真实入口仍禁止启动；总计最多3轮。

## 第2轮实现交付（等待独立验收）

[第2轮报告](../measurement/candidate-05/evidence/ROUND-02-WORKER-REPORT.md)：4个有效 RED/GREEN 切片及8个初始化边界，累计新增49/49 PASS、继承单独64/64 PASS。原始115文件与首轮快照28文件均保全。native V8范围265/323（82.04%），指定区域180/214（84.11%），语句NOT MEASURED。初始化失败纳入共享保护、context在获取前建立、回执不可写明确NOT VERIFIED及persistenceConfirmed:false。真实入口未运行，审批前置门禁未改；首轮拒收保留，遗留包装/预约内部等缺口如实列出，验收勾选仍待协调者。

## 协调者验收（第2轮，范围限定）

2026-10-29：独立审查与协调者各自重跑新增49项，均49/49通过；首轮失败及其修复证据保留。[独立验收](../reviews/measurement-05/ROUND-02.md)、[协调者验收](../reviews/measurement-05/COORDINATOR-02.md)。本票只接受已批准的隔离合成 acquisition 路径；真实测量、真实审批与历史两个 synthetic wrapper 的初始化行为仍未验证，原测量任务保持暂停。候选覆盖矩阵中此前的 PENDING 保留为冻结前快照，以本验收记录为后续结论。
