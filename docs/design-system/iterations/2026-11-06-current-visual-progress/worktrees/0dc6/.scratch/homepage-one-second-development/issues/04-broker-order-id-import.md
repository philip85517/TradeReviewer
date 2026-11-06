# 04 券商订单号不应触发模拟成交校验

State: closed
Status: accepted
Assignee: /root/astra_lazy_startup_impl
集成负责人: root
Blocked by: None
验收轮次: 2/3（candidate 1 独立验收 FAIL；candidate 2 经独立代码审查与root桌面真实持久化验收 PASS，原证据保留）

## Scope / 根因与方案

Task02 浏览器确认导入时发现既有阻断，保存后仍1866行。工作区全量重送旧成交，6条富途IPO记录带通用 sourceTradeId；validateSimulationEvidence 将该字段单独视为 TradingView 模拟证据，要求 platform=tradingview，确定抛 Invalid simulation evidence。冻结baseline也有此行为。本票是新发现的导入校验缺陷，不恢复暂停的 P1/F07 或 Bars，不重置 Task02 轮次。

最小方案：通用券商订单号单独存在不代表模拟；TradingView 的订单号及所有显式模拟字段继续严格校验。保留来源字段、金额/费用、nature、账户、原数据，不清洗旧成交或跳过校验。仅修正模拟证据识别条件；不改合并算法、数据库结构、UI或全量发送方式。

## Refs / 设计合同

- app/lib/trades/types.ts:137 通用 sourceTradeId；app/lib/import/statement-evidence.ts:820 券商IPO订单证据；statement-evidence.test.ts 相关回归。
- sqlite-store.ts validateSimulationEvidence / validateExecution / mergeTradeData；sqlite-store.test.ts 模拟严格性、原子性、重开用例。
- ../DESIGN-COVERAGE.md HP11导入持久化链；首页视觉基线不变，无新控件、无新布局。
- ../evidence/candidate-02/IMPORT-SOURCE-VALIDATION.json；原失败截图和AX、PRE-IMPORT-EXECUTIONS.json。

## 验收

- 先RED：真实SqliteStore接收带普通订单号的券商成交，且和TradingView两笔一起重送能成功；重开保留所有来源字段。
- 反例：非TradingView携显式模拟字段仍拒绝；TradingView只有订单号缺必需模拟证据仍拒绝；现有模拟金额/来源冲突/原子回滚不放宽。
- 新隔离副本完整store复现：旧1866行重送在修复前失败；修复后再加2笔，原1866行逐列内容不变。不得写原库，不将推断HTTP状态当原请求实测。
- root生产浏览器确认、SQLite新增、返回和reload。仅服务器校验变更，视觉新增项N/A；受影响导入控件按Task02局部审计验收。

## 派发

允许修改 app/lib/storage/sqlite-store.ts、sqlite-store.test.ts；可新增focused测试。唯一owner，无其他产品文件。先读当前workflow、systematic-debugging及TDD；只跑定向测试，保存RED/GREEN和冻结增量。可对新临时isolated副本做完整store验证，不写candidate02或业务库。不构建、启动服务、浏览器、提交或改暂停任务。root独立审查，最多3次候选。

## Candidate 1 实施与证据

- 产品仅收窄 `sourceTradeId` 触发条件；原显式模拟校验不变。新增 `sqlite-store.broker-order-id.test.ts`，旧 store 测试和 Task01 增量保留；Task02 冻结源码和测试未改。
- [完整报告](../../../.superpowers/sdd/PLAN/task-04-report.md)；[冻结证据](../evidence/task-04/round-01/)；[原保存链诊断](../evidence/candidate-02/IMPORT-SAVE-DIAGNOSIS.md)。Task04 1/3 与 Task02 2/3 独立，暂停任务轮次未重置。
- [x] 真实 store RED、永久 focused RED 已保留；修复后 [10 项专用测试](../evidence/task-04/round-01/green-broker-order-id.log) 与 [12 项既有回归](../evidence/task-04/round-01/green-existing-regressions.log) PASS。
- [x] [完整副本与合成对照 3/3 PASS](../evidence/task-04/round-01/green-final-isolated-store.log)：1866→1868，原行所有 SQL 列未变，重开来源和历史一致。见 [匿名结果](../evidence/task-04/round-01/green-final-isolated-store.json)。
- [ ] root 生产浏览器确认、SQLite、返回和 reload；独立审查/构建/类型检查仍待验收。State 保持 open。

