# ADR-0002：行情获取、缓存与 provider 交互回溯（2026-09-21）

- 状态：实现回溯记录
- 日期：2026-09-21
- 代码基线：`07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4`
- 范围：日线和盘中行情从浏览器刷新、缓存缺口、HTTP 路由、provider，到 SQLite 回写和图表聚合的已实现路径
- 性质：本文记录当前代码，不批准新架构，也不把外部来源的可用性承诺为稳定 SLA

## 导航与边界

两张图对应同一份代码回溯：

- [行情整体调用流程](market-data-flow.html)：缓存读取、缺口规划、请求、回写和图表使用。
- [provider 交互顺序](market-provider-interaction.html)：各市场/周期的候选顺序、supports 过滤、降级和来源交互。

本文只描述仓库中的实现。没有读取业务数据库、原始交易文件或任何 provider 密钥，也没有请求外部行情。

## 一条请求的实际路径

用户刷新单个标的或批量刷新时，工作区先从 `ApiMarketDataRepository` 读取本地日线/盘中蜡烛和 coverage；缓存足够时，sync service 返回 `source: cache`，不会访问行情 API。需要网络时，日线走 `/api/market-data/daily`，盘中走 `/api/market-data/intraday`；成功或失败的 coverage 都通过 `/api/storage/market-data` 写回 SQLite。对应入口分别是 [`trade-review-workspace.tsx`](../../app/components/trade-review-workspace.tsx)、[`sqlite-repositories.ts`](../../app/lib/storage/sqlite-repositories.ts)、[`sync-service.ts`](../../app/lib/market/sync-service.ts)、[`intraday-sync-service.ts`](../../app/lib/market/intraday-sync-service.ts) 和 [`market-data/route.ts`](../../app/api/storage/market-data/route.ts)。

批量刷新通过 [`runRefreshQueue`](../../app/lib/market/refresh-queue.ts) 限制同时运行的标的：批量最多 3 个，普通刷新最多 2 个。新请求会取消同标的旧请求；未开始的项目记为 `cancelled`，同步层把 AbortSignal 传给自己的 fetch/worker。取消能否继续传到外部来源取决于 route 和 provider：盘中 route 会把请求 signal 接到 providerFetch，日线 route 则用自己的内部 controller 覆盖 `init.signal`，没有把浏览器请求 signal 接入该 controller；Tiger 还绕过 providerFetch，使用独立的 Python 子进程超时。失败和 hard status 会保留为可重试标的，但显式取消不会自动变成重试。

## 缓存、coverage 与缺口调度

行情缓存的两个维度是：

| 数据 | 持久化内容 | 缺口单位 | 请求入口 |
| --- | --- | --- | --- |
| 日线 `1D` | `daily_candles`、日线 `coverage`、`provider_symbols` | 市场交易日日期区间 | `/api/market-data/daily` |
| 盘中 `15m`/`1h` | `market_candles`、`interval_coverage`、`provider_symbols` | UTC 时间区间，按连续蜡烛段拆开 | `/api/market-data/intraday` |

日线先读取已有 candle 和 coverage，修正与已知蜡烛不一致的旧 tail，再由 [`planCoverageGaps`](../../app/lib/market/coverage-planner.ts) 合并 `complete`/`partial` 覆盖并生成缺口。每个缺口最多按 500 个自然日切块；路由本身也拒绝超过 500 个自然日的请求。覆盖中明确记录 `missingTradingDates`，因此一个 provider 没有近期日期时，下一次可只补命名日期。日线的 `provider-latest-available`、`provider-history-limit`、`no-data` 会保留为部分覆盖；源失败、限流、拒绝、超时和无效响应不会被当成已覆盖。

盘中 coverage 以 `requestedStart/requestedEnd` 记录请求段；对有缺口的返回，会按连续时间戳切成多个 `complete` 段并留下 `missing-candles` 的 `partial` 段。请求范围按最多 14 个自然日切块，虽然 API 对 `15m` 允许最多 60 日、对 `1h` 允许最多 730 日；这是上层调度的更小批次。`forceRefresh` 会让失败的源结果和已知负结果重新进入计划，并给浏览器请求加 `cache: no-store`。

