# 独立诊断复核

Status: COMPLETE（仅诊断复核）；完整样本漏斗、首次截止越界与终态已交叉核对。产品故障仍存在。

复核者：`/root/astra_funnel_audit`。仅只读源码、配置和已保存证据；不打开数据库、不发 API、不使用浏览器、不启动服务、不修改产品或插桩。唯一写入为本记录。依据 `systematic-debugging`、`docs/agents/frontend-control-audit.md`、`docs/agents/development-workflow.md` 与本目录范围矩阵。此记录不解除旧 P1/F07 或 ContributionBars 3/3 暂停。

## 静态核对（2026-10-24，首轮）

- 原 worktree：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；原始内容以 `BASELINE-MANIFEST.json` 冻结，逐文件重新计算 SHA-256 暂无变化。
- 插桩副本：`/private/tmp/tradereview-home-funnel-oiy236zg`。检查了相对原始 dirty 源码的全部 app 差异、`db/sqlite.ts` 及共享 helper；`conf`、`scripts` 与原始源码一致。
- 未发现修改财务输入/计算规则、形状/摘要验证、日期/金额/身份值、HTTP 路径或查询参数、SQLite SQL 或数据库解析优先级的差异。15,000 ms（旧非配置路径 15,010 ms）守卫与 before/after-domain 拒收分支保留。原有 Promise.all 的来源/FX 并行及日线扇出保留；原有缓存命中条件和 FX 请求超时、重试次数未改。
- 插桩新增 `x-hp-profile-id` 请求/响应头、计时和计数、AsyncLocalStorage 请求关联、React effect 观察及 PerformanceObserver。它们是临时副本诊断行为，不是零成本执行；console/JSON、紧凑 detail 收集、额外 Promise/await 微任务与计时调用可能扰动墙钟时间和临界截止附近的结论。不可将插桩耗时无误差等同原始产品耗时。
- `hpSync`/server 同步包装保留返回值和异常；源码中的 acquisition dispose、SQLite commit/rollback 及 FX timeout 清理仍执行。`hpAsync` 添加微任务边界，虽然没有主动改变产品并发策略，但应在测量限制中明确。

## 计时解释与缺口

- `workspace.bundle.sourceAndFx` 包含并行来源与 FX；`dailyAll` 包含并行 HTTP 请求；`host.reload`、bundle、contract、finance/source 之间有嵌套。父子跨度和并行 request 总和均不可作为请求墙钟总时长。
- `http.headers` 是 fetch 发起到 JS 收到 Response，包含排队、编译/服务器处理/传输及主线程恢复，不能直接称为纯网络时间。`body-json` 同时包含剩余 body 等待与解析，不能直接称为纯 JSON CPU。
- `contract.sha256` 包含异步 digest 及 JS continuation 等待；`PerformanceResourceTiming.responseEnd`、longtask 的 `start/ms` 才能帮助区分已收完网络而 JS 尚未恢复的区间。observer 事件自己的 epoch 是回调执行时间，不是该资源/长任务的发生时刻。
- 原生 SQLite query 的墙钟区间含查询、行物化及等待；没有 DB 引擎 CPU profile，不能进一步断言纯磁盘或纯 CPU。同步财务/编码区间可定位主线程占用，但不等于采样 CPU profile。
- 同一页面多个 generation/Strict Mode/bootstrap 重启须分开。HTTP id 按浏览器 helper 递增，重新加载后会复用；服务器关联时须同时用 sample 时间窗与 route，不可跨 cold/warm 按 id 合并。
- `host.render` 的 `react-commit` 来自 useEffect，可观察提交后 effect，不代表像素已绘制。最终可见终态仍需主代理保存的真实 DOM/截图。
- 初轮发现的 `analyze-trace.py` 的 selected 中 `host.reactCommit` 与实际 `host.render` / `react-commit` 不匹配，摘要会漏该事件，但 browserEvents 原始数组保留它。market-data SQL/map/编码跨度位于 `server.route` end 的 `detail`，顶层 aggregate 没有展开；判断 SQL 成本必须读取 detail。主代理已在完整样本分析中修正这两处；本复核仍直接核对原始事件及 detail。
- 同步聚合循环的 finally end 可能在异常时没有 `failed` 字段；上层 throw/catch 与 parent span 应共同检查，不能因 end 存在就判成功。

## 暂定门槛

