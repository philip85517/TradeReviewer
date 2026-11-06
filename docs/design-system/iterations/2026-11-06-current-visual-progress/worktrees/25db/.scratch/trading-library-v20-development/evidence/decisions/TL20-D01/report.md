# TL20-D01 独立练习旧数据契约核查

状态：**DONE_WITH_CONCERNS**。技术事实核查和候选声明已完成；完整业务契约、旧数据映射与引用迁移尚不可冻结。本报告不关闭 TL20-D01 或任何 HITL 票，也不构成 V2.0 产品交付验收。

执行者：Sol 6.1 / ultra；独立 Luna 5.6 / max 验收由 root 协调。源版本：`d95afc37d30f817edbd6daab41e85f485138de0d`。工作目录：`/Users/zhoulin/.codex/worktrees/25db/TradeReview`。45 个源文件/需求文档的 SHA-256 和行数见 [source-manifest.json](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/source-manifest.json)。行号均指当前工作目录源码，合成失败栈中的转译行号不作源码引用。

所有自身写入仅在本证据目录；未改产品、配置、票状态或地图，未提交 Git，未读取或写入业务数据库，未启动服务或浏览器。运行验证仅创建三个 `:memory:` SQLite 句柄；安全包装器会拒绝任何文件数据库路径。

## 结论与批准边界

1. 当前模型具备原成交、导入批次线索、旧 run 兼容读取、账户/标的成交修订和 episode 级 Recall 保存能力；**没有**独立 practice、内容 revision、练习实际日期来源、人的平仓动作或内部配对分摊的稳定身份合同。
2. `simulationRunId`、`source.run`、`fileFingerprint`、导入历史 ID 和 episode ID 各有不同含义，不能互换为 practice ID。当前规范 TradingView 账户的 episode 故意跨 run 合并，不能用于独立练习边界。
3. 当前 `StatementParseResult.records` 不是完整源记录投影：重复角色、未配对、无效或歧义行会被排除；不能由它证明批准的“全文件规范化多重集等价”。
4. 既有 Recall 的 ID 对账只检查 execution ID 增删；同 ID 改价可能仍显示 completed，开仓核心变化又可能产生新 episode ID。升级必须保留旧键、完整人工内容、正式版及关联投影；不能静默搬家或把旧完成状态当新证据已通过。
5. 可以先独立实施一个**只比较调用者提供的完整规范化记录多重集的纯函数**，不接存储、不识别旧练习、不分配身份、不写日期、不迁移引用。完整源行 normalizer/实际导入接线仍有明确缺口，见“最小安全实施部分”。本次只提供声明，没有实施该函数。

已读批准合同 [产品规格](/Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/design-system/trading-library-design-spec.md) 全文，尤其 L9–61（文件/日期/版本/引用）、L65–79（主动平仓回合）；[V2.0 视觉候选](/Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) BT01/03/04/06/09/10（BT04 L136–159）。同时读当前开发、拆分、任务跟踪规范，以及本功能 [INTERFACES](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/INTERFACES.md)、[DESIGN-COVERAGE](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/DESIGN-COVERAGE.md) 和 [任务要求](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/issues/01-legacy-contract.md)。没有以交接摘要代替原稿。

## FACT：当前字段和存储映射