普通读取允许使用 HTTP 缓存；显式更新/批量更新强刷浏览器 HTTP 层。路由返回的缓存头是日线 `public, max-age=21600, stale-while-revalidate=86400`，盘中 `public, max-age=1800, stale-while-revalidate=3600`；空结果或 `missing-sessions` 的日线响应改为 `no-store`。SQLite 存储 API 始终 `no-store`。这些行为分别见 [`daily/route.ts`](../../app/api/market-data/daily/route.ts)、[`intraday/route.ts`](../../app/api/market-data/intraday/route.ts) 和 [`market-data-fetch.ts`](../../app/lib/market/market-data-fetch.ts)。

批量刷新给 provider fetch 包装了全局最小间隔 2,100ms；429、502、503、504 最多重试两次，重试等待按 2,100ms、4,200ms 递增。`no-data`、`provider-history-limit`、`source-unavailable` 是不重试的 HTTP 结果；应用层仍会按 coverage 和显式刷新策略决定下次是否再试。队列层的取消、有限并发和 hard failure 筛选见 [`refresh-queue.ts`](../../app/lib/market/refresh-queue.ts)。

## 日线：逐交易日补缺

日线使用 [`fetchDailyWithCoverage`](../../app/lib/market/providers/daily-fallback.ts)。它按 provider 顺序逐个请求，并为每个 provider 计算尚未获得的交易日区间。第一个成功 provider 的元数据作为结果基底；后续 provider 只填前者没有的日期，已存在的日期不会覆盖。返回的 `candleSources` 按交易日记录真实 provider、provider symbol 和抓取时间，写回时每根蜡烛保留这些来源。

因此日线是“逐日补缺”：同一段结果可以有不同 provider 的日期，但不会用后一个 provider 改写已经成功的日期。provider 返回空数据、历史边界或失败时，路由保留失败原因；有部分蜡烛时会继续填剩余日期。所有 provider 返回空/失败且没有可用蜡烛时，路由按错误优先级返回 `429`、`403` 或 `502`。

日线 fallback 对每个 provider 调用做 9 秒 `Promise.race` 等待预算，并把超时时的内部 AbortController 交给 HTTP fetcher；这能限制路由等待并尝试取消 HTTP 请求，不保证任意 provider 实现的底层工作都被取消。Tiger 日线调用忽略这个 fetcher，由自己的 Python 子进程控制（默认 12 秒）；route 的外层总预算为 55 秒。请求参数由 [`request-policy.ts`](../../app/lib/market/request-policy.ts) 校验市场、标准化代码、日期和 500 日上限；响应由 sync service 再校验标的、市场、请求区间和蜡烛字段，避免错误标的数据写入缓存。

## 盘中：按候选顺序择优，不跨 provider 拼接

盘中使用 [`fetchWithProviderFallback`](../../app/lib/market/providers/router.ts)。它按候选顺序尝试 provider，并先按 `supports(market)` 过滤。结果只要满足当前策略就直接返回；`Tiger` 空结果会继续尝试，`1h` 跨至少 3 天且蜡烛明显稀疏时也会继续尝试。所有候选都失败时，如果存在非空的最佳部分结果，返回蜡烛数最多的一个结果；否则按错误优先级返回失败。

这里没有类似日线 `candleSources` 的逐蜡烛合并：一次盘中路由响应只有一个 `provider/providerSymbol`，sync service 把该 provider 写到这次返回的所有蜡烛。因此“择优不拼接”是当前实现事实；盘中缺口会留在 coverage 中，后续请求再尝试覆盖。

候选顺序（括号内为 `supports` 过滤后的有效市场）如下。可选 Tiger 只有配置有效时才出现在列表中；A 股 `1h` 的 BaoStock 由盘中路由组合根注入。

