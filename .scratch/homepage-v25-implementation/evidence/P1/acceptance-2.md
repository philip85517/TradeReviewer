# P1 独立验收第2轮 — FAIL / 2 of 3

root，2026-10-23 02:40 CST。本轮绑定 freeze-2 的30个owner文件，aggregate `b5611a7a229ca1d661fe3a0533ac8729ec0761f265d673aa9a5830edc204a2d1`；开始验收时44个owner/consumer指纹全部匹配，见 `acceptance-2/verification/initial-hashes.json`。显式隔离库 `.data/tradereview-test.sqlite`，root持有服务127.0.0.1:3333 / PID85569 / session85604。

## 已直接接受的局部结果

root独立12文件194测试PASS。真实9行持仓的查询P1、名称降序、第2页600100，经准确Eye详情进入普通交易库，再返回重读，URL/查询/排序/页/来源焦点保持。Esc与关闭均回来源Eye，四核心卡层级已修复；两桌面首张布局已直接看图比较，详见本轮 `DEPENDENCY-GATE.md`。该有限门仅允许P2-A与S纯合同推进，不等于P1接受。

root实际从普通库打开该未平仓回合，在真实Recall填写计划100/90/120并返回首页。隔离库只读核对存在该episode的revision1、status=in-progress及三个真实字段，见 `acceptance-2/functional/recall-draft-readonly.json`。未平仓完成动作被拒绝符合原规则。保存后再次打开/reload、失败与冲突恢复完整链仍未验证，不能据此签署持久化门。

## 失败与未验证

|项|证据与判断|结果|
|---|---|---|
|全量Workspace回归|root独立95项：50 PASS / 45 FAIL，exit1；`acceptance-2/verification/workspace-all.log`。完整逐项根因见 `ROOT-FULL-REGRESSION-DIAGNOSIS.md`，37项先被旧入口/结构断言阻断，其后业务断言仍NV；其余含读取周期变化、错误端点fixture、strict-live入口上下文与ordinary scope目录错配|FAIL|
|ordinary切交易性质|源码可证可点击nature改变仅改本地scope，而account options固定首页live、run options仍读另一全局scope，URL和摘要仍原live。需独立动态RED后修复，不能仅迁移旧测试隐藏该缺口|FAIL（静态数据链）|
|首页全局修复|唯一新repair未显式daily-only，落入默认intraday读取；先迁移真实live缺行情用例，记录RED后限制首页adapter|FAIL（静态消费合同）；动态NV|
|真实状态与持久化|普通往返及真实草稿入库局部PASS；受控源变更、来源删除、reload、未保存失败/取消、双窗口冲突及恢复字段未完整验|NOT VERIFIED|
|控件与边界|保留55需求和96公共状态分母；本轮仅执行登记的最小旅程。0/1/5/8/50、CSV、完整账户/市场/URL/back-forward、390及其余动态状态未完整验|NOT VERIFIED|
|完整视觉|四卡及两宽首张持仓骨架局部PASS；全状态、极值、空异常、窄屏未独立比较。P2/P4占位不能视为视觉通过|NOT VERIFIED|
|lint|已有cash state effect error仍FAIL，基线也存在不代表本次通过。已保存owner检查，不豁免required检查|FAIL|

全量日志运行结束在F/S后续授权编辑之前，属于freeze-2有效证据。02:31后F、02:32后S的开发会使HMR页面和消费接口漂移；之后画面不得倒填本轮证据。S新v3和日期/读取意图接线另有明确开发授权，必须在后续候选重新冻结后一起验证。

## 原owner第3候选准备边界

先完成systematic-debugging根因→最小RED→修复，不扩大修改文件集合。迁移旧helper到裸全局普通库/真实新首页ready门，保留原保存、行情、游标、缓存、隔离断言；未知nature不填live。aliases/FX等非目标故障端点保持合法。首屏legacy+owned固定2次bootstrap预算允许，保留不读legacy和归属安全；daily调用轨迹先观察，不随意加次数。

首页repair显式daily-only；ordinary主动改nature以显式全局普通集合承接，统一scope/account/run/摘要，保留返回首页UI，不能禁用可用选项或改变首页实盘合同。F动态RED与原子接线建议经root审查后再授权这一产品修复。S消费更新由同一integration owner接入已接受接口，不另建period/附件权威。

#41 ETF和#45旧period/calendar行为保留目的映射至P3/P2必要接线，后续集成前不得声称已通过。第3次正式候选须待适用业务断言真正运行、必要真实UI门具备证据后再提交；本票第三轮仍FAIL或required NOT VERIFIED即暂停，禁止拆票/改名重置轮数。

|门槛|结论|
|---|---|
|功能|FAIL|
|端到端/持久化|NOT VERIFIED（局部正证据保留）|
|视觉|NOT VERIFIED（已修详情与首张两宽局部PASS保留）|

P1保持open / acceptance-failed，已用2/3轮。没有产品交付声明。