| 语义 | 当前真实字段/位置 | 能证明的事实与缺口 |
| --- | --- | --- |
| 原成交 | [TradeExecution](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/types.ts:59)，L59–147 | `id/accountId/instrument/side/executedAt/quantity/price/fee`；source 中有 row、sourceOrder、fileName、fileFingerprint、batchId、simulationRunId、sourceTradeId、simulationRole、报告信息。没有 practiceId、practiceDate、practiceRevisionId、humanActionId、pairAllocationId。 |
| 源文件/导入定位 | 同文件 L70、84–88、131–138 | filename 是来源名称；row/sourceOrder 是一次解析的定位；fp/run 含解析输入身份。不同内容、重排行可能改变 fp/run/执行 ID；相同名字不能说明同一文件/练习。没有保留全部原始行或原文件字节的通用字段。 |
| 练习日期 | [产品规格](/Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/design-system/trading-library-design-spec.md:51)，L51–61 | 历史成交时间、实际练习日期、导入时间是三个语义。当前 execution 与 import history 均没有实际练习日期和手填/修正来源字段；不能用 `executedAt` 或 `importedAt` 代填。 |
| 导入历史 | [ImportHistoryEntry](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/import-history.ts:8)，L8–41 | `id/fileName/sourceLabel/importedAt/firstTradeAt/lastTradeAt/tradeCount/instrumentCount/.../sourceKind/tradeNature/simulationRunId`，另有排除、重复、冲突计数。不是不可变的完整文件版本，也没有完整成员表/源记录多重集。模块本地存储入口是浏览器旧状态迁移用途，L1、119、136。 |
| 批次表 | [SQLite schema](/Users/zhoulin/.codex/worktrees/25db/TradeReview/db/sqlite-schema.ts:35)，L35–64 | `import_batches.id` 主键，`source_fingerprint` unique；`executions.import_batch_id` 外键。当前 `putImportHistory` 不给 source_fingerprint 列赋值，不能凭 schema 的 unique 列断言现行导入已有文件去重。 |
| 批次写入/读取 | [SqliteStore](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-store.ts:1779)，L1779–1872；L1091 | source.batchId 可创建占位批次，其初始 imported_at 用 execution.executedAt；实际 history 随后 upsert。同 ID 的 history 可被覆盖，不是不可变版本。`getImportHistory` 读 reconciliation_json 并处理修订/月结投影。占位时间不能据为实际练习日期甚至可靠导入时间。 |
| 成交持久化 | 同文件 L844–859、1803–1845 | source 放 evidence_json；当前 nature/run 也有独立列，读时可补回这两个当前字段。旧 `source.run` 可随 JSON 留存，但不会自动提升为新 simulationRunId。 |
| 成交修订 | [TradeRevisionRequest](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/trade-revisions.ts:3)，L3–6 | `{id,instrumentId,accountId,reason,changes,expectedScope?,importHistory?}`，change 为 before/after execution，结果 `{executions,revision}`。scope 是账户+标的，非 practice；最多 500 changes，补充 history 要单标的及 expectedScope。 |
| episode/review | [TradeEpisode](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/types.ts:181)，L181–204；[schema](/Users/zhoulin/.codex/worktrees/25db/TradeReview/db/sqlite-schema.ts:65) | episode 是计算结果；旧 reviews 以 episode_id 为键，含 cursor/plan/review/drawings 等。不是源文件版本表，也不是主动平仓动作表。 |
| Recall 人工作品 | [RecallDocument](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/recall/types.ts:105)，L23–53、85–128、192–198 | 文档含 episodeId/revision/decisions.executionIds、快照、图画、工作状态/阶段上下文、cursor/executionCursor、lastCompleted、reconciliation；计划/评价/retained bundle 还有执行证据、快照/图画上下文和版本引用。不能只保留 note 文本。 |
| Recall 存储图 | [schema](/Users/zhoulin/.codex/worktrees/25db/TradeReview/db/sqlite-schema.ts:192)，L192 起；[保存](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/recall/server-repository.ts:124)，L124–195 | `recall_documents` 存 draft_json/finalized_json/revision；各类计划、评价、人工评价、metric 投影也以 episode/version/entity 引用。保存使用独立 revision CAS，并在同事务重建投影。正式版仅显式 finalize 更新。 |

### 身份可以与不可以区分什么

| 现有标识 | 当前生成/消费事实 | 不可据此认定 |
| --- | --- | --- |
| 文件名 | parser 解析 SSE/SZSE 六位标的上下文，[parser](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-simulation.ts:148)；没有练习日期识别器 | 文件唯一性、练习稳定身份、日期来源真实性。 |
| fileFingerprint | [fingerprintBytes](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/file-fingerprint.ts:1) 对字节作两组 32 位累积，输出 16 hex | 密码学无碰撞保证、语义等价、不可变 practice 身份。本次 SHA-256 只是候选新 artifact 校验方案，非现存实现。 |
| simulationRunId | 活跃 parser 为 `tradingview:${sourceFileId}:${market}:${symbol}`，[parser](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-simulation.ts:244)，L244–256 | 独立于格式/行序的 practice 或内容版本；一个文件多范围的既定政策。 |
| 旧 source.run | [tradingViewSourceRun](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/tradingview-account-identity.ts:41)，L41–61 兼容读；当前 `tradeScopeKey` 只读 simulationRunId，[types](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/types.ts:211) | 旧 run 可无损直接写回；实际当前 writer 要求当前 simulationRunId 等完整证据，[validator](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-store.ts:467)，L467–511。 |
| import history ID / batchId | [preview](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/import-preview.ts:172)，L172–228 通常产生 `import:${fingerprint}`；workspace 把 pendingImport.id 写入 source.batchId | 导入历史是完整原文件快照、批次可恢复所有被丢弃行、更新后稳定 practice ID。 |
| execution.id / sourceTradeId | 当前 parser ID 含 fp、market、symbol、CSV tradeId、物理 row，[parser](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-simulation.ts:228)，L228–268；CSV tradeId 配 entry/exit | 物理 row 是跨重排稳定原记录身份；CSV tradeId 是人的主动动作；相同 ID 就代表财经内容未变。 |
| orderReference / executionGroup | [types](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/types.ts:10)，L10–34 可记录 order reference、技术 fills | 现有全部数据都有此证据，或该字段已足以自动认定“一个人动作”；来源/合并/拆分规则仍待 TL11-D07。 |
| episode.id | [episodes](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/episodes.ts:85)，L85–125 由 opening scope/time/side/qty/price 加 occurrence 派生；规范 TV scope 省略 run | 源文件/练习/人的平仓回合身份。开仓改价可能更换键；同一账户不同文件的开、平仓会进入同一 episode。 |
| 内部分摊 | [episodes](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/episodes.ts:136)，L136 与 L507–593 有 close/reverse 派生成交片段、持仓累加/归零 | 稳定 pairAllocation ID 或 humanAction ID；派生执行片段不能改写原始记录身份。 |

