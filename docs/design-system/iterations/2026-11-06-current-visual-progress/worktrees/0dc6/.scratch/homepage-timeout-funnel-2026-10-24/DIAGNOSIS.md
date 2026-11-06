# 首页财务访问超时：完整漏斗诊断

本次完整桌面样本中，数据库读取成功，15 秒预算被行情请求扇出及前端大体积来源编码、摘要计算消耗。bundle 在 **13.827 秒**返回，随后 `fromGlobal` 同步执行 **3.704 秒**，最终于 **17.541 秒**被 `afterDomain` 截止守卫拒收。首次跨过 15 秒发生在 `finance.prepare.sourceEncode`，其后的 SHA-256 又执行约 2.135 秒。页面因此没有接受这次财务范围，显示超时和未知金额。

这是诊断结论，产品故障仍存在；没有修改财务算法、放宽 15 秒预算或恢复旧任务迭代。

## 样本与保护边界

- 日期：2026-10-24；工作区 HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，包含原有未提交修改，以 [baseline](BASELINE-MANIFEST.json) 绑定实际源码内容，不能仅凭 HEAD 复现。
- 桌面：真实浏览器 **1440×900**，`/home?scope=live&market=a&accounts=*&rangeMode=all`。不是窄屏、mock chart 或 Node 纯计算替代。保存了[截图](complete-desktop.png)、[可访问性树](complete-desktop-AX.txt)及[几何尺寸](complete-desktop-geometry.json)。
- 环境：[RUN-COMPLETE.json](RUN-COMPLETE.json)。从当前源码复制到临时应用，使用 Node 26.0.0 / SQLite 3.53.0，实际框架为 **vinext/Vite 8.0.13 开发服务**。观察性插桩及 collector 仅位于临时副本；[完整补丁](COMPLETE-INSTRUMENTATION.patch)和[副本哈希](COMPLETE-SOURCE-MANIFEST.json)已冻结。
- 数据：原业务库 WAL-aware 在线备份到 `complete.sqlite`，显式 `TRADEREVIEW_DB_PATH`，端口 **4391**。原 3333 服务未重启，原真实库页面未重载。快照含 1,866 executions、213 import_batches、11 trade_revisions、138 reviews、236 instruments；快照自身的既有 bootstrap 清理可能写入，仅发生于隔离库。
- 原工作区 887 个 baseline 文件与副本 884 个 manifest 文件最终均无差异：[核验](FINAL-SOURCE-VERIFICATION.json)。[实际监听及打开文件](RUNTIME-ISOLATION.json)证明 4391 连接 `complete.sqlite`，3333 仍连接原业务库。
- 原业务库五张保护表在 **03:32:11.568→03:43:58.667 UTC** 的逻辑行数和 SHA-256 均一致：[前](BUSINESS-BEFORE.json)、[后](BUSINESS-AFTER.json)。结论限于这些表及该时间区间，不能推广为全部表或其他会话无写入。

首个 cold 采样的 console 只保留最后 500 条，无法构造完整漏斗，已保留为 **NOT VERIFIED**，没有用后次覆盖。随后单独建立批量日志 collector，获得一个完整样本：session `1792813199721-gessxk125rl`、8 batches、3,921 events，seq 1–3921 连续、重复/缺号/transport failures 均为 0。后续 30 秒后台轮询不计入首读成本。

## 导航启动与财务预算分别计算

| 截止起算前的阶段 | 本样本耗时 | 解释 |
| --- | ---: | --- |
| document request→responseStart | 10,374.2 ms | 开发服务首次页面请求 TTFB，不能归为 SQLite 查询 |
| document→DOMContentLoaded / loadEnd | 10,718.0 / 10,719.1 ms | 包含上述 TTFB |
| 框架 GET /home 日志 | 约 10.4 s | compile 4.3 s、render 6.0 s；框架报告值，已含于导航，不再相加 |
| 初始 bootstrap 客户端跨度 | 680.5 ms | 起算前已有数据初始化；不是额外加到下面 15 秒 |
| document→globalRead.begin | 14,318.2 ms | load 后到 begin 的空隙未全部逐函数归因 |
| document→超时状态 React effect | 31,950.5 ms | effect 不是像素 paint；最终可见状态另由截图确认 |

