# 本地原生发布工具最终验收

State: closed
Status: accepted
Coordinator: /root
Accepted: 2026-10-06 10:08 +08:00
Baseline: 63690a494b8ad403081c7720985be54a95db60c7
Code state: codex/local-native-deploy，工作区修改尚未提交；真实应用验收发布显式指定的已提交基线快照，发布控制工具来自当前工作区。

## 范围与结论

用户在当前聊天确认当前已提交 HEAD、最新远端 master 或指定 ref 的本地 make deploy 方案。D01–D09 范围内发布行为均由协调者独立接受。没有执行正式部署、提交、推送或合并。实施者 `/root/deploy_source`、`/root/native_runtime`、`/root/deployment_flow_audit` 均为 gpt-5.6-luna / medium；根 Makefile、文档和集成验收由 `/root` 负责。

规格映射见 [DESIGN-COVERAGE.md](DESIGN-COVERAGE.md)，适用流程见 [development-workflow.md](../../docs/agents/development-workflow.md)。独立审查已解决工具来源、锁内控制面恢复、物理路径别名、wrapper/实际 listener 身份和候选句柄归属问题，见 [independent-review.md](reports/independent-review.md)。

## 需求覆盖

| ID | 结论 | 验收行为与证据 |
| --- | --- | --- |
| D01 | PASS | current/detached/dirty 源码拒绝/精确提交；[source.md](reports/source.md)、[45 项测试](reports/deploy-test-final.log)、[Make 旅程](reports/make-acceptance.json) |
| D02 | PASS | master 强制获取、远端推进、失败无缓存回退、显式 ref；[source.md](reports/source.md)、[实际获取失败](reports/master-dry-run-final.log) |
| D03 | PASS | 完整 SHA/ref/时间/version/前一成功版本，实际 PID/cwd/HTTP 对照；[生产 status](reports/production-status-final.log)、[旧版本 UNKNOWN](reports/formal-status-final.log) |
| D04 | PASS | 独立安装构建后停旧服务；构建失败不启停；[runtime.md](reports/runtime.md)、[构建期间旧 PID/HTTP 200](reports/old-service-during-build.json)、[CLI](reports/cli-final.log) |
| D05 | PASS | 固定端口、外来 listener/PID 重用/子监听/Unicode/物理路径；[45 项测试](reports/deploy-test-final.log)、[安全反例](reports/safety-tests-final.log) |
| D06 | PASS | 不健康候选与发布后失败恢复，A/B/rollback A，候选句柄停止不误停外来进程；[Make 旅程](reports/make-acceptance.json)、[CLI 最终复验](reports/cli-final.log)、[真实回滚](reports/production-rollback-final.log) |
| D07 | PASS | 保留数据/配置/备份/日志，锁内恢复，危险路径与日志符号链接拒绝；[安全测试](reports/safety-tests-final.log)、[toolkit.md](reports/toolkit.md)、[Make 旅程](reports/make-acceptance.json) |
| D08 | PASS | 根/安装后目标 Make，空格路径，dry-run 无目标写入/启停，控制面与文档；[Make 旅程](reports/make-acceptance.json)、[formal dry-run](reports/formal-dry-run-final.log)、[发布指南](../../deploy/DEPLOYMENT.md) |
| D09 | PASS（发布工具范围） | 独立审查、相关回归、真实生产构建/部署/回滚/浏览器加载；[生产部署](reports/production-deploy-accepted-final.log)、[浏览器](reports/browser-smoke.md)、[审查](reports/independent-review.md)；全量失败按下表保留 |

## 验证与限制

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| make deploy-test | PASS，45/45：source 13、runtime 11、toolkit 4、CLI 11、safety 6 | [deploy-test-final.log](reports/deploy-test-final.log) |
| 最后 rollback 停止边界调整后 CLI | PASS，11/11；随后真实部署/目标回滚通过 | [cli-final.log](reports/cli-final.log) |
| Docker deploy Vitest | PASS，58/58 | [docker-regression-final.log](reports/docker-regression-final.log) |
| npm test | PASS，构建及 5/5 Node 应用测试；过时 schema 断言 13 修正为已实现的 14 | [npm-test-final.log](reports/npm-test-final.log) |
| npm run typecheck | PASS | [typecheck-final.log](reports/typecheck-final.log) |
| 发布代码/测试 scoped ESLint | PASS，0 错误/0 警告 | [scoped-lint-final.log](reports/scoped-lint-final.log) |
| Node/zsh 语法、git diff --check | PASS | [final-static-checks.log](reports/final-static-checks.log) |
| 全量 Vitest | FAIL，39 失败 / 3025 通过 / 6 跳过，workspace、workspace.refresh、holdings 三个未修改业务文件 | [unit-final.log](reports/unit-final.log) |
| 全量 ESLint | FAIL，13 错误 / 40 警告；原始输出保留，本次新增未用变量警告已修复 | [lint.log](reports/lint.log) |
| 业务失败基线复核 | 部分验证，其余 NOT VERIFIED；干净基线 refresh/holdings 有 5 项失败；workspace 组合运行未完成并终止，不能声称全部 39 项已证明为基线失败 | [baseline-unit.log](reports/baseline-unit.log)、[不完整运行](reports/baseline-three-files.log) |
| 产品 UI 视觉/图表/核心写入持久化/触屏 | NOT APPLICABLE：运维工具任务，无 UI/交易写入实现变更；浏览器仅验生产启动与读取加载 | [browser-smoke.md](reports/browser-smoke.md) |

