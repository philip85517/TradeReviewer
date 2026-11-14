# 性能诊断：工作量、测量和归因边界

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](SOURCES.md) 定位。

2026-11-14。只读评审，没有优化产品实现；下述失败仍然存在。当前前端需要的是小选项、6行列表与全范围汇总、单练习详情、单练习6条配对页。旧链的主要问题是请求粒度与实际执行工作量不相称。证据标识和原始结果见 [evidence](evidence/README.md)。

## 判断与证据强度

|优先级|原因|本轮证据|能够得出的结论|
|---|---|---|---|
|1|全量事实处理发生在筛选/分页之前；详情财务借用全库统计|25db 实际服务的 SQL/返回列字节随练习数增长；源码确认浏览器最后才 slice，详情最后才按ID取财务|**已确认的结构问题。**页面行少不能限制后端工作；应重新划分读服务，不能只包装旧响应|
|2|同一原件/记录反复认证、组装CSV、解析和投影|50×50样本中实际调用2,500次分组CSV parser；分段计时约占56–57%|**该合成样本中的主要成本已定位。**需要保留认证规则、改变重复工作的时机/表示；未证明真实业务库也占相同比例|
|3|预计算后公共读取仍加载并重验整个发布|38a0真实路由重放；readiness与分页各读取226详情、726证据目标，单次约25.4MB payload JSON|**优化链本身仍有大工作量。**预计算存在不等于普通分页廉价；重构须维持完整性与freshness保证|
|4|重复大JSON、base64往返、序列化和兼容验证|源码及返回字节确认；未逐项CPU剖析|**确定的额外工作，贡献未全部量化。**不能给出“hash占比”或把全部延迟归于序列化|
|5|索引、长事务、同步执行和后台调度耦合|EXPLAIN/一次索引对照确认排序可改善；其余源码确认，缺并发测量|**次级改进或风险。**补索引不会移除全库解析；尚不能把锁等待、磁盘或worker竞争判为实测主因|

这组证据支持“读链组织需要重做”，不支持“SQLite不适用”“所有领域模型应丢弃”或“所有页面卡顿都来自后端”的泛化判断。

## A. 25db：直接运行实际存储/指标服务

探针：[practice-read.probe.test.ts](evidence/backend/practice-read.probe.test.ts.txt)，结果：[practice-read-results-v2.json](evidence/backend/practice-read-results-v2.json)，日志：[practice-read-probe-v2.log](evidence/backend/practice-read-probe-v2.log.gz)。导入的是候选工作区真实函数，不是另写一个模拟算法。

方法：Node26.0.0 / SQLite3.53.0；每组新建内存库，使用真实 preview/commit 创建合成来源，分别改变练习数N=1/10/50、每份完整配对数G=1/50。每操作顺序运行3次，独立记录函数与JSON序列化时间。没有HTTP/socket/浏览器、磁盘、并发、真实业务数据；导入成本不计入下表。SQL代理统计 **get/all调用、返回行和返回列字节**，不是SQLite扫描页数、实际磁盘I/O或解码后内存占用。此表使用G=50，每份原件9,929字节。

|实际操作|N|3次函数耗时 ms|SQL get/all|读取原件BLOB字节|返回文本列字节|序列化对象字节|
|---|---:|---|---:|---:|---:|---:|
|列表指标 `readPracticeListWithMetrics`|1|30.60 / 30.35 / 32.68|7|9,929|418,653|543|
|同上|10|315.36 / 301.82 / 294.68|61|99,290|4,186,530|4,944|
|同上|50|1,485.02 / 1,422.40 / 1,422.87|301|496,450|20,932,650|24,504|
|普通 `PracticeStore.list`|50|82.37 / 86.38 / 80.22|101|0|10,461,500|21,154|
|单对象 `readWithLegacy`（source-only）|50|2.09 / 1.83 / 1.84|12|9,929|209,686|223,654|
|全库 `readStatisticsInputsSnapshot`|50|383.74 / 372.53 / 375.70|901|496,450|20,956,000|789,354|
|当前对象完整配对投影|50|27.63 / 27.52 / 28.77|4|9,929|209,423|25,829|

这是函数层样本，不是4个新接口的HTTP压测。统计表中的789KB是内部输入快照序列化体积，不能当作 `/statistics` 最终HTTP正文大小；同理其函数计时不包含路由/客户端的全部处理。