规范 TradingView 账户业务 scope 明确是 account-wide、`simulationRunId:null`，[identity](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/tradingview-account-identity.ts:12)，L12–29、135–150；`episodeKey` 同样跨 run，[episodes](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/episodes.ts:36)。[library](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/trades/library.ts:151)，L151–193 直接消费该全账户 episode，review 也按 episode.id 投影。因此不能把账户净损益、归零段或时间/价格相近记录当独立练习映射算法。

## FACT：真实调用链和可复用签名

| 层/提供方 | 当前精确入口与真实消费者 | 后续需要适配 |
| --- | --- | --- |
| 活跃解析 | [dispatcher](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/dispatcher.ts:76)，L76–89 调 `parseTradingViewSimulationCsv(input, {fileName,sourceFileId,context?}): StatementParseResult`；[结果合同](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/contracts.ts:57) 为 `broker,records,candidates,exclusions,diagnostics,blocked,monthly?,tradeNature?,simulationRunId?` | 新增完整源行证据通道；旧 records 保持 execution 消费语义，不能改名冒充完整源文件。旧 [tradingview.ts](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview.ts:61) 是历史实现，不是 dispatcher 当前入口。 |
| 预览/客户端去重 | [workspace](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/components/trade-review-workspace.tsx:5038)，L5038–5151 赋 batchId、调 mergeTradingViewReimports、无冲突后 mergeExecutions、成功后更新本地状态 | 当前 duplicate 全部命中可直接返回，无 practice/date gate。新导入需先服务端 preview/choice，再原子 commit，commit 后权威重新读取。 |
| bootstrap | [StorageBootstrap](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-contracts.ts:29) 为 schemaVersion/migration/executions/importHistory/instruments/reviews/reviewStates/tagSuggestions/marketDataJobs/settings；[GET route](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/api/storage/bootstrap/route.ts:13) 调 store.getBootstrap；[client](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-http-client.ts:133)，L135、159 | 当前无 practices/revisions/legacyAttention；Recall 文档独立加载。workspace L2514–2618 按旧字段装载和必要时迁移浏览器旧状态。不能只改类型而没有服务端和消费方。 |
| 合并写入 | [MergeTradeDataInput](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-http-client.ts:52) 为 executions、instruments?、importHistory?、replaceExecutionIds?；`mergeExecutions(...): Promise<ExecutionMergeReport>` L139/163 → [PUT trades](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/api/storage/trades/route.ts:32) → [mergeTradeData](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-store.ts:1246) | 可复用验证、写 execution 的受保护证据机制和事务 helper；现有事务只写 instruments/executions/history，不写 practice/revision/Recall，也没有 practice CAS。直接套用旧 replace 会删除旧成交，不能代表不可变版本。 |
| 修订 | [repair client](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/trade-repair-client.ts:10) GET history(instrumentId)、POST revise；[route](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/api/storage/trade-revisions/route.ts:8) → [reviseTrades](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-store.ts:1280) | 可借鉴 request-id 幂等、full-record before CAS、expectedScope 检查（L1309–1349）；scope 实为账户+标的，不是多标的文件版本，未原子对账 Recall。 |
| 旧 review repository | [ApiEpisodeReviewRepository](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-repositories.ts:139)，L139–150 从 bootstrap.reviews 按 episode.id 取/写 | 保留旧 episode 键和旧内容；新的练习卡不能无来源复制旧 completed。 |
| Recall client/UI | [repository](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/recall/repository.ts:53)，L53–97 GET episodeId、PUT document/expectedRevision/finalize；[RecallWorkspace](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/components/recall/recall-workspace.tsx:1525)，L1525–1562 按 episode.id 加载再 reconcile；workspace L6099 传 selectedEpisode | 新 practice/pair target 是适配层工作；不能改旧 episodeId 后期待旧文档自动可见。BT06 的阶段、市场/执行双 cutoff、future visibility、viewport 和返回来源由 TL20-D06 定义/验收。 |
| Recall server | [API](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/api/storage/recall/route.ts:28) GET；L70 PUT；[server](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/recall/server-repository.ts:117)，L117–195 在需权威 episode 时从全部当前 executions 重建，然后 CAS 保存及投影 | 不能无视 currentEpisode 的现有 target 假设。新 target、证据摘要、legacy binding 必须与 writer/reader/status 投影一起适配。 |

