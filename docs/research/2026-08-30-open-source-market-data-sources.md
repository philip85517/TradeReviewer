# 港美股开源行情数据源调研（排除 Futu / Longbridge）

调研日期：2026-08-30

## 目标与约束

当前系统需要按证券代码和成交时间补齐行情，核心要求是：

- 同时覆盖美股和港股；
- 至少能获得历史 15 分钟 OHLCV，且需要支持较老交易；
- 能在本地服务中稳定批量更新；
- 排除 Futu 和 Longbridge；
- 优先考虑开源客户端、清晰许可、仍在维护的方案。

需要特别区分“开源客户端”和“开放数据”。本次没有找到一个同时满足“完全免费、数据开放、港美股、多年历史 15 分钟 OHLCV、稳定服务”的独立数据源。多数项目开源的是 SDK 或适配层，底层行情仍需要券商账户、交易所行情权限或商业 API 套餐。

## 结论

按本项目的匹配度，建议优先级如下：

1. **Tiger OpenAPI**：如果已有老虎账户和行情权限，这是最贴合当前业务的候选。官方 SDK 开源，覆盖港美股，原生支持 15 分钟 K 线；较老记录可尝试使用历史 1 分钟数据聚合为 15 分钟。正式接入前必须用真实账户验证 2019 年等旧日期的 1 分钟 OHLCV 权限。
2. **IBKR + ib_async / Client Portal API**：覆盖范围和历史深度最好，适合作为长期主源，但需要 IBKR 账户、行情订阅以及常驻 Gateway/TWS，部署和运维成本最高。
3. **Twelve Data**：REST 接口最容易接入当前 TypeScript 服务，原生支持 15 分钟；港股 XHKG 属于付费市场，且历史深度需要用正式 key 验收。
4. **EODHD**：可作为近期历史补充源。它提供 5 分钟数据，可聚合到 15 分钟，但官方保留期约 600 天，不足以单独覆盖 2019 年等旧交易。

`AKShare`、`stock-sdk`、`yfinance` 和 `OpenBB` 不应被当作新的独立行情源：它们分别依赖东方财富、腾讯、Yahoo 或其他商业 provider。换用这些封装不会消除当前上游被限流、端点不可达或历史窗口不足的问题。

## 候选对比

| 候选 | 港股 + 美股 | 15 分钟历史 | 较老历史 | 认证/成本 | 开源部分 | 适合程度 |
| --- | --- | --- | --- | --- | --- | --- |
| Tiger OpenAPI | 是 | 原生 15m；历史 1m 可聚合 | 有潜力，需账户实测权限 | 老虎账户、资金及行情权限 | 官方 Python SDK，Apache-2.0 | 首选验证 |
| IBKR | 是 | 原生 15m | 官方接口支持长周期请求，但受产品可用性、权限和 pacing 约束 | IBKR 账户、行情订阅、Gateway/TWS | `ib_async`，BSD-2-Clause；官方 API | 能力强，运维重 |
| Twelve Data | 是 | 原生 15m | 未在公开页确认具体分钟级深度，需正式 key 验收 | XHKG 需要 Pro 级别 | 官方 Python 客户端，MIT | 最易接入，成本较高 |
| EODHD | 全球市场候选 | 5m 聚合为 15m | 5m 约 600 天，不满足多年回溯 | API key / 付费套餐 | 官方 Node/Python 客户端，MIT | 仅作近期补充 |
| Alpaca | 仅美股 | 支持 1–59 分钟聚合 | 取决于 feed/套餐 | API key、数据套餐 | 官方 SDK | 不能单独满足港股 |
| Polygon | 仅美股 | 支持分钟聚合 | 取决于套餐 | API key、数据套餐 | 客户端可开源，数据商业化 | 不能单独满足港股 |
| yfinance / yahooquery | 港美代码可查询 | 15m，但 Yahoo 分钟历史窗口短 | 不满足多年分钟历史 | 无正式 SLA；易限流 | Apache-2.0 / MIT | 不建议作为生产主源 |
| AKShare / stock-sdk | 表面覆盖港美 | 取决于上游 | 取决于东方财富/腾讯 | 公共网页端点 | MIT / ISC | 不是新数据源 |
| OpenBB | 取决于所选 provider | 取决于 provider | 取决于 provider | 多数 provider 需要 key | 开源聚合框架 | 只适合作为适配层 |

## 1. Tiger OpenAPI

### 能力