观察：

- 列表指标为6N+1次 get/all，普通列表为2N+1次，统计为18N+1次（当前source-only合成数据）。大JSON重复出现在返回列中；20.9MB不是原始CSV有20.9MB，也不是浏览器必须接收20.9MB。
- 单对象raw detail并未随无关练习数增长，反驳“所有detail底层都全库”的过度概括。问题在于页面的 `readDetailFinancialBundle` 另调用全库统计后选一个；随着N从1增至50，其依赖的统计原件工作量从9,929增至496,450字节。探针的“单对象不应被无关练习放大”断言明确 **FAIL**，不是修复结果。
- 原始详情仍带整份source/revision/base64与历史，故一个9.9KB来源对应约223KB对象；其耗时在本样本中小，不代表该DTO适合页面正常读取。
- 配对工作量受当前对象大小影响，未随其他对象数增长；但它构建/返回50对而非6条页面。不能把该数值解释为已有配对分页。
- 本样本没有legacy绑定。绑定后的验证会读取全部旧成交/重建回合，并被逐练习统计重复调用；这是源码确认的放大路径，**未量化**，不能把source-only时间套到旧成果迁移环境。

调用依据：[列表指标](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:8`）、[列表/统计/详情](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:155`）、[页面财务取全库](SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:62`）、[旧关联全量验证](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.ts:309`）。

### 分段定位：CSV重建/重解析是该样本的主要成本

另一独立运行在同样50×50完整组样本上给真实函数加spy计时，不替换返回值，不跳过校验；先预热一次，再取3次。显式断言全部50份指标可知、每份pairCount=50，避免把unavailable/吞错短路误当快速完成。[探针](evidence/backend/stages.probe.test.ts.txt)、[原始结果](evidence/backend/stages-results.json)、[通过日志](evidence/backend/stages-probe.log.gz)。

|分段|调用次数/次列表读取|3次累计时间 ms|含义|
|---|---:|---|---|
|列表|1|76.80 / 71.80 / 75.94|读元数据和revision JSON|
|认证source snapshot|50|437.11 / 436.58 / 430.67|含DB、JSON/hash/原件重导入等，未继续拆分|
|完整配对投影|50|785.27 / 783.86 / 779.12|包含下一行，不可相加|
|投影内部的分组CSV parser|2,500|734.57 / 735.09 / 725.92|每组重建CSV再解析，约占总时间56–57%|
|整个指标读取|1|1,300.25 / 1,293.11 / 1,286.61|spy插桩口径，与上一表SQL插桩不同|

这里的1.29秒不是从1.42秒优化后的结果：**两次运行没有任何产品代码改变**，插桩与主机状态不同，不比较它们的速度变化。嵌套CSV时间不能再加到配对投影时间上。初次计时脚本在安装spy后获取original造成递归，被服务映射为unknown；已修正探针并保留[失败日志](evidence/backend/stages-probe-v1-failed.log.gz)与[原脚本](evidence/backend/stages-v1.test.txt)，该失败不能作为产品缺陷或性能数值。

### 索引对照及其限制

原排序计划为 `SCAN practices` + `USE TEMP B-TREE FOR ORDER BY`。只在该内存库新增日期/标的/序号/ID索引后，计划改为 `SCAN practices USING INDEX probe_practices_order`；单次统计仍901次get/all、496,450字节BLOB，370.53ms。

这证明索引能去掉排序临时树，却不会移除当前代码逐来源的解析/认证。只有一个对照样本，不报告显著加速比；这也不排除最终范围SQL、历史外键、搜索/排序需要合理索引。**先限制读链工作，再按最终SQL做索引评估**是本轮建议，未执行产品修复。

## B. 38a0：重放已有发布的真实处理器

探针：[readstore.probe.test.ts](evidence/backend/readstore.probe.test.ts.txt)，结果：[readstore-results.json](evidence/backend/readstore-results.json)，日志：[readstore-probe.log](evidence/backend/readstore-probe.log.gz)。

真实 `POST` 路由接收真实Request、生成Response，序列为readiness → summaryAndPage第1页100行 → 严格客户端协议解析。只替换DB连接提供方为候选原有 **隔离验收库、readOnly:true**；不接触业务库。沿用历史诊断的固定业务时点2026-11-05T08:00Z；交易库发布的valid_until必须为null，freshness依赖数据库身份/epoch/依赖向量，不是日期有效期。本轮不证明它相对当前业务输入的新鲜度。当前1,221个源码文件与A1b记录的冻结指纹全部一致（独立研究见 [readstore报告](research/readstore-performance.md)）。

|样本|readiness ms|分页/正文 ms|严格解析 ms|顺序总时长 ms|正文字节|
|---|---:|---:|---:|---:|---:|
|1|2,265.40|1,817.09|99.55|4,182.05|627,555|
|2|1,869.54|1,816.24|41.28|3,727.06|627,555|
|3|1,830.05|1,834.64|48.13|3,712.82|627,555|

3次都未达旧一秒读取预算，诊断断言明确 **FAIL**。没有套接字/浏览器/React、首次构建/后台写入或受控冷热缓存；不能称“浏览器首屏4秒”，不能用3个样本计算可靠p95。

第4次单独SQL插桩验证工作量，未混入前三次计时：

- 发布含226个详情payload：13,693,424字节；726个证据目标JSON：11,737,709字节。**每一个请求都重读约25,431,133字节这两类JSON**，再加发布证明、成员、episode、stock等。
- readiness和分页分别完整验证。一次分页请求内部的readiness/validate可用事务内Map去重；该Map不跨HTTP请求，所以并不能消除这两个请求间的重复。
- 整个两请求序列为154次get/all、7,410个返回行、67,885,314个返回文本列字节。67.9MB包含其他证明/元数据，不是25.4MB×2的精确同义量，不是网络流量或物理磁盘I/O。

源码：[验证整个发布](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:519`）、[事务内Map](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:18`）、[分页入口](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:562`）。

历史同指纹A1b已有20次顺序总时长median3,078.02ms、p953,404.50ms；本轮只能独立确认问题仍可复现。运行环境未严格控制，不能据3.71–4.18秒声称发生性能回退。更早A1a约245ms不含新增完整详情且代码不同，禁止拼接成“现功能已达标”。后台单次构建约19.84秒与上述已准备发布的读取成本独立，不相加为页面时间。历史证据和边界见 [专项报告](research/readstore-performance.md)。

## 其他服务/运行时问题：已看见机制，未做因果定量

|问题|已确认事实|尚未确认|
|---|---|---|
|同步工作与事务|DatabaseSync、统计/指标读事务内进行同步JS重计算；资本只读snapshot复用BEGIN IMMEDIATE入口|真实event-loop延迟、读写锁竞争、WAL增长、busy timeout是否主导延迟|
|导入/更正写入|事务/CAS/幂等规则有价值；commit在写锁内重认证，decision先取全practices|并发导入/读取与真实来源大小下的锁持续时间，本轮不迁入写链|
|后台刷新|38a0确有独立worker进程；同一调度循环先交易库刷新后首页，global job/保守失效|实际饥饿/写放大占比、队列吞吐、失败后恢复时间；不能说worker只是一个Promise|
|旧原件/兼容|部分目标读取先capture/assemble整书，并带整书兼容载体|真实单目标source请求的各阶段耗时与体量|
|浏览器/网络|旧客户端有重复序列化、配对嵌套查找；Mock端口有options→page串行|真实waterfall/渲染贡献；本轮后端证据不能替代UI性能诊断|

来源：[同步DB/事务](SOURCES.md#25db)（冻结定位：`25db:db/sqlite.ts:43`）、[资本snapshot](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:61`）、[调度](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/homepage-refresh-worker.ts:97`）、[独立进程启动](SOURCES.md#38a0)（冻结定位：`38a0:scripts/start-local.mjs:50`）、[原件整书捕获](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-evidence.ts:49`）。

## 对下一轮设计讨论的约束

本轮可以据此淘汰“旧接口加adapter”“先整库解码再slice”“先readiness全量验证再分页再全量验证”的迁入方式。新方案仍需明确四读字段依赖、输入快照、认证与损坏发现保证，然后比较轻量SQL投影/范围聚合和持久发布方案。不能仅用“有缓存”“改异步”“补索引”作为性能达标依据，也不能删校验让探针变绿。

后续若获准实现，必须另外测首次构建、日常读取、写后失效、来源/资本/行情/FX/规则变化、重启/DB切换/损坏拒绝、并发及真实浏览器。当前业务规模、bound比例、多市场估值/FX等未验证，**不承诺具体容量、p95或工期**。