当前 `withSqliteTransaction(database, run)` 在 [db/sqlite.ts](/Users/zhoulin/.codex/worktrees/25db/TradeReview/db/sqlite.ts:117) 用 BEGIN IMMEDIATE / COMMIT / ROLLBACK，可复用其机制。`initializeSqlite` 对传入的内存句柄应用真实迁移；本次没有调用 L88 的默认 `openSqliteDatabase()`。

### 解析和去重的已证实损失

[活跃 parser](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-simulation.ts:315) L315 起虽取得物理源行，但 L323–338 无效行 continue；L341–343 重复 tradeId+role continue；L352–356 未成对交易只留诊断/计数；L359–381 还有配对校验及日期歧义排除。输出 L407 的 records 只含接受 executions。signal 和完整原行没有写入 execution，源“大小（价值）”也未作为完整原字段保留；exit 侧报告不等于每行全字段。

[reimport](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-reimport.ts:24) 的关键字段包括 platform/fp/market/symbol/tradeId/role/sourceTimestampText；L154 的财务核心只比较 side/currency/qty/price/fee 和双方都有的 gross/net，不比较完整 sourceReport。L310 起 fallback、L343 起 key multiplicity 检查保护局部重复，不等于全文件语义比较。底层 [execution reconciliation](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/execution-reconciliation.ts:82) 又受 simulation scope/run 等约束。不得将此现有行为写成“已经支持批准的语义重复”。

另有当前多范围技术限制：[mergeExecutionsInTransaction](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/sqlite-store.ts:1728)，L1728–1737 把同 fingerprint 的不同 instrument 视作 Simulation context conflict。这是实现限制，不能替代 TL20-D04 的产品决定。

## 四类合成记录：逐字段映射与兼容结果

所有值为脚本手写的虚构数据。完整输入见 [synthetic-input.json](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-input.json)，10 项输出见 [synthetic-results.json](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-results.json)。

| 字段/关系 | 完整日期证据 completeDate（S01） | 缺日期 missingDate（S02） | 仅旧 run oldRunOnly（S03） | 已有人工作品 manualWork（S08/09） |
| --- | --- | --- | --- | --- |
| account / instrument | TV canonical account；CN-SH:600000 | 同左 | 同左 | 同左 |
| executions | dated-entry buy100、dated-exit sell100；price10 fee0 | missing-* 两笔，数量/价格同左 | old-* 两笔，数量/价格同左 | 引用 dated-*，使用实际 episode builder |
| 历史时间 | 2022-01-03 / 2022-01-05，07:00Z；sourceTimestampText 同日期、date-only、Asia/Shanghai | 同左 | 同左 | snapshot/cursor 指向这两笔历史证据 |
| fileName / fp | not-an-identity.csv / run-A（history 另存 SSE_600000_2026-09-26.csv） | SSE_600000.csv / run-A | fileName 留存，fp 删除 | 不从名字重建文档身份 |
| current / legacy run | simulationRunId=run-A；无旧 run | simulationRunId=run-A | 仅 source.run=legacy-run，删除 current run | 原始当前 run 留存 |
| batch/history | source.batchId=import:run-A；history importedAt=2026-10-20，历史范围另存 | import:missing；无 practice date | 直接插入内存旧形状行验证 read contract；非通过当前 writer 伪造兼容 | 人工作品单独存 recall_documents，不在 import history |
| 实际练习日期 | **外部合成确认输入** value=2026-09-26；不是从文件名推断，也不是现有 schema 字段 | null / 未知 | null / 未知 | 不能从作品创建/完成时间推回 practice date |
| 现行读写结果 | schema14 中 executions/history/batch 正常回读，但没有承接 suppliedDateEvidence 的声明字段/消费者 | 当前 writer 接受两笔；证明它没有新合同的日期完整性闸门 | 读回 source.run；专用 helper 得 legacy-run，通用 scope 得 simulation:unknown；再次 merge 被 Invalid simulation evidence 拒绝 | 实际创建、保留、完成、保存再读取：revision1、completed、3 snapshots、Text note；不是仅构造一个 JSON 样本 |
| V2 安全映射建议 | 日期证据可作为候选输入，仍不能据既有行自动认定 practice；不可宣称当前已持久化该日期 | 留在只读待核查/暂存草稿，不能进入新正式练习的“未知日期”卡 | 把旧 run 当兼容证据留存；不自动升格为 practiceId 或补 current run 写回 | 保留旧 episodeId、execution refs、draft/formal/全部投影；有歧义只标需确认，不迁移或删除 |

补充反例的实测结果：

