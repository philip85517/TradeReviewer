# 38a0 交易库读取、证明与后台服务复用评审

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](../SOURCES.md) 定位。

评审日期：2026-11-14。范围：38a0 实际工作树中的交易库读协议、派生表、构建器、校验器、证据读取及首页后台调度；对照 e0bb 前端四类读取需求。只形成迁移判断，不迁移或修复后端。本文作者只读源码及已有证据，没有打开数据库、启动服务或运行数据库测试；新增重放指标由主代理独立提供，另列其边界。

**结论：38a0 不适合整块 cherry-pick 成为新模拟交易库后端。它值得保留的是持久任务、发布隔离、版本绑定、证据完整性规则及反例测试；热读校验、旧实盘投影和全书证据适配器需要重新设计。** “已经有分页和后台 worker”不能据此判定读取性能达标，也不能据此判定已经实现新练习模型。

## 1. 审查对象与证据新鲜度

- 38a0 分支为 `codex/homepage-db-1s-20261105`，HEAD `8c8c66c715be46e1e8a53d61d02b82f4fa13b22c`；必须包含未提交源码判断，不能只检查 HEAD。此前清点为 27 个 tracked 脏文件、46 个 untracked app 文件。
- 本次逐文件重算 A1b `source-after-final-record.json` 中全部 **1,221 个文件** SHA-256，当前内容与冻结清单 **0 个差异**。清单文件自身 SHA-256 为 `8e7afc06e10044c9783df1a9d4410bdc23d5f4ea089ac7b79200d83b461f7342`。这使 A1b 的失败证据能绑定到当前源码；不表示旧机器负载、缓存或 UI 状态与今天一致。[冻结清单](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/source-after-final-record.json:1`）
- 归档记录的产品总指纹为 `1d011413d90754cbe363d8c0c4f24025660e3ae5bbef5dfbdf372f82cb569a10`；本文核验的是清单各文件哈希，没有另行猜测其聚合算法。[版本记录](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:96`）

|当前审查文件（38a0 仓库内相对路径）|本次 SHA-256|
|---|---|
|`app/lib/storage/trade-library-read-store.ts`|`9c0baf229231242aa18e32b798579f67ad7ae1511d3dfacaf7ccabe7b154aa7d`|
|`app/lib/storage/trade-library-read-schema.ts`|`3fc1bad3beba670a4e4b4299a7bda7ceaa6fde3a78c171e8e74912a62a3ff368`|
|`app/lib/storage/trade-library-read-builder.ts`|`2550a0274a55e1e5cd116b6f99f1b10089ff9038299ec49579d78985b96905e6`|
|`app/lib/storage/trade-library-read-contract.ts`|`f6faa974d3a3d2c4a87a2419cafbc9352b8dbc06659c33e00f1221d43f583085`|
|`app/lib/storage/trade-library-read-evidence.ts`|`fdba719eba0c66abd0cbe6636189b7e0b72b9b3fad6f4e1a80d997e2e0d98aee`|
|`app/lib/storage/homepage-refresh-queue.ts`|`5c5cafa2f775c518e6fe38b6f3bcb208ec7b505cc0133fce623a736ff198e345`|
|`app/lib/storage/homepage-refresh-worker.ts`|`b9e5b3ccd57eddf736231dfe225a0bad35dfde4d3a44e2a2c610ed04b248ebe6`|
|`app/components/homepage-v25/homepage-view-client.ts`|`5e543f1d4019f1e02833fee08b81fd21c348b9e7e667850a2eb759de0df60a5e`|
|`app/api/storage/trade-library/read/route.ts`|`ca6b14bfa0ee50487f2dea56f486ae6d94c7de0240f807d2719aaafae88eaf60`|
|`scripts/start-local.mjs`|`0c79fd72a1d3c0011259b380361a74d266d370b54b9aae0d342b8aa9fbbc8687`|
|`scripts/homepage-precompute-worker.ts`|`807e8f82c96678c8dcdd7838476b969fc11fff5f09aefafe7d2efa6b63bb1f70`|

## 2. 先看完成度：四类前端读取还缺什么

e0bb 端口明确以模拟练习为对象：`practiceId + revisionId + practiceVersion`，读取支持 AbortSignal 与 snapshotVersion；列表和配对页均为每页 6 行。详情包含分项财务、初始资金来源／版本、结束估值、未知值及不可操作原因。它们是前端 DTO 需求，不是已批准的后端事实表设计。[完整契约](../../../../app/lib/library-preview/contracts.ts#L2) [四类方法](../../../../app/lib/library-preview/contracts.ts#L82)

|前端实际需要|38a0 当前对应能力|完成度判断|
|---|---|---|
|`readOptions`：日期范围内模拟练习的市场／账户选项、默认范围、快照|`readiness` 返回全局发布状态、别名与版本；分页 payload 带全目录和 facets|没有等价的模拟 options 读取。就绪探测也不是轻量目录端口。|
|`readPracticePage`：筛选／排序、6 个练习、全筛选范围汇总及可计算／未知数量|`summaryAndPage` 已有预存统计及分页，但解析器只接受**完全固定的默认实盘选择、stocks、newest、100 行**|旧实盘股票列表局部完成；不能用字段改名适配练习，也没有所需动态筛选与排序。|
|`readPracticeDetail`：一个练习及明确 revision/version，分项财务／资本／估值，首个配对页|`rounds` 按 stockRef 返回一个标的所有组和所有回合；真实源数据严格解析存在失败|不是练习详情，合法原文还会被拒绝；不能算可交付实现。|
|`readPairPage`：同一练习版本下独立的 6 行配对页、总数和完整性|`rounds` 是全量数组，无配对页操作；`originalEvidence` 是原件证据，职责不同|缺失。应独立定义配对身份、完整性和排序，不借用“所有回合”充当分页。|

固定范围限制来自实际请求校验，而非文档推测。[固定实盘及 100 行](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-contract.ts:257`） [全回合详情类型](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-contract.ts:530`） [原件响应携带整书兼容载体](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-contract.ts:546`）

四方法不等于必须发四个请求；Mock 中 options→page 串行行为也不是生产两次往返的设计依据。生产协议仍需讨论选项复用、合并、缓存和快照共享。[请求台账边界](../REQUEST-LEDGER.md)

## 3. 已证实的性能问题：返回有界，读取工作无界

当前正常读取链为：HTTP `readiness` → 全发布校验；随后 HTTP `summaryAndPage` → 内部 readiness → 全发布校验 → 最后切 100 行。分页请求内的 Map 可以复用该次 readiness 的校验结果，所以**不是同一个正常分页请求重复全校验两次**；但 Map 每次公开读取新建，不能在两个 HTTP 请求间复用。指定不同旧发布时还可能涉及另一个发布。[就绪校验](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:110`） [每次分页新建 Map](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:561`） [先校验后 slice](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:588`）

`validatePublication` 不仅检查元信息：它读取所有业务组、所有 episode、所有股票行和成员，再 `.all()` 读取该发布的**全部详情与全部证据目标**，逐项 JSON 解码、规范编码与 SHA-256、验证引用及集合关系。最后才交出包含全图的对象。这是完整性目标与热读责任放在一起造成的体积耦合；不是逐标的 SQL N+1。派生表已有发布＋行的主键，问题也不能简化为“缺索引”。[全部详情／证据加载](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:519`） [解码重新算摘要](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:312`） [现有主键](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-schema.ts:85`）

同一 execution 及其来源结构同时放入 round `parts` 和 evidence target `parts`。分页 payload 还整体携带证券目录、别名、权威复核 ID、状态字典与 FX，而不是仅当前页所需上下文。小行数不自动等于小响应或小处理量。[重复 parts](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-builder.ts:541`） [全局目录和显示快照](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-builder.ts:509`）

### 3.1 指纹相同的历史 A1b 实测

发布 ID 为 `dbd8cf92-c495-4b54-855c-535ab9618141`。单个发布详情 226 行、13,693,424 字节；证据目标 726 行、11,737,709 字节；**仅这两类 JSON 共 25,431,133 字节**。当前＋前一发布约 50.9MB 是两份存储量，不是单次读取量。第一页响应为 627,555 字节。[体积记录](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:57`）

|A1b 20 样本，毫秒|p50|p95|最大值|
|---|---:|---:|---:|
|readiness|1,494.24|1,640.87|1,857.22|
|分页处理＋正文生成|1,543.41|1,732.28|1,746.01|
|JSON＋严格客户端协议解析|33.01|41.42|134.37|
|每个样本的三个环节顺序总和|3,078.02|3,404.50|3,544.56|

总和分位数来自各样本总时长，不是把各环节分位数相加。测试固定业务时点 `2026-11-05T08:00:00.000Z`，使用真实 Request／Response 和严格解析，仅把连接提供方替换成已有只读隔离发布；**无套接字、浏览器、React 绘制、后台写入**，没有受控冷热缓存。因此能够确认该读取路径本身已超一秒，不能称为浏览器首屏 3.08 秒，也不能量化 DOM／网络在真实页面中的占比。[原始 20 样本](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/default-read-diagnostic.json:1`） [测量边界](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:59`）

旧 A1a 约 245ms p95 不包含新增完整详情，源指纹不同；不可将旧性能与新功能拼成通过。A1b 单次后台构建约 19,842.76ms 是另一个成本，也不能混入已准备发布的热读分位数。[旧版差异](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:68`） [单次构建边界](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:89`）

### 3.2 主代理本轮独立重放

主代理在同一已有只读隔离发布、固定业务时点下运行三次未插桩的真实路由＋严格解析序列，总时长分别为 **4,182.05／3,727.06／3,712.82ms**，第一页各 627,555 字节。第四次独立 SQL 插桩序列记录 **154 次 get/all、7,410 个返回行、67,885,314 个文本列字节**；readiness 与分页各加载 226 个详情和 726 个证据目标。该文本列体积包括多类数据及元信息，并不等于磁盘 I/O、网络流量或解码后内存；插桩结果也不与前三次耗时混算。这进一步确认调用路径和体积，不能给出正式性能分位数或浏览器验收结论。[本轮原始证据与 scope](../evidence/backend/readstore-results.json#L1)

**归因强度：** 全量读与重新校验证据已确认，是当前热读工作量过大的直接机制；并且真实路径已慢。尚没有分阶段 CPU profile、并发／冷启动／真实页面 waterfall，不宣称“哈希占 X%”“SQLite 占 X%”或“所有慢都由这一处造成”。

## 4. 版本、完整性、新鲜度实际分别保证什么

|条件|当前行为|迁移时应保留的含义与边界|
|---|---|---|
|发布内容完整|发布写入所有派生关系后，事务内 `validatePublication`，通过才切 head；随后保留当前及前一完整发布|保留候选发布不能半成品可见、历史引用不悬空；不要把校验移出原子发布后再宣称等价。|
|head 与当前输入相容|readiness 比较 databaseId、epoch、rules 与六类依赖；失配为 202 REFRESH_PENDING|这是 freshness 门，不是 JSON 摘要完整性证明。只保留 publicationId 或 immutable 假设无法代替它。|
|列表快照仍可继续|带 readVersion 的分页要求数据库身份／epoch、当前依赖、保留状态及精确版本绑定均相符|“还保留两版”不代表任一旧版都可继续分页；依赖改变时旧快照仍返回 409。|
|回合详情可读|必须保留且版本精确相符，同时 facts/source/catalog/rules/review/display 六类依赖全部仍一致|当前并非无限读取历史详情的协议；重构需明示更新时继续旧快照还是要求刷新。|
|原件目标仍有意义|先精确绑定旧发布与目标引用；抓取当前来源；facts/source/catalog/rules 必须仍一致；sourceRefs 摘要及成交身份／账户映射还需一致|review/display 单独变化可继续读取同一来源证据；这是有意较窄的 freshness 规则，不能一概等同于六类依赖校验。|
|来源历史完整|缺失材料／版本／观测／关联／映射／revision 等历史，或源图悬边／循环，抛 SOURCE_CORRUPT 503；有效更新导致绑定改变为 409|“源历史丢失”与“来源合法改变”应分开报告。不能全改成重试或吞掉损坏。|

[发布顺序与保留](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:287`） [readiness freshness](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:99`） [列表版本兼容](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:565`） [详情六依赖](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:632`） [原件四依赖＋目标当前性](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:657`） [来源图完整性](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-evidence.ts:48`）

因此“发布时全量证明、热读只读当前页”只是待设计方向，不能直接删掉热读校验或仅按 publicationId 永久缓存。当前测试特意要求**第一页之外的股票／成员／episode／详情／证据损坏也在下一次公开读取时拒绝**；若新方案改变检测时机或不变量，必须先显式决定等价保证如何成立。候选机制可以讨论写入不可变约束、版本证书、页证明及独立全量审计，但本文没有证明任何一个组合足够，也不授权实现。[页外损坏反例测试](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.test.ts:140`） [归档仍要求保留的保证](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:91`）

## 5. 数据模型与服务耦合：不能把旧发布直接嫁接到 25db

38a0 构建器复用旧 component 中的 browse/filter/stock-rounds 逻辑，固定实盘共享范围，按证券归并 episode；捕获时既抓整书来源，也为 registry 所有表枚举行做摘要，并为全部 instrument 抓完整日期范围行情。事务捕获后再做重投影是合理分界，但业务投影仍耦合整书、首页、旧 UI 规则与行情输入。[组件规则依赖](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-builder.ts:6`） [完整捕获](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-builder.ts:38`） [固定旧投影](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-builder.ts:221`）

25db 已有独立 `practices`、`practice_sources`、`practice_revisions`、import/sequence/date history、command 幂等记录；source/revision 有不可变触发器。38a0 registry 没有这些新表，构建器也不读取其练习事实；不能认为旧 `simulation_run_id` 或旧 episode 等价于完整练习模型。迁移 registry 名单本身也不能自动生成正确投影。[25db 练习模型](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:403`） [38a0 输入名单](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-schema.ts:6`）

**`app_settings` 已注册，不能说它漏注册。** 25db 初始资金和 revision 写在 app_settings；38a0 对该表除两个 FX 专用 key 外保守递增全部业务依赖并排队。因此资金写入可以触发保守失效；但这不代表构建器理解默认／自定义资金继承、资金 revision 和练习收益率，也不补上新练习事实表未纳入的问题。[资金 CAS 与写入](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:37`） [app_settings 分类规则](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-schema.ts:129`）

当前触发器对未知字段保守失效，防止“新字段变了但缓存没失效”；代价是来源／catalog／facts 等经常一起增长，刷新 job 仍是全局 default。它能合并到最新 generation，却不是增量重建。由此可推断存在写放大、过宽重建和频繁 supersede 的风险；**尚未测实际写入频率及占比，不能把它定为已测主瓶颈**。[全局 generation 与重排队](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-schema.ts:148`）

原件端口也超出单目标职责：先 `captureHomepageStoredRows` 抓全书，重验全局材料图；之后解析全部 tradeReadPages、assemble 整书，响应仍带全部 tradeReadPages 兼容载体。应保留来源谱系、目标身份与缺失诊断；新端口须重做目标化读取和分页／有界来源资料，不能把这层搬过去作为廉价单证据读取。[抓整书及历史检查](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-evidence.ts:49`） [整书 materialize 及载体](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-evidence.ts:77`）

## 6. 后台 worker 与 HTTP：有哪些好设计，哪些还需拆分

- **值得保留：** 数据捕获在一致性事务内；计算在捕获事务外；发布前检查 claim、generation、databaseId、epoch、book sequence、依赖向量与 registry，再原子发布。新写入不能让旧计算覆盖新 head。任务有持久状态、最多三次重试、superseded 路径及启动恢复。[claim／capture／发布栅栏](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:218`）
- **不要误判 worker：** 启动器确实 spawn 独立 worker 进程，并等恢复完成才启动 web；不是仅在 web 事件循环 Promise.resolve。该异步边界只是允许发布前看到更新／取消。[独立进程](../SOURCES.md#38a0)（冻结定位：`38a0:scripts/start-local.mjs:50`）
- **需要重构：** 同一 worker 的每次循环先 await 完整 trade-library refresh，再协调首页批次／目录／view。一个慢交易库任务会延后本轮后续工作；独立目录数据结构不等于独立调度。应讨论任务隔离、调度公平与容量预算，尚无并发压测，不能宣称已经发生饥饿。[串行顺序](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/homepage-refresh-worker.ts:97`）
- **需要决定运维边界：** worker 意外退出会停止 web，这是避免保存后永无消费者的显式保护，也产生可用性耦合。未来应先决定“后台不可用时只读可否继续／写入如何提示”，再决定是否保留此策略；不能无意继承整个 supervisor。[退出策略](../SOURCES.md#38a0)（冻结定位：`38a0:scripts/start-local.mjs:70`）
- **HTTP 可保留的是约束模式：** 严格解析、错误代码区分、no-store、有版本的返回绑定；不直接复用旧 DTO。现有 homepage client 的 AbortSignal、请求选择绑定、过期检查、有限 202 轮询与一次 409 重试是模式参考，它不是交易库四端口的已接线客户端。[交易库路由](../SOURCES.md#38a0)（冻结定位：`38a0:app/api/storage/trade-library/read/route.ts:5`） [首页客户端](../SOURCES.md#38a0)（冻结定位：`38a0:app/components/homepage-v25/homepage-view-client.ts:54`）

## 7. 合法原文被拒绝：设计质量上的确定反例

来源字段 `statementRealizedPnl` 和 `positionEffectEvidence.realizedPnl` 是原文字符串，协议却使用标准 decimal 校验，导致合法的 `13,631.16` 被拒绝，客户端只给通用 execution source/instrument 错误。归档在 1,774 段成交中定位 65 段受影响，涉及 45 标的、52 回合。应保留来源原文，区分原文与计算值类型，并使错误能指出字段；不能通过重导、删除字段或更改原件让测试变绿。[实际错误类型](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-contract.ts:604`） [通用拒绝点](../SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-contract.ts:628`） [真实数据诊断](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:35`）

旧实盘三页 100／100／26 行、统计和 facets 与旧逻辑的比较局部通过；详情严格解析 FAIL，完整 726 回合／三市场原件／最终重开未验完；桌面接线、视觉、真实首屏均未验收。不能把合成测试通过、数据库保护通过或旧页行结果一致转述成“交易库后端已完成”。[完成度矩阵](../SOURCES.md#38a0)（冻结定位：`38a0:.scratch/homepage-db-optimization-20261105/module-implementation-20261106/a1b/root/ROOT-ACCEPTANCE.md:21`）

## 8. 逐模块迁移判断与成本边界

成本为相对工程复杂度，不估算没有依据的人天；“保留”指可作为新实现依据／抽取后复用，不授权现在复制代码。

|模块|判断|值得带走的部分|必须先解决的事项／相对成本|
|---|---|---|---|
|持久任务、代际失效、claim fencing、恢复|**重构后复用**|合并更新、重启恢复、旧计算不得覆盖新发布、可诊断失败|拆出交易库调度职责，明确写事务接入与重试语义；中高。若原样带整个首页 supervisor，成本继续扩大。|
|捕获→计算→CAS 发布→原子 head 切换|**保留设计，抽取后复用**|一致性边界、发布不露半成品、有限保留与引用清理|依赖实际练习模型重定义，保存窗口与阅读会话策略需一致；中高。|
|完整性证明／manifest／反例测试|**保留规则，重构实现**|来源分区、无丢失／重复、组身份、页外损坏和失效拒绝|把全量认证与热读责任重新划界，证明新方案仍满足损坏保证；高，是性能与正确性的核心成本。|
|`validatePublication` 公共热读实现|**重写**|可复用不变量和测试 oracle|不能逐页读取全部发布图；需要有界 SQL 行／字节／校验及证书失效机制。先完成证明设计，不以缓存 ID 掩盖更新／损坏；高。|
|stock/episode builder 与 summary/page|**练习读模型重写**|旧范围结果与汇总算法可做对照资产|旧实盘证券聚合无法表达练习版本、日期、资本、未知态与 6 行配对页；解除组件层依赖、全库行情依赖；高。|
|schema／registry／触发器|**重构后复用部分机制**|未知字段保守失效、变更通道、注册校验|纳入实际新练习表，明确资金／行情／复核依赖；避免把触发失效误当业务语义已实现；中高。|
|round detail／原件兼容读取|**保留审计规则，重写读取适配**|原文、不可变谱系、目标身份、缺失与合法变更分类|消除整书 capture／parse／carrier，提供目标化来源；旧全回合集不等同新配对页；高。|
|运行时协议校验器|**重构后复用模式**|严格边界、绑定检查、事实 unknown 显式表达方向|修正原文／decimal 混淆、缩小 DTO、字段级错误，按新领域审核所有可选项；中。|
|HTTP 路由与 homepage client 模式|**重构后复用小片段**|Abort、有限重试、202/409/503 分类、请求与返回绑定|实现真正四类读取、鉴权／缓存／快照、避免昂贵 readiness 前置；中，不能以重命名替换。|
|已有真实数据比较器和损坏／重启测试|**值得保留并扩展**|事实保护、错误反例、页边界、崩溃恢复|重新绑定新数据模型与版本，不转移旧 PASS 到新代码；中。|

## 9. 后续讨论应形成的决策材料

1. **完整性保证说明：** 下一次公开读必须立即发现任意页外损坏，还是允许独立审计后禁用版本？先明确保证，再比较页证书／不可变存储／全局校验的设计与成本。保持事实变化失效和恶意／意外改写检测各自的责任。
2. **四读取数据依赖表：** 每个字段分别来自哪个练习 revision、资金 revision、结束估值、配对规则与汇率；unknown 与缺少来源不能默认为零。全筛选汇总仍要覆盖完整 scope，但不意味着每次请求重读全事实。
3. **快照生命周期：** options／列表／详情／配对页是否必须同一 snapshot；新增、重导、改日期、资金变更、行情更新后旧会话能否继续读；过期采用可解释的 409／version-expired，不能静默切换。
4. **可测成本表：** 各端口每页 6 行时返回和读取的行／字节边界、SQL／解码／计算／渲染分段时间；独立报告预热读取、首次构建、写后更新、并发和浏览器体验，不互相替代。
5. **候选代码清单：** 将可抽取的任务／发布／校验规则与必须重写的读模型分别列出具体依赖闭包，再估算首次接入及长期维护成本。完成这些材料后再判断具体 cherry-pick；目前不应按整个分支迁移。

以上为研究判断，不是迁移验收或产品修复完成声明。当前确认的是“旧后端有哪些资产和缺口，以及为何不能直接接到四读取前端”；新的后端接口、数据模型与性能实现仍待讨论。
