# 服务端、存储消费及 FX 诊断插桩

状态：**代码已冻结；静态语法检查通过；运行时采样与最终归因由主代理执行，本报告不声称运行时验收通过。**

工作范围为 PF02/PF03 首页访问耗时取证。遵循 systematic-debugging 的“先收集跨层证据，再判断原因”，没有实施性能修复。P1/F07/Bars3/3 保持暂停。所有应用代码修改仅存在于 `/private/tmp/tradereview-home-funnel-oiy236zg`；原工作树仅新增本诊断报告、补丁、校验记录。此次负责的 17 个原路径与主代理先前保存的 baseline manifest 一致（其中 2 个新辅助文件在原仓和 baseline 均不存在）。

## 产物与校验

- `SERVER-INSTRUMENTATION.patch`：15 个已有文件的观察性修改及 2 个新增辅助文件；基于原工作树的实际内容对比，不以 HEAD 替换用户已有改动。
- `SERVER-INSTRUMENTATION-MANIFEST.json`：全部 17 个路径、原文件与副本 SHA-256、baseline 一致性及类型错误文件一致性。
- `SERVER-SYNTAX-CHECK.json`：最终冻结代码 17/17 可被 TypeScript transpileModule 解析，0 个语法错误；没有加载或执行应用模块。
- `SERVER-TYPECHECK.log`：固定 Node 26.0.0 执行 `tsc --noEmit --incremental false --pretty false` 的完整静态输出。退出码 2：Recall 测试文件中的 `viewport`/`exact` 类型错误，以及 `db/index.ts` 的 `Env.DB` 类型错误。错误所指文件在原仓、副本与 baseline 中哈希一致；本次输出没有指向这 17 个插桩文件的错误。未在 baseline 另跑完整 tsc，因此这不是“完整类型检查通过”的证据。

本代理未启动服务、打开数据库、发 HTTP 请求、打开浏览器或执行全量测试。主代理独立运行的服务/采样不属于本报告的验证操作。静态 tsc 启动早于最后几处观察字段调整；最终语法检查与 manifest 均晚于代码冻结。运行时行为等价性仍需结合主代理的采样审阅，不以静态检查替代。

## 请求关联与日志格式

复用主代理的 `app/lib/diagnostics/homepage-profile.ts`，没有修改该共享文件。`sqlite-http-client` 与 migration client 的默认 fetch 改为诊断 `hpFetch`；显式注入的 fetcher 保持原样。`hpFetch` 向同源 `/api/` 请求加 `x-hp-profile-id`，被包裹的 GET 路由读取并回显该 header。服务器 AsyncLocalStorage 将同一 id/route 传给嵌套同步和异步观察。无法取得合规 header 时分配 `server-N`，不能假定这种 id 与某个浏览器请求已关联。

普通日志沿用 `[HP_FUNNEL]` JSON：runId、side、seq、t、epoch、stage、phase。`operationStartT`/`operationEndT`/`operationMs` 覆盖被观察的调用，开始采样位于本层 start console 输出之后。异常仅记录类型并重抛，保留调用方原来的错误转换。不会记录账户、证券、交易记录、数据库路径、SQL 参数或 response payload。

为控制首页 market-data fan-out 的诊断开销，每个 market-data 请求只有 route start/end 两条主要 JSON 日志。内部同步阶段累计在 end.detail；每项包括 `stage,startT,startEpoch,endT,endEpoch,operationMs` 及可直接获得的 rows。瞬时事件包括 `stage,phase,t,epoch`。detail 按完成顺序排列，嵌套阶段会重叠，**不可把它们直接相加**。若路由长期不结束，已开始但尚未回传的 detail 不会单独输出；route start 可以证明请求仍未完成。

客户端 `storage.http.body-json` 仅调用一次原有 `response.json()`，记录回显 id、URL pathname、status、可选 Content-Length 与已存在数组的 length。没有为计数重新序列化 payload，没有读取响应 body 两次。HTTP headers 日志只表示 fetch 返回响应头；body-json end 才表示客户端已取得解析结果。

## 阶段覆盖

