# 非财务事实更新与原子发布实验

State: open
Status: review（candidate-01 已冻结，等待独立预审）
Assignee: update_experiment（实际继承协调者模型，未切换）
集成负责人: 主协调者；独立接受: 协调者安排的独立审查者

本目录是用户已批准的隔离 CLI 实验。2026-10-29 协调者接受 DESIGN.md 所述边界，授权 TDD 与轻量验证；耗时基准须等候选冻结、独立预审及协调者另行放行。所有代码与脱敏报告只写本目录，数据库只写本 worker 自建的 `.data/update-publication-worker/`。不写产品、正式库、既有冻结 run-01/02 或 wayfinder 状态。

基数沿用冻结 seed 的 run-02 非财务投影，1866 笔十字段成交事实。`source_facts` 是在独立实验库中建立的**合成源模型**。历史新增、修订、withdrawn 都是 synthetic delta，绝不是实际导入、产品修订或撤销流程验收。其源+投影在同一实验 SQLite 事务提交；不能据此证明真实 executions 与产品投影有同样的事务边界。

财务 P1/F07、Bars、重复导入、真实导入/修订、金额/费用/盈亏、行情/FX、产品版本通知、HTTP/浏览器完整首页一秒、真实崩溃/断电均不在实验范围。无前端控件、布局或数据接线改动，UI 控件与视觉检查 NOT APPLICABLE；CLI 读取性能不能作为完整页面性能。

设计与覆盖：[DESIGN.md](DESIGN.md)、[DESIGN-COVERAGE.md](DESIGN-COVERAGE.md)；执行计划：[PLAN.md](PLAN.md)；任务：[01-update-publication.md](issues/01-update-publication.md)。未获独立接受前维持 open。

候选 01 自测：14/14 TDD 与一次轻量验证 PASS；5,478 个检查记录、147 个范围阶段结果。见 [RESULTS.md](RESULTS.md)、[RUN-HISTORY.md](RUN-HISTORY.md)、[原始结果](results/candidate-01.json)。这些是实现者自验，独立预审与最终接受仍 NOT VERIFIED。未运行重复/耗时基准。

冻结代码摘要 `28b1b5bda18251af10638d0fc24b484671667b9edd2b3a92aac4216e200c237e`，详见 [SNAPSHOT.json](SNAPSHOT.json)。候选副本位于 archive/candidate-01；顶层仍保留可运行版本。独立审查可用下列轻量命令（工作目录为当前 worktree）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/update-publication-experiment/core.test.mjs .scratch/update-publication-experiment/concurrency.test.mjs .scratch/update-publication-experiment/runtime.test.mjs .scratch/update-publication-experiment/oracle.test.mjs
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/update-publication-experiment/run.mjs --check
```

`--check` 不打开数据库；测试只在内存或自己 mkdtemp 的私有 .data 子目录运行。`--light` 会新建下一候选目录并占用最多三轮之一；本次已执行一轮，重复运行等待协调者决定。没有启动服务，无浏览器预览。
