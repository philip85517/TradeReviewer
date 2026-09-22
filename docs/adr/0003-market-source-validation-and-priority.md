# ADR-0003：行情源可用性、口径核验与优先级建议

- 状态：实测验证与重构输入
- 日期：2026-09-21
- 代码基线：`07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4`
- 范围：美股、港股、A 股（沪/深）股票与 ETF 的 `1D`、`1H` provider 适配器
- 性质：本记录描述一次只读冒烟测试和基于代码证据的优先级建议，不承诺外部行情源 SLA

最终固定的生产候选矩阵和 1H 时间归一化规则以 [ADR-0004](0004-fixed-provider-priority-and-bar-normalization.md) 为准；本记录中的“推荐优先级”保留为实测推导过程和候选依据。

## 结论先行

本次对 8 个代表性标的、7 个 provider、2 个周期执行了 112 次直接适配器探测，其中 37 次成功、31 次源错误、28 次明确无数据/不支持、16 次因 Tiger 未配置而跳过。腾讯、东方财富、百度、Sina US、BaoStock 均有可用组合；Yahoo 本次所有请求受到上游限流，不能据此判断解析器本身不可用；Tiger 因 `TIGER_OPENAPI_CONFIG` 未配置，没有进行真实 OpenAPI 调用。

当前应用的统一输出和持久化口径是**不复权**：路由返回 `adjustmentMode: "raw"`，SQLite schema 默认 `raw`。东方财富明确传 `fqt=0`，BaoStock 明确传 `adjustflag=3` 并拒绝其他标记；Yahoo 解析器保留可选 `adjustedClose`，但标准 OHLCV 仍使用 raw quote 字段。腾讯、百度和 Tiger 的上游复权参数没有在适配器中显式固定，后续重构必须把它们变成可审计的 provider contract。

本次没有发现“所有 provider 都可互换”的事实。1H 的时间标签已经出现明显口径差异：2026-09-08 的 `600519`，腾讯/东方财富首根为 `02:30Z`，BaoStock 首根为 `01:30Z`；港股 `0700` 也观察到百度比东方财富早一小时。BaoStock 代码会把源的收盘时间减一小时后写成 bar 起点，其他来源直接使用源时间。统一 `barLabel`（起点还是收盘点）前，不应跨源拼接 1H。

## 测试方法与边界

测试脚本为 [.scratch/source-probe-run.ts](../../.scratch/source-probe-run.ts)，原始结果为 [.scratch/source-probe-results.json](../../.scratch/source-probe-results.json)。所有请求只读，没有写入行情数据库；Node 使用 `NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem`，与项目本机启动脚本的证书环境一致。

| 项目 | 取值 |
| --- | --- |
| 日线窗口 | `2026-09-08` 至 `2026-09-15`（含首尾） |
| 1H 窗口 | `2026-09-08T00:00:00Z` 至 `2026-09-15T23:59:59.999Z` |
| 美股 | AAPL（股票）、SPY（ETF） |
| 港股 | 0700（股票）、2800（ETF） |
| A 股沪市 | 600519（股票）、510300（ETF） |
| A 股深市 | 000001（股票）、159919（ETF） |
| provider | Tencent、Eastmoney、Yahoo、Baidu、Sina US、BaoStock、Tiger |
| 并发 | 探测脚本同时运行 4 个只读任务；耗时只用于相对比较，不是 SLA |

状态表中的 `✅n` 表示返回 n 根蜡烛；`✗` 表示返回错误或空数据；`—` 表示 provider 明确不支持该市场/周期；`⚠️` 表示未配置或本次受限。

## 1D 可用性

| 市场板块 | Tencent | Eastmoney | Baidu | Sina | BaoStock | Tiger | Yahoo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 美股股票 AAPL | ✅6 | ✅6 | ✅5（到 09-14） | — | — | ⚠️未配置 | ⚠️上游 429 |
| 美股 ETF SPY | ✗无数据 | ✗响应格式变化 | ✅5（到 09-14） | — | — | ⚠️未配置 | ⚠️上游 429 |
| 港股股票 0700 | ✅6 | ✅6 | ✅6 | — | — | ⚠️未配置 | ⚠️上游 429 |
| 港股 ETF 2800 | ✅6 | ✅6 | ✗未返回 | — | — | ⚠️未配置 | ⚠️上游 429 |
| A 股沪市股票 600519 | ✅6 | ✅6 | — | — | — | — | ⚠️上游 429 |
| A 股沪市 ETF 510300 | ✅6 | ✅6 | — | — | — | — | ⚠️上游 429 |
| A 股深市股票 000001 | ✅6 | ✅6 | — | — | — | — | ⚠️上游 429 |
| A 股深市 ETF 159919 | ✅6 | ✅6 | — | — | — | — | ⚠️上游 429 |

