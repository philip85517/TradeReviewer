# 当前模型、读写链路与预计算实验：静态证据

日期：2026-10-31。范围：候选数据库/视图模型的事实输入，**不是新模型批准、实现或产品验收**。

本轮只读源码、文档和既有实验报告，没有打开任何 SQLite 文件，没有调用会初始化数据库的模块，没有启动服务、运行测试或访问页面。源码基点为 `b49b17066fab4bea7270082ce07c7dfdfa9cc7d1`；工作树已有多份未提交设计/实验文件，下面引用的是当前文件内容，并非全部属于该提交。唯一新增文件为本文。

## 1. 先确定哪些是当前事实

|结论|性质与证据|
|---|---|
|当前声明的迁移是 1–18，旧数据库审查不能直接当作当前表清单。|源码事实：[迁移注册](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:699)。旧报告基于 14 次迁移：[旧基线](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/database-review/current-model.md:9)。本轮未验证实际数据库已执行哪些迁移。|
|数据库连接入口不是纯只读操作。|[连接](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite.ts:46) 会执行初始化及 import-history audit；[初始化](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-initialization.ts:15) 设置 FK/WAL、核对迁移校验和、执行缺少迁移。本文未调用它。|
|成交保存已有审核计划、版本校验、幂等回执与提交后读，不是直接覆盖一个 JSON 文件。|[写事务](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-changes-engine.internal.ts:218)、[准备的读快照](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-changes-engine.internal.ts:267)、[兼容写入口](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/sqlite-store.ts:1902)、[提交后读取](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-change-submission.ts:11)。|
|当前首页仍在读取来源后构造财务模型；实验预计算不等于产品已采用持久读模型。|[实际首页读取链](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/trade-review-workspace.tsx:2345)、[纯计算视图](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-view-model.ts:102)。下面的实验均单独标注资格。|
|财务事实的完整性、枚举完整性、来源身份、页面展示和数据库版本是不同概念。|[快照输出的 coverage not-proven / amounts not-evaluated](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:140)、[财务来源合同](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/source-contract.ts:6)、[生命周期完整性门槛](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-source-model.ts:100)。|

## 2. 持久事实、表及字段

下表是候选模型可复用的代码定义，不是实际行数、数据质量或业务完整性检查。

