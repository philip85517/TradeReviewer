# 实验设计覆盖

Owner: update_experiment；集成与独立接受: 协调者。所有元素/画板/浏览器操作均 NOT APPLICABLE：纯隔离 CLI，不修改产品前端或接线。

|需求 ID / 来源|元素/参考|状态与旅程|owner|可观察结果及反例|证据|状态|
|---|---|---|---|---|---|---|
|UP-01 / DESIGN §来源|CLI，无画板|冻结输入→私有复制→源摘要|update_experiment|seed/原预备前后hash不变；私有路径/no-symlink；无真实行输出|runtime.test.mjs；candidate-01.json input/checks|PASS 自验；独立待验|
|UP-02 / 05-update历史补录|CLI|synthetic 历史新增→翻页|update_experiment|full/incremental/oracle全页及统计相等；独立旧全量prepare逐页相等|core.test.mjs；candidate-01 scopeChecks|PASS 自验；独立待验|
|UP-03 / 修订与版本|CLI|账户/市场/时间/null/withdrawn/复活|update_experiment|新旧分组、空组、检索、日期、精确时间平手与分页无重漏；迟到v1 CAS拒绝；非ASCII排序键拒绝|core.test.mjs；candidate-01 checks|PASS 自验；独立待验|
|UP-04 / 跨页更新|CLI|成功、失败与旧游标|update_experiment|成功拒绝，失败仍可读；identity四维变更、页大小不一致拒绝|core.test.mjs；candidate-01 checks|PASS 自验；独立待验|
|UP-05 / 原子失败|CLI|source/projection/binding后注入失败|update_experiment|实验源、投影、版本、摘要全回滚；关闭后新连接等价|core.test.mjs；candidate-01 checks|PASS 自验；真实产品原子性/进程崩溃 NOT VERIFIED|
|UP-06 / 并发读取|CLI|双连接WAL读快照重叠写事务|update_experiment|四屏障旧/旧→新事务新/新；metadata/rows屏障保持旧payload；无快照mixed反例|concurrency.test.mjs；candidate-01 concurrency|PASS 自验；独立待验；写锁等待 NOT VERIFIED|
|UP-07 / 更新后读取成本|CLI|full与incremental→首次读|update_experiment|12个单次原始wall/CPU/space/read；147范围阶段相等；非独占限制|RESULTS；candidate-01 updates/environment|单次已记录；稳定性能/完整首页 NOT VERIFIED|
|UP-08 / 实验限制|无产品UI|财务、Bars、真实导入、完整首页、崩溃|update_experiment|保留 NOT VERIFIED，不恢复暂停工作|README；RESULTS|NOT VERIFIED，范围外|