因此用户感受到的冷启动约 32 秒，与应用的 **globalRead 15 秒预算**是不同口径。没有另取 warm 样本，也没有将冷编译结论推广到生产环境。

## 财务首读串行漏斗

唯一完整请求为 generation **2** / requestId **2**，固定预算 **15,000 ms**。下表使用同层串行跨度；内部并行和子跨度不再累加。

| 阶段 | 本阶段墙钟 | 相对 globalRead 起点的结束时刻 | 主要内容 |
| --- | ---: | ---: | --- |
| sourceAndFx | 1,288.9 ms | 1,292.8 ms | 首页源与 FX 并行；HTTP、body、来源合同验证 |
| acquisition.prepare | 1,131.3 ms | 2,424.2 ms | binding 420.2、monthly evidence 708.1 ms |
| FX JSON / aliases / summaries | 139.5 ms | 2,564.3 ms | 各 4.3 / 132.7 / 2.5 ms，间隙另计 |
| dailyAll | **7,242.6 ms** | **9,807.4 ms** | 236 个行情请求，154,410 根日线 |
| entries | 163.3 ms | 9,971.5 ms | 交易库条目构建 |
| acquisition.complete | **3,854.3 ms** | **13,826.3 ms** | binding 重检、来源构建和行情/交易指纹 |
| bundle 返回 | — | **13,827.0 ms** | 此时尚未超过预算 |
| host.catalog | 7.9 ms | 13,835.4 ms | 转换前目录 |
| workspace.fromGlobal | **3,703.8 ms** | **17,540.2 ms** | 来源 clone/encode/SHA、财务域准备 |
| afterDomain 守卫 | — | **17,541.0 ms** | `reject-deadline-afterDomain`，新财务范围未接受 |

未包裹胶水代码、日志调用及取整约为数毫秒，不能把表内嵌套的 bundle 返回点再次加到总时间。[结构化漏斗](FUNNEL-METRICS.json)可逐项回溯 seq、request id 和时钟。

```mermaid
flowchart LR
  A[globalRead 起算] --> B[来源与 FX 1.289 s]
  B --> C[准备与辅助读取 1.271 s]
  C --> D[236 个行情请求 7.243 s]
  D --> E[entries 与 complete 4.018 s]
  E --> F[bundle 返回 13.827 s]
  F --> G[fromGlobal 3.704 s]
  G --> H[17.541 s 守卫拒收]
```

## 上游 API、SQLite、浏览器分段

### 首页来源和汇率

首页来源 `http-3` 的服务端 route 为 **474.46 ms**，其中 snapshot **339.50 ms**、响应 JSON 构建约 **134.4 ms**。snapshot 内还包含行查询/物化、映射、规范编码及来源摘要验证；不是纯数据库执行时间。单项 execution query 约 17.9 ms、map/sort 约 115.6 ms，服务端 canonical 约 138.4 ms、SHA 约 31.7 ms，均已包含在父跨度内。

浏览器侧 headers **814.7 ms**、body-json **163.4 ms**、contract **309.8 ms**，来源 ResourceTiming encoded body **6,325,206 bytes**。contract 内 JSON.parse **23.0 ms**，其余主要为两次 canonical、TextEncoder 和摘要验证。这些证据不支持把全部 1.289 秒称为 SQL 或纯 JSON.parse。

FX `http-4` 命中本地日期缓存：ensureDaily **0.61 ms**、route **1.02 ms**，没有外部 provider 请求或重试。headers **814.2 ms**与首页来源并行；本次不是外部汇率请求耗尽预算。

### 行情扇出：最大单段等待

`readHomepageBundle` 在 `summaries.map(...)` 中同步派发 236 个 `readInstrumentMarketState(...includeIntraday:false)`，再通过 `Promise.all` 等待全部返回。关键请求为 **http-16…http-251**、连续 seq **193…428**；全部 server route / body 完成、HTTP 200，日线总计 154,410 根。