| 项目 | 状态 | 范围/证据 |
| --- | --- | --- |
| 原产品源码未被本次插桩改变 | PASS（首轮） | 独立 SHA-256 对比 baseline，0 差异；需最终再核对 |
| 插桩未主动变更截止/财务/查询/并发合同 | PASS（静态） | 相对原 dirty 源码逐段 diff；存在上述观测开销 |
| 服务实际隔离数据库及原业务数据保护 | NOT VERIFIED（本复核者） | 不访问数据库或服务；由主代理提供运行与逻辑摘要证据 |
| 当前桌面请求漏斗与首个截止越界点 | NOT VERIFIED | 等待原始 browser/server 日志 |
| 真实页面最终状态 | NOT VERIFIED | 等待主代理 DOM/截图；本复核者不开展浏览器操作 |
| 修复/全页控件/视觉保真/写流程验收 | NOT APPLICABLE | 本轮仅诊断，无此修复或交付授权 |

## 首个 cold 采样缺测（保留失败证据）

主代理报告 CUA console 读取硬上限为 500 条；独立读取 `cold-browser-logs.json` 确认恰有 500 个 HP_FUNNEL 事件，`seq` 从 2888 到 3387，仅保留后段 http/body-json、render.entries/initialCatalog、resource/longtask。此片段没有 host 或 workspace.bundle 事件，不能由“没有”反推它们未发生，也不能形成完整首读漏斗或首个截止越界结论。原始采样保留为 NOT VERIFIED，不用后续重载覆盖。

主代理拟新增临时持久化日志 transport。审查建议：固定 collector 输出文件、不触达数据库；collector 不接入自身观测；原生 fetch 和 resource observer 排除 collector 避免反馈递归；顺序号与 batch/ACK/失败/丢弃计数用于完整性；记录批量 POST 与主访问竞争连接及序列化/调度开销。后续样本须独立命名、重新冻结观测版本，不能冒充无扰动的首样本。

已只读复核 transport 实现：helper 先入内存缓冲，每 5 秒使用原生 fetch 发送；collector 固定写 `BROWSER-COLLECTOR.ndjson`，没有数据库 import；resource observer 排除 `/api/diagnostics/`，没有显见反馈递归。新增 `session` 分离重载页面。失败后把 batch 放回缓冲，因此“文件已追加但 ACK 丢失”可产生重复事件；分析需按 session+seq 去重并验证连续序号。collector 的同步 append、请求解析与客户端批量 JSON/传输增加观测开销，不能声称完全不影响调度或时间。


## 冻结完整样本的独立复算

证据：`FROZEN-BROWSER-COLLECTOR.ndjson`、`FROZEN-SERVER.log`、从冻结文件重建的 `complete-trace.json`、`RUN-COMPLETE.json`。独立直接解析 collector 得到 session `1792813199721-gessxk125rl`，8 个 batch，3,921 条事件，seq 1–3921 连续，重复 0、缺号 0、transport failures 0。首读及初始后台扇出统计按主代理冻结口径限制到 seq ≤3495；更后的 30 秒后台轮询不混入首读成本。

这只证明从 helper 启动后的事件完整，不能弥补首个 cold 采样被 console 截断，也不能证明无观测开销。完整样本是后续独立重载，使用 `complete.sqlite` 在线快照；不是原产品无插桩 cold-run 的精确耗时基准。

最终复核 SHA-256：原工作区 `BASELINE-MANIFEST.json` 887 文件，差异 0；临时副本 `COMPLETE-SOURCE-MANIFEST.json` 884 文件，差异 0。临时插桩仅存在副本，未回写原产品源码。本报告的所有分析操作仅读取文本、日志和已保存截图，没有打开数据库或请求服务。

### generation 2 的串行漏斗

只分析唯一 `host.globalRead.begin` 的 generation 2 / requestId 2。`startedAt=1792813200908`、`deadlineAt=1792813215908`，预算固定 15,000 ms。导航从 document start 到 loadEnd 为 10,719.1 ms，属于截止起算前的启动背景；不能算入这 15 秒。

下列行选取同层串行跨度，合计约 17,532.9 ms；与 afterDomain elapsed 17,541 ms 相差约 8.1 ms 为跨度之间的未包裹胶水/日志/时钟取整。不能再加入其子阶段。

| 同层阶段 | 墙钟 ms | 占 17,541 ms | 说明 |
| --- | ---: | ---: | --- |
| sourceAndFx | 1,288.9 | 7.35% | 来源与 FX 并行，以来源支路完成为边界 |
| prepare | 1,131.3 | 6.45% | 来源 binding 与 monthlyEvidence |
| fxJson | 4.3 | 0.02% | FX body 读取/解析 |
| aliases | 132.7 | 0.76% | 原 alias loader |
| summaries | 2.5 | 0.01% | 标的汇总 |
| dailyAll | 7,242.6 | 41.29% | 236 请求并行等待，154,410 根日线 |
| entries | 163.3 | 0.93% | 交易库 entries 构建 |
| complete | 3,854.3 | 21.97% | acquisition 校验与完整来源指纹 |
| host.catalog | 7.9 | 0.05% | 域转换前 catalog |
| completeGlobalRead | 3,705.1 | 21.12% | 包含 fromGlobal 3,704.4 ms / workspace.fromGlobal 3,703.8 ms |