|现有存储/粒度|关键字段与约束|模型含义及边界|
|---|---|---|
|`instruments`，每标的 ID|`id` PK；`symbol,name,market,currency`；`metadata_json`；`localized_name_json`；时间戳。[建表](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:26)、[本地化名称迁移](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:190)|稳定标的身份与展示资料分开考虑；名称更新不属于下面的成交簿版本覆盖范围。|
|`executions`，每成交 ID|`id` PK，batch FK set null，instrument FK restrict；`account,side,executed_at,quantity,price,fee,currency,evidence_json`；后加 `trade_nature,simulation_run_id`。[建表](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:49)、[性质迁移](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:183)|金额/数量是 TEXT；账户/费/币种可空。候选表不能把缺失、未知、非法值统归零，也不能把 simulation 与真实交易混在同一组。|
|`import_batches`，每导入批次|`id` PK；可空唯一 `source_fingerprint`；source name/type、imported time、record count、reconciliation/evidence JSON；性质/模拟 run。[建表](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:37)|批次是来源证据/历史，不等于一条成交或账户身份。|
|`trade_revisions` 与交易审核计划|revision 进入成交簿版本；`trade_change_plans` 保存 policy、expires、body/digest、receipt/choices digest；`trade_change_receipts` 每 plan 唯一；`trade_change_requests` 每 request ID 唯一。[版本依赖](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:561)、[计划/回执](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:796)|保留审核/提交证明；不能用“页面已刷新”代替已提交回执，也不能因丢响应就重复创建请求。已消费计划与回执有不可变约束。|
|`source_materials` / `source_material_versions`|材料 current-version 指针；版本含 supersedes、parser version、source kind、locator、fingerprint、scope、diagnostics、content、legacy batch；版本归属约束。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:566)|材料身份、材料版本、解析观察与成交是独立实体。候选计算需保留追溯到哪一版本/解析规则。|
|`source_observations` / `source_execution_links`|观察 `identity_status=located/unresolved`、locator/raw JSON、original account；观察与成交多对多 link reason/time。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:590)|有原始内容不代表已定位稳定身份。旧数据迁移保守，不用名称/金额猜身份；版本、观察和链接禁止改删。|
|`source_material_account_mappings`|材料＋original account 联合键；canonical account、reason、audit ref。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:609)|是有来源范围的映射，不是全局账户主表。账户标签也不是账户 ID。|
|`execution_fact_states`|每 execution ID 一行；active/withdrawn、revision、reason、recorded；缺行解释为 active。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:618)|withdrawn 不等于删除原始成交；读模型须保留撤回审计并排除其活跃贡献。|
|`daily_candles` / `market_candles`|日线键 instrument/date/adjustment；区间键 instrument/interval/timestamp/adjustment；OHLCV TEXT；provider、provider symbol、currency、fetched time；区间另有 knowledge time。[日线](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:80)、[区间](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:92)、[来源字段](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:164)|日历日、实际时间、复权模式、来源及可知时间不能合并为一个“最新价版本”。|
|`coverage` / `interval_coverage` / `provider_symbols` / `market_data_jobs`|范围 start/end/details/update；provider 映射及唯一性；job 状态/progress/error。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:105)|覆盖与值分开，任务成功也不直接证明指定计算边界有合法行情。|
|`reviews`、`recall_*`|legacy review 按 episode ID 保存 JSON；recall 有草稿/正式版本与独立工作区关系。[legacy](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:67)、[recall 建表段](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:193)|episode 是派生交易过程，不应反推 execution 身份。复盘资料不全等于成交不全。|
|`app_settings`|key PK、JSON value、updated time。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:157)|现金基准、临时本金、汇率快照等分别存入 settings；不是完整经纪商资金流水账，也没有在本次 schema 中发现通用账户主表。|
|现金/本金/FX 设置|[现金基准读写](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/cash/cash-baseline-store.ts:140)、[临时本金历史](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/principal/account-principal-provisional-store.ts:124)、[FX snapshot key](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/fx/storage.ts:11)、[参考资金 API](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/api/trading-room/reference-capital/route.ts:9)|候选资金收益率必须先明确资金事实资格；不能直接把参考资金/临时本金当完整现金流。|
|`import_history_*`，派生审核证明|audit state 绑定 rule、database identity、epoch、generation、ready、trigger digest；proof/membership/material refs/dirty 分表。[定义](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/import-history-audit-schema.ts:1)|这是派生证明，不重写原计划、回执、材料或历史；epoch 轮换也不会把未就绪 generation 标为 ready。|

## 3. 现有版本、读取与写入合同

### 3.1 成交簿版本有明确覆盖边界

`BookVersion={databaseId,epoch,sequence}`；缺失或损坏时失败，不能退回版本零。[类型与校验](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-book-version.ts:4)。恢复/克隆需要显式轮换 epoch，常规初始化不轮换：[恢复边界](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-book-version.ts:60)。候选 cursor/cache 不能仅以 sequence 判同一份数据。

当前触发器覆盖 instrument 的 ID/symbol/market/currency、成交业务字段、batch、revision、TV alias、来源谱系和 fact state；忽略成交 evidence 根 `accountLabel`，也没有把 instrument name/metadata/localized name、行情、FX settings、reviews/recall 纳入该版本。[触发器工厂](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:513)、[覆盖字段](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:544)、[谱系触发器](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:691)。这是“不能单独代表整页全部依赖”的范围事实，不是本轮证明产品存在旧名称缓存缺陷。

### 3.2 成交读取已保留前置依赖，但首页仍重组全包

- `StoredTradeFact` 保留原始 null 字段；读取复制 executions/instruments、fact states 和 source rows：[复制合同](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:15)。
- `readStoredTradeSnapshot` 在 deferred transaction 中复制，提交后进行材料化/摘要：[事务边界](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:147)。纯材料化区分 withdrawn、展示期间与所有前置成交；期间筛选不丢弃成本依赖：[依赖/展示分流](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:108)。
- Cursor 绑定 policy、完整 bookVersion、selection digest 和 offset；exact/atLeast 都要通过版本规则：[cursor](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:66)。`receiptId/knownAt` 是本次读观察，不是持久业务版本或历史市场可知时间：[回执产生](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/stored-trade-snapshot.ts:140)。
- 首页来源在同一 transaction 中复制成交、bootstrap、review/recall 摘要，提交后以 1,000 条为单位材料化所有页，再组装整包：[首页来源读取](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/homepage-source-snapshot.ts:22)。这个循环不是浏览器按需取下一页。
- bootstrap 与 homepage-source 当前均走该来源集合：[bootstrap API](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/api/storage/bootstrap/route.ts:6)、[homepage-source API](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/api/storage/homepage-source/route.ts:21)。客户端成交读取也会循环至全部页：[客户端](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/sqlite-http-client.ts:199)。
- canonical 编码、内容 digest、wire clone、页版本/selection 一致性检查保护载荷合同；不自动证明经济含义或生命周期完整：[读合同](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-read-contract.ts:18)。