| 检查 | 实测结果 | 含义 |
| --- | --- | --- |
| S04 跨文件 run | file-A 的 buy100 + file-B 的 sell100 生成 **1 个 closed episode**，episode 无 run | episode 不能充当 practice。 |
| S05 人的回合 vs 归零段 | buy100、buy50、sell80 后 1 个 open episode/rem70；再 sell70 后 1 个 closed episode/4 executions | 假设由外部证据确认两次 sell 分别是人的动作，批准规则应为 2 主动平仓回合、3 内部分摊；现 episode 计数无法表达。此检查不证明动作识别政策。 |
| S06 同字节 vs 重排 | 相同 bytes fp=bfeb66cbfafc8b63：duplicates2/accepted0，保留原对象；重排 fp=caa1bf7b1f8df28b：duplicates0/accepted2，merged4 | 同一语义源行重排后现逻辑可重复纳入。 |
| S07 保留重复/未配对 | 原2行、加重复进场3行、加不同未配对进场3行，三种输出均只有2 executions；有 duplicate-role / incomplete 诊断 | 原始出现次数与未配对内容已丢失；计数诊断不能重建完整 multiset。 |
| S08 人工作品不变 | roundtrip completed、3快照、Synthetic human note，正常 unchanged 对账仍 completed | 证明当前保存/重载链和不变 ID 对账。完整文档见 [manual document](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-manual-document.json)。 |
| S08 去掉 exit | needs-confirmation；removedIds=[dated-exit]；3快照和 lastCompleted.completed 均保留 | 有现成保留人工内容/正式版本的机制，不能借升级清除它。 |
| S08 同 ID 改 exit price | status 仍 completed、stale=false | [reconcileRecallDocument](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/recall/document.ts:502)，L502–565 只以 ID 增删判断 changed；新版本需内容证据摘要/范围影响判定。 |
| S08 改 opening price | 重建 episode ID 改变；直接 reconcile 抛 document and episode ids do not match | 新旧 key 不可强制移植。旧 UI 按新 ID 加载时可能新建空文档；旧文档仍在，但没有 practice 映射。 |
| S09 实际 trade revision | 原请求重试幂等，historyCount1；Recall revision仍1/completed | 交易修改与 Recall 独立 CAS；当前不存在跨两者的原子失效/确认流程。 |
| S10 失败注入 | helper 事务中插入批次后 throw injected，前后 batchCount均1 | 只证明现有事务 helper 回滚；未证明候选 practice migration/事务已实现。 |

## PROPOSAL：供后续实施审查的精确声明

[candidate-contracts.ts](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/candidate-contracts.ts) 全文为 **PROPOSAL ONLY**，未被产品导出；strict standalone typecheck 通过仅表示声明自洽。没有 schema migration、HTTP handler 或实现，也没有把这些计划类型记作现有事实。

| 声明位置 | 候选职责与不变量 | 提供方 → 消费者 |
| --- | --- | --- |
| L5–17、29–46 | 独立品牌 PracticeId/RevisionId/ArtifactId/RecordId/ActionId/AllocationId 等；Practice 有 currentRevisionId、独立 metadata `version`、date evidence、sequenceToken；Artifact 保存 sha256/length/原名/bytes ref/parserVersion | 新 practice storage → 新 library/import flow；源文件 ID 与稳定练习 ID 分开。sequenceToken 的分配域仍待日期/多范围政策。 |
| L20–28 | DateDraft resolved/unresolved；DateEvidence value/origin/evidenceReference/confirmedAt；正式 active Practice 不能为 unresolved | 日期识别/明确人工输入 → import plan / changeDate；confirmedAt 是记录验证/确认时刻，不能替代练习日，也不宣称 filename 必须人工重批。 |
| L47–76 | CanonicalField、完整 NormalizedSourceRecord/File；`validateCompleteNormalizedFile(input: unknown): CompleteRecordValidation`；`compareCompleteRecordMultisets(before,after): ContentComparison` | 独立完整源行投影/验证器 → 纯比较器 → preview 候选证据。类型的 complete:true 不是可信声明，必须有运行时校验和来源覆盖证明。 |
| L78–97 | RevisionRecord 留 rawCells/sourceRow/state/0..many executionIds；PracticeRevision 不可变，含 parent/artifact/完整 records/历史范围/importedAt/legacy refs | 新版本存储 → 当前版本统计、历史版本只读、dry-run；sourceRow仅版本内定位。state=invalid 仅表达证据留存，不自动授权无效内容成为正式交易。 |
| L98–125 | HumanAction 的证据为明确 order reference 或用户确认；ActiveCloseRound 与 PairAllocation 分离，后者显式开/平原成交引用、quantity、开/平分摊费；PracticePairRound 限 practice+revision | 动作识别/配对领域服务 → live rounds 与 practice内配对；准入、合并、拆分及费用算法待上游，不能由类型默许。 |
| L126–157 | ReviewTarget 区分 practice+revision/pair 与 active-close-round；LegacyReference 保留 episodeId/executionIds/docRevision/digest；ReferenceDisposition unchanged/needs-confirmation/confirmed-binding；`inspectLegacyPracticeCandidates(snapshot): LegacyDryRun` | 独立只读清单工具 → 人工核查；candidateKey 是报告定位，不是迁移身份。dry-run 摘要不能代替完整备份 payload。 |
| L158–203 | `PracticeRepository.previewImport/commitImport/getPractice/getRevision/changeDate/getBootstrap`，输入/输出完整声明在文件；commandId、planId、snapshotDigest、expiry、choice、reference confirmations 显式 | 新服务端 provider → HTTP adapter → workspace / library；当前 SQLite client 不具备这些方法。候选不冻结新 URL 名称，须由集成接口负责人同步 INTERFACES。 |