bundle 在 elapsed 13,827 ms 返回，`beforeDomain` 判定未过期。域转换随后占用约 3.705 秒，`afterDomain` 在 elapsed 17,541 ms 判定过期，seq 1522 明确 `reject-deadline-afterDomain`。没有成功接受新的财务范围。

### 首次越界的最深已测同步跨度

| 同步阶段 | 相对 startedAt 开始 → 结束 ms | duration ms |
| --- | ---: | ---: |
| finance.prepare.clone | 约 13,878.7 → 14,204.0 | 325.3 |
| finance.prepare.sourceEncode | 14,204.1 → 15,252.1 | 1,048.0 |
| finance.prepare.sourceSha256 | 15,252.2 → 17,387.4 | 2,135.2 |
| finance.prepare.sourceIdentity（父跨度） | 14,204.0 → 17,387.4 | 3,183.4 |
| finance.prepare.accountSourceGraph | 约 17,388.3 → 17,523.5 | 135.2 |

**首次 15 秒 deadline 越界位于 `finance.prepare.sourceEncode` 内。SHA 开始时已越界约 252 ms，因此不能把首次越界点写成 SHA。** sourceSha256 输入 41,578,004 UTF-16 code units；本次 prepareFinance 的 entryCount/groupCount 均为 0，group digest/selection/canonical/quotes 汇总计时全为 0。耗时证据指向保留的大型来源图编码/摘要，不支持把这里称为逐组财务计算瓶颈。

更早的 acquisition.complete 已占 3,854.3 ms，其中 quotes fingerprint 的 encode 598.4 ms + SHA 2,186.5 ms，输入 44,092,801 UTF-16 code units；trades fingerprint encode 138.3 ms + SHA 413.4 ms。这些与 sourceIdentity 是先后发生的不同工作，不应只报告最后一段而忽略先前预算消耗。

PerformanceObserver 记录 browser perf start 24,123.5、duration 7,735 ms 的长任务，覆盖 dailyAll 最后 body 完成后，到 entries、complete、fromGlobal、afterDomain 拒绝的整段。计时器原计划 delay 14,432 ms，实测 callback delay 17,059.6 ms，晚 2,628 ms；它在 seq 1543 才触发并于 1544 ignore-stale。**实际拒绝来自同步工作完成后的 afterDomain 守卫，timer 并未在预算到点时中断同步执行。**

### 236 个日线请求、排队与后台重叠

源码保留 `Promise.all(summaries.map(...readInstrumentMarketState(...includeIntraday:false)))`。首读 dailyAll 的同步扇出对应连续 http-16…http-251；这 236 个请求全部有 server route 与 body 完结事件，全部 HTTP 200，body 的 dailyCandlesCount 总计 154,410，与 bundle 汇总一致。

- dailyAll 总墙钟 7,242.6 ms；请求发起横跨 perf 16,886.5…17,455.3 ms，最后 body 在 24,123.5 ms 完成。不能把 236 个 headers 累加值 1,082,049.3 ms 当成页面等待。
- 236 server route 的区间合计及 union 均约 2,954.75 ms；首个 route 到最后 route 的包络约 7,187.79 ms。route 平均约 12.52 ms，中位 10.62 ms，p95 29.78 ms，最大 41.99 ms。
- ResourceTiming 仅记录脱敏 path，没有 request id；按 fetch 发起时间一对一最近匹配这 236 请求，最大偏差 0.3 ms。该时间匹配支持但不是额外的原生 request-id 关联。`requestStart−fetchStart` 中位 4,910.95 ms、p95 6,454.5 ms、最大 6,558.1 ms；TTFB 中位 79.1 ms；responseStart→responseEnd 中位 0.7 ms。总 encoded body 43,076,943 bytes。这显示大量时间在请求调度/排队，而非每个请求都在执行数秒 SQL。
- 首读 seq ≤3495 共 501 个带 helper 的 HTTP 发起，其中 critical 日线 236 个，另外还有 236 个后台 market-data、22 个 metadata、2 bootstrap、2 reviews，以及各 1 个 aliases/homepage-source/FX。此统计不覆盖未走 helper 的所有请求，不能当完整网络请求数。
- 后台日线确实重叠：http-13/14 的 body continuation 延到扇出之后；http-15 在日线窗口内执行；http-252/253/255 与扇出排队尾部及后续长任务交叠。窗口内已插桩后台 route 重叠实例为 http-15、252、253，完整 route duration 合计约 31.89 ms（253 有小段超出窗口）。reviews/metadata 等未做同样 server 深分段。
- http-252 的 body-json 墙钟 7,739.9 ms，但服务器 route 仅 8.48 ms；它的 body continuation 被 critical 后续长任务延后。这是“body-json 不等于 JSON parse CPU”的直接反例。

