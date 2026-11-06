# 当前桌面首页：只读源码链诊断

诊断时间：2026-10-24；工作树 `0dc6/TradeReview`；HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3` 加当前未提交内容。实际文件版本见 [source-manifest.json](source-manifest.json)，行号摘录见 [source-line-evidence.txt](source-line-evidence.txt)。目标为 `/home?scope=live&market=a&accounts=*&rangeMode=all`，桌面 1440×900；浏览器证据由主代理独立采集，本代理没有打开浏览器。

本轮仅诊断。已读 AGENTS、development-workflow、frontend-control-audit、本轮 README / DESIGN-COVERAGE，以及 systematic-debugging 技能和 2026-10-24 已有 strict / terminal / timeout / CPU 诊断资料。没有修复、修改产品文件、访问网络或数据库、重启服务、运行全量测试或恢复 P1/F07/Bars；3/3 暂停保持。唯一执行探针为当前纯性质函数的内存调用。

## 结论与证据等级

1. **当前直接故障已证实：首次首页财务读取超时，没有被 host 接受发布。** 主代理当前桌面看到顶部“读取已超时，新范围未应用”、指标 `— / timeout`、期间禁用、曲线尚未就绪。源码说明首读失败保留 `view:null` 与空 holdings seed；不能把当前 0 行直接归因于 strict live，也不能把它读成真实零持仓。
2. **真实数据库并未整体断开，已由独立运行证据证实。** 当前 PID 29149 使用 conf 共享业务库；status/trades 返回 1,866 成交、213 导入、236 标的，三类 ID 全量摘要与只读数据库一致。见 [runtime-api-approved-attempt.json](runtime-api-approved-attempt.json) 及运行报告。这个结论证明普通存储链路连接；不证明 homepage-source 已过绑定验证、acquisition 完成或 host 已接受。
3. **独立的后续资格差异已证实：普通库可显示 live 的 1,784 条历史券商成交，在当前领域规则下都是 unknown。** 其 API source 两个性质字段确实缺失，其他 82 条为 simulation。本轮直接执行当前 `tradeNatureOf` / `displayTradeNature`，结果分别为 `unknown→live:1784`、`simulation→simulation:82`，严格 live 成交为 0，见 [source-policy-probe.json](source-policy-probe.json)。这是首读成功后会显露的选择合同问题，不是当前 timeout 的成因证明。
4. **历史展示尚未接线已由当前源码证实；all 期间完整性也有独立缺口。** 历史区域是静态保留区，history reload 恒抛错；acquisition 当前传入 `lifetimeSourceCoverage:[]`、`fxObservations:[]`。有合格分组时，all 不能仅凭首笔成交推出完整生涯边界。这些情况应显示来源/能力状态，不能用 HTTP 200 或数据库有成交自动转成财务成功。
5. **当前超时具体耗在哪个请求、哪段 CPU 尚未验证。** 现有结构含无局部截止的等待、全标的日线 fan-out、反复同步编码/摘要/克隆。历史 CPU 证据支持优先检查这条路径，但当前 workspace 哈希与历史测量不同；本轮没有新加载/性能采样，绝不把历史 19.245 秒或 Node 分段数字冒充当前测量。

## 完整边界链：输入、输出、失效点与证伪方式

| 边界 / 当前源码 | 输入 → 输出 | 数据丢失、失败或空值的准确位置 | 可证伪证据（本轮未执行的明确保留为待验） |
| --- | --- | --- | --- |
| SQLite → 原子 snapshot：`homepage-source-snapshot.ts:16` | deferred 读事务中的全库 bootstrap + Recall summaries → receipt / payload binding | 先数 executions / instruments / imports / reviews / Recall，孤儿成交或 shape/count 不一致会 throw，route 503；import projection gap 记 receipt，不等价于所有财务证据完整。此处不按 live/a 过滤。 | 同一 snapshot receipt 的枚举数/ID、binding、projectionGaps；不能用另一个 `/trades` 200 替代。本轮没有重新请求 homepage-source。 |
| 行映射：`sqlite-store.ts:848`、`:1023` | SQL 行 + evidence_json.source → execution / bootstrap | source 字段优先；仅 source.tradeNature === undefined 且 SQL 列是 string 才回填。故 SQL NULL 本身不决定 runtime nature。getBootstrap 枚举成交/导入/标的/复盘/settings/jobs。 | 同时核对 SQL 列、evidence source 和 API source。本轮 runtime 三方 aggregate 已核对性质字段缺失。 |
| route → client：`api/storage/homepage-source/route.ts:8`；`sqlite-http-client.ts:162` | JSON/no-store → parseResponse → parseHomepageStoredCollection | 非 2xx、坏 JSON、形状/计数/绑定错误均可失败；客户端把 contract 失败包装为 invalid-response，即使 HTTP 200。 | response status/body + 客户端 parse 接受结果与 request generation。仅 HTTP 状态不够。 |
| 客户端 contract：`homepage-source-contract.ts:64,89,164` | detached canonical JSON + WebCrypto SHA-256 → owned payload | 整对象同步 canonical/JSON copy；shape、unique IDs、receipt counts、digest 校验；异步 crypto 等待。没有此层独立 timeout。 | 测量收到 response、JSON、detach/shape、digest 完成时间；保留摘要字节同值验证。 |
| Workspace 门禁/seed：`trade-review-workspace.tsx:2176,2184,2277,2288` | ambient bootstrap/alias ready → host 开始首读；seed acquisition/source/view=null | 初始账户目录用 explicitLiveEntries；ambient 数据只作种子，不会自动成为 accepted 财务 source。readOnInitialize/readCollections 均 true。 | storageState/aliasRecoveryState、host initialized、producer token、accepted sourceId；不能用普通库已显示推断财务已发布。 |
| bundle 首段：Workspace `2233–2254` | snapshot 与 FX 并行 → prepare → FX JSON → aliases | `Promise.all([getHomepageSource(), fetch('/api/trading-room/fx')])`，均无 signal；非 OK FX 在 prepare 之后才抛错。body JSON、activeAliasLoader 也可等待/拒绝。页面读取依赖 FX 是源码事实，本代理没有 GET 该接口。 | 对已有自然请求观察各 settle 时刻，区分 HTTP 首包与 body/parse 完成；不可仅看网络200。 |
| 日线集合：Workspace `2255–2257`, `561–621`, `694–709`；`sqlite-repositories.ts:107` | 全部 prepared executions → 全 summaries → 每标的 candles+coverage | **live/market/accounts 筛选在后面**；这里 Promise.all 全标的日线，单个未 settle 挂住整体，单个 reject 拒绝整体。现有 concurrency=4 scheduler 在 `1257` 创建，但该 caller 没传 scheduler/signal。Repository 默认缺 dailyCandles/coverage 为 []，结构缺字段可能变成 coverage 缺失而非 HTTP 错误。 | 数清 summary 数、发起/settled/rejected 数及 missing response 字段；当前请求数/耗时 NOT VERIFIED。不要把历史 287 直接当当前值。 |
| financial acquisition：`financial-acquisition.ts:191–256` | 完整 stored carrier + monthly projection + candles/coverage/reviews/FX → raw+receipt | prepare 再 shape/digest；complete 再检查 retained carrier / digest / clock / gaps，再构造多个 full-content revisions。projection gap/unrepresented carrier 让 universe unknown，而非静默完整。FX history/lifetime coverage 当前固定 []。complete 时间戳在 Workspace `2267` 先取，CPU 工作仍在 host deadline 之内。 | prepare/complete 时间、raw universe reasons、4 revisions 和完整性；HTTP receipt 完整不代表 financial universe 完整。 |
| host 接受：`use-homepage-host.ts:118–230,292–310` | generation/scopeKey/startedAt + resolved bundle → catalog validate → fromGlobal → accepted session | 15s 从 request.startedAt 起算；reload 返回后第一次 deadline guard；同步 fromGlobal 后第二次 guard；定时器也可超时。任一 deadline 失败保留前次 committed 数据、清 pending；首读只有空 seed。旧 token/late result 不发布。无 AbortController 取消上述 I/O。 | 需同时看到 request identity、deadline、accepted producer key、sourceId，不能用 promise fulfilled 代替 accepted。 |
| source own / eligibility：`financial-source-model.ts:152–192`；`attachment-groups.ts:50–68,153–205` | raw entries + accepted scope/attachments → eligible composite groups + selectedEntries + prepared source | execution 用 tradeNatureOf；episode 用 episode.tradeNature。必须 live，再按 accounts、market、symbol；未通过 scopeIncludes 的记录根本不入 groups，**不会出现在 attachment exclusionReasons**。分类/open/pending 的 unknown 才作为组内 exclusion reason。openOnly 还需预投影。 | 分别报告 raw、strict live、market、accounts、attachments 计数，保留原始身份；当前纯性质探针仅证明第一资格差异，不虚构 A 股最终财务行数。 |
| scope / range：`financial-view-model.ts:28–65,102–136`；`financial-source-model.ts:96–148` | accepted snapshot.period + source selection → known/empty/unknown bounds → series/current | `a` 映射 CN/CN-SH/SH/SSE/CN-SZ/SZ/SZSE；`*` 是全账户，报告币种 CNY。期间采用 host acceptedSnapshot，不是随意取 draft。all 要求每组完整 lifetime coverage/起点/knowledge/provenance；当前 [] 必使非空组有 missing-or-conflicting。只有 bounds known 且 selection complete 才生成 series。current 可独立生成。 | 记录 accepted scope、selectionKey、bounds.state/reasons、series 和 current 分开检查；不要把 all 自动解释为 min(executedAt)~今天。 |
| 财务与持仓：`homepage-v25-performance.ts:598–690`；`holdings-model.ts:89–165` | prepared source → F facts/current → holdings | source/revision/policy/clock/currency/group 身份不同直接 throw，整次 global 不发布。缺完整性时总额available=false/value=null，行仍可保留；quantity=0 才跳过，quantity=null不是零。原始日线缺失/陈旧、数量/成本/费用/FX证据不足分别影响值。 | 核对 facts/source/stamp；用 metric.available/reasons/coverage 判断 `—`，不用 SQL NULL 或视觉符号倒推无交易。 |
| 终态呈现：Workspace `2342–2346,6242–6250`；`period-surface.tsx:37–67`；`home-surface.tsx:307–337` | host session + null view/seed holdings → 当前画面 | 首读 timeout 设 initialized=true，HomeSurface ready只看 initialized && storage ready。view仍null时期间占位永远 disabled“读取中”；指标用 errors.global 显示 error/timeout；图表“期间数据尚未就绪”。空 seed rows会进入“当前范围暂无持仓”分支。 | 当前桌面 DOM已证实这些症状；需要在将来故障验收区别首次失败与已有旧成功 source 的 stale 展示。 |
| 历史接线：Workspace `2288,2299,2306`；HomeSurface `337` | history seed/status not-wired → 固定保留区 | global 成功也返回 `history:{source:null,status:'not-wired'}`；reloadHistory 恒 throw；HomeSurface 固定“历史统计与贡献将在后续阶段接入”。 | 源码直接证实，无需查询历史表来解释该文案；未来必须验证真实 history producer 到当前 UI 的完整接线。 |

## 与普通交易库的工作路径对照

普通 workspace bootstrap（`trade-review-workspace.tsx:2875–2893`）通过 getBootstrap 读取并 `applyMonthlyHistoryEvidence`，随后建立 summaries/library entries。`library.ts:253–261` 用 `displayTradeNature` 作为显示性质；`trading-nature.ts:5–12` 在两个显式字段缺失时允许 futu、tiger、china-merchants 推导为 live。首页要求 canonical identity：`types.ts:207` 未知即 unknown；`explicitLiveEntries` 要求 episode 的每条 fill 都明确 live，attachment qualifier 同样严格。

本轮 API/DB 证据已经超出“只看 SQL NULL”：1784 条在 API source 中双字段缺失；375 招商、814 富途、595 老虎；82 TradingView source.tradeNature=simulation 且旧字段=simulated。纯探针调用的是当前两个模块实际函数，不是手抄算法，也不调用网络或 DB，见 [source-policy-probe.mjs](source-policy-probe.mjs)。monthly evidence 处理会复制 source 并更新 positions/events/history flags（`statement-evidence.ts:563`），没有把 unknown 改成 live 的赋值。

所以“交易库能看到实盘”与“首页严格 live 无合格成交”可以同时成立。后者目前是合同差异及未来发布后的阻断；首读当前已在 timeout 被拒，不能声称浏览器已经实际走完资格并据此显示 0。也不能直接修改历史数据 nature 来使计数好看，必须先决定兼容推导可否作为财务身份及其来源证明。

## 当前根因优先级与已知失败的关系

| 优先级 | 当前判定 | 与历史材料的关系 |
| --- | --- | --- |
| P0：首读超时拒绝发布 | **已证实**；是本次桌面无财务数据的直接原因。 | 历史 timeout Finding 与当前机制吻合；当前究竟 IO / SHA / clone / own 各占多少仍 NOT VERIFIED。 |
| P0：失败终态与空结果混同 | **已证实**；独立于造成 timeout 的慢阶段。即使仅显示改正确，财务仍未成功。 | 已有 terminal-state Finding 未闭环；不得通过截图文案变化宣布修好数据链。 |
| P1：legacy display live vs strict identity unknown | **当前函数+当前聚合证实**；修复超时后仍需单独处理的选择合同。 | 不能盲重复历史 F07 或把运行库 SQL NULL 直接当全部结论。本轮保留暂停。 |
| P1：历史区未接线、all 完整性来源未提供 | **源码证实**；当前 UI 未承诺从真实库历史生产结果。 | 与现有 stored-history/terminal 失败同属未交付路径，不能拿 isolated core projection pass 代替接线验收。 |
| P2：类型门禁仍有已知失败 | 本轮未重跑；不能证明已消失，也无证据它造成浏览器 timeout。 | `issues/14-p1-strict-finding.md` 记录 8 个 strict errors：一处 viewport 字段、七处 getByRole exact 选项。test runtime pass不能覆盖strict fail。 |

历史 CPU checkpoint 是**线索**：当时完整源读取/编码/摘要在 complete 与 own 中明显占时，节点采样也说明 all-source 先读后筛选。当前 source manifest 对比历史设计快照：11 个已列关键文件哈希相同，但 Workspace 当前为 `4a653d174c25f05e9ce7927cfc6845b282e7fbc98c32ba76a9021d57e3ae80e5`，历史为 `acf7d573c11a75f60cc0f246e8101cf15c1668dba309776f5b5e1d37805aabb9`；旧隔离数据库/执行条件也不同。不可把历史 19.245 秒、287 日线或 nativeNode 12.121 秒视为当前桌面测量，更不能说 CPU 已被当前浏览器精确归因。

## 一次统一修复设计建议（仅建议，未执行）

建议以“可信来源→有效资格→有截止的 acquisition→原子发布→明确终态”作为一个集成合同，而不是继续逐个可见症状盲修。下一轮若获修复授权，应先冻结同一桌面版本、请求/DB快照与验收矩阵，再按以下分工实施并一次独立接受：

1. **一个 source owner 管完整来源与身份。** 明确定义遗留券商记录的兼容政策，保留 unknown/live/simulation 与证据理由；普通库显示、首页资格、账户目录和集合跳转共用可审计映射。拒绝未知时明确计数/原因；允许兼容时也保留来源与原始身份，不能偷偷重写成交。全量 snapshot receipt 与 financial universe complete 各有其意义，不合并成一个 boolean。
2. **一个 acquisition owner 管时间和工作量。** 在原子绑定/完整性语义不变前提下，针对已有 CPU 线索评估 retained-digest 的相同字节流、分块编码/摘要、重复遍历消除；不是去掉校验或延长15秒。设计 request-scoped abort/deadline 贯穿 snapshot、FX、aliases、market reads，限制 fan-out 并避免已淘汰请求继续占用资源。是否提前缩小行情集合必须证明不损害 complete enumeration、跨组原始证据或 all 边界；不能简单加 filter 了事。
3. **一个 UI owner 管全页 terminal 合同。** 首读 pending、首读 failed/timeout、已成功后 refresh failed（旧 source）、成功空集合、成功但证据不足应是不同状态。期间按钮、图表、指标、持仓计数、搜索/导航都消费同一状态；空 seed不产生“暂无持仓”断言。重试只在匹配 producer 被接受后报恢复，保持 generation/scope/clock 两处 deadline guard。
4. **补齐或明确隔离历史能力。** history source、range、FX历史知识、lifetime coverage 与投影 producer 必须接到当前 HomeSurface；all 起点不可凭首笔交易伪造。若业务范围尚未授权实现历史，应继续明确 not-wired，不能让当前数据诊断顺带恢复暂停任务。
5. **一次验收覆盖真实来源和故障路径。** 同版本1440×900、真实只读来源先验收首读被接受；再在隔离DB/受控响应中验收首次timeout/拒绝、刷新失败保留旧数据、late result淘汰、legacy unknown与simulation隔离、A/*/all以及非空但覆盖不足的区别。ordinary library→homepage→collection→return 要核对范围与数据身份。strict typecheck及已知失败也须各自闭环。截图、功能、持久化/数据流三个门禁不能互相替代；禁止把本轮诊断当修复或整体验收PASS。

## 本轮执行与证据边界

- 有限探针：pinned Node 26.0.0，`source-policy-probe.mjs`；仅转译/调用当前两个纯模块并读取已保存的 API 聚合，输出当前性质差异；exit 0。
- 没有业务库写入、网络请求、缓存刷新、服务控制、全量/strict/历史CPU重跑或浏览器操作。本代理只写本文件及 source-*。
- 当前 desktop UI、共享库路径与 API/DB ID 对照来自主代理/运行代理的独立新证据；当前 homepage-source 自然请求的 payload、每阶段耗时、是否某个 IO 未 settle 没有独立采样，保留 NOT VERIFIED。
- 完成的是源码诊断报告；首页故障未修复，P1/F07/Bars 3/3 仍暂停。
