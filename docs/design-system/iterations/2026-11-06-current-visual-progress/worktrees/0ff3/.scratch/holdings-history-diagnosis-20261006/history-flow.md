# 持仓历史数据链诊断（只读）

日期：2026-10-06  
环境：`http://127.0.0.1:3031`；隔离库 `.scratch/local-review-20261006/review.sqlite`；服务日志 `.scratch/local-review-20261006/service.log`。本报告仅读代码、日志和 SQLite，未改产品源文件、未写数据库、未发起外部行情请求、未操作浏览器或服务。

## 结论

历史图不是 worker 完全没收到输入，也不是计算异常后丢掉全部点。打开页面时，workspace 的行情 hydration 只从本地存储读取日线和 coverage；这个启动路径没有调用 `startMarketDataUpdate`。因此 stale 的日线仍被传入历史 worker，但尾部只到缓存已有日期。历史模型仍生成 279 个日点：市值完整要求所有持仓数量和报价有效；PNL 完整还要求所有持仓成本有效。7 个旧仓带有 `ambiguous-opening`，另有 `CN-SH:513010` 是未核验的负仓证据；这些持仓的数量/方向或成本证据不完整，且缓存行情尾部不足，导致 `marketValueAvailable`/`unrealizedPnlAvailable` 从未在“今年”达到全持仓完整，UI 显示“所选期间暂无完整估值”。

当前日期点又叠加了缓存过期：隔离证据中当前 8 个仓全部是 `quoteStatus: stale`，最新报价日期最晚为 2026-09-28，而 `asOf` 是 2026-10-06。

## 数据链及代码证据

1. 页面在 [`review-dashboard.tsx:825-835`](../../app/components/dashboard/review-dashboard.tsx:825) 把 `holdingsCandlesByInstrument`、`holdingsAsOf`、entries、scope、FX 和目标币种交给 `useHoldingsHistoryWorker`；workspace 在 [`trade-review-workspace.tsx:1785-1794`](../../app/components/trade-review-workspace.tsx:1785) 构造行情输入：`marketStates[id]?.daily ?? []`。最终 dashboard props 在 [`trade-review-workspace.tsx:5838-5851`](../../app/components/trade-review-workspace.tsx:5838) 传入。

2. hook 在 [`use-holdings-history-worker.ts:81-110`](../../app/components/dashboard/use-holdings-history-worker.ts:81) 将 candles、asOf、entries 等完整放入 cloneable worker input，并在 effect 中 `controller.request(workerInput)`。worker 的输入协议在 [`holdings-history-worker-protocol.ts:14-25`](../../app/lib/reviews/holdings-history-worker-protocol.ts:14) 明确包含 `candlesByInstrument`；计算时 [`:42-53`](../../app/lib/reviews/holdings-history-worker-protocol.ts:42) 将同一份 candles/asOf 传给 observation 与 current-day 两次 history build。

3. 控制器会创建 module Worker、`postMessage` 输入，Worker 失败才回退主线程计算：[`holdings-history-worker.ts:156-180`](../../app/lib/reviews/holdings-history-worker.ts:156)。同 identity 的刷新会暂时保留上一结果，identity 改变才清空结果：[`holdings-history-worker.ts:98-120`](../../app/lib/reviews/holdings-history-worker.ts:98)。所以当前没有“空数据被 worker 静默吞掉”的证据；hook 的唯一计算中状态也只是 `持仓历史正在更新`，错误才会显示 `持仓历史计算失败`：[`use-holdings-history-worker.ts:121-142`](../../app/components/dashboard/use-holdings-history-worker.ts:121)。

4. history builder 按精确 instrument id 取 candle，找不到才使用空数组：[`trading-room-history.ts:134-140`](../../app/lib/reviews/trading-room-history.ts:134)；每个 entry 在 ledger 构建时调用该 lookup：[`trading-room-history.ts:395-418`](../../app/lib/reviews/trading-room-history.ts:395)。因此 key 不匹配会造成该仓全无行情，但现有模型证据显示 2026-09-14 已有 6 个仓进入计算（CNY 194501.4、USD 1551.99），不支持“所有 instrument key 都错”的假设。

5. 每日 history 的 end 是 `min(scope.period.endDate, asOf)`，且从本地 candles 构建 ledgers：[`trading-room-history.ts:820-835`](../../app/lib/reviews/trading-room-history.ts:820)。单个持仓只有在数量/方向可验证、报价价格大于零、币种与结算币种一致、报价交易日不早于最后可见成交日时才有 market value：[`trading-room-history.ts:678-723`](../../app/lib/reviews/trading-room-history.ts:678)。整日完整性要求所有 holdings 的 market value 和 PNL 都可用：[`trading-room-history.ts:848-952`](../../app/lib/reviews/trading-room-history.ts:848)。所以“有部分数值”仍会被标为非完整点。