| 指标 | 结果 | 含义 |
| --- | ---: | --- |
| dailyAll 墙钟 | **7,242.6 ms** | 页面实际等待口径 |
| 236 server route 时长合计 / 区间 union | 2,954.75 / 2,954.75 ms | 已含下面 SQL/map/响应构建；不是新增 2.955 秒 |
| route 中位 / p95 / 最大 | 10.62 / 29.78 / 41.99 ms | p95 是本次 236 请求分布，不是多轮跑分 |
| SQLite query 叶子合计 | 1,413.25 ms | instruments 191.73、coverage 263.31、daily 958.21 ms |
| map 叶子合计 | 1,162.10 ms | instruments 220.56、coverage 715.98、daily 225.56 ms |
| response JSON 构建合计 | 239.27 ms | 包含在 route 内 |
| `requestStart−fetchStart` 中位 / p95 / 最大 | **4,910.95 / 6,454.5 / 6,558.1 ms** | 浏览器排队/调度等待；不能全部归给服务器 SQL |
| request→responseStart 中位 | 79.1 ms | 包含服务端处理等，不是纯线路延迟 |
| responseStart→responseEnd 中位 | 0.7 ms | 本地响应体传输量级 |
| encoded body 总量 | **43,076,943 bytes** | 约 43.1 MB，非 43 MB 的数据库文件读取 |

ResourceTiming 没有业务 request id，使用 path 与最近唯一开始时间一一匹配；最大偏差 0.3 ms。分析脚本没有简单截取整个 dailyAll 时间窗：该窗还有 3 个后台发起，关键 236 请求由同步 map 连续序号及 id 确定。

至 seq3495 的 helper 请求共有 501 个，其中 market-data 472 个（关键 236、后台另 236），另有 metadata 22、bootstrap 2、reviews 2，及 aliases/source/FX 各 1。后台和首读确有重叠，但没有关闭后台的对照实验；已测后台 route 在关键窗口重叠量级约 31.89 ms，**不能把全部 7.24 秒归咎于后台，或承诺去掉后台会节省某个秒数**。未走 helper 的请求不在上述 501 的覆盖范围。

## 首次越界点与前端同步阻塞

