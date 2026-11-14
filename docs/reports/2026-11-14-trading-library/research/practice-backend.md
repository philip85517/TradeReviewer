# 25db 模拟交易库后端：按四类前端读取逐层审查

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](../SOURCES.md) 定位。

评审日期：2026-11-14。本文是后端迁移决策的源码研究，不执行后端迁移、修复、业务数据读取、数据库升级或服务启动。研究对象是 **25db 工作区的实际文件（包含未提交及未跟踪实现）**，不是单独评审其 HEAD 提交；当前前端需求以 e0bb 的四类 `LibraryReadPort` 为准。源码版本及逐文件 SHA256 见文末。

## 结论及判定含义

**值得保留的是领域约束、纯计算规则、错误反例和写入一致性设计；不建议把当前列表、详情财务、统计及配对读取链整体 cherry-pick 到当前前端。** 四类读取均有可借鉴的底层事实或投影，但没有一个现有 HTTP 接口完整实现当前前端要求的粒度、快照和分页语义。因此，“已有页面显示”和“已有同名接口”不能等同于接口已完成。

本文使用四种明确结论：

|判定|本次具体含义|
|---|---|
|可复用|保留其小接口、规则及必要测试，在新端口下调用；仍需验证依赖与行为，并不表示现在执行迁移。|
|重构后复用|保留规则或内核，拆掉现有存储、HTTP、兼容链的耦合后使用。|
|保留设计并重写|保留约束、案例及正确性目标，重新实现目标读模型/查询/协议。|
|放弃迁入|当前实现方式不作为新链基础；相关业务能力可另行建设。|

核心依据：当前六行分页发生在全量读取和大量原件校验之后；单练习财务调用全库统计；配对返回整个练习且客户端存在嵌套查找；源认证、统计、兼容验证、展示 DTO 没有形成成本明确的读取边界。这是已确认的源码行为，**不据此断言所有现有性能问题均由这些机制导致，也不据此否定 SQLite 或所有旧模型**。证据分别见下述七项发现。

## 四类读取与现有链条

