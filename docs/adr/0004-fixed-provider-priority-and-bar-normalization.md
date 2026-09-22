# ADR-0004：固定行情源优先级与 1H 时间口径

> 实施前审查提示：本记录的“四源最小性”、统一减 60m 和可知时间推断存在反例，见 [架构审查](0005-market-platform-architecture-review.md)。原决策保留供追溯，这些规则不可直接实施；后续设计确认后替代。

- 状态：已决策，待实现
- 日期：2026-09-21
- 依据：[ADR-0003 实测报告](0003-market-source-validation-and-priority.md)
- 目标：每个市场/资产/周期最多三个来源，全局生产链使用最少的来源，同时保留可验证的质量兜底

## 决策

生产链只保留四个核心来源：**Eastmoney、Tencent、Baidu、BaoStock**。

这是满足当前要求的最小集合：

- Eastmoney 是四类市场、股票和 ETF 的通用主源，且日线和 1H 明确使用不复权 `fqt=0`。
- Tencent 为 A 股/港股日线和 A 股 1H 提供低延迟的独立备用；它在美股/港股 1H 当前不可用，因此不作为这些场景的兜底。
- Baidu 是美股/港股 1H 的备用，同时覆盖美股/港股日线和美股 ETF；它没有 A 股实现。
- BaoStock 只负责 A 股 1H 的独立 raw 校验和最后兜底，`adjustflag=3` 可审计。

Yahoo、Sina US 和 Tiger 不进入默认生产候选链：Yahoo 当前受限流影响，Sina 只有美股 1H 且延迟高，Tiger 尚未配置和完成复权/时间标签 canary。它们保留为手工诊断或 feature flag 灾备；启用 Tiger 时必须替换同一市场的一个候选，不增加默认全局来源集合。

## 固定优先级矩阵

箭头表示同一请求的顺序。每行不超过三个来源；“条件启用”表示 contract canary 通过后才可进入该位置。

| 市场/资产 | 1D 固定顺序 | 1H 固定顺序 | 说明 |
| --- | --- | --- | --- |
| A 股股票/ETF（沪/深） | Eastmoney → Tencent | Eastmoney → Tencent → BaoStock | A 股日线不启用 BaoStock；A 股 1H 用 BaoStock 做严格 raw 兜底 |
| 港股股票 | Eastmoney → Tencent → Baidu | Eastmoney → Baidu | Tencent 当前 1H 空数据；Baidu 作为股票备用 |
| 港股 ETF | Eastmoney → Tencent | Eastmoney | Baidu 的 2800 样本未返回；通过 ETF canary 前不进入生产链 |
| 美股股票 | Eastmoney → Tencent → Baidu | Eastmoney → Baidu | Tencent 只在日线股票场景保留；美股 1H 由 Baidu 兜底 |
| 美股 ETF | Baidu → Eastmoney（修复后） | Baidu → Eastmoney（修复后） | Eastmoney SPY 解析问题修复并通过 canary 前，Baidu 是唯一生产源 |

“最多三个”按实际请求键 `market × assetType × interval` 计算，而不是把同一市场的所有来源强行凑足三个。生产代码应从这张矩阵生成候选，不再使用一个全局 provider 数组推导顺序。

## 1D 口径

- `tradingDate` 使用交易所本地日期：美股 `America/New_York`、港股 `Asia/Hong_Kong`、A 股 `Asia/Shanghai`。
- 所有价格和成交量均为 raw；标准输出 `adjustmentMode="raw"`。不把 Yahoo 的 `adjustedClose` 混入 OHLC，也不在 fallback 时隐式切换复权模式。
- 日线结果先校验完整交易日集合。P1 只能返回完整集合才标记 `complete`；缺少尾部日期时标记 `latest-available`，再由 P2/P3 只补缺失交易日。
- 每根 candle 记录实际 provider、provider symbol、请求窗口、抓取时间和 `adjustmentMode`。后源不能覆盖已成功的日期。

## 1H 统一时间口径

### 规范

持久化的 `timestamp` 统一为**交易所本地时间对应的 UTC bar 起点**，采用半开区间 `[timestamp, timestamp + 1h)`。`knowledgeAt` 保留源 bar 的收盘/可获得时间，用于说明数据何时可被观察到。所有来源都额外保留：