早期 RED、集成失败与不完整运行均保留。范围外业务问题没有由本任务修复；本验收不能作为后续远端合并的全项目绿色证据。

## 数据与运行实例

正式服务仍为 release `20260923-master-ee76e83` / PID 42336 / 3022。只读检查没有改变其部署目录、配置、桌面副本或业务数据库。[版本核对](reports/VERSION-AUDIT.md)列出全部 12 条 worktree 记录（含两条目录已不存在的残留）。09:39 最近成功核实远端 master 为 63690a49，正式服务落后 29 个提交；随后获取失败，不能声称已核实之后的远端状态。各应用 package version 都是 0.1.0。

模拟 Make 旅程使用唯一临时 Git/目标/独立 SQLite/63684，逐阶段核对配置与数据库文件字节，结束后清理自身服务。真实生产验收使用独立空库/61739，没有复制或使用正式交易库，没有向正式库写入测试数据。

保留入口：[http://127.0.0.1:61739/](http://127.0.0.1:61739/)。当前 release `20261006T020332Z-05fdf32bd1`、应用完整 SHA 63690a494b8ad403081c7720985be54a95db60c7、监听 PID 95630，healthy=true / consistent=true。目标/数据库见 [production-smoke-environment.json](reports/production-smoke-environment.json)；10:08 浏览器为“我的交易室”空库状态，error 日志 `[]`。这是隔离验收实例，不是正式入口。

旧 release 缺少 release.json 时为 UNKNOWN；不能自动回滚到缺少完整元数据的旧版本。代码回滚不恢复数据库，版本之间必须保持迁移兼容，见发布指南。

## 使用与签署

`make deploy REF=master DRY_RUN=1` 预览，网络获取失败明确报错；`make deploy` 发布当前干净、已提交的 HEAD。本次代码尚未提交，因此当前默认发布会拒绝。启动、停止、参数见 [发布指南](../../deploy/DEPLOYMENT.md)与 [隔离实例说明](reports/browser-smoke.md)。

协调者签署：/root，2026-10-06 10:08 +08:00。最终聊天交付提供版本表、命令、验收限制与隔离预览链接。发现范围内回归时保留本记录，并同步重开 README、覆盖表与相关 issue。

## 后续运行状态观察

2026-10-06 10:16–10:20 +08:00 用户要求只读检查 Docker 与数据库。正式端口 3022 已无监听，HTTP connection refused；本文 10:08 的运行状态属于当时的验收证据。此次未启动或停止任何服务、未修改数据库，停机原因未诊断。Docker 引擎也未运行，实际镜像/容器版本未验证。具体数据库版本和源码迁移差异见 [DOCKER-DATABASE-AUDIT.md](reports/DOCKER-DATABASE-AUDIT.md)。本观察不更改已接受的发布工具范围，也不证明正式停机由发布工具引起。

2026-10-06 10:23–10:28 +08:00 用户进一步授权正式运行后核对：既有正式原生入口已恢复（PID 98660，HTTP 200），Docker 引擎已启动；原 release 指针与代码没有切换。正式源码 schema 7 / 数据库 schema 14、旧 Docker 镜像源码 schema 3 / 实际旧挂载库 schema 6 的差异已核实；现存容器实际挂载和端口不符合当前 .env。原始成交保持一致，启动/浏览首页后证券元数据和一条复盘时间戳发生变化，启动前一致性备份保留。详见 [FORMAL-RUNTIME-VERSION-AUDIT.md](reports/FORMAL-RUNTIME-VERSION-AUDIT.md)。本后续检查不是新版本发布或产品全流程兼容性验收。