需求源：[四类端口及 DTO](../../../../app/lib/library-preview/contracts.ts#L82)、[请求台账](../REQUEST-LEDGER.md)。Mock 中 `options → page` 的串行调用是实验策略，台账已经明确不能原样冻结为真实网络方案；本研究没有把四类端口等同于必须四个 HTTP URL。[台账接入成本](../REQUEST-LEDGER.md)

|前端实际需要|25db 的现有路径|实现程度及缺口|
|---|---|---|
|`readOptions({mode,from,to})`：小选项、默认范围、snapshotVersion|旧列表由 `listWithMetrics()` 获取全部练习，再结合宿主 instruments/accountLabels 在浏览器生成市场/账户选项。|有生成选项的素材，无独立日期范围小查询及快照契约。不能为了选项加载全库 source 或财务。[列表消费者](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-list.tsx:95`） |
|`readPracticePage(query)`：每页≤6行；汇总覆盖完整入选范围|`GET /api/storage/practices?metrics=1` → `readPracticeListWithMetrics` → `PracticeStore.list()` → 每练习源快照/配对投影；浏览器筛选、排序、slice。财务来自另一条全库统计链。|范围/页 SQL、范围汇总、返回校正页号、统一 snapshotVersion 未实现；不能仅给旧响应包一层 slice。[路由](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/route.ts:6`）、[metrics](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:8`）、[前端筛选分页](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-list.tsx:138`） |
|`readPracticeDetail(key)`：一个对象、财务分解、资本版本、估值、配对首页|`GET /practices/:id?legacy=verified-v1` → `PracticeStore.readWithLegacy`；另取 `pairing-status?...projection=tradingview-v1`；`readDetailFinancialBundle` 再读取 `/statistics?version=2` 的全部练习后取一个。|原件详情及身份保护较完整；当前组合方式不满足单对象粒度。缺少所需完整财务分解、资本读版本整合、结束估值服务及版本过期语义。[详情 store](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:210`）、[财务消费者](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:62`） |
|`readPairPage(fullKey,page)`：当前对象6条、稳定 pairId、版本及完整性|`GET /practices/:id/pairing-status?revisionId=…&practiceVersion=…&projection=tradingview-v1` → 源快照 → 完整配对投影。|有完整身份及过期当前版本拒绝；没有后端分页、pairId 页面协议、保留快照策略。绑定 `pairRef` 属于显式写入，不应为只读翻页而写入。[配对路由](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/pairing-status/route.ts:9`）、[绑定表](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:522`） |

前端页汇总要求 `totalCount/calculableCount/unknownCount/scopeNet/scopeWinRate`；这些应覆盖**筛选范围**，不能由当前六行得出，也不能把 unknown 当零参与汇总。[页契约](../../../../app/lib/library-preview/contracts.ts#L31) 账户选项是 UI 选择，不是服务端授权；旧客户端对此也有明确注释，不能把浏览器筛选改名为数据隔离。[旧统计选择](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-v2-client.ts:172`）

## 七项主要源码发现

### 1. 六行列表的实际成本随全库练习数、修订 JSON 及原件总量增长

`PracticeStore.rows()` 无范围条件、无 LIMIT，按练习日期等全表读取。`list()` 对每行调用 `revision()`，读取并解析包含完整 source 的 `revision_json`，再查周期声明；它只需要摘要字段，却承担完整修订传输和 JSON 解析。HTTP 路由只区分 `metrics=1`，没有处理前端的日期/市场/账户/搜索/页号参数。[全量 SQL 与 revision](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:48`）、[摘要生成](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:157`）、[路由参数](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/route.ts:6`）

带 metrics 的列表不是简单计数：它在一个读事务中对**全部**练习读取源快照、认证原件并重建配对，然后才返回计数。浏览器获取全量之后才筛选、排序和截取六条。因此减小 DOM 行数不能限制服务器工作；即使在 HTTP 输出端 slice，原工作仍存在。[metrics 循环](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:11`）、[浏览器分页](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-list.tsx:138`）

**设计判断：保留设计并重写列表读取。** 新读取需要范围查询和可查询的摘要/投影，不应依赖原件 JSON 才获得第一层列表字段。范围总计仍可能需要聚合整个入选范围，不能声称所有工作必然固定六条；应限制为已认证摘要/投影的范围聚合，而非每次重读所有原件。

反证/保留点：metrics 使用同一 SQLite 读事务，避免身份与投影读到不同数据库瞬间；未知来源返回 `metrics:null`，SQLite operational error 会继续抛出，未把数据库故障装成零计数。这些正确性语义应保留。[事务与错误区分](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:8`）

### 2. 单练习财务依赖全库统计，统计又重复读取来源与详情

`readDetailFinancialBundle(detail)` 读取全部 `StatisticsV2Snapshot`，再按 practice/revision/version/source 身份选择一条。身份核对值得保留，但这个读取粒度意味着打开 A 的财务会处理 B、C 等不相关练习。[单练习选择](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:34`）、[全库取数](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:62`）

`readStatisticsInputsSnapshot()` 先 `list()` 全库，再逐个读取完整 detail（含 legacy 检查），把 BLOB 转 base64 后再解码，重新 hash/parse、核对修订和原始记录、读取资本并做财务投影，最后才提交读事务。未带 `version=2` 的旧统计响应仍先执行同一全量财务计算，再丢弃 `financialV2`。[完整统计链](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:167`）、[旧/新统计路由共用计算](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/statistics/route.ts:29`）

客户端又将已解析的响应映射成旧协议，`JSON.stringify` 后构造 `Response`，交给旧客户端再次解析、校验。这是已确认的额外序列化，不据此声称它是主要耗时。[客户端适配](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-v2-client.ts:144`）

**设计判断：放弃迁入“详情→全库统计→取一条”的连接方式；统计/详情 query service 保留设计并重写。** 单对象详情应只依赖该对象及明确的共享配置；范围汇总应是独立范围读取，不借用原始 detail DTO。在同一读快照内组合是正确目标，并非问题本身。

反证：`PracticeStore.readDetailInTransaction(id,…)` 的主要源、修订和历史查询已经按 ID 查一个练习，并不总是全库扫描。真正的全库扩大来自详情的财务消费者及 legacy-bound 分支，不应把所有 detail 方法描述成同一种复杂度。[按 ID 的详情](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:218`）

### 3. 配对有来源证明，但“整份投影+整份校验+整份渲染”未形成翻页边界

配对路由验证完整 practice/revision/version；源读取遇到非当前版本返回409；然后 `projectTradingViewPractice` 扫描所有原始记录、按交易编号分组、为每组重新构建 CSV 并调用 parser，最终输出所有 executions/allocations。路由没有分页输入。[路由](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/pairing-status/route.ts:13`）、[源版本保护](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:340`）、[全量配对](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-pair-projection.ts:35`）

客户端 `pairProjection` 对每个 allocation 多次 `events.some/find`；详情金额映射对每条 allocation 再找 events、groups 和原始 records。由循环和线性查找可推出最坏二次量级查找，不是实测浏览器耗时结论。[客户端嵌套查找](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-http-client.ts:191`）、[财务配对映射](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:69`）

**设计判断：配对规则重构后复用，分页 query service 保留设计并重写。** 保留“来源记录不是原始订单、每条记录有稳定 recordId、未获证据不推断同日顺序”的约束；输出经版本化的 pair 投影，再按确定顺序分页。只做 `slice` 仍会重建整个练习；需要区分首次投影构建成本与常规翻页成本。

边界：当前投影只支持 `CN-SH/CN-SZ` 六位标的；每组要求恰好两条来源和两条解析记录；全局费用列部分缺失会 unavailable。返回类型含 `partial`，当前函数实际只有 ready/unavailable 的返回分支，不能据类型声称复杂部分成交旅程已完成。[投影支持范围及返回](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-pair-projection.ts:35`）

现有 pair binding 的唯一键包含 practice/revision/algorithmVersion/openRecordId/closeRecordId/quantity，是人工成果精确归属的有用设计；原始投影没有页面所需 pairId，应明确投影 pair 身份与显式绑定 pairRef 的映射，不能靠时间、价格重新猜配对，亦不能让读取分页隐式写绑定。[binding schema](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:522`）

### 4. 源认证承担高价值防损坏规则，却处在常规全库读取内层

源快照读取会查询 BLOB 与 revision JSON，验证字节长度和 SHA256；借 `json_tree` 拒绝重复 JSON key；重新 parse revision、核对 provider/scope；把原件编码 base64 交给 `preparePracticeImport` 完整重导入；再深比较 source、attestation、history 和 recordIds。认证工作不是一个便宜的主键读取。[原件/JSON 校验](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:139`）、[重导入及深比较](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:241`）

**设计判断：认证规则和失败反例应重构后复用；当前逐次全库认证编排不迁入。** 不能为性能直接删除这些检查。可以比较“导入时认证并保存可验证投影”与“按不可变来源/修订缓存认证结果”，但缓存键至少需要覆盖实际来源及修订、认证/投影算法版本，并定义外部篡改、恢复、进程重启、数据库切换后的失效/重新认证策略。该选择尚未由本文实现或验证。

需要保留的区别：source 保存完成仅证明原件与身份，并不自动证明成交映射、费用、完整持仓或财务可计算；Revision 的 `projection:'awaiting-policy'` 明确只是能力标记。[事实与投影约束](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-contracts.ts:53`）、[财务准入契约](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-contracts.ts:134`）

### 5. 旧数据关联的验证可把单对象读取扩大到整个旧成交及 Recall 范围

`readCurrentInTransaction` 无 marker 时立即返回 source-only；若已绑定，则执行完整 `verify`。后者读取全部 legacy executions，重建全部 trade episodes，检查目标回合归属、Recall schema、旧记录 digest 和相关人工成果。这条分支在统计的逐练习 detail 中也会被调用。[source-only 短路与 bound 分支](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.ts:441`）、[全 legacy 成交/回合验证](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.ts:309`）

因此若 K 个练习有绑定，源码存在逐练习重复读取/投影旧成交集合的路径；其实际规模和成本取决于绑定比例、旧成交及 Recall 表数据，本文未访问业务 DB，不能量化。仅用 source-only 合成练习测量，会遗漏这条昂贵路径。

**设计判断：精确关联、不可误认人工成果的规则保留；整个兼容运行链暂不迁入四类只读接口。** 需要旧成果时，单独审查可验证的 association provider，明确依赖版本及失败行为，避免把所有 Recall 历史验证耦合进每个列表/详情读取。反证：source-only 不会执行上述全量旧成交验证，不能把 bound 路径成本套给所有样本。

### 6. 写模型完整性较强，读 schema 和事务边界不适合照搬

schema 把原件 BLOB、practice 当前身份、不可变 revision、import history、日期/序号历史、幂等命令分开；有 FK、唯一约束和不可变触发器。这些事实边界有价值。当前 revision JSON 又包含完整解析 source，普通列表因此读取大量不需要的内容。[schema](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:403`）、[Revision 模型](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-contracts.ts:53`）

写入使用 `BEGIN IMMEDIATE`，原件再认证、来源/练习/修订/历史/回执原子提交；输入 digest、preview guard、命令回执检查避免错用旧预览/重试 ID。人工日期更正同时核对 expectedVersion/currentRevisionId、追加历史和重新分配必要序号。值得保留这些规则，但当前 `decision()` 先读全 practices 再在 JS 中过滤，且完整原件重解析处在写锁内；新写路径需单独衡量锁范围，不应因为当前阶段只读而误判写模型无问题。[写入事务](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:81`）、[候选决策](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:56`）、[日期 CAS](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:125`）

目前显式 practice 范围索引为 `(account_id,instrument_id,practice_date)`，另有唯一/主键索引；日期/序号历史查询按 practice_id，但对应建表段未建立 practice_id 索引。现有 schema 没有为当前全局日期稳定排序、市场/名称搜索、范围聚合及 pair 页建立专用读投影/索引。应以最终查询和 EXPLAIN 评估补充索引；**“缺一个索引”不能解释或解决全库 hash/parse/projection**。[索引与历史表](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:433`）、[实际排序 SQL](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:48`）

连接使用同步 `DatabaseSync`、WAL、5秒 busy_timeout；统计与 metrics 在读事务里执行同步 JS 重计算。由此可确认同步工作占据当前执行线程，并延长事务持有时间；不能仅由源码推断真实并发下 event-loop 延迟、WAL 增长或锁等待。WAL 也不能使这些重复解析消失。[连接及配置](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite.ts:43`）、[共享连接](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite.ts:93`）

资本 `readGlobalSnapshot/readPracticeSnapshot` 使用通用 `withSqliteTransaction`，后者为 `BEGIN IMMEDIATE`，使读快照也采用写事务入口；这是应改读事务边界的候选，尚未证明它造成真实争用。[资本快照](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:61`）、[事务 helper](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite.ts:116`）

**设计判断：事实/写入约束重构后复用；读模型、查询及锁编排重新设计。** 不建议直接 cherry-pick 全部 migration/schema 进入当前分支，更不据此次研究授权升级业务数据库。

### 7. 数据版本与财务完整性需要显式补齐，不能把“能算”当“已接入”

practice 的 version/currentRevisionId 已用于 CAS 和配对当前版本保护；但详情 HTTP 只接 practiceId，未承载前端的 optional revision/version 或 snapshotVersion；配对过期报 `version-conflict`，尚无快照保留/`version-expired` 页面协议。`practice-source-v1` / `statisticsVersion:2` 是协议版本，不能充当当前数据快照版本。[详情路由](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/route.ts:5`）、[源版本校验](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:340`）、[统计路由](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/statistics/route.ts:35`）

资本有独立持久 revision 和 ETag，包含继承全局配置且防 ABA；HTTP 要求 If-Match，缺失428/不一致409，这是高价值设计。资本更新并不递增 practice.version；新 DTO 的资本版本、收益版本及页快照需要覆盖资本等依赖，不能只 key 在 practiceId/revisionId/practiceVersion 上。本文没有审查另一个 38a0 版本的缓存失效登记，也不据此声称其遗漏 app_settings。[资本 ETag/CAS](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:29`）、[资本写入](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:111`）

纯财务投影明确区分“可计算闭合组小计”和“完整练习净额”，对重复/缺失组、数量/方向/日期、费用与极端精度有原因码；合法千位分隔数字先验证分组形式再去逗号，值得作为金额解析反例和规则资产保留。[纯规则契约](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.ts:3`）、[小计与整份净额](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.ts:84`）、[Decimal 解析](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.ts:159`）

storage adapter 在确认完整受支持报表、全部闭合组与费用可知时，把小计提升为 practiceNet，并把 residual 标记 none；这是依赖 provider 完整性契约的业务推导，**本文没有把它判定为必错，也不能未经业务确认推广到所有导入格式、残余或部分成交**。它把完全未报费用映射为0，部分缺失保持未知；这一 provider 语义也应单独确认。其指标输入固定 `currency:'CNY'`，`equityPath:null`，时间基础为无时区本地来源时间，尚未接结束估值/完整权益序列。[adapter 的完整性提升及输入](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-financial.ts:14`）

资本类型列出 CNY/USD/HKD/USDT，全球设置可按 currency 取；但当前 `getPractice()` 默认 CNY 解析并继承无 currency 参数的 global，per-practice 写入也默认 CNY。配对和统计选择限沪深。这些类型不能证明全市场/跨币种整链完成。[资本类型及解析](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-contracts.ts:5`）、[单练习资本读取](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:99`）、[市场选择](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-v2-client.ts:180`）

通用 `practice-metrics` 只接受 caller 已确认事实，区分 gross/net 防重复扣费；收益率需正资本；回撤需完整有序权益/一致估值与现金流处理；汇总拒绝重复 ID 与混币。**这些纯能力可复用，真实来源提供者未接齐时应继续 unknown，不能由能力函数存在推断前端各财务字段已完成。** 当前前端还要求 realizedGross/unrealizedGross/closedFees/retainedOpenFees/endValuation 等，不是把旧 net/fee 重命名即可得到。[输入契约](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.ts:3`）、[计算与回撤](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.ts:155`）、[汇总身份币种](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.ts:239`）、[新详情字段](../../../../app/lib/library-preview/contracts.ts#L51)

## 可选择保留的最小模块边界

成本采用相对等级：低=窄纯接口及反例对齐；中=拆 storage/协议及补版本、投影；高=新增范围/投影/失效/并发语义。不是工期承诺，不含业务数据搬迁和生产上线。

|模块|完成度 / 质量判断|迁移判断|首次接入成本与前提|长期成本判断|
|---|---|---|---|---|
|`practice-date`|严格公历日期；文件名一处明确日期才接受，不用交易区间兜底。|可复用规则与测试|低；仅处理 dependency 中 `isIsoDate` 的严格契约；保留练习日/历史交易区间/导入时刻三者分离。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-date.ts:18`）|低；范围稳定。|
|`practice-scope`|不裁剪源行，校验一账户一标的及完整性声明；无法证明调用者事先没丢行。|可复用纯校验|低；只能放在可信 server adapter 之后，不信任浏览器 `complete:true`。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-scope.ts:53`）|低；按 provider 明确证据。|
|`tradingview-practice-financial-projection`|窄 CSV 标准化行契约、Decimal、原因码、小计边界较好；特定 provider/CNY。|可复用纯内核，携带反例|低至中；与新 Fact/原因码映射，确认 fee/provider 完整性；不连同全库 store 迁入。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.ts:3`）|低至中；若扩多市场应另建 provider，避免一个函数吞所有格式。|
|`practice-metrics`|纯输入、费用基准、残余与资本、权益完整性清楚。|可复用纯内核|低；真实 provider 必须证明输入，保留币种/unknown/精度保护。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.ts:3`）|低；它不负责读库/行情，不能把接入成本藏进该模块。|
|源 importer + snapshot reader|认证覆盖很强；当前认证与 DB/full source 输出耦合。|重构后复用|中；拆原件读取、认证结果、版本化摘要投影；保留损坏/身份失败反例。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:139`）|照搬高，拆边界后可控；认证失效策略是必要成本。|
|TradingView 配对投影|完整两行闭合组可建来源配对；重构 CSV 再解析、全量输出；不是通用成交配对。|重构后复用受支持规则|中；直接接标准化行、小接口验证、稳定 pair 身份/算法版本；分页独立。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-pair-projection.ts:35`）|通用化盲扩会高；保持 provider 限定较可控。|
|Capital setting/CAS|覆盖继承、ABA、版本冲突及非法值 unknown；读事务使用写事务入口、单练习默认 CNY。|重构后复用|中；拆 adapter；资本/币种/继承版本进入读取依赖；读写事务分开。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:29`）|规则可维护；不能只缓存 practice.version。|
|Practice/Revision/Source/History 事实设计|身份与原件分离、不可变来源、记录出现项ID、日期更正历史有价值；JSON承载太多读取内容。|重构后复用领域设计；schema按目标重评|中至高；保留不变量与迁移前后的数据证明；另设查询友好投影，非直接复制所有表。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-contracts.ts:42`）|保留事实设计有利；照搬读写混用会持续高。|
|Commit/date command|事务、digest/receipt、CAS/历史等规则较完整；候选扫描与重解析扩大锁内工作。|重构后复用设计；本阶段不接写入|中至高；窄 repository/query、事务并发反例；原件写认证不能被移除。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:81`）|需专项并发审查，不能沿只读接入顺便迁入。|
|列表/options/query service、详情 DTO、统计 scope query、pair page|目前缺少四类读取的有界粒度/统一版本。|保留必要语义并重写|高；定义 scope、snapshot/expiry、summary/pairs、unknown、权限及成本预算后再实现。|比在旧链外包四层 adapter 更清晰；需持续维护投影和失效。|
|现有 practice HTTP client/route 大表|有严格协议/错误校验；无新四类 query/AbortSignal 贯通，v2借旧Response再解析。|保留协议校验理念并重写适配层|中；端口↔HTTP 映射、取消、契约错误与版本过期；校验应纯函数化。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-http-client.ts:224`）|避免新旧协议互构 Response 的长期耦合。|
|legacy execution/Recall 全兼容链|严谨防误认，但绑定读取依赖整个旧成交/回合及 schema。|放弃作为四类读取基础；按需单独审查|高；只有明确要展示旧成果时再设计 provider；保持现有原件及成果不动。[源码](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.ts:309`）|照搬后会把旧系统约束持续带入新读链。|

## 三种路线的成本比较及反例

|路线|短期|长期|本次判断|
|---|---|---|---|
|旧 store/route 整体搬入，外包四端口 adapter|现成响应较快接页面；适配仍需 all→page、财务拼装与版本补丁。|保留全库认证/统计/兼容耦合，失效与请求粒度难以约束。|不推荐；“已能显示”不能抵消上面的机制。|
|选择性保留纯规则/事实约束，重新实现读取编排与投影|需支付四类读取模型、版本、聚合、认证失效的明确成本。|正确性资产可继承，读取成本与依赖更易解释。|推荐作为后续讨论基础；尚未授权迁后端。|
|全部重写，包括金额、日期、未知及绑定规则|代码表面最统一，但需重建大量正确性反例。|易重新引入误认、重扣费、把缺数据当零和错误配对。|未见足够理由丢弃已有纯规则；重写读链不等于抹掉领域知识。|

可使结论改变的证据：若业务练习库永远极小、所有详情都必须展示完整原件和全部 legacy 成果，旧链可有较低的短期接入成本；若不可变 source 的可信边界能在真实部署中可靠成立，经版本化认证/投影缓存可明显降低重复计算。但这两者都不能由当前文件或“加缓存”口号直接成立，且当前前端需求已明确分页和单对象粒度。

## 已确认机制、待验证影响与最小补证

|状态|结论|
|---|---|
|源码已确认|列表全量、每对象 revision JSON；metrics 每对象认证并配对；详情财务取全库统计；统计原件/base64/hash/parse和资本/legacy逐对象；配对全量输出；部分客户端嵌套查找；资本读入口 `BEGIN IMMEDIATE`。上文逐项引用。|
|性能假设|源 JSON/认证/重复投影而非排序是主要瓶颈；legacy-bound 会显著放大；同步工作影响并发与 event loop；长事务影响 WAL/锁。需测量贡献和规模，不能用静态代码直接给真实延迟或 p95。|
|未验证|业务库实际数据量/源大小/损坏及 bound 比例、冷/热/重启性能、磁盘/网络/浏览器耗时、读写竞争、实际索引计划、授权边界、资本/估值/算法变化的全链快照失效。本文未访问业务 DB。|

后续实验应使用隔离库和构造来源，分别改变练习数 N、每练习来源行数 R、legacy 绑定比例/旧成交数 L；把 SQL 调用与返回字节、原件字节、认证/hash/parse/投影、序列化、HTTP、React 渲染分层计量。应分开“第一次投影构建”和“普通列表/翻页”，并覆盖改日期、资本更新、投影算法版本、旧成果更新、重启和损坏拒绝。给新索引做 EXPLAIN/对照，但不能把消除排序临时表等同于消除所有源处理。不得用多个串行调用总时长直接推断网络瓶颈。

根协调者另行运行了真实函数的隔离内存合成探针，其方法和数值保存在 [practice-read-results-v2.json](../evidence/backend/practice-read-results-v2.json)；本文未独立运行该探针，不将其数值冒充业务库或浏览器延迟。本文的裁决主要依赖可追到文件的读取机制与需求差距。

本轮是文档/代码研究，没有修改候选源文件，没有执行迁移、写业务库或启动服务；没有进行 UI/数据库验收。存在相应测试文件可作为规则资产候选，但**测试文件存在不等于本轮执行通过**，也不替代真实新读链接入后的性能和一致性验证。

## 版本冻结与 SHA256

以下元数据和清单由报告写入后读取实际文件生成；它们标识本次研究结束时的工作区，不虚称研究开始前已有不可变快照。候选文件在清单生成前后再比对；工作区总体脏状态须与 HEAD 一并理解。没有把未提交实现误认为 d95afc37 已提交内容。


- 采集时间：`2026-11-14T02:34:52.091945+00:00`。
- 25db 候选：`/Users/zhoulin/.codex/worktrees/25db/TradeReview`；HEAD `d95afc37d30f817edbd6daab41e85f485138de0d`；branch `codex/trading-library-v2-development-plan`；全 status NUL 记录数 `11894`，已跟踪 status NUL 记录数 `95`；完整原始 `git status --porcelain=v1 -z --untracked-files=all` SHA256 `a53349c8474cf99dc8264adf48b3c0fb7a252fb205cdf5eb59ee515327d614ab`。
- e0bb 前端需求：`/Users/zhoulin/.codex/worktrees/e0bb/TradeReview`；HEAD `1770178694f5815b699c23deef894888dac1abea`；branch `codex/library-frontend-mock`；全 status NUL 记录数 `674`，已跟踪 status NUL 记录数 `0`；完整原始 `git status --porcelain=v1 -z --untracked-files=all` SHA256 `6393da6f27d6c814cc0a32b1264f3c9560e296a6a5dbeb2f473431eafd525fc1`。
- status 列为 porcelain 两字符码：`??` 未跟踪，` M` 工作区修改；`clean` 为该文件无未提交差异。整体 status 的 NUL 记录数不是业务文件数（可含生成物及 rename 附加记录），不用于描述实现规模。
- 以下 47 个文件 SHA256 在清单生成前后完全一致；仅作本次结束时冻结，不替代提交/归档。

|实际文件|git status|SHA256（文件完整字节）|
|---|---|---|
|[25db/app/api/storage/practices/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/route.ts:1`）|`??`|`194d90e3d8e366c335c2454fdab1427c4d620a88897f959cbc41ef00a3ce0c09`|
|[25db/app/api/storage/practices/[practiceId]/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/route.ts:1`）|`??`|`b81bda935cab54078416193792681886d134ff7b6ff0fa2a63c9972a40751a3e`|
|[25db/app/api/storage/practices/[practiceId]/pairing-status/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/pairing-status/route.ts:1`）|`??`|`94d777ed383f1c5c4c08fbce3823173cae5d59ad1158e324a601a9cd2ba29531`|
|[25db/app/api/storage/practices/statistics/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/statistics/route.ts:1`）|`??`|`d90746a1509754f5edd312c3252a1cd777062f95ea81cd0a84ada67cd2791fd0`|
|[25db/app/api/storage/practice-capital/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practice-capital/route.ts:1`）|`??`|`f66c45a4db000a04fc130402af43f11e69f04da524cf7d0ac5594617bf82c4c2`|
|[25db/app/api/storage/practices/[practiceId]/capital/route.ts](../SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/capital/route.ts:1`）|`??`|`5a6faf3cfe606b53180309038b9c9dedba72f31030cb2c079ea313ba691e2dbb`|
|[25db/app/lib/storage/practice-store.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:1`）|`??`|`9d8397cc1c521e2a0580d2c0babb928c96e38bddb787a14d917e49cead66d17c`|
|[25db/app/lib/storage/practice-list-metrics.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:1`）|`??`|`825bd6c662efb253014960b51471b4fcb16182675978f74cd2cc1e0a60be33c5`|
|[25db/app/lib/storage/practice-source-snapshot-reader.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.ts:1`）|`??`|`af438be6e0b2d989f5c0943e35b7593a7092b0623f4d26b65d445e7de0450a50`|
|[25db/app/lib/storage/practice-http-client.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-http-client.ts:1`）|`??`|`4aee7792f29e8e3d76fe8747dfa3a235e2357b698bec7c31c0dc07d21ea30fbc`|
|[25db/app/lib/storage/practice-statistics-v2-client.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-v2-client.ts:1`）|`??`|`c71c81f9e0355e4bd1996958dab45a58aae97ba141954886b674f79e624480be`|
|[25db/app/lib/storage/practice-statistics-http-client.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-http-client.ts:1`）|`??`|`b09f96f228c70eba2e4b7bbfd48f8faa617c04c52bf7389cd5251af2086d6218`|
|[25db/app/lib/storage/practice-statistics-financial.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-financial.ts:1`）|`??`|`1f0f3d8d993001a3953fd05f3cf04acde6b27e7d2adbb4b6996f02bc58e1dc84`|
|[25db/app/lib/storage/practice-capital-store.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:1`）|`??`|`4cfe10769555ffaf13c495bf35f6bab5c6db8be826babc055ee2afb2e937fbcb`|
|[25db/app/lib/storage/practice-capital-contracts.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-contracts.ts:1`）|`??`|`af14ccde669db20a9ac3b4c44a44ac5e65dd9955f8eb9c555cbca8ebefe4d4a2`|
|[25db/app/lib/storage/practice-period-declaration.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-period-declaration.ts:1`）|`??`|`4000a0de87df49a24e7978133c1139b5d96927e4fddd5770c00db8f98c726150`|
|[25db/app/lib/storage/legacy-practice-reference-store.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.ts:1`）|`??`|`25a0c2500a3bfa77020162bff55f97ecd7f443a503dded6175b4647fc48d4938`|
|[25db/app/lib/storage/practice-execution-reader.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-execution-reader.ts:1`）|`??`|`8b70e09b000b36f4e1c53d2ccd41920fb03ed146b3eae37548576ee98a7341ae`|
|[25db/app/lib/storage/sqlite-store.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/sqlite-store.ts:1`）|` M`|`a35a978970e323d93460f03940ebb33d55a7ec237ceec3dffce974976d72e525`|
|[25db/app/lib/import/practice-import.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/import/practice-import.ts:1`）|`??`|`c885331833dda22905e43a08254e2010cf7e518763eb530ed775ced318352518`|
|[25db/app/lib/import/tradingview-practice-source.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/import/tradingview-practice-source.ts:1`）|`??`|`43d14bbe8807236860da9da90f61f408c449ad66f493aeb8bb6aa598f7922ee8`|
|[25db/app/lib/import/tradingview-simulation.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/import/tradingview-simulation.ts:1`）|` M`|`955ffc9c8c41243503a11eb0ab53b117cd1ebd2e57074e027b2e0b427471bacf`|
|[25db/app/lib/trades/practice-contracts.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-contracts.ts:1`）|`??`|`fbc69ef3ba45385589c301a67dd72c281a9fa900dc5e6ee44157f5857bfe7938`|
|[25db/app/lib/trades/practice-date.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-date.ts:1`）|`??`|`f67ad802c8e6f4a9b6805b63304d65faf50ddc7f9da17b0e90493b47cee5ef77`|
|[25db/app/lib/trades/practice-scope.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-scope.ts:1`）|`??`|`68a3c8220b8b12d248aa33620bf6a0bc8e988ced9ee29fc96a94e23793105d22`|
|[25db/app/lib/trades/practice-metrics.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.ts:1`）|`??`|`7428ba3e98f975f9f3b188bc71b4f89133693725e2aedbd9389e510697924c51`|
|[25db/app/lib/trades/tradingview-practice-financial-projection.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.ts:1`）|`??`|`29f0938ddfd15ea70b726784b91adffde4b0ab4d0160edfa911127242bcc29d1`|
|[25db/app/lib/trades/tradingview-practice-pair-projection.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-pair-projection.ts:1`）|`??`|`d4a1203a69c53e52989ea30426e87de89f05fae5fd530e21cbcc525d95c7c7e8`|
|[25db/app/lib/trades/practice-pairs.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-pairs.ts:1`）|`??`|`ff596db45f36cf4986df94a5bdb35273b4a4cf44bdd8a1a035e318f01bf9b09a`|
|[25db/app/components/library/library-practice-list.tsx](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-list.tsx:1`）|`??`|`9d35469cdd15e9992719a9bb2dd6b388234bcb9f31a06224af04104bc6581e49`|
|[25db/app/components/library/library-practice-browser.tsx](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-browser.tsx:1`）|`??`|`8e80b6831240541c47a098dcbe60b23bfb40056f5a29b37f5c8e2a1dcfdbdecc`|
|[25db/app/components/library/library-practice-detail.tsx](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-detail.tsx:1`）|`??`|`fabfeea95cb5ac2ef806fb86c645a9ca696c91b5c2c444f6c6d5886c34e9b1d5`|
|[25db/app/components/library/practice-detail-financial.ts](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:1`）|`??`|`b8a42216f64ebdece2e49dd73cf992d089462bffc42d71648f504932424b6c10`|
|[25db/app/components/library/practice-detail-open-quantity.ts](../SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-open-quantity.ts:1`）|`??`|`213a4af7ae0676f19b109635635630288befe668851151579089ef98089d80d4`|
|[25db/db/sqlite.ts](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite.ts:1`）|` M`|`376c7145e9517026b0759048a7f829855b1121ddbf67d97c3cfad4fac5331f47`|
|[25db/db/sqlite-schema.ts](../SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:1`）|` M`|`3ed3d43894a1a0607401ad65148eebf4fceb9b92df6b1b009adec0454dbef563`|
|[25db/app/lib/trades/practice-date.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-date.test.ts:1`）|`??`|`3f2f00adf89bf8769c4483db29ee83356381148b467dc75cb0f469482137782d`|
|[25db/app/lib/trades/practice-scope.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-scope.test.ts:1`）|`??`|`bf1f9319dfb44b8d7cded8eb995e2925aa2214eeaf30c5a8d2207296504d49ff`|
|[25db/app/lib/trades/practice-metrics.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/practice-metrics.test.ts:1`）|`??`|`583dda8b8f8d250b2580aa64b13ab39191f02fec8a314167ef94355315b8f8f1`|
|[25db/app/lib/trades/tradingview-practice-financial-projection.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-financial-projection.test.ts:1`）|`??`|`8c23b579e7c1ab8d04ccdc09e45ba5b6730952a8d81d1e9a9ab080e90e74d83d`|
|[25db/app/lib/storage/practice-source-snapshot-reader.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-source-snapshot-reader.test.ts:1`）|`??`|`67de2eb09629892860a214567f7c011d9472ddeea032442e58f865690a8c60cc`|
|[25db/app/lib/storage/practice-list-metrics.integration.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.integration.test.ts:1`）|`??`|`5b0848846e1809382eb5d04cb719bbf8f671c0afadc900eb0053f00f27872866`|
|[25db/app/lib/storage/practice-capital-store.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.test.ts:1`）|`??`|`f97e25c423ab2ea339488a7f4994a3ea77531914169f8e4007c676c35b9b7c67`|
|[25db/app/lib/storage/practice-store.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.test.ts:1`）|`??`|`e06dff87911fa6484557383e73d596c84e23dbef828964f4d0dcffa3a65a71a5`|
|[25db/app/lib/storage/legacy-practice-reference-store.test.ts](../SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/legacy-practice-reference-store.test.ts:1`）|`??`|`273cbb78583f5401fb9f674fe93f5e4dff541b4b1e60c84933d7d8b5d3f18c0a`|
|[e0bb/app/lib/library-preview/contracts.ts](../../../../app/lib/library-preview/contracts.ts#L1)|`clean`|`0188c6a6bbaa050b8ddc71fbae32dd30835be81b73a68754931cc4796b18f55d`|
|[e0bb/.scratch/library-frontend-mock-20261113/REQUEST-LEDGER.md](../REQUEST-LEDGER.md)|`??`|`f1b1287c78ac0a708541604ca9a3e803d06c0d081c68c1ad71fdc07076ad896c`|