对应原工作区代码链：[readHomepageBundle](../../app/components/trade-review-workspace.tsx#L2233) → [236请求的Promise.all](../../app/components/trade-review-workspace.tsx#L2257) → [fromGlobal的来源拥有逻辑](../../app/components/trade-review-workspace.tsx#L2292) → [prepareHomepageV25Source调用](../../app/components/homepage-v25/financial-source-model.ts#L181) → [clone及完整来源规范编码/SHA](../../app/lib/reviews/homepage-v25-performance.ts#L647)。[host域转换后的再次截止检查](../../app/components/homepage-v25/use-homepage-host.ts#L174)解释了为何bundle返回后仍会被拒收。行号绑定本次baseline；日志插桩名字仅存在临时copy。

`acquisition.complete` 的 3,854.3 ms 中，build 为 3,351.6 ms：行情指纹 encode **598.4 ms**、SHA **2,186.5 ms**，摘要输入 **44,092,801 UTF-16 code units**；交易指纹 encode **138.3 ms**、SHA **413.4 ms**，输入 7,387,074 UTF-16 units。这已经在进入域转换前消耗了大部分余量。

随后 `prepareHomepageV25Source` 再对保留的来源图生成身份：

| fromGlobal 内部阶段 | 相对起点区间 | 耗时 |
| --- | ---: | ---: |
| clone | 13,878.7→14,204.0 ms | 325.3 ms |
| **sourceEncode** | **14,204.1→15,252.1 ms** | **1,048.0 ms；此处首次越过 15,000 ms** |
| sourceSha256 | 15,252.2→17,387.4 ms | 2,135.2 ms |
| sourceIdentity（父跨度） | 14,204.0→17,387.4 ms | 3,183.4 ms，不能再与两子项相加 |
| accountSourceGraph | 17,388.3→17,523.5 ms | 135.2 ms |

sourceSha256 输入 **41,578,004 UTF-16 code units**；该数字不是传输 bytes。两个先后独立的行情/来源身份 encode+SHA 共约 **5,968.1 ms**，占最终 17.541 秒约 34%。这支持检查大体积来源身份工作的边界及重复遍历；不证明可以删掉身份校验。

本样本 `prepareFinance` 的 **entryCount=0、groupCount=0**，逐组 digest/selection/canonical/quotes 累计为 0。因此此处热点是保留的大型来源图处理，不能误写成持仓逐组财务算术。为何条目未进入可计算分组、金额语义是否正确，仍需原财务任务独立验证。

浏览器记录到一个 **7,735 ms** 长任务（performance 24,123.5→31,858.5），覆盖最后日线回调、entries、complete、fromGlobal 和拒收。超时计时器计划 delay 14,432 ms，实际 callback delay 17,059.6 ms，晚 **2,628 ms**；它在拒收后才执行并因 stale 被忽略。实际故障来自 **afterDomain 守卫**，定时器不能在同步 JavaScript 执行中途抢占。

## 页面终态与后续修复方向

桌面截图、AX 和 host.render 一致：顶部“读取已超时，新范围未应用。”；四项指标为 `—`；期间控件仍显示“期间数据读取中”且禁用；曲线“期间数据尚未就绪”；持仓出现初始 0 条及“当前范围暂无持仓”。这是失败后的页面状态，**不能推导业务库为空或当前确无持仓**。历史已平仓仍显示尚未接入，沿用旧暂停状态。本轮未点击修复、筛选、跳转或任何写控件。

后续受控修复应优先围绕两个已测热点设计，而不是先延长截止时间：

1. 检查 acquisition 与 finance 来源身份的拥有边界，评估避免多次对大型行情图规范编码/摘要的方案；必须保留形状、绑定、身份及金额合同，并通过篡改/陈旧来源反例验收。
2. 检查 236 请求的全量行情获取及后台重叠，比较批量读取或共享获取等方案；分别测浏览器队列、SQL/map 与完整首读墙钟，不能只看单 API 快了多少。
3. 性能改动后独立验证非零财务条目的金额、历史汇率资格和桌面终态，保留原 15 秒及旧性能任务门槛。超时后的 loading/空持仓提示也须按功能状态安全独立验收。

以上是证据支持的候选方向，没有执行架构或产品修复；**P1/F07、ContributionBars 既有 3/3 FAIL 暂停保持**，本诊断不占用或重置修复轮次。

## 证据、复算与限制

原始输入：[冻结服务端日志](FROZEN-SERVER.log)、[冻结浏览器日志](FROZEN-BROWSER-COLLECTOR.ndjson)、[collector ACK](complete-collector-ACK.json)。分析：[完整 trace](complete-trace.json)、[analyze-trace.py](analyze-trace.py)、[build-funnel.py](build-funnel.py)、[指标](FUNNEL-METRICS.json)。独立 Astra 只读复核和主代理验收分别保存于 [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md)、[FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)。

复算仅处理保存的文本，不连接数据库或服务：`python3 .scratch/homepage-timeout-funnel-2026-10-24/build-funnel.py`。临时诊断预览为 [4391 首页](http://127.0.0.1:4391/home?scope=live&market=a&accounts=*&rangeMode=all)，服务保持运行；其定位是隔离快照诊断，不是修复交付。

若需重启同一诊断副本，在临时目录 `/private/tmp/tradereview-home-funnel-oiy236zg` 中运行（不要执行占用 3333 的 make dev）：

```sh
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-timeout-funnel-2026-10-24/complete.sqlite /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node scripts/start-local.mjs --dev --hostname 127.0.0.1 --port 4391
```

这是一个完整、带观测开销的开发环境样本：计时包装、数组、日志 JSON、额外 await/微任务和每 5 秒 collector POST/同步 append 都可能影响调度。它可以定位本次失败链，不能充当无插桩 3333 的精确耗时、warm 基准、优化节省量或 production 指标。SQL span 含原生行物化，不是磁盘/锁/CPU 的分别采样；body-json 含传输等待、解析及 JS 恢复，不能称为纯 JSON CPU。父子、并行和跨进程区间不能重复相加。没有采样 CPU profile，也未穷尽所有未插桩函数。

服务端 17 文件语法检查通过；完整 TypeScript 检查仍失败于已有 Recall 测试 `viewport/exact` 和 `Env.DB` 类型错误，见 [client](CLIENT-TYPECHECK.log)、[server](SERVER-TYPECHECK.log)。不将诊断接受写成产品测试全通过。