### 3.3 保存成功与读模型就绪必须可区分

准备阶段只在读锁内复制，匹配/hash 在 commit 之后执行；提交事务使用 `BEGIN IMMEDIATE`、写入和 audit 一起 commit，失败 rollback：[引擎](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-changes-engine.internal.ts:218)。旧 `mergeTradeData` 也经 prepare/commit，replacement 需版本化计划：[兼容入口](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/sqlite-store.ts:1905)。

前端已有 `prepare-required/outcome-unknown/saved-awaiting-read/retry` 状态。重试先查同一 request ID，已取得保存回执后读取 `atLeast receipt.bookVersion`；读失败不否定保存成功：[提交状态机](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/trade-change-submission.ts:5)。候选异步重建应延续这个区分。

名称修改是单独事务：[名称写入](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/sqlite-store.ts:1934)。行情、区间行情和 settings 也有独立写入口：[市场数据写入](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/storage/sqlite-store.ts:2001)。不能仅在成交导入路径加一个任务，就声称整页依赖都有更新通知。

## 4. 当前计算模型可复用的语义

|对象|当前代码事实|候选模型必须保留的区别|
|---|---|---|
|来源取得|首页同时取得 homepage-source 和 FX，之后按 instrument 读取市场 repository，构造 entries 再计算。[实际链](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/trade-review-workspace.tsx:2345)|成交来源的事务不覆盖随后外部/独立读取的行情、FX；不能给它们虚构同一数据库原子快照。|
|来源 revision|trades/metadata/quotes/fx 四项是当前内容 fingerprints；financial acquisition 目前传 `fxObservations:[]`、`lifetimeSourceCoverage:[]`，另有 current FX。[构建](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-acquisition.ts:151)|内容摘要不同于持久更新计数；空历史资格不能默认为完整。|
|完整性|all 范围要求每业务组的 lifetime coverage 完整、涵盖 inception、有 evidence、knownAt/through 满足 asOf 等；否则边界未知。[规则](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-source-model.ts:100)|枚举全部当前存储行不等于持仓从起点完整；不能以最早已见成交猜开户/期初。|
|业务组|account＋instrument＋nature＋simulation run；持仓关联另外核对 settlement currency。[分组](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/reviews/homepage-v25-performance.ts:123)、[持仓关联](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/holdings-model.ts:104)|账户名/标的名不做身份键；真实/模拟及不同模拟 run 不合并。|
|准备计算|`prepareHomepageV25FinancialSource` 克隆输入、绑定 revisions 和 policies，构建 ledger/quote index/fee facts。[准备](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/reviews/homepage-v25-performance.ts:648)|prepared handle 背后是内存 WeakMap，并非可直接写盘重启的序列化缓存：[句柄/WeakMap](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/reviews/homepage-v25-performance.ts:490)。|
|时点/边界|view stamp 绑定 source/revisions/policies/generation/selection/asOf/currency；日期输入转换到上海时区日末；边界有 day/instant、future/source-missing/value。[view 校验](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-view-model.ts:16)、[asOf](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-view-model.ts:74)、[boundary](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/reviews/homepage-v25-performance.ts:482)|业务日期、执行时刻、asOf、knownAt、fetchedAt、publishedAt 分开；时钟推进可能使无新成交的结果也变化。|
|财务输出|endpoint 分 realized、opening/closing unrealized、change、net、lifetime、market value、fees；fee facts 有发生/可知/归属/来源；quote、FX 各有 coverage。[合同](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/lib/reviews/homepage-v25-performance.ts:466)|不能只存一个 pnl 数字和 boolean 完整；收益额、收益率、跨币种合计不应未经合同证明直接累加。|
|不可用|unavailable total 保留 native money/coverage，但合计为 null；缺完整边界时不凭空补时间序列。[输出](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/financial-view-model.ts:87)|missing/invalid/unsupported/pending/unknown 保留原因；null 不能填 0。|
|持仓页面|rows 含数量、成本、quote、PnL 各自状态/原因、原币/报告币、证据；只剔除已知零数量，保留未知；汇总来自完整 current facts。[字段](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/holdings-model.ts:14)、[行与汇总](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/homepage-v25/holdings-model.ts:134)|summary 的作用域是完整筛选集合，不是当前分页。分页、筛选、排序需要绑定同一 publication。|
|尚未接线|首页 history seed 明确 `not-wired`，reloadHistory 抛未接线；期间切换可重投影已接收 source。[状态](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/app/components/trade-review-workspace.tsx:2401)|不能把有合同/单测的历史计算接口描述为完整线上历史读取资格。|