这里 Tiger 的 A 股单元格是代码级不支持；Tiger 配置本身也未提供，因此美股/港股单元格只能记为“未配置”，不能当作真实失败率。

日线的直接结论是：A 股和港股样本中腾讯、东方财富均完整返回；美股股票腾讯/东方财富/百度均能返回，但百度少了 09-15；美股 ETF 只有百度在本次探测中完整识别，东方财富的 SPY 响应触发了解析格式错误，腾讯没有返回。

## 1H 可用性

| 市场板块 | Tencent | Eastmoney | Baidu | Sina | BaoStock | Tiger | Yahoo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 美股股票 AAPL | ✗腾讯空数据 | ✅35（从 09-09） | ✅42 | ✅42 | — | ⚠️未配置 | ⚠️上游 429 |
| 美股 ETF SPY | ✗腾讯空数据 | ✗响应格式变化 | ✅42 | ✅42 | — | ⚠️未配置 | ⚠️上游 429 |
| 港股股票 0700 | ✗腾讯 `param error` | ✅36 | ✅36 | — | — | ⚠️未配置 | ⚠️上游 429 |
| 港股 ETF 2800 | ✗腾讯 `param error` | ✅36 | ✗未返回 | — | — | ⚠️未配置 | ⚠️上游 429 |
| A 股沪市股票 600519 | ✅24（历史边界警告） | ✅24 | — | — | ✅24 | — | ⚠️上游 429 |
| A 股沪市 ETF 510300 | ✅24（历史边界警告） | ✅24 | — | — | ✅24 | — | ⚠️上游 429 |
| A 股深市股票 000001 | ✅24（历史边界警告） | ✅24 | — | — | ✅24 | — | ⚠️上游 429 |
| A 股深市 ETF 159919 | ✅24（历史边界警告） | ✅24 | — | — | ✅24 | — | ⚠️上游 429 |

同样，Tiger 的 A 股单元格是代码级不支持；美股/港股仍是未配置，必须配置账户后再测。

1H 的直接结论是：A 股三家可用来源为东方财富、腾讯、BaoStock；港股以东方财富最完整，百度只覆盖股票样本；美股股票可由东方财富、百度、Sina US 返回，美股 ETF 本次由百度和 Sina US 返回。腾讯当前对美股/港股 1H 返回空数据，因此不应仅凭 router 中的候选位置把它当作有效来源。

## 接口效率与覆盖观察

以下是成功样本的粗略中位耗时。探测有 4 路并发，网络抖动、TLS 和上游限流都会影响数值；它用于排序初始假设，不能替代持续健康指标。

| provider | 周期 | 成功样本数 | 返回蜡烛数 | 中位耗时 |
| --- | --- | ---: | ---: | ---: |
| Tencent | 1D | 7 | 42 | 84 ms |
| Eastmoney | 1D | 7 | 42 | 90 ms |
| Baidu | 1D | 3 | 16 | 275 ms |
| Eastmoney | 1H | 7 | 203 | 116 ms |
| Tencent | 1H | 4 | 96 | 606 ms |
| BaoStock | 1H | 4 | 96 | 643 ms |
| Baidu | 1H | 3 | 120 | 952 ms |
| Sina US | 1H | 2 | 84 | 1,828 ms |

效率不能脱离覆盖和质量解释。腾讯 1H 的 A 股样本速度并不稳定且伴随历史边界警告；东方财富 1H 在本次样本中覆盖更广、耗时更低；BaoStock 返回严格不复权 A 股 1H，速度较慢但适合作为独立校验和兜底；百度美股 1H 覆盖好但耗时更高；Sina US 是可用的美股 1H 备用源，耗时最高。

应用层当前还设有硬预算：日线单 provider 9 秒、整条日线 route 55 秒；盘中 route 12 秒；外部 HTTP 入口默认每客户端 30 次/分钟。工作区批量 fetch 以 2.1 秒为最小间隔，429/502/503/504 最多重试两次；刷新队列由调用方限制为普通并发 2、批量并发 3。这些预算应在 provider-specific token bucket 和独立 semaphore 之上保留，而不是用无限重试掩盖来源质量问题。

## 数据口径与一致性

### 复权