6. workspace 的启动 hydration 在 [`trade-review-workspace.tsx:2854-2977`](../../app/components/trade-review-workspace.tsx:2854) 调 `readInstrumentMarketState`，读取结束后只 `setMarketStates`；该 effect 没有 `startMarketDataUpdate`。日线读取路径为 `repository.getDailyMarketData`（或 getDailyCandles + getCoverage）：[`trade-review-workspace.tsx:545-615`](../../app/components/trade-review-workspace.tsx:545)。真正 provider 更新入口是 [`trade-review-workspace.tsx:3374-3410`](../../app/components/trade-review-workspace.tsx:3374)，只能由显式刷新/重试或导入等路径调用。storage GET 只返回 SQLite 的 candles/coverage：[`app/api/storage/market-data/route.ts:18-48`](../../app/api/storage/market-data/route.ts:18)；客户端 GET 使用 `cache: no-store`，但这仍是本地库读取：[`sqlite-http-client.ts:158-175`](../../app/lib/storage/sqlite-http-client.ts:158)。

## 实际证据

- `.scratch/holdings-history-diagnosis-20261006/model-evidence.json`：`asOf=2026-10-06`，今年 `points=279`，`completeMarketValuePoints=0`、`completePnlPoints=0`，但 `knownMarketValuePoints=271`、`knownPnlPoints=271`。这直接表明历史点存在且有部分估值，不是 worker 无输出。
- 同一证据在 2026-09-14 显示 15 个历史仓中 6 个有 quantity/marketValue/cost/PNL；7 个旧仓在 279 天都 `quantityMissingDays=279`，并带 `ambiguous-opening`/成本待核对；第 8 个旧仓 `CN-SH:513010` 是负仓方向证据未核验。`CN-SH:516780` 另有 138 天未支持公司行动数量与成本调整。其余可估值仓的已知数值并未使整日完整，因为市值的数量/报价与 PNL 的成本门槛均通过 `holdings.every(...)` 检查。
- 同一证据当前 `count=8`，market value 可用 `0/8`、PNL 可用 `0/8`；8 行均 `quoteStatus=stale`。已缓存报价日期分别最晚到 2026-09-28 或更早；`CN-SH:513010` 报价为 2024-04-02。
- 只读 SQLite 检查：`daily_candles` 共 153425 行，日期范围 `2014-03-11..2026-09-28`，全部 `adjustment_mode=raw`。因此全库日线缓存确实存在，但截至日没有覆盖到 2026-10-06；coverage 计算遇到无相关覆盖返回 `stale`（[`sync-status.ts:59-70`](../../app/lib/market/sync-status.ts:59)）。
- `.scratch/local-review-20261006/service.log` 截至现有记录有 `/api/storage/bootstrap`、`/api/storage/status` 和 instrument resolve；没有记录到 `/api/storage/market-data` GET，也没有 provider 行情请求记录。日志只作辅助证据，不能据此否定某次本地读取；决定性证据是启动 hydration 的代码路径只读 repository，以及 SQLite 日线范围止于 2026-09-28。bootstrap 本身是启动读取（路由直接 `getBootstrap()`，[`app/api/storage/bootstrap/route.ts:13-15`](../../app/api/storage/bootstrap/route.ts:13)），不能把 stale cache 变成新行情。日志中的一次 `HK:2148` resolve 502 与当前 history 仍有 279 点、且已有 6 仓估值的证据不吻合为主因。

## 假设排除与可证伪预测

| 假设 | 预测 | 目前证据 |
|---|---|---|
| 页面开页自动刷新行情，但刷新结果没进入 worker | 日志应有 market-data 写入/更新 job，且 `marketStates[id].daily` 应延伸到 asOf | 未见 market-data 请求；代码启动 hydration 只读；缓存上限 09-28。主因不支持自动刷新已发生 |
| candles 未传进 worker 或 instrument id 全部不匹配 | 所有历史点应无报价，`knownMarketValuePoints` 应为 0 | 271 天有 known value，9/14 有 6 仓数值；假设被反驳 |
| Worker/controller 报错导致空图 | `statusReason` 应持续为失败，或 model points 为空 | 实际 279 points、提示“更新中”消失、无 console warn/error；假设被反驳 |
| 仅补齐行情即可让“今年”完整 | 补行情后仍有 8 个旧仓 quantity/开仓证据不足、516780 公司行动原因 | 模型证据已显示这些 domain blockers；该假设只能解释一部分，不能单独保证 complete |
| mixed currency/FX 单独阻断 | 去除缺证据仓后，仍应所有点因 FX 无法转换 | 证据中 CNY 与 USD 都有原始金额，且 271 天 known；需要单独 FX 反事实才能确认，不应作为当前主因 |

## 对照行为

开页路径是“bootstrap → 每个 instrument 读本地日线/coverage → `marketDataCandles` → history worker”。stale 状态本身不会让数组变空，因此 worker 会用已有缓存计算旧日期；它不会因为 stale 自动请求 provider。显式刷新/质量重试进入 `startMarketDataUpdate`，provider 结果持久化后，`marketStates` 改变，新的 `marketDataCandles` 触发 hook 的 worker input 更新（虽然 `holdingsHistoryIdentity` 自身不含 candles，hook 的 `workerInput` 依赖含 `candlesByInstrument`）。这解释了“持仓历史更新提示消失但图仍无完整估值”：提示表示计算完成，不表示数据已被刷新或达到完整性门槛。

## 诊断边界

本报告定位了前端加载/缓存/worker 链路和它与完整性门槛的关系；未把旧仓数量证据、公司行动、FX 数据规则当作可由本链路单独修复的问题。DB 中已有日期/覆盖细节与具体估值规则由另一诊断负责。服务和隔离库保持原状。