## 5. 既有预计算实验：能证明什么

本轮只复核报告/原型设计，没有重跑；实验 PASS 的范围不能升级为产品 PASS。

|实验及最新资格|可复用事实|保留的限制/失败|
|---|---|---|
|真实冻结来源 A/B/C，run-02，**仅实验范围 PASS**|A 完整源包 p50 8,474.79ms/34,315,599B；B 同源完整校验后窄包 7,175.89ms/3,250B；C 预准备非财务事实 0.677ms/3,250B；首次准备 7,312.530ms。[结果](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/real-data-fact-experiment/RESULTS-RUN-02.md:29)|无 HTTP/browser/完整财务；7 个样本非独占、无 OS 冷缓存；新进程完整启动+身份+打开+读+退出 900.447ms，不能只报内部 4.001ms。[重启](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/real-data-fact-experiment/RESULTS-RUN-02.md:46)|
|source preparation profile，**已接受的诊断**|主成本含 materialize、canonical 编码/hash、解析/克隆；原始复制的中位数约 28ms，不能用它代表全部 SQL。[profile](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/source-preparation-profile/reports/approved-01-plain-report.md:23)|不证明 SHA 计算单独耗 1.1s；阶段中位数不相加；不含 HTTP/browser/完整财务，不是 1 秒完成。|
|source reuse，**局部复用验证**|三对 warm 后端样本优化后仍约 6.63–8.26s；窄化数据/复用部分计算不能自动消掉全链成本。[报告](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/source-reuse-experiment/reports/real-sample-01.md:5)|材料复用接口存在旧材料与新输入错配风险；产品来源会拒绝而 parser 可接受的漏 withdrawal audit 情形说明“摘要正确”不等于业务完整。[风险](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/source-reuse-experiment/reports/real-sample-01.md:25)|
|update-publication，**非财务增量实验 PASS**|实验十字段事实；expectedVersion CAS；同一事务 source/version/projection/summary/binding；同一 deferred 读包。两类合成单行变更增量约 3.8–4.0ms，对照重建约72–73ms。[设计](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/update-publication-experiment/DESIGN.md:9)、[benchmark](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/update-publication-experiment/benchmark/reports/run-review-approved-01/REPORT.md:13)|全局 summary 仍扫描全部 active，不是 O(1)；不是产品 importer、异步 prepared swap 或任意跨文件发布；未覆盖完整版本依赖。benchmark 未重跑 crash/并发；1 秒产品资格 NOT VERIFIED。[验收](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/update-publication-experiment/benchmark/reports/run-review-approved-01/COORDINATOR-ACCEPTANCE.md:4)|
|display-cache-restart，**两笔合成成交离线原型 PASS**|改 name/localized/accountLabel 时 fact version/digest 不变而 presentation digest 变；stale 拒绝、刷新后复用；独立子进程重启无 DML。[验收](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/display-cache-restart-experiment/COORDINATOR-ACCEPTANCE.md:4)|来源名称写与刷新是两个事务，中间允许明确 stale；每次读仍扫描/hash 来源，零 DML 不是零 IO；无产品 wire/性能/崩溃资格。[设计](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/display-cache-restart-experiment/DESIGN.md:22)|
|combined read prototype|cursor 绑定 bookVersion、facts/presentation digests、rules、code、scope、page size；summary/page/presentation 同一快照。[设计](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/combined-read-experiment/prototype/DESIGN.md:14)|仍是全重建；组合过滤可扫描；每次读扫描 active presentation；display-only 不升 fact version，不能据此防并发显示资料丢更新；要求所有 writer 使用发布边界，产品未证明。|
|combined measurement-06，**真实规模整次 FAIL**|虽然部分内部计时文件存在，退出码1、`MEASUREMENT_INTERNAL_ERROR`、最终 raw/FAILED 记录零字节，不能认证整次结果。[协调者记录](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/combined-read-experiment/reviews/measurement-06/REAL-RUN-COORDINATOR-20261029.md:25)|保留 FAIL；不能拿局部快读时长宣布可投产。|
|combined measurement-07，**仅 synthetic finalization 修复 PASS**|E01–E04 的记录完整化修复和独立复核通过。[最新报告](/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/combined-read-experiment/reviews/measurement-07/REPORT.md:9)|真实规模尚未批准/冻结/运行，**NOT VERIFIED**；不能覆盖 measurement-06 的真实规模 FAIL；无 SIGKILL/断电、产品 HTTP/UI 资格。|