| 来源 | 代码证据 | 当前结论 | 重构要求 |
| --- | --- | --- | --- |
| 应用路由/SQLite | daily、intraday route 均返回 `adjustmentMode: "raw"`；schema 默认 `raw` | 应用边界统一声明不复权 | 保持 raw 与 adjusted 分列，不能只靠一个布尔值覆盖所有源 |
| Eastmoney | 日线和盘中都传 `fqt: "0"` | 明确不复权 | 将参数和响应元数据写入 provider contract |
| BaoStock | 请求固定 `adjustflag: "3"`；解析器拒绝非 `3` | 明确不复权 | 保留 `adjustflag` 证据并独立记录 bar label |
| Yahoo | OHLCV 取 `quote`；日线另存可选 `adjustedClose` | 标准蜡烛为 raw，调整收盘价只作为附加字段 | 若将来支持复权，必须同时调整 OHLC，而非只替换 close |
| Tencent | 当前请求未显式传复权参数；`fqkline` 返回值直接标准化 | 应用层按 raw 保存，但上游语义未锁定 | 增加显式 raw 参数或启动时 contract probe，未确认前降低优先级 |
| Baidu | 当前请求未传复权参数，直接标准化 | 应用层按 raw 保存，但上游语义未锁定 | 通过固定事件样本校验 corporate action 前后价格关系 |
| Tiger | Python bridge 只传 `day`/`60min` 和时间范围 | 本次未配置，不能证明上游复权语义 | 配置真实账户后做 raw/adjusted 对照，并把结果写入 contract |

### 价格和时间样本

- 日线收盘值在样本中基本一致：AAPL 09-08 腾讯/东方财富均为 `316.220`；600519 为 `1309.300`/`1309.30`；0700 为 `435.400`。
- 美股 1H 的 AAPL 首根收盘为东方财富 `315.670`、百度 `315.67`、Sina `315.6700`；SPY 为百度 `766.7`、Sina `766.7000`。这说明小数位不同，但数值可对齐。
- A 股 1H 的 600519 首根收盘腾讯/东方财富为 `1313.00`，BaoStock 为 `1313.0000`；但首根时间戳分别为 `02:30Z` 与 `01:30Z`。这不是简单的小数格式差异，而是 bar 起点/收盘标签差异。
- 百度美股日线只返回到 09-14；东方财富 AAPL 1H 从 09-09 开始，而百度/Sina 从 09-08 开始。缺口必须进入 coverage，不能用“请求成功”标记成完整覆盖。
- 东方财富 SPY 的响应触发“行情响应格式已变化”，应先修复美股 ETF symbol/字段解析，再提升该来源在美股 ETF 的优先级。

## 推荐优先级

下面的顺序是**按市场 + 资产类型 + 周期**分层的建议；`Tiger*` 只有在真实账户通过 canary、复权和 bar label 验收后才进入生产候选。它不等同于当前 router 的顺序，重构时应改为配置化矩阵。

| 数据范围 | P1 | P2 | P3 | 排除/条件 |
| --- | --- | --- | --- | --- |
| A 股 1D 股票/ETF | Eastmoney | Tencent | Yahoo | Baostock 无日线；Yahoo 需退避；Baidu/Sina/Tiger 不支持 |
| 港股 1D 股票/ETF | Eastmoney | Tencent | Baidu（股票）/Yahoo | Baidu ETF 样本无数据；Tiger* 可在验收后置于 P1 |
| 美股 1D 股票 | Eastmoney | Baidu | Yahoo | Tiger* 通过验收后置于 P1；Tencent 只保留股票兜底 |
| 美股 1D ETF | Baidu | Yahoo | Tiger* | Eastmoney 修复 SPY 后再加入；Tencent 排除 |
| A 股 1H 股票/ETF | Eastmoney | Tencent | BaoStock → Yahoo | BaoStock 是严格 raw 的独立校验源；先统一 bar label |
| 港股 1H 股票 | Eastmoney | Baidu | Yahoo | Tiger* 通过验收后置于 P1；Tencent 当前空数据 |
| 港股 1H ETF | Eastmoney | Yahoo | Tiger* | Baidu 当前 ETF 样本无数据；Tencent 当前空数据 |
| 美股 1H 股票 | Eastmoney | Sina US → Baidu | Yahoo | Tiger* 通过验收后置于 P1；Sina 耗时高 |
| 美股 1H ETF | Baidu → Sina US | Yahoo | Eastmoney（修复后） | Tencent 当前空数据；Tiger* 需 ETF canary |