并发与日期保护必须同时满足：`Practice.version` 独立于内容 revision；changeDate 与 existing-practice update/open-duplicate 都检查 expectedPracticeVersion + expectedRevisionId。两次仅改日期不产生内容 revision 时，第二次必须冲突，防止覆盖第一次人工确认。候选 `ImportChoice.create` 才携带新 date；update 和 open-duplicate 没有写日期字段。**duplicate-open 是读旧练习的结果，普通 reimport 保持当前人工日期；只有显式 changeDate 可改变已存在日期。** 文件日期与手填冲突的交互仍待 HITL，不能靠“最近输入覆盖”解决。

### 候选原子事务范围（尚未实施）

1. preview 不改正式表、不分配正式编号、不写 Recall。产生有期限 plan：保留源字节及完整规范化证据摘要、日期来源、候选多重集差异、引用影响和所读 snapshotDigest；有 blocker 不给可提交计划。文件暂存的生命周期/隐私保留规则需后续明确。
2. commit 在 **同一连接 BEGIN IMMEDIATE 内** 先校验 commandId 的已存请求/结果（相同请求返回原结果，不同请求冲突），重读计划、源内容完整性、日期闸门、snapshotDigest、Practice.version/currentRevisionId，和所有将改变的引用的 documentRevision/digest。preview 的客户端布尔值不是授权或一致性证明。
3. duplicate-open 不产生 revision、不增加样本、不分配新编号、不改日期或旧 Recall。新建/更新由用户 choice 决定；更新保留 practiceId/已确认编号和日期，创建独立不可变 revision、artifact/全部原记录与版本内 execution 映射，最后更新 currentRevisionId/version。不能用旧 merge 的“删前版 executions”代替版本历史。
4. 事务同时写幂等结果、当前版本指针、导入历史/来源映射、可核验的内容影响摘要和新引用 disposition。统计仅消费 current revision，不累加新旧版本。受影响的完成状态必须有原子可见的 needs-confirmation 覆盖层或经 D06 验证的完整 Recall writer 适配，不能让新证据配旧 completed 暂时流出。
5. 未经确认的旧 Recall 不改键、不删 draft/finalized、不改 decisions/snapshots/drawings/retained bundles 或投影。确需变更绑定/文档时，所有关联图与它们的 CAS 必须在同一顶层事务内；现有 Recall save 自带事务，不能直接嵌套 BEGIN，应抽取已验证的 transaction-aware provider。若接口未完成，拒绝此类 commit，不先写交易再补引用。
6. commit 成功后权威 rebootstrap/getPractice，验证 current revision/日期/编号/引用状态；前端再刷新。任一步异常整笔回滚。异步文件字节保留与 SQLite 的一致性要采用先安全暂存、事务内确认证据 ref、失败清理无引用暂存的策略；不可宣称普通 DB 事务能回滚文件系统。

上面定义了技术一致性要求，没有替用户决定多范围拆分、日期冲突、动作识别、配对或旧引用迁移政策。

### 只读 dry-run、旧引用兼容与回滚候选

- dry-run 只针对用户另行授权且范围明确的快照运行。本任务没有查看真实存量，所以不能报告“真实旧数据足够/多少缺日期”。清单应包含 schema/source checksum、全部原执行/批次证据与 orphan 情况、旧 reviews/reviewStates、Recall draft/formal/所有投影的计数与 digest；保留不可变原 payload，以 executionId/episodeId/documentRevision 追踪。缺失原文件、缺日期、run冲突、成员歧义、人工引用一对多都输出 blocker，不自动定案。
- LegacySnapshot 候选类型是分析输入摘要，不是完整备份格式；引用 payload 和关联投影要另有完整受控快照。候选分组仅供核对，不为历史文件分配 practiceId。未知日期旧数据保持旧可读入口或隔离待核查清单；不得把旧样本偷偷排除导致统计/入口变化，也不得放入新正式“未知日期练习”列表。实际过渡 UI 需独立范围批准。
- 对确认 unchanged 的引用保留旧文档、键和版本；对 removed/ambiguous/scope/content-changed 项保留原作品和 lastCompleted，显式 needs-confirmation，提供旧证据只读回看。只有有独立确认记录并检查源/目标 CAS 的 binding 才能关联新 target；不得凭时间价格、相同收益或文件名猜对应关系。
- 部署前迁移需独立备份/恢复演练与全图校验；本次仅内存 schema14 和 helper rollback，**生产恢复未验证**。失败前 commit 用 SQL rollback；已提交后的业务撤回用保留历史的补偿 revision/显式 binding 变更，不能盲目还原备份覆盖此后新写的人工作品。备份恢复仅在明确停写和对账方案下执行。失败演练须比较原始字节/数量/金额/引用图及 draft/formal hash，不能只看行数。

