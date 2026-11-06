# 当前网页连接真实业务数据库

ID: real-db-20261024-01
State: open
Status: acceptance-failed
Assignee: /root
集成负责人: /root
独立只读启动审计: /root/astra_database_connection_audit（GPT-6 Astra Ultra）
验收轮次: 1 / 3
Blocked by: 刷新动作被自动审批拒绝；真实库浏览触发既有自动写入，完整只读验收未通过

## Scope / What to build

用户原话：“将当前的网页接入真实数据库”。将当前 3333 服务从隔离验收快照切换到项目配置的真实业务库。原计划保留当前交易库 URL；实际原 URL 的首页来源资格过滤显示 0，已通过既有控件切换普通交易库，恢复实盘、全部账户和 A 股可见范围。当前 URL 为 /trades，原查询参数未保留，不能算该项通过。没有修改产品代码或项目默认配置。未执行用户编辑、保存或导入；服务自身自动复盘保存及元数据写入已发生并记录。P1/F07 和 Bars 的 3 / 3 暂停状态保持。

## Refs

- [项目默认配置](../../../conf/runtime.json)
- [底层启动入口](../../../scripts/start-local.mjs)
- [标准调试备份入口](../../../scripts/debug-local.mjs)
- [SQLite 初始化](../../../db/sqlite.ts)
- [前端验收规则](../../../docs/agents/frontend-control-audit.md)

## Diagnosis / Design

当前 3333 PID 23059 的 cwd 为本工作树；lsof 显示其打开 .data/tradereview-test.sqlite。标准 make dev / npm run dev 设计上生成并连接隔离快照。改用 start-local.mjs --dev --hostname 127.0.0.1 --port 3333，沿 conf/runtime.json 解析真实库；固定 Node 26.0.0 / SQLite 3.53.0。先只读确认真实库 quick_check=ok、迁移 1–14、data_migrations complete，并保存四张核心表逐行规范化摘要。

## Acceptance

- [x] 实际 3333 服务 cwd 和 lsof 打开文件指向项目配置的真实库。[证据](../SERVICE-OPEN-FILES.txt)
- [x] API 成交、导入、标的 ID 集合与真实库只读查询一致。[最终核对](../API-FINAL.json)
- [ ] 当前真实浏览器页面刷新后读取真实数据，保留范围条件，测试 fixture 不再显示；保存截图。
- [ ] executions / import_batches / trade_revisions / reviews 四表前后计数、内容摘要一致，迁移未改变。
- [x] 可复现启动说明及独立主代理验收记录已保存，服务保持运行。[启动](../STARTUP.md)、[验收](../FINAL-ACCEPTANCE.md)

## UI coverage contract

触发：数据源接线变化后的真实页面验收。范围：当前 /trades?scope=live&market=a&accounts=*&rangeMode=all 的加载、范围保持、数据展示；这是启动配置操作，不改布局、控件或业务行为。排除：全控件审计、写入/导入/复盘保存、首页财务和性能缺陷修复；没有对这些项目宣称通过。不在业务库运行写验收。

## Evidence / Counterexamples

[BUSINESS-BEFORE.json](../BUSINESS-BEFORE.json) 保存切换前只读摘要。status API 的 databasePath 是固定脱敏标签，不能单独证明连接路径；以 lsof 和 API ID 摘要共同证明。

第 1 / 3 轮：连接和真实数据显示 PASS；普通库全市场实盘 232 标的 / 732 回合，A 股 52 / 85，[页面证据](../FINAL-UI-FULL.txt)。主动 reload 被自动审批拒绝，没有改用另一入口绕过刷新。已存在浏览器会话读取了重启后的真实服务，后续只通过本地范围控件切换。

四表完整只读 FAIL：[最终摘要](../BUSINESS-FINAL.json) 显示 executions / import_batches / trade_revisions 内容未变，reviews 数量仍为 138 但摘要改变。旧隔离快照对照发现一条 updated_at 差异，但重建摘要与切换前不符，不能断言真实库仅时间戳改变，也未进行推测性回滚。见[诊断](../DIAGNOSIS.md)和[自动写入问题票](02-automatic-writes.md)。

未启动第 2 轮，未重置已暂停的财务任务轮次。主票保持 open；本次仅可声明运行时接线生效。