该建议体现四个维度：Eastmoney 在本次覆盖和延迟上最均衡；Tencent 在 A 股和港股日线快，但 1H 跨市场能力不可靠；BaoStock 覆盖窄但 raw 约束最清楚；Baidu/Sina 对美股 1H 有互补覆盖；Tiger 的潜在质量和稳定性不能在未配置时假定。

## 兜底与健康规则

1. **先做能力预检。** 路由键必须包含 `market × assetType × interval × adjustmentMode`；provider 不支持时不发请求。ETF 不能自动沿用股票的可用性结论。
2. **响应通过四项校验才能落库。** 校验标的身份、市场时区、bar label/interval、请求范围和数值字段。身份错误或解析格式变化要把该 provider-symbol 置为短时熔断对象，再尝试下一个来源。
3. **区分失败类型。** `no-data`/不支持在本次请求立即跳过；429、403、5xx 和 timeout 按 provider 退避重试；解析错误不盲目重试，而是记录 contract failure；`provider-history-limit` 只能产生 partial coverage。
4. **日线可以按交易日补缺。** 保留当前 `fetchDailyWithCoverage` 的“先到先得、后源只填缺失日期”行为，每根 candle 写入实际 provider；后源不得覆盖已有日期。
5. **1H 暂不跨源拼接。** 当前盘中结果以单一 provider 为单位返回。统一 `barLabel`、时区和 session 后，再评估按时间段拼接；在此之前只切换整段 provider，并把 `actualStart/actualEnd` 和缺口写入 coverage。
6. **建立可观测健康分。** 建议按 24 小时滚动窗口记录成功率、完整覆盖率、p50/p95 延迟、429/5xx/解析错误率、字段一致性抽检和并发拒绝率。连续两次 contract failure 触发熔断，连续两次 canary 成功才恢复。
7. **按来源限并发。** 保留当前交互并发 2、批量并发 3 的全局上限；建议 Tiger Python 进程和 BaoStock TCP session 各自并发 1，公开 HTTP provider 各自并发 2，并给每个来源独立 token bucket。全局 30 req/min、批量最小间隔 2.1s、有限重试继续作为上层保护。
8. **保存可追溯元数据。** 每根 candle 或每段 coverage 保存 provider、provider symbol、fetchedAt、adjustmentMode、source interval、barLabel、请求窗口和失败原因；raw 与 adjusted 数据永远分开，不能在 fallback 时隐式转换。

## 重构前置事项

- 配置真实 Tiger 账户后，分别对 AAPL、SPY、0700、2800 做 1D/1H canary，核对复权、时区、bar label、历史边界和吞吐；Tiger 仍不支持 15m。
- 修复并补测 Eastmoney 美股 ETF（至少 SPY）的 symbol/响应解析，确认成功后才能进入美股 ETF 优先链。
- 给所有 provider 增加 `adjustmentMode`、`barLabel`、`sourceTimezone`、`nativeIntervals` 和 `rateLimitClass` contract；把当前 router 的硬编码顺序迁移为矩阵配置。
- 增加同一交易日/同一小时的 cross-source canary，尤其覆盖除权除息、停牌、夏令时切换和港股午间休市；将 BaoStock 与腾讯/东方财富的时间标签差异固化为测试。
- 将本次代表性探测扩展为全量 instruments，并单独增加 `15m` 矩阵测试；本 ADR 不把本次 1D/1H 样本外推成全市场覆盖率。

## 相关实现

配套的请求路径和 provider 降级图见[行情 provider 交互图](market-provider-interaction.html)；本 ADR 增加了该图没有覆盖的在线可用性、口径和优先级证据。

- [provider router](../../app/lib/market/providers/router.ts)
- [daily fallback](../../app/lib/market/providers/daily-fallback.ts)
- [Tencent adapter](../../app/lib/market/providers/tencent.ts)
- [Eastmoney adapter](../../app/lib/market/providers/eastmoney.ts)
- [Baidu adapter](../../app/lib/market/providers/baidu.ts)
- [Yahoo adapter](../../app/lib/market/providers/yahoo.ts)
- [Sina US adapter](../../app/lib/market/providers/sina-us.ts)
- [BaoStock adapter](../../app/lib/market/providers/baostock.ts)
- [Tiger adapter](../../app/lib/market/providers/tiger.ts)
- [market data fetch policy](../../app/lib/market/market-data-fetch.ts)
- [refresh queue](../../app/lib/market/refresh-queue.ts)