- 官方 [`get_bars`](https://quant.itigerup.com/openapi/en/python/operation/quotation/stock.html) 支持 `1min`、`3min`、`5min`、`15min`、`30min`、`60min` 等周期，并支持开始/结束时间；单次默认 300、最大 1200 条，最多 50 个标的。
- 官方[历史行情权限说明](https://quant.itigerup.com/openapi/en/cpp/permission/historySubscribe.html)列出股票/ETF 的分钟历史范围：常规 15/30/60 分钟为最近一个自然年；历史 1 分钟产品可追溯到 2015 年。这个权限表意味着旧交易可以尝试按日期取得 1 分钟 OHLCV 后聚合，但不代表任意账户默认拥有该权限。
- 官方[请求限制](https://quant.itigerup.com/openapi/en/python/permission/requestLimit.html)显示 `get_bars` 和 `get_timeline_history` 为每分钟 60 次。
- 官方[行情权限说明](https://quant.itigerup.com/openapi/en/python/operation/quotation/common.html)覆盖美股和港股，实际返回能力与账户行情权限有关。

### 开源与维护

- 官方 [`openapi-python-sdk`](https://github.com/tigerfintech/openapi-python-sdk) 采用 Apache-2.0 许可，仓库仍活跃。
- SDK 的 [`CHANGELOG`](https://github.com/tigerfintech/openapi-python-sdk/blob/master/CHANGELOG.md)记录了 `get_bars` 的历史分钟 K 线日期能力。

### 风险与验证项

- 需要 `tiger_id`、RSA 私钥、账户和相应行情权限，不能匿名调用。
- 原生 15 分钟窗口只有最近一年，旧记录必须依赖历史 1 分钟权限并聚合。
- `get_timeline_history` 主要返回时间、价格、均价和成交量，不应直接假定它等同于完整 1 分钟 OHLCV；应优先验证 `get_bars(date=...)` 的历史 1 分钟结果。
- 官方主力 SDK 是 Python；当前 TypeScript 项目可采用本地 Python sidecar，或在后续实现签名 REST 客户端。

### 验收样例

在接入前用真实凭证验证：

- 美股：`AAPL`，2019 年任一正常交易日；
- 港股：`00700` 或项目中的 `6969.HK`，2019 年任一正常交易日；
- 返回字段必须包含可聚合的 `open/high/low/close/volume`；
- 连续取数后按交易所时区聚合为 15 分钟，并与券商图表抽样比对。

## 2. IBKR + ib_async / Client Portal API

### 能力

- IBKR 的 [Web API 历史行情接口](https://www.interactivebrokers.com/docs/web-api/v1/ws/market-data/historical-market-data-request)支持包括 `15min` 在内的 bar，并返回 OHLCV；文档列出最长到年级别的 duration 选项，同时限制并发历史请求数量。
- [TWS API 历史 K 线文档](https://interactivebrokers.github.io/tws-api/historical_bars.html)提供同类能力。
- [历史行情限制说明](https://interactivebrokers.github.io/tws-api/historical_limitations.html)要求控制 pacing 和每次请求的时间跨度，批量更新必须有队列、退避和断点续传。
- IBKR 明确说明 [API 历史行情通常需要相应 Level 1 实时行情权限](https://interactivebrokers.github.io/tws-api/historical_data.html)。API 属于 off-platform 使用，交易所授权可能和桌面端显示权限不同，需参考 [TWS Data vs API Data](https://ibkrcampus.com/docs/general/market-data-subscriptions/tws-data-vs-api-data)。

### 开源与部署

- [`ib_async`](https://github.com/ib-api-reloaded/ib_async) 是活跃的 BSD-2-Clause Python 客户端，仍需连接本地 IB Gateway 或 TWS。
- 也可使用官方 Client Portal/Web API，但同样需要登录会话和本地/企业网关。

### 适用判断

如果目标是长期稳定覆盖多年港美股分钟历史，IBKR 的能力最接近要求；代价是账户、行情订阅、网关常驻、会话恢复和 pacing 管理。它适合部署为独立行情 sidecar，不适合直接塞进一次性 Next.js 请求链路。

## 3. Twelve Data

### 能力

- 官方 [`time_series` 文档](https://twelvedata.com/docs)支持 `15min`，并允许指定开始/结束时间、交易所、MIC 和时区。
- 官方[交易所清单](https://twelvedata.com/exchanges)显示美国市场属于基础覆盖，香港交易所 `XHKG` 需要更高等级套餐。
- 官方[价格页](https://twelvedata.com/pricing)显示免费 Basic 额度有限；覆盖 XHKG 的套餐属于付费层级。价格会变化，采购前应以当时页面为准。
- 本次用官方 demo key 验证到 `AAPL` 的 15 分钟 OHLCV 数据形状；同一 demo key 不能验证 XHKG，正式评估必须取得可用 key。

### 开源与接入

- 官方 [`twelvedata-python`](https://github.com/twelvedata/twelvedata-python) 客户端采用 MIT 许可并保持维护。
- REST API 可直接从当前 TypeScript 服务调用，不需要常驻券商客户端，是四个候选中工程接入成本最低的。

### 风险

- 开源的是 SDK，不是行情数据；港股需要付费。
- 公开价格/交易所页面没有给出足以确认本项目旧记录需求的分钟历史深度。购买前应要求试用 key，并对 2019 年港美股样本做端到端验证。

## 4. EODHD

### 能力与限制

- 官方[实时与盘中数据说明](https://eodhd.com/financial-apis/new-real-time-data-api-websockets)列出 1 分钟、5 分钟、1 小时历史 OHLCV；其中 1 分钟约 120 天、5 分钟约 600 天、1 小时约 7200 天。
- 可将 5 分钟 K 线严格聚合成 15 分钟，但约 600 天的保留期无法覆盖 2019 年旧交易，因此它只能作为近期补充源。
- 官方[快速开始](https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis)说明其覆盖大量全球交易所和证券，调用需要 API key；港股具体标的仍应在试用阶段逐个验收。

### 开源

- 官方组织提供 [`EODHD-APIs-Node-Financial-Library`](https://github.com/EodHistoricalData/EODHD-APIs-Node-Financial-Library) 和 [`EODHD-APIs-Python-Financial-Library`](https://github.com/EodHistoricalData/EODHD-APIs-Python-Financial-Library)，采用 MIT 许可。

## 不推荐作为主源的项目

### AKShare 与 stock-sdk

- [`AKShare`](https://github.com/akfamily/akshare) 和 [`stock-sdk`](https://github.com/chengzuopeng/stock-sdk) 都是活跃的开源封装。
- `stock-sdk` 的[发布说明](https://github.com/chengzuopeng/stock-sdk/releases)明确包含东方财富 `push2his.eastmoney.com` 及其分片域名的分钟接口适配。
- 当前系统已经验证东方财富相关域名存在空响应/不可达问题，因此换成这两个库不会提供新的上游，也不会从根本上修复下载不全。

### yfinance / yahooquery

- [`yfinance.download`](https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html)支持 `15m`，但官方项目文档说明 intraday 数据不能超过最近 60 天。
- [`yfinance`](https://github.com/ranaroussi/yfinance) 和 [`yahooquery`](https://github.com/dpguthrie/yahooquery) 都是非官方 Yahoo 封装，没有生产 SLA；当前环境还遇到了 Yahoo 429 和 crumb 403。

### OpenBB

- [`OpenBB`](https://docs.openbb.co/platform/developer_guide)是统一 provider 的开源平台，不是新的底层行情源。
- 官方[密钥配置文档](https://docs.openbb.co/odp/python/settings/user_settings/api_keys)也表明多数数据能力仍取决于各商业 provider 的 key。

### Alpaca / Polygon

- Alpaca 的[历史股票 bars](https://docs.alpaca.markets/us/reference/stockbars)支持分钟聚合，但股票数据 feed 面向美国市场。
- Polygon 的[股票数据概览](https://polygon.io/docs/rest/stocks/overview)和[分钟聚合](https://polygon.io/docs/flat-files/stocks/minute-aggregates/2025/07)同样以美国股票为主。
- 两者可作为美股专用冗余源，但都不能单独解决港股记录。

## 推荐接入方案

不要继续把多个匿名网页端点并列为“等价主源”。建议把行情层分成三类：

1. **可信主源**：Tiger、IBKR 或 Twelve Data 之一，具备凭证、权限和可测 SLA；
2. **近期补充源**：EODHD，或保留现有腾讯/东方财富/Yahoo 作为 best-effort fallback；
3. **聚合与持久化层**：所有源统一转换为当前系统的 15m/1D contract，落库后记录 provider、抓取时间、实际覆盖区间和失败原因。

推荐决策路径：

- 已有可用老虎账户：先做 Tiger 的 2019 港美股历史 1 分钟凭证验证；通过后以 Tiger 为主源。
- 有 IBKR 账户且可以接受常驻 Gateway：验证行情订阅后选 IBKR，能力最完整。
- 希望纯 REST、最低运维：申请 Twelve Data 的 XHKG 试用/正式 key，先验收旧日期历史深度，再决定购买。
- 三者都没有凭证时，无法仅靠现有匿名开源封装把“所有历史记录”可靠补齐；此时应把 UI 状态明确标记为数据源不可用，而不是继续无界重试。

## 下一步最小验证

在写正式 provider 之前，只实现一个只读验证脚本，固定查询四组样本：

| 市场 | 标的 | 日期 | 目的 |
| --- | --- | --- | --- |
| US | AAPL | 2019 年交易日 | 验证旧美股分钟深度 |
| HK | 00700 / 0700.HK | 2019 年交易日 | 验证旧港股分钟深度和代码格式 |
| US | AAPL | 最近交易日 | 验证近期 15m 完整性 |
| HK | 6969.HK | 最近交易日 | 复现当前项目失败标的 |

验收标准是四组都能返回连续 OHLCV、交易所时区正确、可重复调用且错误码可分类。只有通过这一关，才值得把该源接入“一键更新全部记录”。