## 最小安全实施部分：完整记录多重集纯函数

**可以独立实施，但输入必须是“已经完整、已经规范化”的源记录；当前 execution parser 输出不够。** 纯比较器只计算相同 canonical row 的出现次数，比较两个计数表，输出 equal 和差异；行顺序/字段排列顺序不参与比较，出现次数参与。用确定性无歧义序列化后的完整行内容作 map key，避免把哈希碰撞当等价。不接数据库，不读 import history，不分配 ID，不判断是不是旧练习，也不触发重导入写入。比较结果只是内容证据；账户/标的/练习日等候选筛选与用户 update/new choice 仍在其外。

当前支持的中文 TradingView CSV，完整比较的最低列范围是 [REQUIRED_HEADERS](/Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/import/tradingview-simulation.ts:27)，**17 列全部**：

| 范围 | 必须进入完整行的列 |
| --- | --- |
| 文本标识/角色 | 交易编号、类型、信号（保留其字段身份和值；不转作稳定业务 ID） |
| 历史日期 | 日期和时间（当前支持 YYYY-MM-DD；规范化校验，不取导入/实际练习日替代） |
| 12 个数值列 | 价格 CNY、大小（数量）、大小（价值）、净损益 CNY、回报 %、手续费 CNY、有利波动 CNY、有利波动 %、不利波动 CNY、不利波动 %、累计损益 CNY、累计损益 % |
| 整数列 | 持续时间（K线） |

每行 scope 的 accountId/instrumentId/nature 也须明确且有效，不能在单标的 parser 外推多范围政策。source filename、byte fingerprint、物理 row、sourceOrder、importedAt、数据库 executionId、sourceRun 等来源/定位字段不加入“业务内容等价”字段；它们另行保留作证据。PracticeDate 不属于历史 CSV 行内容，单独作为候选范围和受保护 metadata。字段白名单以该 normalizationVersion 固定；未来新增列不能静默丢弃后仍断言全文件等价，须完整覆盖并升版本，或返回 unsupported/不允许判等。

纯比较器可先对严格的 canonical input 实施，不需要在该函数里猜“哪些格式等价”。生产 normalizer 后续可复用现 parser 的 UTF-8/BOM/CSV读取、文本 trim、Decimal 规范数字、历史日期解析作为**待校验基础**（parser L51–97）；这些片段本身未证明跨格式全覆盖，不能顺便扩张大小写、Unicode、空值/0、未知列或不合法日期的等价规则。特别是 allowBlank→0 不能直接推广给完整源字段，否则会丢失差异。对非法/不支持值，必须保留原证据且失败关闭，不能排除该行后宣称 complete。

**最小实际缺口 FULL-CONTENT-001**：在分组、角色去重、配对和排除之前，暴露全部源行的完整投影；证明每一源行恰有一次 occurrence，保存重复次数、未配对行和未能正常化的原证据；明示未知列/空值/异常值处理。当前内部 TradingViewRow 尚可在解析前获得，但公开 `StatementParseResult.records` 及已存 executions 无法恢复被丢字段。若只有旧 executions 而无完整原文件，不能安全构造 CompleteNormalizedFile，不能判“完整文件等价”。这不是要求补读业务库；本次没有补读。

可交给后续最小切片的边界：实现严格运行时 canonical schema 校验与 multiset comparison，并使用全手写 canonical fixtures 验证重排等价、重复次数改变不等、未配对行改变不等、信号/报告列改变不等、空值/未知字段不被吞掉、输入不变性。它只能标为“比较引擎完成”；未接完整源行投影前，不能标为导入语义去重已落地。本次未实施该函数，也未把此候选转成已批准政策。

## HITL / 集成阻塞和本次不能关闭的事项

