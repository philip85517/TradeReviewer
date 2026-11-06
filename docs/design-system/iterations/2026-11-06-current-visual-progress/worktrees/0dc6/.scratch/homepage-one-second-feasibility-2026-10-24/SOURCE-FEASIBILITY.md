# 来源身份与财务投影：≤1 秒可行性复核

日期：2026-10-24。范围：OS03，`financial-acquisition`、`financial-source-model`、`homepage-v25-performance` 的来源拥有、内容身份、缓存与财务语义。研究者：独立 subagent `/root/astra_one_second_source`。仅阅读当前源码、CONTEXT/AGENTS、ADR-0001/0006 及已冻结诊断；只新增本文件。没有访问数据库、HTTP、服务、浏览器或依赖，没有运行新 benchmark、改产品或恢复旧 3/3 暂停。

## 结论

当前路径不能支持“整个页面打开到真实首屏可用≤1000 ms”的承诺。既有样本的财务首读本身为 17,541 ms，导航至失败终态 effect 为 31,950.5 ms；这不是成功首屏。它是带观测开销的单次开发环境样本，不能外推生产、热访问或优化收益。保存 trace 的 1 秒门槛回放只再次判定该基线 FAIL。

来源域最有价值的方向，是把稳定内容版本与每次读的证明分开，并让首屏消费带版本及资格证据的小投影。仅用更快 SHA、移到 worker 或复用当前 memo，不能单独把整个页面压至 1 秒。热命中具备可研究的实现路径；首次全量构建、导入/更正后的未命中及证据本身缺失，目前没有 1 秒保证。

## 实际重复发生在哪里

以下行号绑定当前工作区，诊断基线另有冻结 manifest；这些是源码证据，不是新运行结果。

| 路径 | 当前工作及其意义 | 证据 |
| --- | --- | --- |
| HTTP 来源解析 | canonical→JSON.parse 脱离调用方，再做形状及摘要验证；首次 canonical 和 binding canonical 是两遍。脱离对象在 await 前完成，避免 fetcher 在异步校验间修改内容 | `app/lib/storage/homepage-source-contract.ts:163–171` |
| acquisition prepare/complete | prepare 校验完整 stored binding；等待行情后 complete 再校验实际内容及原始 digest，防止 IO 期间变更或重新 hash 替换；随后检查原始载体是否被 assembler 丢失 | `app/components/homepage-v25/financial-acquisition.ts:191–242` |
| acquisition revisions | trades 指纹覆盖 entries/imports/reviews/Recall；quotes 指纹覆盖全部 candles/status/coverage；metadata 指纹支持 Map；都使用同步 tagged encoding + SHA | 同文件 `:75–96,167–179` |
| S1 选择→F 准备 | 选择原始完整组后，entries/lifetime 被筛选，但 metadata、candles、FX 仍是整个 acquisition 图。F 先 structuredClone 完整 input，再对 input+policies 编码并 SHA | `financial-source-model.ts:151–185`；`app/lib/reviews/homepage-v25-performance.ts:638–653` |
| openOnly | 先准备候选完整来源用于持仓资格，再准备最终选中来源，最多两次完整 candle capture。该行为已有显式测试，不能声称随手删一遍便等价 | `financial-source-model.ts:164–181`；`financial-source-model.test.ts:496–509` |

冻结诊断中 acquisition complete 3,854.3 ms，其中 quotes 编码+SHA 为 598.4+2,186.5 ms（44,092,801 UTF-16 units），trades 为 138.3+413.4 ms。随后 F 再 clone 325.3 ms、source encode 1,048.0 ms、SHA 2,135.2 ms（41,578,004 UTF-16 units）。quotes 与 source 两套身份的编码+SHA 合计约 5,968.1 ms，但属于重叠数据的不同身份合同，不能直接互换 digest。`stableContents` 使用 tagged Array/Map/undefined 表示，`stableProjectionJson` 是另一套 JSON 编码；后一身份还包括 selected input、revisions、policies。

本样本 F 的 **entryCount=0、groupCount=0**，逐组 digest/selection/canonical/quote 工作为零；3.7 秒不能归因于非零账本计算。完整 candle 图仍在 F input 中，解释了零组也付出大图拥有/身份成本。也不能据此宣布真实持仓为空，或推算非零财务数据的完成耗时。

上表的重复不全是冗余：前后 binding 检查分别守住不同时间边界；F clone 守住调用方后续修改。性能重构必须提供等效的不可变所有权和完整性证明，才能省去对应遍历。

## 既有缓存为何不解决首开

