# 2019–2022 年 1h 历史行情数据源调研

调研日期：2026-08-31  
说明：将需求中的“20219-2022”按“2019–2022”理解；若实际目标是 2021–2022，结论中的“是否需要注册”和“港美股覆盖”仍然成立。

## 结论先行

在“港股 + 美股、完整交易日、1 小时 OHLCV、覆盖 2019–2022、无需注册/API Key”这几个条件同时成立时，当前没有找到可以作为可靠主源的数据源。

无需注册的开源项目大多是以下两类：

1. 只覆盖 A 股，或只提供日线/近期分钟线；
2. 封装东方财富、腾讯、百度、Sina 或 Yahoo 的公开端点，能偶尔拿到行情，但没有多年 1h 历史保证。

真正能覆盖旧 1h 区间的候选，基本都要求 API Key、订阅或数据账户。也就是说，换一个 Python/TypeScript 开源 SDK 本身不能补出上游没有提供的历史数据。

## 无需注册候选

| 候选 | 无账号/Key | 2019–2022 1h | 市场 | 结论 |
| --- | --- | --- | --- | --- |
| Yahoo chart / yfinance | 通常不需要用户 Key；属于非官方封装 | 不满足 | 港美代码可查，但历史窗口受 Yahoo 限制 | 只能做近期 fallback |
| AKShare / 东方财富公开接口 | AKShare 本身无需账号 | 不满足港股多年分钟历史 | A/H/美股接口表面较广 | 不是新的底层数据源 |
| BaoStock | 默认匿名登录 | 仅适合 A 股；2019 是否仍在分钟保留期内需实测 | A 股 | 不能解决本项目港美股 |
| 腾讯/东方财富/百度/Sina 公共端点 | 无账号 | 不可承诺 | 当前项目可覆盖部分港美股 | 只能 best-effort，不能作为完整回溯依据 |

### Yahoo / yfinance

