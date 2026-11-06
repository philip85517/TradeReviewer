# 首页 ≤1 秒：服务端与持久读取模型可行性

作者：`/root/astra_one_second_server`；日期：2026-10-24。范围 OS02，仅分析服务端 API、SQLite、首页来源及持久聚合边界。未运行数据库、API、网络、浏览器、服务或测试；唯一产物为本文。产品实现和旧 P1/F07、ContributionBars 3/3 暂停状态未改。

结论：**窄化 SQL 和批量行情读取是有证据的优化机会，但不足以支持整个页面 ≤1 秒的承诺。最有结构性机会的是：用版本化、持久的首屏聚合视图替代每次导航重新传输并处理完整来源图。** 这需要新增版本与失效契约，以及导入/行情更新后的投影发布流程；当前代码已有的缓存不具备这一能力。是否达到 1 秒只能在真实首屏、非零财务数据和独立正确性验证后判断。

## 证据口径

- 已测基线仅引用上一轮的 [DIAGNOSIS.md](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)、[FUNNEL-METRICS.json](../homepage-timeout-funnel-2026-10-24/FUNNEL-METRICS.json)、[INDEPENDENT-REVIEW.md](../homepage-timeout-funnel-2026-10-24/INDEPENDENT-REVIEW.md)：单次完整、带插桩、vinext/Vite 开发环境、隔离 SQLite 的 1440×900 首页样本。没有本轮 live benchmark，也没有 warm/production 对照。
- 本轮源码为工作树 HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3` 加既有未提交内容；HEAD 不能独自代表源码。旧基线内容绑定见旧目录 `BASELINE-MANIFEST.json`。下文行号指本轮读取的工作树。
- 已读 `CONTEXT.md`、`AGENTS.md`、当前任务 README 及当前工作流程。ADR 0001/0002 提供历史架构线索，ADR 0006 描述行情模块边界；当前代码优先。ADR 0004 自带“不能直接实施”的审查提示，本文不把其待实现策略当现状。
- 保存 trace 的 1 秒门槛回放仍 FAIL：loadEnd 10,719.1 ms、财务拒收终态 effect 31,950.5 ms、globalRead 的 afterDomain 17,541 ms。终态 effect 不是成功财务首屏 paint。任何下文方案均为**静态推断、未实施、未测收益**。

## 现状：缓存存在，但没有首页持久聚合版本

| 边界 | 已存在的能力与准确限制 | 源码证据 |
| --- | --- | --- |
| 数据库连接 | 按绝对数据库路径复用 `DatabaseSync`；WAL、busy timeout；这是连接复用，不是查询/首页结果缓存。同步数据库调用和同步映射仍在路由执行中。 | [db/sqlite.ts:12](../../db/sqlite.ts#L12)、[42](../../db/sqlite.ts#L42)、[88](../../db/sqlite.ts#L88) |
| 原始行情 | `daily_candles`、`market_candles`、coverage 持久化，已按 instrument/date 等设主键；API 读取本地存量。冷浏览器不等于冷行情库。盲目“加索引”不能消除已经取出的 154,410 根数据。 | [sqlite-schema.ts:78](../../db/sqlite-schema.ts#L78)、[sqlite-store.ts:1174](../../app/lib/storage/sqlite-store.ts#L1174)、[1387](../../app/lib/storage/sqlite-store.ts#L1387) |
| 首页来源 | `begin deferred` 将 counts、bootstrap、Recall 摘要绑定在单次同步快照内；每次生成 UUID、knownAt 和整个 envelope 的 SHA。receipt 明确是 opaque read identity，**不是持久 DB revision**。`scope=all-persisted-records` 与 `enumeration=complete` 是当前合同。 | [homepage-source-snapshot.ts:16](../../app/lib/storage/homepage-source-snapshot.ts#L16)、[40](../../app/lib/storage/homepage-source-snapshot.ts#L40)、[46](../../app/lib/storage/homepage-source-snapshot.ts#L46)；[homepage-source-contract.ts:9](../../app/lib/storage/homepage-source-contract.ts#L9) |
| HTTP | bootstrap、homepage-source、market-data 均 no-store；首页客户端也是 no-store。没有现成 ETag/304 或持久首屏结果复用路径。单纯取消 no-store 会引入陈旧数据风险，并不能建立正确版本。 | [bootstrap route:6](../../app/api/storage/bootstrap/route.ts#L6)、[homepage-source route:6](../../app/api/storage/homepage-source/route.ts#L6)、[market-data route:9](../../app/api/storage/market-data/route.ts#L9)、[sqlite-http-client.ts:160](../../app/lib/storage/sqlite-http-client.ts#L160) |
| 财务来源/计算 | acquisition 的 revisions 是读取后对实际输入计算的 fingerprints；prepared source 自有 WeakMap 与 memo。它们能复用一个已准备 handle 内的计算，不能在刷新、进程重启或新的来源构造前跳过首读。 | [financial-acquisition.ts:15](../../app/components/homepage-v25/financial-acquisition.ts#L15)、[173](../../app/components/homepage-v25/financial-acquisition.ts#L173)；[homepage-v25-performance.ts:599](../../app/lib/reviews/homepage-v25-performance.ts#L599)、[647](../../app/lib/reviews/homepage-v25-performance.ts#L647) |
| 已有 revision | Recall 有每文档 revision/CAS，trade_revisions 是交易修订审计记录；正常 mergeTradeData、行情提交、metadata 与 settings 写入未共用一个首页持久 generation。不能用修订条数代表整个首页数据版本。已核查 schema/首页路径中未见持久首页投影表。 | [server-repository.ts:134](../../app/lib/recall/server-repository.ts#L134)、[sqlite-schema.ts:412](../../db/sqlite-schema.ts#L412)、[sqlite-store.ts:1253](../../app/lib/storage/sqlite-store.ts#L1253)、[1387](../../app/lib/storage/sqlite-store.ts#L1387)、[1420](../../app/lib/storage/sqlite-store.ts#L1420) |
| 首页实际 FX | `/api/trading-room/fx` 的 GET 等待 ensureDaily；本地 `trading-room.fx` 保存当日状态，`lastAttemptDay` 同日直接返回，service 的 inFlight 合并同进程并发刷新。它不是另一条 `/api/fx` snapshot 路径。跨日或首次无缓存会进入外部请求，默认每次 8,000 ms、最多两次；这是配置边界，非本轮实测延迟。 | [trading-room/fx route:21](../../app/api/trading-room/fx/route.ts#L21)、[42](../../app/api/trading-room/fx/route.ts#L42)；[fx-service.ts:38](../../app/lib/fx/fx-service.ts#L38)、[97](../../app/lib/fx/fx-service.ts#L97)、[153](../../app/lib/fx/fx-service.ts#L153)、[222](../../app/lib/fx/fx-service.ts#L222) |

首页来源快照仅覆盖 bootstrap 与 Recall；后续 FX、各证券行情是其他请求，不在该 SQLite 快照事务里。当前 acquisition 记录实际观察内容，不能将它误称为所有表的同一数据库版本。以后持久投影需要明确单一快照或显式版本向量与校验，不能借现有 receipt 声称实现了全链路原子读取。

## 重复读取与放大点

1. **每证券请求重复取全量目录与 coverage。** `GET /api/storage/market-data` 先 `getInstruments().some(...)`，再 `getIntervalCoverage().filter(...)`。两方法各自全表读取并 JSON 映射。对于 dailyOnly，route 仍构造/返回 intervalCoverage，但首页使用的 `ApiMarketDataRepository.getDailyMarketData()` 只返回 dailyCandles 和 coverage。可窄化为按 ID 存在检查、按 ID/interval 查询，并让首页批量日线合同只读需要的字段。证据：[route:28–48](../../app/api/storage/market-data/route.ts#L28)、[store:1038](../../app/lib/storage/sqlite-store.ts#L1038)、[1228](../../app/lib/storage/sqlite-store.ts#L1228)、[repository:103](../../app/lib/storage/sqlite-repositories.ts#L103)。其他调用者可能依赖 intervalCoverage，不能直接删公共响应字段而不盘点消费者。

2. **全量 bootstrap 与首页源重叠。** 首页 read bundle 内又读完整 homepage-source，而后者内部调用完整 getBootstrap；工作区初始化也调用 getBootstrap。bootstrap 含 executions、import history、instruments、reviews、reviewStates、tag suggestions、jobs 和 settings，不是纯首页首屏 DTO。`getReviews()` 有正式 Recall completion 时还会再次 `getExecutions()` 并重建 episodes；这条分支是否在新样本触发需测，静态存在不等于每次一定发生。证据：[workspace:2240](../../app/components/trade-review-workspace.tsx#L2240)、[2862](../../app/components/trade-review-workspace.tsx#L2862)、[snapshot:31](../../app/lib/storage/homepage-source-snapshot.ts#L31)、[store:1023](../../app/lib/storage/sqlite-store.ts#L1023)、[1139](../../app/lib/storage/sqlite-store.ts#L1139)。读取对象内共享 executions 可以减少重复，但复用普通 bootstrap 不能替代当前来源快照的事务一致性保证；已有 [并发读测试:86/105](../../app/lib/storage/homepage-source-snapshot.test.ts#L86) 专门表达该差异（本轮仅读测试，未执行）。

3. **首页下载的是完整行情历史图。** bundle 对所有 summaries `Promise.all` 读日线；范围来自成交/持仓 replay bounds。当前首屏构建交易条目、最新报价及来源身份均依赖这些数据。可把首屏聚合移到服务端，但不能只把最近 N 根或仅当前持仓传给原算法，否则历史收益、起始成本和来源覆盖可能变义。证据：[workspace:541](../../app/components/trade-review-workspace.tsx#L541)、[2255](../../app/components/trade-review-workspace.tsx#L2255)。

已测量级支持这些候选：首页 source route 474.46 ms（含 snapshot 339.50 ms 和 JSON 构建，非纯 SQL），传输 6,325,206 bytes；行情关键 236 请求墙钟 7,242.6 ms、合计 43,076,943 bytes。行情 route 合计 2,954.75 ms 内，SQL 叶子 1,413.25 ms、映射 1,162.10 ms；浏览器 `requestStart−fetchStart` 中位 4,910.95 ms。**这些父子/并行量不能相加；不能宣称删掉重复查询就能节省整段 7.24 秒。**

## 三档候选及严格 1 秒条件

| 方案 | 改变什么 | 对 ≤1 秒的作用与限制 | 状态 |
| --- | --- | --- | --- |
| A：窄查询 + 批量本地行情读取 | 给首页专用批量接口，按需要的证券/区间读取日线与 coverage；共享目录映射与 executions，避免 236 次全目录/coverage 扫描；保留当前完整来源语义。批量需验证参数数目、请求大小和排序，不能仅在新 route 内循环调用现有 HTTP API。 | 减少请求排队及重复映射，是最直接的工程机会。若仍发送约 43 MB 历史并在客户端反复编码/SHA，则首屏端到端 1 秒没有证据支持。单个巨型 JSON 同样会阻塞序列化/解析；SQLite DatabaseSync 上 Promise.all 也不意味着 SQL 并行。 | 静态可行；收益、批量大小和尾延迟未测。 |
| B：服务端按需首屏投影 | 单次一致性读取事实/行情/FX，复用财务领域实现生成指标、持仓行与首屏曲线点；返回紧凑 DTO、完整范围证明、版本/政策、缺失原因和可追溯引用。完整交易/行情详情在进入对应旅程时读取。 | 能移除大历史图跨网络和前端身份重复处理，但只是搬移全量计算并不消除工作。首次请求还可能全量扫描、构建及哈希；更重的同步 Node 计算会拖住其他路由。应测 server CPU、单请求与并发，不得将“改服务端”直接等同 1 秒。 | 静态可行；需要新契约及与现有财务内核等价证明。 |
| C：持久、版本化的首页投影 | 基于 B，把聚合结果或可组合的日/账户/证券投影持久化，按 source revisions + 财务/日历/FX政策版本 + scope/range/currency + cutoff 读取；写入触发增量重建/失效，完整 generation 通过校验后原子发布。首页热读只需验证版本、读小结果。 | 最有机会把导航关键路径从“全量材料化”变成“小结果读取”。持久结果可跨应用重启保留；仍不能保证浏览器冷模块、OS 冷页、首次投影或新增长历史的时限。导入后首次也要求 1 秒时，需在导入完成前准备可发布结果，或证明同步增量成本有界；异步任务尚未完成时命中旧结果不算当前数据首屏成功。 | 静态方向可行；新数据模型/失效协议/构建成本/容量均未验证。 |

推荐评估顺序为 A 消除已证实浪费，再以 B 的正确性契约评估 C。不能用 A 的单接口提速预先接受严格 1 秒，也不建议未经正确性边界直接堆一个无限期内存缓存。移出首屏的详情需要保持用户点击后的旅程与状态安全；任何设计层面的延迟展示都须另行确认，不属于本轮授权。

## 持久版本与失效的最低契约

- **版本由提交事务拥有。** 覆盖普通导入/同文档重导、交易修订/删除、月结证据投影、证券 metadata/别名、行情与 coverage、FX、影响首页的 Recall/reviews；显示状态还需覆盖 jobs 等相应依赖。事务 rollback 不推进已发布版本。不能只监听一个 route，忽略 legacy migration 或另一写入口；跨进程共享同一业务库也必须看见版本变化。
- **内容版本与观察时间分离。** 当前 receipt 将 UUID/knownAt 也写入 binding，重复读取即使业务内容不变，摘要也不同。不能原样将该 digest 当跨读缓存键。新合同可保留稳定事实版本与当前读取/构建时间，但必须保留篡改、缺项和陈旧来源拒收能力；不是删掉校验。引用的 `knownAt/fetchedAt` 不能因为命中缓存被刷新为“现在”。
- **发布完整快照。** 构建时捕获版本，离开读事务后计算，发布时验证版本仍匹配；若写入已发生则重做或放弃该 generation。若选择显式版本向量，也要证明组合时点规则。不得混用新交易与旧行情覆盖后仍标为完整。
- **失效不仅是数据行数。** 同数量修正、同秒多次写入、删除后新增、coverage 从 complete 变 partial、相同价格但来源/可知时间变更均可改变财务资格。count/max(updated_at) 不能代替完整版本。财务/日历/费池/汇率规则升级与跨市场已完成交易日变化也必须进入 key 或使缓存失效；当前政策枚举见 [performance.ts:484](../../app/lib/reviews/homepage-v25-performance.ts#L484)。
- **范围组合需证明。** 固定默认首页可以先有一个受控投影；任意账户集合、市场、期间和币种可能造成组合爆炸。若按账户/日预聚合，须验证资本、费用、汇率知识截止及来源覆盖在组合时可加性，不能把会计金额简单相加当已证明等价。当前精度使用 Decimal/字符串，迁到 SQL 的浮点 SUM 可能改变结果。

## 热、冷、导入与缺失条件

| 场景 | 当前事实 / 所需条件 | 1 秒判断 |
| --- | --- | --- |
| 已启动、同来源热访问 | 原始日线/FX 可在库，但全源 endpoint no-store 且每读新身份；没有已测 warm 样本。C 必须命中匹配的持久 generation。 | NOT VERIFIED；不能从数据库缓存存在推导首屏达标。 |
| 浏览器冷导航，持久投影热 | C 能跳过全历史读取；JS/CSS、路由启动、解析与真实 paint/交互仍消耗总预算。 | NOT VERIFIED；服务端预算只能占 1,000 ms 的一部分。 |
| 进程重启、数据库 OS 页冷 | 连接缓存和内存 handle 消失；持久投影可保留，但初始化、I/O、序列化及模块冷路径仍需测。 | NOT VERIFIED；原 10.374 s 文档 TTFB 不归给 SQLite。 |
| 导入/重导/修订后首次打开 | 投影必须反映新事务；后台重建期间返回旧已知版本须明确过期，不能算“新数据可用”。如把计算前移到导入完成前，应同时报告导入耗时，避免仅移动等待而掩盖成本。 | 无增量/预生成证据前不能承诺。 |
| 尚无持久投影或新任意范围 | B 的全量 on-demand 路径可能重现扫描、构建/哈希。需要 bounded fallback 或先完成建模；骨架不算财务首屏。 | 严格全场景目标未证实。 |
| 缺日线/缺历史 FX/跨日 FX 无有效状态 | 存储行情 GET 不补外部行情；刷新是另一流程。首页 FX GET 在跨日会等待外部刷新。缺失是数据资格问题，不能用旧行情、当前 FX 或空集合伪装完整。即使 1 秒内展示正确缺失状态，也不等于“真实金额和曲线可用”。 | 不能保证真实完整财务结果；需预先具备数据，或明确把“正确缺失状态”作为另一个目标，不能偷换当前假设。 |

## 可证伪的后续验收（本轮未执行）

1. 在显式隔离库固定非零交易、持仓、已平仓与历史 FX fixture，比较旧正确性基准和新投影的每项金额、曲线、覆盖、时点、币种、证据引用；包含多账户、多市场、同文档重导与缺行情。旧性能样本 prepareFinance entryCount/groupCount 均为 0，不能作为金额等价 oracle。
2. 对 A 采集 SQL 次数/行数/映射次数、响应 bytes、JSON/哈希、浏览器请求队列；验收应能证伪“只是把 236 HTTP 包进一个接口，内部仍全表重复映射”的假优化。执行计划、SQLite 锁/I/O 未测，不能预判索引收益。
3. 对 C 检查同数量更正、coverage-only 更改、不同连接并发写、metadata/Recall/FX 更新、政策版本升级、跨交易日和构建中崩溃：必须使用正确版本或明确拒收，不能旧数据被接受。篡改 payload、拆离 receipt、缺漏证券、观察时点倒置仍须失败；现有 [contract tests:47](../../app/lib/storage/homepage-source-contract.test.ts#L47) 是反例起点，本轮未声称它们运行通过。
4. 在相同源码/数据/视口下分别测无插桩 production 的热读、浏览器冷导航、进程重启、持久投影缺失、导入后首次与外部 FX 失败。每个场景报告 navigation→真实首屏 paint→关键控件交互，而不是只测 API 或 shell；多轮分布和最差值独立报告。严格目标的通过标准不得由平均值或单次 cache-hit 代替。

本报告没有分配预测毫秒数：已测基线不能推出三个方案的节省量。若下一轮给服务端设预算，它应是留足模块/网络/客户端/paint 后的**待验证设计预算**，而非实测结论。只有更新后的真实运行与财务正确性都通过，才可接受整体 ≤1 秒。