1. `preparedData` 是按句柄对象索引的 WeakMap（`homepage-v25-performance.ts:599`）。每次 prepare 先完整 clone/hash，之后才新建 `ProjectionMemo`（`:647–653`）。没有按稳定来源版本复用整个 prepared handle 的全局/持久缓存。
2. memo 复用同一 handle 的 state/current/exact batch；current key 包含 cutoff 与币种（`:950–953`），batch key 包含完整 request（`:989–994`）。本地期间切换复用 previous.source（`trade-review-workspace.tsx:2301–2304`）；global read 重新 acquisition 并调用 own source（`:2233–2272,2289–2299`）。因此后续投影缓存不能免除首次 IO 和身份成本。
3. memo 有 8,192 项/64 MiB 限制和最多四个 batch（`homepage-v25-performance.ts:559–584,1043–1046`）；source/index 单列并非受同一 64 MiB 限制（`:684–690`）。增大 memo 不会消除 full source clone/hash，且可能增加保留内存。
4. 当前 receiptId 是 randomUUID、knownAt 每次生成，绑定摘要包含两者（`homepage-source-snapshot.ts:33–46`、`homepage-source-contract.ts:82–85`）；它们是读取身份，**不是持久数据库 revision**。representation 再将 receiptId/payloadDigest 纳入 trades revision（`financial-acquisition.ts:231–248`）；测试明确要求即使正文相同，read-2 也改变 trades revision（`financial-acquisition.test.ts:619–628`）。因此把现有 sourceId 当跨导航稳定 cache key，通常会失效。
5. FX acquisition 包含实际 observedAt，current evidence 的 fetchedAt 也来自此次客户端观测（`financial-acquisition.ts:110–148,178`）。复用旧 FX 内容不能虚构一次新的历史已知时间。市场缓存虽然避免 provider IO，本次仍将 154,410 根日线以 236 请求交给浏览器，并重新绑定内容；“行情已缓存”不等于“首屏投影已缓存”。

## 三类方案及合同影响

| 方案 | 可以消除/压缩的工作 | 合同与代价 | 1 秒判断 |
| --- | --- | --- | --- |
| A. 维持现有完整来源，优化拥有和摘要实现 | 同一不可变 owned snapshot 内复用已验证 binding；保持字节编码不变，试验原生/WebCrypto digest；共享候选与选中来源的不可变索引，减少重复 clone | 需要 branded/封装所有权及完整生命周期；当前 mutable retained 会在 IO 后重检，不能只删守卫。改为 async 会改变接口及取消时序。只替换相同 UTF-8 的 SHA 可以保留旧身份；改变输入、编码、Map 表示或 hash 组合则需要身份版本变更 | 热同句柄可能有益；新导航仍走 full IO/encoding。即使概念上消掉全部 fromGlobal，保存样本仍有约 13.8 秒上游工作，不能单独达标。冷/失效无保证 |
| B. 版本化来源 + 持久首屏投影 | 写入/更正时维护分区内容版本与投影，读时按小 revision manifest 找到已完成、同版本的指标/持仓/曲线；不把全量 candles 送到浏览器再 hash | 需新增稳定内容版本，与 read receipt/observedAt 分离；为交易、月结证据、Recall、metadata、quotes/coverage、FX及政策建立完整依赖和原子失效。sourceId 和 proof/read 语义需显式升级；当前测试要求读身份进入 trades revision，不能静默改名继续沿用 v1。把计算提前到写入是成本转移，必须测写入与重建成本 | 已存在精确版本投影时，热访问/浏览器模块冷而数据投影热有可行路径，仍需导航+传输+渲染实测。首次空缓存、代码政策升级及导入后首次打开若同步全量重建，无 1 秒保证；必须在写入完成前维护或完成增量更新才可能覆盖此类访问 |
| C. 精确首屏小投影接口，完整图按需读取 | 首屏只返回现有设计需要的指标、持仓、可见曲线点、资格/原因、originalByCurrency 与版本引用；明细审计图留在来源拥有者。可与 B 组合 | 不是删掉原始历史或把 unknown 当 0。所选期间的期初成本/费用与历史 FX 仍可能依赖期间之前完整证据；server 必须保持原 F 权威与一致切面。若收缩 candle input 或改变 F sourceId，属于来源身份合同重设；如果改变曲线默认密度、期间、附件、信息层级或延迟首屏必要结果，则另需设计授权 | 相比完整图更接近≤1秒所需边界，但只有证明查询/投影有界或命中预计算才可承诺。冷 cache miss 只是把同一工作移到服务器，不自动达标；缺失的外部行情/历史FX不能凭接口变小获得 |

优先研究 B+C；A 可作为受控的局部改善或配套。worker/分片异步能减少主线程长任务，但仍有 clone/transfer、排队和等待；若真实指标必须等该计算完成，首屏终点并未前移。后台预计算只有在打开前已经完成且版本有效时才缩短导航等待；不能把异步启动等同于首屏可用。

## 必须保留的金额与时间资格