| 层/入口 | 主要 stage | 可解释的边界 |
| --- | --- | --- |
| SQLite 连接 | `sqlite.open`、`sqlite.resolve-path`、`sqlite.connection`、`sqlite.ensure-directory`、`sqlite.native-open`、`sqlite.initialize`、`sqlite.migration.apply` | 缓存命中与首次连接、原初始化及实际新增 migration；migration 仅记录版本/数量 |
| status/bootstrap | `storage.status.read`、`storage.bootstrap.read` | 初始可用性与 bootstrap 获取，含相应 DB 下层阶段 |
| homepage-source snapshot | `snapshot.total`、`snapshot.transaction.begin`、`snapshot.counts`、`snapshot.orphan-check`、`snapshot.bootstrap`、`snapshot.recall-summaries`、`snapshot.binding-canonical`、`snapshot.sha256`、`snapshot.shape`、`snapshot.transaction.commit`/`rollback` | 事务、读取、组装、canonical JSON、摘要与 shape 分开；count/materialized 事件含数量 |
| bootstrap 组装 | `bootstrap.migration/executions/importHistory/instruments/reviews/reviewStates/tagSuggestions/marketDataJobs/settings` | 保留原字段求值顺序，观察各组整体成本 |
| 大表读取和投影 | `sqlite.instruments.query/map`、`sqlite.executions.query/map-sort`、`sqlite.import-history.query/project` | SQL 原查询与 JS 投影/排序分别观察；不逐行打点 |
| reviews 兼容构造 | `sqlite.reviews.legacy-read/recall-read/build-episodes/bridge` | 保留原多次读取和 episode 构造路径，观察其成本 |
| market-data | `market.*.read`、`sqlite.daily-candles.query/map`、`sqlite.market-candles.query/map`、`sqlite.interval-coverage.query/map` | route 校验、DB读取及行映射；每请求 detail 中记录 rows，便于整体 fan-out 统计 |
| aliases | `aliases.read`、`server.response.json` | 原 migration aliases 查询与 JSON 响应建立 |
| JSON 响应 | `server.response.json` | 原 `Response.json` 的同步调用，与 DB/shape 阶段分离 |
| 浏览器 JSON 消费 | `storage.http.body-json`、`storage.migration.shape` | headers 之后的 body 取得与 JSON 解析总等待；aliases 结构校验 |
| homepage contract | `contract.total`、`contract.detach.canonical`、`contract.detach.json-parse`、`contract.shape`、`contract.binding-canonical`、`contract.text-encode`、`contract.sha256`、`contract.digest-hex` | 原 detach、shape、binding 与 WebCrypto 摘要顺序；记录已有 chars/bytes 与条数 |
| FX route | `fx.service.acquire`、`fx.ensure-daily`、`fx.refresh`、`fx.snapshot.read` | 缓存 service、ensureDaily/refresh 调用及旧 snapshot 路径 |
| FX service | `fx.read`、`fx.local-settings.read`、`fx.local-state.parse`、`fx.daily-cache` decision、`fx.refresh` inFlight 事件 | 区分日期 cache hit、join in-flight、启动 refresh、本地 store 读取/解析 |
| FX 外部路径 | `fx.external.total/headers/body-text/retry-wait`、attempt/timeout 事件、HTML/state/persist 阶段 | 默认超时 8000ms、2 次尝试及既有 backoff 不变；外部响应头等待、文本 body、解析、存储分别观察 |

具体 stage 拼写以补丁和原始日志为准。工作限定于观察，SQL、业务返回值、缓存截止、错误映射、事务顺序和 FX 默认值均保留原实现；原有安全检查不绕过。仅增加诊断 header 和调用包装，不移除现有昂贵步骤。

## 修改文件清单

新增：

- `app/lib/storage/homepage-profile-server.ts`
- `app/lib/storage/homepage-profile-client.ts`

修改：

- `app/lib/storage/homepage-source-contract.ts`
- `app/lib/storage/homepage-source-snapshot.ts`
- `app/lib/storage/sqlite-http-client.ts`
- `app/lib/storage/sqlite-store.ts`
- `app/lib/storage/tradingview-account-migration-client.ts`
- `app/api/storage/homepage-source/route.ts`
- `app/api/storage/status/route.ts`
- `app/api/storage/bootstrap/route.ts`
- `app/api/storage/market-data/route.ts`
- `app/api/storage/tradingview-account-migration/aliases/route.ts`
- `app/api/storage/tradingview-account-migration/http.ts`
- `app/api/trading-room/fx/route.ts`
- `app/api/fx/route.ts`
- `app/lib/fx/fx-service.ts`（主代理明确扩展授权）
- `db/sqlite.ts`

## 计时解释与未覆盖项

1. `Response.json` span 覆盖同步响应构造，不等于 socket 写完、下载完成或浏览器可交互。没有为获得响应 bytes 重新 JSON.stringify；真实传输/编码 bytes 应读取主代理的浏览器 ResourceTiming。Content-Length 缺失时保留 null。`chars` 是 JavaScript 字符串长度，`TextEncoder.byteLength` 才是实际编码字节。
2. browser 与 server 的 performance time origin 不同；跨端按 HTTP id 与 epoch 对齐，不能相减各自的 t。同源缓存、连接排队、框架编译/调度、socket 发送等仍需资源/导航时间和 route 外等待补齐。
3. SQLite query span 包含 prepare/all 与原生结果转换，不能直接称为纯磁盘时间或 SQLite 内核 CPU 时间；锁等待、OS page cache、磁盘 I/O 不再拆分。Recall summary repository 内部查询/解析未改，仅测其聚合调用。较小的 bootstrap 子结构和 market coverage 段内部仍为聚合。
4. 非 market span 的 operationMs 去掉本层 start/end console 调用，但包裹 span 仍包含下层日志与辅助采样成本；market detail 仍有数组写入成本。异步包装会增加少量 Promise/microtask 调度。插桩结果是诊断副本的观察，不应宣称原始无插桩耗时完全相同，更不能把 console 开销归为 SQLite 根因。
5. `response.json()` 的 wall time 混合 body 等待、解码/解析和主线程调度；由 ResourceTiming.responseEnd 与 longtask 判断下载结束后是否还阻塞。hpFetch headers 返回不等于 body 完成。
6. FX timeout/race 和原有请求重试行为保留。只有采样实际进入相应分支才能证明该次页面的外部等待，不能因代码存在重试便推断发生了重试。
7. 路由 GET 是本轮重点。若未来调用部分共享 POST/PUT 返回辅助函数，会出现未关联的观察日志；此报告不宣称写路径已验收。未给所有 API 添加 route wrapper，也未修改业务计算文件或共享浏览器 helper。
8. runtime 状态为 **NOT VERIFIED by this worker**，整页 timeout 的归因与可交互证据必须由主代理整合 HTTP、浏览器、同步计算及服务端观察后给出。本报告不判定根因，不交付修复。