| 稳定 ID | 未解决问题 | 归属/下一步 |
| --- | --- | --- |
| LEGACY-DATE-001 | 真实旧日期证据是否完整、多候选/多日/日期与手填冲突、编号冲突；本次没有真实样本，不能填值 | [TL11-D02](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v11-design-decisions/issues/02-practice-names-dates.md)。已批准的“缺日期先补/手填受保护/不以历史或导入时间替代”不用重投票；未决分支回 HITL。 |
| LEGACY-IDENTITY-001 | 既有批次/run/行号不足以普遍证明独立练习或稳定版本；相似来源不是自动合并证据 | TL20-D01 后续独立、明确授权的数据核查；任何历史重分类要有可审查 dry-run，不接触业务库补猜。 |
| FULL-CONTENT-001 | 公开 parser/旧存储缺全部原行，无法完整语义判等 | 技术可拆为完整行投影+纯比较器；字段范围见上，不能用 accepted executions 充数。 |
| ACTION-001 | 明确订单参考的可信来源、人动作合并/拆分、一个动作多 fills、缺证据处理 | [TL11-D07](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v11-design-decisions/issues/07-action-identification.md)。不自动按时间价格聚类。 |
| MULTISCOPE-001 | 单文件多账户/多标的如何分组、日期/编号/跨范围统计，当前单 fp 限制需适配 | [TL20-D04](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/issues/04-multi-scope.md)。候选 arrays 只预留信息，不表示政策已定。 |
| LEGACY-REF-001 | 哪些旧 episode/decision/snapshot/formal 可对应新 practice/round、内容变化如何精准失效 | TL20-D01 + [TL20-D06](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/issues/06-replay-adapter.md)。保留原图，不强制迁移；新 target/replay 与返回链需独立集成验收。 |
| PROD-VERIFICATION-001 | 新 schema、迁移、事务全图回滚、恢复、真实来源完整性未实施/验证 | 后续开发和隔离库验收；本次不能用内存 helper PASS 代替。 |

本次可接受为技术事实的部分是：身份分层、原 evidence 与人工图保留、日期三义分离、当前调用链/缺口、完整 multiset 比较的纯函数边界。其余候选待 root/独立审查及所属 HITL 决策；不因本报告的技术声明而自动解决。

## 验证命令、结果与轮次

在工作目录运行（运行时由 [native-environment](/Users/zhoulin/.codex/worktrees/25db/TradeReview/conf/native-environment.json) 固定）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-check.cjs
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler .scratch/trading-library-v20-development/evidence/decisions/TL20-D01/candidate-contracts.ts
```

冻结后复跑必须使用独立目录，避免覆盖 recordedAt 和原始证据。先 `mktemp -d /tmp/tradereview-tl20-d01.XXXXXX`，再把它返回的绝对路径替换下面的占位路径：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-check.cjs --output-dir /tmp/tradereview-tl20-d01.REPLACE_WITH_FRESH_DIRECTORY
```

源码根始终由 harness `__dirname` 定位，改变 output-dir 不改变被测源。脚本写入 synthetic-input/results/manual-document 三个 JSON；所有 SQLite 打开均有 `location === ':memory:'` 断言。内存转译只为执行源码，不构成全项目 typecheck。

| 核查 | 已执行结果 |
| --- | --- |
| 合成 harness 默认输出 | exit0；Node v26.0.0 / SQLite3.53.0；10 PASS / 0 FAIL；仅3个内存句柄 |
| 增加 output-dir 后复验 | 显式输出到本证据的 rerun-output；exit0；相同10 PASS / 0 FAIL；原默认证据未覆盖 |
| 候选 strict standalone tsc | exit0；无输出。仅候选声明和其类型依赖，不是产品全项目验证 |
| source manifest | 最终45个源/文档 SHA-256、行数、HEAD；只读源文件。初次清单有2个误列路径而失败，纠正到 app/lib/storage 后通过；未生成虚假缺失内容 |
| 报告/证据最后核查 | exit0；67个绝对文件链接均存在，0 missing；原结果及独立输出结果均10 PASS；recordedAt不同，原成功结果未覆盖 |
| 产品 UI/真实数据/迁移恢复 | NOT APPLICABLE：本次纯事实/文档，无产品更改；没有因此宣称后续 UI/DB 门禁通过 |
| root 的基线27测试 | root另行记录，本执行者未重复计为自身测试或独立验收 |

完整失败与修复历史保存在 [verification-rounds.md](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/verification-rounds.md)；初始5 PASS/5 FAIL结果仍留 [synthetic-results.round-1.json](/Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/decisions/TL20-D01/synthetic-results.round-1.json)。SYN-HARNESS-001 与 SYN-FIXTURE-001 各1轮修复复验，initial discovery不计修复轮；未到5轮。没有抹掉初始失败，也没有第6轮重试。

## 自身产物与冻结范围

本报告交回后冻结供独立审查；其他参与者的 review-preflight.md 不计为本执行者产物。自身文件均位于本目录：

- report.md（本报告）
- source-manifest.json（源版本/哈希）
- candidate-contracts.ts（候选声明）
- synthetic-check.cjs（内存合成验证器，支持显式 output-dir）
- synthetic-input.json、synthetic-results.json、synthetic-manual-document.json（原成功证据）
- synthetic-results.round-1.json（保留的初始失败证据）
- verification-rounds.md（稳定问题 ID、修复轮次与命令结果）
- rerun-output/synthetic-input.json、rerun-output/synthetic-results.json、rerun-output/synthetic-manual-document.json（output-dir支持的成功复验，不覆盖原证据）

独立 reviewer/协调者应另写验收记录；本报告不代写 Resolution、不更改 TL20-D01 状态，也不把尚未决定的日期、动作或多范围规则冻结为产品合同。