- 原始成交是完整 lineage，episode parts 不能再次当成交累加（`homepage-v25-performance.ts:154–168`）；期前附带持仓、月结事件、费用乃至未来成交承载的早期证据不能因“只取首屏日期”删除。S1 当前明确不做 range clipping（`financial-source-model.ts:151`），all bounds 需 inception、knowledge、coverage 证据（`:96–148`）。
- 缺行情不是零。报价查询需要市场已完成 session、raw 调整口径、证券/币种/日历资格；期间 strictAmount 对缺已完成交易日的非零持仓保留 unknown（`homepage-v25-performance.ts:664–669,780–806`）。current 投影目前另用 quoteFor 并暴露 indexed coverage（`:957–968`），重构应保持两个已有口径，不能顺便宣称两者已统一。
- metric 保留原币已知小计与各自 available/reasons/coverage；目标币缺率时 value 可为 null，但原币小计不应丢失；同币种无需额外 FX（`:365–396`）。未知费用不能变成已知 0，也不能从汇总中静默剔除使总额看似完整。
- 历史 FX 按 boundary day、币种对、publishedAt/knownAt/fetchedAt/evidence/status 筛选，冲突失效；current 与 historical 是不同路径（`:811–835`）。当前 acquisition 明确 `fxObservations: []`（`financial-acquisition.ts:171`），不能将今日 FX 或 snapshot receipt.knownAt 填入历史槽以让曲线更快“可用”。历史转换还保留 native slot knownness、原币/目标币、cutoff、source/revisions/policies 的 conversionId（`homepage-v25-performance.ts:1088–1137`）。
- ADR-0006 指出 coverage complete 不证明历史可知时间、调整口径或本次刷新成功；不可变数据版本和研究快照是后续阶段。不能把现有缓存表本身当已完成的版本化证据系统。

## 可证伪验证，不以未测收益立项验收

后续另获实施授权后，至少做下列对照。本轮均 **NOT VERIFIED**，未执行新测试。

| 要验证的断言 | 能推翻它的反例/测量 |
| --- | --- |
| 省去重复 binding 仍等效 | 原始 payload/ID/receipt 在 prepare 前篡改、IO 期间变更、IO 期间重新 hash 替换都必须被拒；仅对象 key 重排可接受。现成反例位于 `financial-acquisition.test.ts:396–402,486–504` |
| prepared/source 复用不被调用方污染 | prepare 后更改原始 executions、Map metadata、candle、FX时钟、selection、coverage、revision；旧结果/身份须保持，下一版本必须失效；`financial-source-model.test.ts:527–552` 已覆盖此类载体 |
| 新版本键完整 | 独立改变成交数量不变的金额、月结 authority、Recall status、metadata 分类、quote 同日修正、coverage、FX发布/已知时间、calendar/finance policy；每个依赖影响对应投影，不能只看行数、最大日期或 trade revision。事务期间并发改动不得拼出跨版本混合结果 |
| 小投影与原合同等价 | 非零多账户/跨币种、原始符号别名、部分平仓费用、IPO/月结附带来源、缺行情、未来时点、未知 inception、缺历史 FX 与冲突 ID；逐项比较 value、原币小计、available、reasons、coverage、边界、费用证据和 curve points，不只比一个总数。已有完整输出身份断言：`financial-source-model.test.ts:513–524`；身份合同若升级须显式维护映射，不能改 expected 来隐藏语义差异 |
| 缓存真的让打开≤1秒 | 分别测热来源+热模块、热持久投影+冷浏览器模块、进程重启、完全空聚合缓存、导入/quote/FX/政策失效后首次读；从 navigation start 到真实指标、持仓、首屏曲线首次 paint 并能交互，全流程同一个版本，观察失败/取消/竞态。记录多次分布、命中率、payload字节、解析/摘要/longtask、server build 与内存，不只报缓存命中 API 耗时 |
| 缺来源也满足既定终点 | 若真实业务证据缺失，只能及时且准确显示现有 unknown/原因；若目标要求所有数值/曲线均有值，那么该场景不能靠优化保证 1 秒，应与“正确未知可交互”终点分开统计，不静默降低目标 |

跨域预算必须由主代理统一：导航、模块、bootstrap、获取、来源校验、投影、React/paint/交互都在同一个 1 秒内。来源域目前只能证明热点与候选边界，不能替导航/服务端报告占用时间或预支未经测量的余量。

## 证据与状态

既有测量来源：[`DIAGNOSIS.md`](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)、[`FUNNEL-METRICS.json`](../homepage-timeout-funnel-2026-10-24/FUNNEL-METRICS.json)、[`INDEPENDENT-REVIEW.md`](../homepage-timeout-funnel-2026-10-24/INDEPENDENT-REVIEW.md)。本报告是源码可行性分析；未验证任何优化收益，未完成产品修复或 UI 验收，旧任务 FAIL/暂停维持。