| 市场 | 日线 `1D` | 盘中 `15m` | 盘中 `1h` |
| --- | --- | --- | --- |
| `US` | Tiger（若配置）→ Tencent → Eastmoney → Yahoo → Baidu | Tencent → Eastmoney → Yahoo → Baidu（均通过 `supports`；Baidu 的 `15m` 实现主动返回 `no-data`） | Tiger（若配置）→ Tencent → Eastmoney → Sina US → Yahoo → Baidu |
| `HK` | Tiger（若配置）→ Tencent → Eastmoney → Yahoo → Baidu | Tencent → Eastmoney → Yahoo → Baidu（均通过 `supports`；Baidu 的 `15m` 实现主动返回 `no-data`） | Tiger（若配置）→ Tencent → Eastmoney → Yahoo → Baidu |
| `CN-SH` / `CN-SZ` | Tencent → Eastmoney → Yahoo（Baidu、Tiger 被过滤） | Tencent → Eastmoney → Yahoo | Tencent → BaoStock → Eastmoney → Yahoo |

实际 `supports` 能力是：Tencent/Yahoo 支持四个市场；Eastmoney 也支持四个市场；Baidu 只支持 HK/US；Sina 只支持 US，且只实现 `1h`；Tiger 只支持 US/HK；BaoStock 只支持 CN-SH/CN-SZ，且只实现 `1h`。顺序和过滤均在 [`providers/router.ts`](../../app/lib/market/providers/router.ts)；各 provider 的支持判断和解析在 [`tencent.ts`](../../app/lib/market/providers/tencent.ts)、[`eastmoney.ts`](../../app/lib/market/providers/eastmoney.ts)、[`yahoo.ts`](../../app/lib/market/providers/yahoo.ts)、[`sina-us.ts`](../../app/lib/market/providers/sina-us.ts)、[`baidu.ts`](../../app/lib/market/providers/baidu.ts)、[`tiger.ts`](../../app/lib/market/providers/tiger.ts) 和 [`baostock.ts`](../../app/lib/market/providers/baostock.ts)。

盘中 API 的总超时是 12 秒，路由将客户端取消传播到 provider。`15m` 单次请求最多 60 个自然日，`1h` 最多 730 个自然日；上层仍按 14 日切块。盘中 route 和 request policy 见 [`intraday/route.ts`](../../app/api/market-data/intraday/route.ts) 与 [`request-policy.ts`](../../app/lib/market/request-policy.ts)。

## 外部来源与配置依赖

公开 HTTP provider 由服务端 route 代理，避免浏览器直接依赖跨域和来源格式：

- Tencent 调用 `web.ifzq.gtimg.cn` 日线和 `ifzq.gtimg.cn` 盘中接口。
- Eastmoney 调用 `push2his.eastmoney.com` 历史 K 线接口，并按市场选择 endpoint。
- Yahoo 调用 `query1.finance.yahoo.com/v8/finance/chart`，以 epoch 秒和原生间隔查询。
- Sina US 调用 `stock.finance.sina.com.cn` 的 `US_MinKService`，只提供美股 1 小时。
- Baidu 调用 `sp0.baidu.com/.../getquotation`，只用于 HK/US。

URL、字段和身份校验都写在对应 provider 文件中；文档不复制 token 或密钥。来源可能返回空、历史范围受限、限流、拒绝、超时或格式变化，路由把它们归一化为 `no-data`、`provider-history-limit`、`source-rate-limited`、`source-forbidden`、`source-timeout`、`source-unavailable` 或 `invalid-response`。

Tiger 是可选的本机 Python 桥：实现会读取 `TIGER_OPENAPI_CONFIG` 指向的文件内容，解析所需键并只返回私钥、账号等字段是否存在的布尔摘要；只有摘要满足 `tiger_id`、`account` 和至少一种私钥时，router 才构造 Tiger provider。服务端通过 `python3 -u scripts/tiger-market-data.py` 启动子进程，将一行 JSON 请求写入 stdin，从 stdout 读取 `{bars}`，默认子进程超时 12 秒并在超时后 kill；密钥内容不应进入日志或文档。证据见 [`tiger-config.ts`](../../app/lib/market/tiger-config.ts)、[`tiger-process.ts`](../../app/lib/market/tiger-process.ts)、[`scripts/tiger-market-data.py`](../../scripts/tiger-market-data.py)。