## 6. 对候选模型的约束与建议（尚非当前实现）

以下是由证据导出的建模建议，具体表名、粒度、保留策略仍待候选方案和用户取舍。

|风险/问题|候选合同建议|依据|
|---|---|---|
|只用 `bookVersion` 标整页，遗漏展示、quote、FX、review、计算规则变化。|publication 记录完整依赖向量：数据库 identity/epoch、成交版本、相关展示/行情/FX/复盘内容版本、rules/code，以及 selection/asOf/reportCurrency；明确每项变更来源。|第3.1、4节；display-cache 实验。|
|后台慢任务用旧输入覆盖已更新结果。|在锁外复制后计算；发布时 CAS 验证完整依赖，旧任务拒绝或重排队，不能仅看 task 时间先后。准备中与 ready 显式分开。|现有 prepare-copy/commit 边界和 update-publication CAS。|
|源已提交但任务未入队；或保存成功后浏览器仍展示旧数据。|若采用异步任务，同一源事务记录可恢复的 dirty/outbox；保存回执与读模型 ready 分开，读取声明目标版本、就绪 publication 和 stale/pending 状态。|当前 saved-awaiting-read 合同；实验同步事务不证明异步投递。此处 outbox 是建议，未在当前产品首页路径验证已实现。|
|summary、新 page、旧名称/旧 cursor 混读。|同一 publication 原子发布所需投影/摘要/展示绑定；一次读取同一 snapshot；cursor 绑定依赖与 selection，版本变化时明确失效。|当前 read contract 与 combined prototype。单独文件的 WAL 不能推定跨文件原子发布。|
|历史补录/撤回只更新当天缓存。|先建立依赖传播：相关业务组的后续 ledger/边界/期间结果、生命周期判断及所有受影响筛选摘要均可能失效；不能假定只修改一个日桶。|前置成交成本依赖、withdrawn 状态、lifetime 合同。|
|预计算粒度照页面字段复制，形成重复金融规则。|优先区分不可变来源事实、规范化业务组/计算事实、页面投影与发布证明；持久化可序列化数据，不直接保存 WeakMap handle。财务资格必须另行批准。|现有纯计算准备源与实验非财务事实边界。|
|空值、覆盖不全或没有历史 FX 被包装为漂亮的数值。|存 value/status/reasons/coverage/evidence/currency/knowledge boundary；保留原币与转换资格；不得补零、猜期初或静默借未来行情。|现有 metrics/FX/fee/boundary 合同。|
|重启、恢复或升级后继续使用过期派生库。|持久 binding 含源身份/epoch、规则/代码、schema、依赖 digest；启动验证，不满足时 stale 或重建；原始事实始终保留。|BookVersion 恢复合同与 restart 实验的范围。|
|“预计算很快”被当作首页完整一秒结论。|分别计来源提取、首次准备/更新、发布、启动、首次查询、序列化/校验、HTTP/browser/渲染；冷/暖、重启、导入、修订分别给证据。|真实 A/B/C 与 measurement-06 FAIL。|

## 7. 未验证与交接边界

- **未验证实际业务库**：实际表/迁移状态、数据分布、空值/无效值比例、账户身份和长期覆盖均未知；报告中的 1,866 成交等只属于历史冻结实验，不是当前业务库统计。
- **未验证当前页面**：没有浏览器、HTTP、真实交互、刷新/返回持久化证据；本文不是 frontend control audit 或当前产品验收。
- **未验证完整财务预计算**：既有快速路线是非财务/合成增量范围；历史 FX、lifetime、每日边界、完整收益率和 Bars 资格不能据此通过。
- **未验证异步发布恢复**：生产写入钩子闭包、并发任务、丢唤醒、跨进程 CAS、真实 importer/修订贯通、崩溃/断电、跨文件原子性均需要后续独立证据。
- **未验证新候选资格**：本文不选择最终表名/分区/日快照粒度，不批准设计；已知 measurement-06 FAIL 与 measurement-07 真实规模 NOT VERIFIED 必须在后续文档保留。

建议父任务把以上事实链接映射到候选模型的每个来源字段、计算粒度、失效依赖和发布门槛，再单独列出需要用户决定的取舍。本文无需 UI/数据库测试，未因此启动任何测试或服务。