诊断历史保留：文件名 `green-isolated-store.*` 是失败尝试，raw parser 名称载荷省略真实 enrichment/summaries 导致同证券 34 行旧记录重写；baseline 受控内存对照同样复现，仅 evidence_json/创建更新时间变化，金额/fee/账户/SQL nature 未变。准确 workspace 载荷后全部原行逐列保持；没有扩大修复或清洗数据。不能将此 harness 反例当成已确认生产第二缺陷。

## 独立验收记录

- 候选1/3 FAIL：真实store对非TV sourceTradeId number/null/array/object接受并持久化；number/array在IPO账单证据消费value.replace抛TypeError。保留round-01，评审探针在 /private/tmp/task04-review-0j5glkif。C3 build PASS但不放行，未浏览器写入。
- 候选2：仅增加通用sourceTradeId字符串类型验证，所有合法字符串原样，不新增空值清洗；批原子性反例及原严格模拟回归一起验收。原轮次不重置。

## Candidate 2 冻结交接

- 相对候选1仅在通用 `validateExecution` 添加 `sourceTradeId` 非undefined必须string的守卫；所有合法字符串原样保留，模拟校验继续严格。相对Task04基线共两行产品修改，无UI/Task01/Task02改动。
- [新证据](../evidence/task-04/round-02/)：RED 4 FAIL/15 PASS；GREEN专用19/19、既有定向严格性15/15、准确隔离副本及合成对照3/3。
- 四非法类型整批拒绝且既有SQL列/证券/历史不变；数字文本、普通文本、空串、空白、缺失ID均关闭重开保留。原1866行逐列不变，真实CSV新增2行，重开1868。
- 候选1独立FAIL和C3 build-only记录保留，不重置轮次；root生产浏览器写链与独立审查待完成，State保持open。

## Root 最终验收（以上待验收文字为冻结交接历史）

- **候选2/3接受**。[独立审查](../evidence/task-04/round-02/INDEPENDENT-REVIEW.md) Approved；19专用、15既有严格性、3隔离全量/合成验证通过，独立8项反例探针通过。C4生产build PASS；root6文件128项回归PASS；全局tsc仍为基线8错误FAIL，不宣称全绿。
- root于真实1440×1000桌面依次完成CSV预览→Space取消、重新预览→鼠标右上关闭、再预览→确认保存→返回交易库→reload。SQLite原1866行所有SQL列均未变，新增2行；重载后1868行hash与保存后完全相同。1280×800只作预览和取消，没有额外写入。
- [C4证据](../evidence/candidate-04/)：PRE-IMPORT / AFTER-CANCEL / AFTER-IMPORT / AFTER-RELOAD / FINAL-EXECUTIONS.json；最终digest `9a8dbe7edd9597bf445f726b95f73a5442285fe5c8b25fa3dc3faf5c2493a255`。原行missing0/changed0/added2。导入历史213→214，600330显示36成交/12回合；新增成交与既有日期重叠，不宣称新增回合或据此接受金额算法。
- 同态导入预览在1440/1280桌面由root直接看图比较，控件层次与720px弹窗一致；独立审查者亦查看1440图与持久化证据。旧C2保存失败、C1非法类型失败及错误harness的34行改写历史均保留。
- 本票仅接受通用订单号校验及受影响导入链，不接受整页首页、财务结果或所有数据库表不变；P1/F07和Bars仍暂停3/3。
