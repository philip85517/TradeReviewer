# 展示缓存与重启原型 Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:executing-plans。已按当前任务指定实现者执行，仓库禁止子代理再派代理；独立审查由协调者安排。

**Goal:** 同一成交版本下名称变化拒绝旧缓存，未变时真实进程重启复用。
**Architecture:** 最小合成SQLite源、十字段事实投影、独立展示摘要和持久缓存；组合版本与读事务保护。
**Tech Stack:** 固定Node26.0.0 / SQLite3.53.0、node:test、worker_threads、child_process；无依赖安装。
**Spec:** DESIGN.md，DESIGN-COVERAGE.md D01–D09；协调者已接受直接推进。

## Global Constraints

只写本.scratch目录、.data/display-cache-restart-worker新建唯一私有测试目录。不改产品或旧冻结证据、不读取正式库、不测性能、不触及暂停工作。独立进程读取必须显式私有路径；保留原始失败/证据。最多3候选轮。

## Review Focus

同账户多逐笔标签不能按账户去重；localizedName结构和缺失/空串不同；旧book身份/epoch不能用sequence替代；重启必须是新进程且0写入；元数据与行之间必须有真实跨连接提交。全部归入以下一项纵向实验。

## Task 1 — 组合版本持久缓存纵向验证

文件：cache.mjs（唯一原型）、cache.test.mjs（字面夹具/反例）、support.mjs（私有合成建库）、restart-snapshot.test.mjs/process-worker.mjs（真实进程重开）、snapshot-worker.mjs（WAL屏障）、README/RESULTS/issue/SNAPSHOT（非产品报告）。

接口：support.fixture()建立唯一私有合成源；currentVersion(db)取得组合凭据；refresh(db)返回{binding,reused,factBuilds,displayBuilds}；read(db, expected)返回固定事实+展示缓存；beginRead(db, expected)返回{binding,finish,abort}并显式持有读事务。路径创建仅测试辅助模块负责，core不解析业务配置。

- [x] 先写版本/名称反例并运行RED，最小版本摘要实现后GREEN；逐步增加刷新、缺失/旧版本、损坏、进程重启和WAL屏障反例，各自保存RED。
- [x] 每项预期来自手工两行夹具，不使用被测摘要函数产生期望名称或行内容。
- [x] 实现最小行为，逐项GREEN；旧缓存不得静默读出；未变refresh不写DML。
- [x] 全部离线实验测试运行一次最终验证并保留stdout、退出码、时间、机器非独占条件；不运行产品全量套件（本次用户限定隔离原型，不改产品）。
- [x] 保存合成快照/进程/混读负例JSON及数据库私有路径；更新覆盖和任务，冻结candidate-01，发送摘要/命令交独立审查；不自行签署accepted。

## Execution ledger

Task 1: 版本RED 0/4→GREEN 4/4；缓存RED 4/12→GREEN 12/12；进程/屏障RED 0/4→GREEN 4/4。独立设计意见补强同连接changeDelta：RED 3/4（undefined不是0）→GREEN整套16/16。原始失败和成功文本均保留。

Task 1: 最终原始验证见results/candidate-01：16/16、exit0，10份合成JSON、17个唯一私有库路径。实现者验证PASS，独立接受待协调者。

Ruling: 不新增持久run.mjs/新门禁工具；直接调用固定原生Node测试入口，用只读SHA256SUMS清单供审查先验身份，再测试。原计划的初始化改由现有fixture承担。这样避免无需求扩展runner；代价是冻结校验由审查命令明确执行，不声称测试入口自动强制防篡改。

Ruling: 用户限定所有新报告写本scratch目录，故issue.md为本任务唯一可续写任务账本，不另建.superpowers目录，不删除失败或验收证据；不提交或合并分支。