存在连接、事件循环和渲染竞争是观测事实；没有移除后台读取的对照实验，不能从本样本推算去掉后台能节省几秒，更不能把整个 7.24 秒归咎于后台。236 个 critical 请求自身扇出、浏览器队列、vinext/Vite 开发服务器和观测 transport 也同时存在。

### SQLite、解析和 FX 的实际量级

| 子项 | 本样本观测 | 解释 |
| --- | --- | --- |
| homepage-source http-3 server route | 474.46 ms | 含 snapshot 339.50 与 response JSON 134.40；不是纯 DB |
| snapshot 内 bootstrap | 157.79 ms | execution query 17.92、map/sort 115.57；此外还有其他表、映射 |
| snapshot 摘要验证 | canonical 138.39、SHA 31.74、shape 8.50 ms | 包含在 snapshot 父跨度内 |
| 来源客户端 | headers 814.7；body-json 163.4；contract 309.8 ms | 三者串行；body-json 包含 body 等待；contract 内纯 JSON.parse 23.0 ms |
| critical 236 日线 SQL 叶子合计 | 1,413.25 ms | instruments 191.73、interval-coverage 263.31、daily-candles 958.21；为 SQL 调用墙钟，不是纯磁盘耗时 |
| critical 日线 map 叶子合计 | 1,162.10 ms | instruments 220.56、interval-coverage 715.98、daily 225.56；独立于 query 但包含于 route |
| critical 日线 response JSON 合计 | 239.27 ms | 包含于 route；不能再加入 route 总量 |
| critical 日线客户端 body-json | 中位 1.0、p95 112.8、最大 134.1 ms；累计 4,218.8 ms | 重叠/等待跨度，不可作为 4.219 秒 JSON CPU或新增串行成本 |
| FX http-4 | cache hit；ensureDaily 0.61 ms；server route 1.02 ms | 本次无外部 provider 请求/回退；headers 814.2 ms 与来源并行；FX JSON 4.3 ms |

就本次 critical 日线而言，已计 query 叶子总量相当于 dailyAll 墙钟的约 19.5%，route 本体合计相当于约 40.8%；这是单服务已测操作量级对照，不是严密可加的跨进程时间分摊。首页 snapshot 还有未逐 SQL 拆开的 counts/orphan/settings 等操作，不能将所列叶子总量冒充全部 SQLite 耗时。FX 没有外部等待，排除“本次因 FX provider 超时撑满 15 秒”的解释。

## 终态与最终复核结论

直接阅读主代理保存的 `complete-desktop-AX.txt`、`complete-desktop-geometry.json` 并查看 `complete-desktop.png`（未操作浏览器）：1440×900，A股/全部账户；顶部可见“读取已超时，新范围未应用。”，指标为破折号，图表显示“期间数据尚未就绪”，期间控件仍为“期间数据读取中”。这与 seq1548 host.render/hasGlobalError=true/outcome=reject-deadline-afterDomain 一致。仅确认诊断终态，不构成全页视觉或控件验收。

| 最终门槛 | 结论 |
| --- | --- |
| 原产品源码保护 | PASS：887 个 baseline 文件最终 0 差异 |
| 观测副本版本冻结 | PASS：884 个 complete manifest 文件最终 0 差异 |
| 有意业务语义/截止/查询目标修改 | 静态未发现；额外微任务、日志、collector 开销明确保留限制 |
| 完整样本事件序列/漏斗/首越界 | PASS：冻结连续日志、requestId、generation、服务器细节与 longtask 交叉证据 |
| 真实超时终态 | PASS（已保存证据的独立审阅；浏览器由主代理执行） |
| 原业务数据库未改动 | 本复核者 NOT VERIFIED：遵守不打开数据库边界，需主代理独立逻辑摘要/运行证据 |
| 原产品无插桩精确耗时、改动因果贡献 | NOT VERIFIED：不存在无观测开销的同条件对照或 CPU sampling profile |
| 修复、全控件、全视觉、写流程、旧 P1/F07 和 ContributionBars | 未开展；旧暂停继续，不能以本诊断解除 |

可接受的诊断结论：本版本完整样本的 15 秒预算先被日线扇出与 acquisition 指纹消耗至约 13.827 秒，fromGlobal 再执行大型来源图 clone/encode/SHA；首次超时发生在 sourceEncode 内，最终 afterDomain 拒收。此证据足以确定本样本失败链和后续需要受控验证的热点，尚不构成产品修复或某一种修复方案的验收。
