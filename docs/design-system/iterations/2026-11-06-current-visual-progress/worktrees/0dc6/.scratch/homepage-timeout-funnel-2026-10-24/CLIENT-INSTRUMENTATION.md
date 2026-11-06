# 客户端首页漏斗 instrumentation（PF04 / PF05）

状态：隔离 copy 观测代码已冻结；浏览器测量、原始数据分析和独立接受由 /root 负责，当前为 NOT VERIFIED。
实现者：/root/astra_funnel_client，gpt-6-astra / ultra。仅执行 systematic-debugging 的证据采集阶段，没有实施产品修复。

实施目录：`/private/tmp/tradereview-home-funnel-oiy236zg`。原仓五个对应源码逐字节与实施前 snapshot 相同，见 `CLIENT-INSTRUMENTATION-FILES.json`。补丁 `CLIENT-INSTRUMENTATION.patch` 相对于该临时 copy 的原始 dirty 源码生成，保留了此前工作。共享 helper、storage、API、DB 不属于本代理写入范围。

## 文件和观测阶段

| 文件 | 观测内容 |
| --- | --- |
| `app/components/trade-review-workspace.tsx` | `workspace.initialBootstrap` 总 span；getBootstrap、legacyExport、monthlyEvidence、aliases、aliasGate settled、summaries、publish-ready；`workspace.render.summaries/entries/initialCatalog/catalog`；`workspace.readiness` effect 观察 |
| 同上 | `workspace.bundle` 总 span；sourceAndFx 并行等待父 span；getHomepageSource、fxHeaders 两个并行子 span；prepare、fxJson、aliases、summaries、dailyAll Promise.all、entries、complete；source-counts、daily-counts、return/throw |
| 同上 | `workspace.fromGlobal` 及 catalog、own、view、facts、holdings 五个同步子阶段 |
| `app/components/homepage-v25/use-homepage-host.ts` | initializeGate；globalRead begin；reload start/end/returned；stale request/error/mismatch；deadline.beforeDomain、deadline.afterDomain、deadline.catch（调用及 decision）；catalog、completeGlobalRead、fromGlobal、onReadAccepted；accept / completion拒收 / deadline拒收 / read错误；timer schedule/fire/clear/stale/decision；React effect 提交观测 |
| `app/components/homepage-v25/financial-acquisition.ts` | prepare/complete 中的 assertShape、bindingEncode、bindingSha256、binding 父 span；prepare.monthlyEvidence、complete.inspectCarriers、complete.build；所有既有 fingerprint 的 `stableContents` 编码和 `sha256` 分开（kind=trades/metadata/quotes/fx/represented-trades/fx-body/fx-observation）；captureFx |
| `app/components/homepage-v25/financial-source-model.ts` | selectionClone、可选 candidateCurrent、episodeCoverage、qualify、originalEntries、prepareFinance、bounds、selectionEncode、retainedClone、freeze |
| `app/lib/reviews/homepage-v25-performance.ts` | finance.prepare.clone、sourceEncode、sourceSha256、sourceIdentity 父 span、collect、groupIndexes、feeFacts、feeIndexes、fxIndexes、accountSourceGraph、accountIndexGraph；groupIndexes 末尾仅输出一次 groupDigestMs/selectionMs/canonicalMs/quotesMs 聚合耗时 |

`groupIndexes` 内的四个聚合区间依次对应原有每组代码：组签名、成交选择与排序、规范化/ledger/ordinary fee checkpoint、日线过滤/交易日验证/排序。计时在既有循环旁采样，不逐条打印，不重放计算。

## 关联和时间语义

