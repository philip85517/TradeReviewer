# 连接与初始化副作用诊断

按 systematic-debugging 先收集运行进程、配置、SQLite 摘要、API、浏览器和源码证据；本任务未提交产品修复。

## 数据源与空列表

原 PID 23059 连接 `.data/tradereview-test.sqlite`；标准 debug 入口本来就生成隔离快照。改用 [STARTUP.md](STARTUP.md) 的底层入口后，PID 29149 打开项目配置的真实业务库及 WAL/SHM，[lsof](SERVICE-OPEN-FILES.txt) 与 [API 集合对照](API-FINAL.json)共同证明连接已切换。API 中 `databasePath` 为脱敏固定标签，不能单独证明路径。

原 `/trades?scope=live&market=a&accounts=*&rangeMode=all` 使用首页来源/显式实盘资格：`holdings-model.ts:50–54` 的 explicitLiveEntries 要求逐笔 tradeNatureOf 为 live；`attachment-groups.ts:50–51,174–181` 同样严格。普通库 `library.ts:253–259`、`trading-nature.ts:5–11`、`app/lib/reviews/shared-scope.ts:26–29` 允许旧券商来源回退实盘。故 SQL trade_nature=NULL 的 1,784 条不能等同于普通 UI 的“来源未知”。前面“0 实盘”的推断已撤回。

真实 UI 操作从来源未知切回普通库实盘，显示 232 标的 / 732 回合；选择 A 股后 52 / 85。最终 URL 是 `/trades`，不宣称保留原首页 query 合同。没有通过改数据库性质字段掩盖差异。

## 自动写入

服务日志中实际出现一次 `PUT /api/storage/reviews 200` 和多次 `PUT /api/storage/instruments/metadata 200`。没有执行用户保存、编辑或导入。

- `trade-review-workspace.tsx:3006–3036` 初始化选中 episode，恢复 timeframe/cursor/panel/drawings 后 hydrated=true、restoring=false。
- `:3550–3579` 保存 effect 没有 activeView=review 或用户 dirty/content diff 条件，交易库浏览也可触发；`:3485–3500` 排队，经 `sqlite-http-client.ts:173` 发出 PUT。
- `sqlite-store.ts:1917–1934` 无条件 UPSERT cursor、drawings 和 updated_at。重新启动 bootstrap 时也未统一重置 hydrated/restoring；队列缺少数据库身份/代际绑定，是进一步排查项。
- `workspace:3069–3087,4108` 的标的名称 hydration / persistInstrumentName 经 metadata route:79 写入；A 股筛选不能阻止全库 US/HK 名称初始化。

[切换前](BUSINESS-BEFORE.json)与[最终](BUSINESS-FINAL.json)对照：executions 1,866、import_batches 213、trade_revisions 11 的计数和完整行摘要一致；迁移 1–14 未变。reviews 数量仍为 138，但摘要改变（391b…→c99f…）。旧隔离快照对照定位一条 updated_at 差异，[诊断输出](REVIEW-DIFF-DIAGNOSIS.json)的 matchesBefore=false，不能证明真实库实际变化仅为时间戳。没有把隔离数据覆盖回业务库。metadata/app_settings 等未保存完整前摘要，不声明这些表未变。

## 自动审批与后续边界

主动 `reload()` 被自动审批拒绝，理由是刷新会触发初始化和自动迁移/元数据写入，违反本轮只读浏览限制。没有换 URL 导航或其他方式绕过拒绝；当前可见数据来自既有会话接收新服务并进行本地范围切换。刷新复验保持 NOT VERIFIED。

统一修复方案已记录在[问题票](issues/02-automatic-writes.md)：先在隔离库固定启动/切换数据源反例，定义用户编辑与系统 hydration 的保存边界；统一收敛 dirty、ready、active view、DB generation、取消旧队列及幂等持久化，再验证正常写流程。不能在业务库上边改边试，也不据本次接线任务恢复 P1/F07 的已耗尽轮次。

## 独立审计记录

2026-10-24，`/root/astra_database_connection_audit`（GPT-6 Astra Ultra，未实施本次运行切换）只读检查配置、源码及已保存证据。结论：连接/API/普通交易库真实数据显示 PASS；首页显式 live 与普通库性质合同存在差异；reviews 和 metadata 自动写入使完整只读验收 FAIL；刷新 NOT VERIFIED。该审计未修改文件、数据库或进程，未执行浏览器动作、HTTP 或测试，不能替代主代理实际浏览器验收，也没有独立视觉 PASS。P1/F07 与 Bars 的 3 / 3 暂停继续有效。