yfinance 的当前源码明确把 1h 的细粒度重建请求限制在最近 729 天以内，超过该范围会直接标记为过旧并跳过请求；15m/30m 的限制更短。[yfinance 当前历史数据实现](https://github.com/ranaroussi/yfinance/blob/main/yfinance/scrapers/history.py)

因此截至 2026 年，Yahoo 无法通过现有公开封装稳定取得 2019–2022 的 1h 数据。它仍可用于近期数据或“有结果就用”的最后 fallback，但不能用于承诺补齐旧交易区间。

### AKShare / 东方财富

AKShare 是开源数据接口库，但其官方港股分钟接口 `stock_hk_hist_min_em` 的文档写明：单次只返回指定标的最近 5 个交易日的分钟数据；周期虽包含 `60`，但这不等于可查询多年 60 分钟历史。[AKShare 港股分钟接口文档](https://github.com/akfamily/akshare/blob/main/docs/data/stock/stock.md)

AKShare、stock-sdk 等项目主要是适配层。它们复用东方财富等上游端点，不能绕过上游的历史范围、空响应、限流和代码覆盖问题。

### BaoStock

BaoStock 的公开文档提供 `SixtyMinute` 频率，并且接口使用 `sh.600000`、`sz.000001` 这类 A 股代码；其文档也说明默认登录为匿名会话。[BaoStock.NET 会话说明](https://github.com/simplerjiang/baostock.NET) [BaoStock.NET 历史 K 线接口](https://github.com/simplerjiang/baostock.NET/blob/main/docs/api/history-k-data.md)

它可以作为 A 股独立验证源，但不能覆盖当前项目的 US/HK 标的。文档同时出现“分钟数据从 1999 年开始”和“分钟数据近 5 年”的不同范围说明，实际接入前必须按标的和日期做 live smoke test，不能据此承诺 2019 年完整可用。

### 当前项目中已有的匿名端点

当前代码已经使用了腾讯、东方财富、百度和 Sina 的公开端点作为行情 fallback。这些源可以在部分标的和近期窗口返回数据，但没有公开的多年 1h 数据承诺；其中同一标的的历史窗口、退市标的、ETF、港股特殊产品都可能不同。

本地 SQLite 实测结果也印证了这一点：当前有 81 个标的、75 个 1h coverage 记录，但仍有 6 个标的完全没有 1h candle：

- `HK:7500` — CSOP HSI Daily (-2x) Inverse Product
- `HK:7552` — CSOP Hang Seng TECH Index Daily (-2x) Inverse Product
- `US:CTRP` — 携程网
- `US:ELEV` — Elevation Oncology Inc
- `US:FB` — ProShares S&P 500 Dynamic Buffer ETF
- `US:NETS` — Netshoes Cayman Ltd

而且“存在 1h candle”也不代表覆盖了成交区间。例如部分 2019–2022 有成交的标的，当前缓存的最早 1h candle 只从 2026 年开始，或只覆盖一小段日期。这是数据源历史范围和当前补洞策略共同造成的，不是单纯 UI 展示问题。

## 能覆盖旧区间、但需要 Key/订阅的候选

### Alpha Vantage

官方文档明确支持全球股票的日/周/月/盘中数据，盘中接口支持 `60min`，并可用 `month=YYYY-MM` 查询 2000-01 以来的月份，因此从接口能力看可以覆盖 2019–2022。可是该接口要求 `apikey`，官方还将历史盘中数据标为 premium endpoint。[Alpha Vantage API 文档](https://www.alphavantage.co/documentation/)

判断：适合作为美股旧区间的优先验证候选；港股和 ETF 需逐个核验代码、市场和数据授权，不能只凭“global equity”宣传语直接承诺。

### Massive / Polygon Flat Files

Massive 的股票分钟聚合文件覆盖所有美国股票，历史记录从 2003-09-10 开始；但免费 Stocks Basic 不包含该文件，Starter/Developer/Advanced 的历史深度分别为 5 年/10 年/全部历史，下载页面还要求创建账户。[Massive 股票分钟聚合文档](https://massive.com/docs/flat-files/stocks/minute-aggregates/2009/03)

判断：如果允许注册，Developer 级别理论上能覆盖 2019–2022 的美股分钟数据，再本地聚合为 1h；但它只覆盖美股，不能解决港股。

### EODHD

EODHD 的接口支持 `1m`、`5m` 和 `1h`，并允许按 Unix 时间范围查询；但接口要求 `api_token`。官方数据可用性说明写明：美股 1h 从 2020 年 10 月开始，其他交易所的 1h 也从 2020 年 10 月开始，虽然单次 1h 请求最大窗口是 7200 天。[EODHD 盘中历史数据文档](https://eodhd.com/financial-apis/intraday-historical-data-api)

判断：可作为 2020-10 以后的补充源，不能单独解决 2019；是否覆盖具体港股/ETF 仍需 token 实测。

### Twelve Data

Twelve Data 覆盖 50 多个国家，时间序列支持 `1h`，但官方 quickstart 明确要求注册并用 API Key 认证；官方历史数据说明又指出，盘中历史通常是过去几年，深度随标的和周期变化，应先调用 `earliest_timestamp` 验证。[Twelve Data quickstart](https://twelvedata.com/docs/introduction/quickstart) [Twelve Data 历史价格说明](https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices)

判断：工程接入简单、全球覆盖较好，但不能在没有正式 Key 的情况下验证 2019–2022，且不能默认所有港股都满足旧 1h 深度。

### Alpaca

Alpaca 的历史 bars 接口支持分钟、小时和日频，但请求需要 API Key/Secret，数据市场主要是美国股票。[Alpaca Historical Bars](https://docs.alpaca.markets/us/reference/stockbars)

判断：可作为美股冗余源，不符合“无需注册”，也不能独立解决港股。

## 最终建议

### 如果“无需注册”是硬约束

不要把 2019–2022 的 1h 完整覆盖作为自动行情源能力承诺。推荐：

1. 保留腾讯/东方财富/百度/Sina/Yahoo 作为近期 best-effort fallback；
2. 对旧区间开放 CSV/Parquet 离线导入，并要求文件携带标的、交易所时区、OHLCV、原始周期和来源；
3. 本地将 1m/5m/15m 聚合成 1h，记录 `provider`、`fetchedAt`、`actualStart`、`actualEnd` 和完整性状态；
4. UI 将“部分可用”明确分成“有近期数据”和“覆盖本次成交区间”，避免有几根 1h candle 就显示为完整。

这是唯一不依赖用户注册、又能可靠补齐旧区间的方式：数据文件来源需要由用户或后续合规采购提供，但应用本身不绑定账号。

### 如果允许用户提供一次 Key/账户

建议先做只读验收，不立即接入批量更新：

1. 美股：用 `AAPL`、`CTRP/TCOM`、`FB`（按历史 ticker）测试 2019、2020、2021、2022 各一个交易日；
2. 港股：用 `00700`、`01810`、`06969` 测试同样日期；
3. 验收返回的 OHLCV 是否连续、时区是否正确、是否包含成交发生时段、是否有退市/ETF 特殊处理；
4. 通过后再加入本项目的 gap-only queue，并以交易区间完整性而不是请求成功作为完成条件。

候选优先级：

- 美股旧数据：Massive/Polygon 或 Alpha Vantage；
- 2020-10 之后的全球补充：EODHD；
- 港美股统一 REST 方案：Twelve Data，但必须先以正式 Key 验证旧港股深度；
- 若接受券商账户：Tiger/IBKR 仍然更适合验证港股历史权限，但这不再属于“无需注册”方案。

## 一句话决策

严格按“无需注册 + 港美股 + 2019–2022 全量 1h”没有可靠公开主源；当前最稳妥的产品方案是“匿名源只做近期补充 + 旧数据离线导入”，若要自动补齐，则至少放宽为“允许 API Key”，并先用真实标的和真实日期做四市场验收。