- 所有日志用 root 的共享 helper，包含 runId、side、seq、单调 `t` 和对齐 `epoch`。没有修改共享 helper。
- workspace bundle 从真正的传入 `requestId`、`context.request.generation/startedAt` 建立关联，`deadlineAt = startedAt + 15000`。fromGlobal 使用实际 context 的 generation；host 使用实际 token。没有 `request.id` 字段，也没有生成伪请求号。
- 初始 bootstrap 在首页 request 尚不存在时使用实际 `replayRequestSequence` 的 `bootstrapRequestId`，此标识不应与 homepage generation 混为同一个计数器。
- 内部纯同步函数不增加签名或数据字段，也不建立全局异步上下文。其子 span 通过包含它的同步 workspace.prepare/complete/fromGlobal 时间区间归属；若日志确有交错歧义，应保留未归属，不能猜测。
- FX 请求使用 hpFetch；底层 HTTP `id` / header 关联由共享 helper 和服务端负责人负责。workspace 的 source/fx 并行 span 提供拥有请求的外层时间边界。
- 同步 hpSync 阶段是主线程同步 wall time（可能包含 GC/抢占/日志开销），不能严格称为进程 CPU time。async span 包含网络/响应体/排队/同步调用及主线程恢复等待；以 HTTP/server/resource/longtask 证据进一步区分。
- sourceAndFx 是 Promise.all 墙钟等待，两个子 span 并行；dailyAll 同样覆盖原 Promise.all，不将证券请求串行化。嵌套父子 span 不相加。binding 与 sourceIdentity 也是父 span，不与其 encode/hash 子阶段相加。
- 首次 deadline 检查位于 catalog/fromGlobal 之前。`reject-deadline-beforeDomain` 可以直接证明没有进入 domain 阶段。第二次检查依旧在原有同步工作完成后、发布前。原始 15000ms 默认和 legacy timer 的既有 15010ms 均保持。
- timer 记录原 request.startedAt、原计算出的 requestedDelayMs、callback 触发时 actualDelayMs/lateByMs，仍用原来的 timeout 和取消方法。后台标签/主线程阻塞均可能使实际触发晚于目标。
- `react-commit` 是 useEffect 观察到的状态，不能等同于像素已绘制，也不是完整 React render 性能测量。host outcome ref 仅记录最近的已观察全局请求结果，和 UI 的 pendingGeneration/error 布尔值一起读。

## 数据保护和观测成本

只记录阶段、真实请求代次、状态布尔值、错误类型、集合数量和编码长度。不输出账户/证券身份、scopeKey、完整账单、金额、哈希内容、receipt 原文或错误 message。`utf16CodeUnits` 是已有编码字符串的 `.length`，明确不是 UTF-8 byte 数；没有为了测量大小额外 JSON.stringify/TextEncoder 大对象。日线 count 仅遍历 state 集合并读取数组 length。

原调用顺序、输入/返回数据、金额/身份校验、15 秒规则、copy/freeze、dispose、缓存和取消分支保留。签名编码与 hash 仍各执行原本次数；未重算业务对象来收集信息。增加了函数包装、performance 时钟采样、少量计数、JSON 日志以及 hpAsync 的 Promise 观察层；这些有非零开销，可能使接近截止的案例越过边界。该 copy 的绝对耗时不能冒充无 instrumentation 基准。金融图复制/编码和保护性检查均继续运行，计时不优化它们。

## 已核对与限制

- 已读原仓 AGENTS.md、development-workflow、当前任务 README / DESIGN-COVERAGE 和 systematic-debugging skill。
- 已逐段对比本次 diff，核对校验/返回/取消路径没有被修复或重排；原仓本代理五个对应源码与实施前副本逐字节相同。
- 最终 Node 26.0.0 `tsc --noEmit --incremental false` 已结束（exit 2），未报告本次五个文件错误；全量检查未通过，报告了未修改的 recall-integration 测试类型与 db Env.DB 类型错误，与首次检查结果一致。最终原始输出见 `CLIENT-TYPECHECK.log`。不能报告全量 typecheck PASS。
- 未启动服务、未使用浏览器、未接触数据库、未联网、未跑大型测试；浏览器相关门槛 NOT VERIFIED，交由 /root。
- 未深入逐叶记录 projection/facts/holdings：这些有完整外层同步 span；对深层进行每 item 日志会严重扰动大集合。本轮首先定位大阶段；不能以没有叶日志断言叶阶段无耗时。
- fromCollection、period/history 主动交互、图表/回放、触屏、所有控件检查不属此次桌面首读的范围。原有 bootstrap 自动迁移分支保留，仅其总体耗时和既有关键读取被观察。
- 原有 P1/F07/Bars 3/3 暂停保持；本观测代码不构成恢复实施、功能交付或问题修复。