```text
sourceTimestamp       源返回的原始时间
timestampTransform    source-end-minus-interval | source-start | aggregated-15m
barLabel              start
timestampNormalizationVersion = bar-start-v1
```

### 各来源转换

| 来源 | 当前观察 | 归一化动作 |
| --- | --- | --- |
| Eastmoney 1H | 样本首根为本地 10:30，表现为收盘标签 | `barStart = sourceTimestamp - 60m`；保留原始时间 |
| Tencent 1H | 与 Eastmoney 同步，样本首根为本地 10:30 | `barStart = sourceTimestamp - 60m`；保留原始时间 |
| BaoStock 1H | 响应含结束时间；现有代码已减 60m | 保留现有减 60m 逻辑，标记 `source-end-minus-interval`，禁止再次偏移 |
| Baidu 1H | 上游是 15m；现有代码先减 15m，再按交易 session 聚合 | 保留每根 15m 的 `knowledgeAt`，聚合后的 1H 使用 session bucket 起点，标记 `aggregated-15m` |

本次实测的 `600519` 首根为 Tencent/Eastmoney `02:30Z`、BaoStock `01:30Z`；港股 `0700` 也观察到 Baidu 比 Eastmoney 早一小时。这个差异必须在 provider adapter 内消除，不能在图表层用 `+/-1h` 临时修正。

### 校验规则

归一化后，每根 1H 必须同时满足：

1. `timestamp` 落在该市场交易 session 的合法起点；午休和收盘后的时间不能被填充。
2. 同一交易日、同一 session、同一 bar 起点最多一根；重复 bar 直接作为 provider contract error。
3. `knowledgeAt >= timestamp` 且不晚于下一个 bar 起点；不满足时拒绝该段结果。
4. P1/P2 对齐后比较 `open/high/low/close/volume`，价格按最小报价单位比较；成交量先校验单位，再比较，不能只比较字符串小数位。
5. 旧数据不原地平移。迁移时按 `timestampNormalizationVersion` 识别，重新拉取受影响区间并生成新的 coverage；保留原记录供审计。

## Fallback 与熔断

1. 先按矩阵筛选能力，再请求；unsupported 不消耗 provider 配额。
2. P1 返回 `no-data` 或历史边界时立即尝试 P2；返回身份错误、解析错误或时间口径错误时，当前 provider-symbol 进入短时熔断并尝试下一源。
3. 429、403、5xx、timeout 使用 provider 自己的退避和有限重试；解析/身份错误不重复重试同一个请求。
4. 日线允许按交易日填缺；1H 在 bar 对齐完成前只切换整段 provider，不跨源拼接。所有 partial/latest-available 结果进入 coverage，不能标成 complete。
5. 熔断恢复需要两次连续 canary 成功；恢复前只能作为诊断源。Eastmoney SPY 解析修复、Tiger 真实账户和复权 canary 均属于恢复条件。

## 并发和全局配额

全局刷新队列继续保持普通并发 2、批量并发 3。四个核心来源分别限流：Eastmoney、Tencent、Baidu 各最多 2 个活动请求，BaoStock TCP session 为 1；外部 HTTP 仍遵守每客户端 30 次/分钟和工作区 2.1 秒最小间隔。一个 provider 的限流不能拖住其他 provider 的 semaphore。

## 实现边界

后续实现应新增配置化 `ProviderPolicy`，至少包含：

```text
market, assetType, interval
orderedProviders
adjustmentMode
sourceTimezone
barLabel
nativeIntervals
rateLimitClass
enabled / canaryRequired
```

路由、coverage 和存储层都读取同一策略对象。provider adapter 只负责源协议、身份校验和时间归一化；fallback 层负责策略顺序；存储层只接受已经完成 `bar-start-v1` 校验的 candle。

## 验收顺序

1. 先给 Eastmoney/Tencent/BaoStock 增加 1H 时间标签 fixture，证明 `600519` 对齐后首根均为 `01:30Z`。
2. 给 Baidu 15m→1H 聚合增加 session fixture，证明港股午休不会跨段合并。
3. 修复 Eastmoney SPY，并完成美股 ETF 日线/1H canary。
4. 将 router 硬编码顺序迁移到 `ProviderPolicy`，验证每个矩阵键最多三个候选。
5. Tiger 只有完成真实账号 1D/1H canary 后，才允许作为 feature flag 候选接入；仍不支持 15m。