BaoStock 不是 HTTP provider，而是服务端直接建立 `public-api.baostock.com:10030` TCP 连接，执行登录、历史查询和分页；客户端总 deadline 默认 5 秒、最多 8 页、响应最多 4 MiB，并支持 AbortSignal。当前协议固定 60 分钟、`adjustflag=3`（不复权），只给中国 A 股 `1h`。证据见 [`baostock-client.ts`](../../app/lib/market/baostock-client.ts) 和 [`baostock.ts`](../../app/lib/market/providers/baostock.ts)。

所有持久化行情 `adjustmentMode` 都是 `raw`。provider 的复权/字段差异不会在本层被悄悄改写；标准化只负责时间、价格/数量字符串、市场交易时段和响应身份校验。

## 回写与图表使用

日线成功后，sync service 把 provider 蜡烛转换为 `DailyCandleRecord`，合并新的 coverage，并调用 `commitSyncResult`；盘中把响应转换为 `MarketCandleRecord`，为每根蜡烛补 `knowledgeAt`（默认是该 bar 结束时间）后调用 `commitIntervalSyncResult`。存储 route 校验 instrument、interval、coverage 状态和字段，再交给 SQLite store 的事务写入；读取则按 instrument、时间和 interval 返回。证据见 [`sync-service.ts`](../../app/lib/market/sync-service.ts)、[`intraday-sync-service.ts`](../../app/lib/market/intraday-sync-service.ts)、[`storage/market-data/route.ts`](../../app/api/storage/market-data/route.ts) 和 [`sqlite-store.ts`](../../app/lib/storage/sqlite-store.ts)。

图表可以直接使用原生 `15m`、`1h` 或 `1D`，也可以在内存中聚合展示周期。[`aggregate.ts`](../../app/lib/market/aggregate.ts) 从 `15m/1h` 生成 `1h/4h`，并从 `1D` 生成 `1W`；工作区在周线模式把日线源明确传为 `sourceInterval: "1D"`，见 [`trade-review-workspace.tsx`](../../app/components/trade-review-workspace.tsx)。盘中原生数据不能生成日线或周线。盘中聚合按市场时区和交易 session 分桶，遇到缺失 source bar 会断开聚合段；聚合改变展示蜡烛，不改变 SQLite 中原始 provider 蜡烛。

## 失败、遗留与实际限制

- 日线和盘中都能把失败 coverage 持久化，并向 UI 暴露失败区间；有部分可用数据时不会因单个缺口丢弃整段结果。
- `source-rate-limited`、`source-forbidden`、`source-unavailable`、`invalid-response` 和 `source-timeout` 不会被当作完整缓存。显式强刷可以重试已知的 `no-data`/历史边界；外部源仍可能再次失败。
- Tiger 配置不是数据库配置，也没有 secret manager；它依赖部署环境的绝对路径和本机 Python/Tiger SDK。缺配置时 Tiger 根本不进入候选链。
- BaoStock 只覆盖中国 A 股 1 小时，且 transport 固定 `60` 分钟和不复权；它没有日线和 15 分钟实现。
- provider router 的“最佳部分结果”只适用于单个盘中 provider 的返回；它不是按时间戳把多个盘中源合并。日线的跨 provider 日期补缺是特意不同的代码路径。
- `market-data-jobs.ts` 明确标为 `MIGRATION-ONLY`，仍能恢复旧 localStorage 任务；当前行情蜡烛和 coverage 的权威持久化是 Node SQLite API。它不是后台队列或服务端调度器。
- 代码没有实时行情、盘口、跨实例刷新锁或来源 SLA；公开接口的历史上限、限流和格式变化是运行时约束。本文没有验证外部源当前可用性。

## 证据核对

本记录以 `git HEAD` `07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4` 读取源码；未请求外部行情，未读取业务数据或密钥。文中两个图链接在写作时均已存在：[`market-data-flow.html`](market-data-flow.html) 与 [`market-provider-interaction.html`](market-provider-interaction.html)。

代码中的一个容易误读之处是 `createMarketDataFetcher` 的重试预算只在工作区批量模式包装 fetch 时启用；路由内的 provider fallback 仍有独立的 9 秒/12 秒/55 秒边界。另一个边界是 provider 顺序表必须结合 `supports` 过滤阅读：例如 Baidu 不会进入中国 A 股链，Sina 不会进入 HK 或中国链，BaoStock 只由 A 股 `1h` 盘中组合注入。
