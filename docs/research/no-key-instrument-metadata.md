# 无 API Key 的证券名称补全数据源

日期：2026-07-28
范围：TradeReviewer 导入成交记录后，依据 `market + symbol` 自动补全股票/ETF 名称；覆盖 US、HK、CN-SH、CN-SZ。

## 结论

不应再让用户填写股票名，也不应把名称缺失作为导入阻断条件。实现上应把名称解析做成独立的服务端多源解析器，并把成功结果按 `market:symbol` 长期缓存。

推荐顺序如下：

| 市场 | 第一来源 | 第二来源 | 第三来源 | 最后兜底 |
| --- | --- | --- | --- | --- |
| CN-SH / CN-SZ | 腾讯单证券行情 | 东方财富单证券快照 | 新浪单证券行情 | 标记为“名称同步失败”，自动重试；不要求手填 |
| HK | 腾讯单证券行情 | HKEX 官方证券清单（每日批量缓存） | 东方财富 → 新浪 | Yahoo 仅作非关键最后尝试 |
| US | Nasdaq Trader 官方 Symbol Directory（每日批量缓存） | 腾讯单证券行情 | SEC 公司代码表（股票）→ 新浪 | Yahoo 仅作非关键最后尝试 |

其中 US 和 HK 应引入交易所/监管机构的批量清单，避免把未承诺稳定性的门户行情端点当作唯一事实来源。CN 当前没有找到同时满足“官方、无需 Key、股票与 ETF、可直接按代码查询”的单一接口，因此使用三个门户源交叉兜底。

## 已验证的即时查询源

以下请求于 2026-07-28 从当前部署网络实际探测。它们都不要求 API Key，但腾讯、东方财富和新浪均没有面向开发者的稳定性承诺，必须通过服务端访问、超时、熔断并缓存。

### 腾讯

请求：

```text
GET https://qt.gtimg.cn/q={providerSymbol}
```

代码映射：

- `CN-SH:600519` → `sh600519`
- `CN-SZ:159915` → `sz159915`
- `HK:700` → `hk00700`
- `US:AAPL` → `usAAPL`

响应为 GB18030 文本，波浪号分隔。实测：

- `sh600519`：第 2 段为 `贵州茅台`
- `sh510300`：第 2 段为 `沪深300ETF华泰柏瑞`，后段同时出现 `ETF`
- `sz159915`：第 2 段为 `创业板ETF易方达`，后段同时出现 `ETF`
- `hk00700`：第 2 段为 `腾讯控股`，后段另有英文名 `TENCENT`
- `usAAPL`：第 2 段为 `苹果`，后段另有 `Apple Inc.`

直接样例：[腾讯 A 股](https://qt.gtimg.cn/q=sh600519)、[腾讯港股](https://qt.gtimg.cn/q=hk00700)、[腾讯美股](https://qt.gtimg.cn/q=usAAPL)。

优点是四个目标市场均覆盖且单次请求很轻。风险是无公开 schema、字段位置可能改变、文本编码不是 UTF-8；解析器必须验证变量名、字段数量和代码回显，不能只取固定索引后直接信任。

### 东方财富

请求：

```text
GET https://push2.eastmoney.com/api/qt/stock/get?secid={marketId}.{symbol}&fields=f57,f58,f107
```

已验证映射和字段：

- CN-SH：`1.600519`
- CN-SZ：`0.159915`
- HK：`116.00700`
- US Nasdaq：`105.AAPL`
- `data.f57` = 代码
- `data.f58` = 中文名称
- `data.f107` = 东方财富市场编号

实测分别返回 `贵州茅台`、`创业板ETF易方达`、`腾讯控股`、`苹果`。直接样例：[A 股](https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f57,f58,f107)、[港股](https://push2.eastmoney.com/api/qt/stock/get?secid=116.00700&fields=f57,f58,f107)、[美股](https://push2.eastmoney.com/api/qt/stock/get?secid=105.AAPL&fields=f57,f58,f107)。

它适合作为中文名称补全源，但不适合作为 US 第一来源：美股不同交易所使用不同 `marketId`，仅凭导入代码不总能直接确定；探测过程中也出现过 `Empty reply from server`。应设置短超时并在一次失败后切换来源，不立即密集重试。

### 新浪

请求需带来源页：

```text
Referer: https://finance.sina.com.cn/
GET https://hq.sinajs.cn/list={providerSymbol}
```

代码映射与名称字段：

- CN：`sh600519` / `sz159915`，CSV 第 1 字段是中文名
- HK：`rt_hk00700`，第 1 字段英文简称、第 2 字段中文名
- US：`gb_aapl`，第 1 字段中文名

响应也是 GB18030 文本。直接样例：[新浪 A 股](https://hq.sinajs.cn/list=sh600519)、[新浪港股](https://hq.sinajs.cn/list=rt_hk00700)、[新浪美股](https://hq.sinajs.cn/list=gb_aapl)。

它可作为第三即时源。风险同样是无公开 schema，并且缺少正确 `Referer` 时可能被拒绝。

## 官方批量来源

### US：Nasdaq Trader Symbol Directory

Nasdaq Trader 的官方说明确认 Symbol Directory 提供 Nasdaq 上市和其他交易所上市证券，字段包含 `Symbol`、`Security Name`、`ETF` 和 `Test Issue`，文件在日内定期更新，末行含生成时间。[字段定义](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs)；[Symbol Lookup 与下载说明](https://nasdaqtrader.com/trader.aspx?id=symbollookup)。

无需 Key 的文件：

- [nasdaqlisted.txt](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt)
- [otherlisted.txt](https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt)

实测两者均为管道分隔文本。前者表头包含 `Symbol|Security Name|...|ETF|...`；后者包含 `ACT Symbol|Security Name|Exchange|...|ETF|...`。`otherlisted.txt` 覆盖 NYSE、NYSE American、NYSE Arca、Cboe 等非 Nasdaq 挂牌证券，因此两份文件合并后适合作为 US 股票和 ETF 的主名称字典。

建议服务端每天首次需要时下载一次，过滤 `Test Issue=N`，构建 `upper(symbol) → {name, isEtf, exchange}`。名称是正式英文证券名；若 UI 希望中文名，可在此基础上再向腾讯/新浪补充本地化名，但不应以中文名请求失败阻断导入。

### US 股票补充：SEC

SEC 官方说明 `company_tickers.json` 和 `company_tickers_exchange.json` 提供 ticker、CIK、EDGAR 公司名和交易所关联，并明确 EDGAR 数据 API 不需要认证或 API Key。[SEC EDGAR API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)、[访问 EDGAR 数据](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)、[Company Tickers](https://www.sec.gov/file/company-tickers)。

SEC 同时声明这些关联会定期更新，但不保证准确性或覆盖范围。它适合补公司股票，不适合覆盖全部 ETF；访问时还要遵守 SEC 的自动访问政策，并使用可识别的 `User-Agent`。因此只放在 Nasdaq Directory 之后。

### HK：HKEX Full List of Securities

HKEX 官方提供无需 Key 的 [ListOfSecurities.xlsx](https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx)。2026-07-28 实测为有效 XLSX，表头包含：

- `Stock Code`
- `Name of Securities`
- `Category`
- `Sub-Category`
- `ISIN`
- `Trading Currency`

HKEX 的证券列表页面也明确表示 Full List of Securities 包含证券资格字段，并覆盖 equities 和 funds（包括 ETF）。[HKEX Securities Lists 说明](https://www.hkex.com.hk/Services/Trading/Securities/Securities-Lists/Closing-Auction-Session-%28CAS%29-Securities?sc_lang=en)。

建议每日下载一次并缓存。使用五位 `Stock Code` 匹配，首期只保留 `Category=Equity` 以及交易所交易产品/基金中明确为 ETF 的行。官方表提供英文名称；需要中文显示时再用腾讯、东方财富或新浪补充。

## Yahoo 的定位

项目现有 Yahoo chart 适配器可继续用于 K 线备用，但不建议承担名称补全的关键路径：

- Yahoo 的 `v1/finance/search` 理论响应包含 `symbol`、`shortname`、`longname`、`quoteType`；开源 yfinance 的官方实现也按这些字段解析搜索结果。[yfinance 源码](https://github.com/ranaroussi/yfinance/blob/master/yfinance/utils.py)
- Yahoo chart 的 `v8/finance/chart/{symbol}` 主要用于价格和时区；yfinance 也以该端点读取 `exchangeTimezoneName`，并没有把名称作为稳定字段。[yfinance base.py](https://github.com/ranaroussi/yfinance/blob/main/yfinance/base.py)
- 当前网络对 `query1.finance.yahoo.com` 和 `query2.finance.yahoo.com` 的 chart/search 实测都返回 Yahoo HTML 错误页，而不是 JSON。
- Yahoo 的公开页面目前要求开发者就 API 访问另行联系，并未给出无 Key 的正式开发者 SLA。[Yahoo Finance 计划说明](https://finance.yahoo.com/about/plans/compare/)

因此：Yahoo 可以作为“有结果就用”的最后尝试，但名称解析完成度不能依赖它。

## 建议的解析契约

输入：

```ts
type InstrumentLookup = {
  market: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol: string;
};
```

输出至少包含：

```ts
type ResolvedInstrument = {
  market: InstrumentLookup["market"];
  symbol: string;
  name: string;
  assetType: "stock" | "etf";
  source: "nasdaq" | "sec" | "hkex" | "tencent" | "eastmoney" | "sina" | "yahoo";
  resolvedAt: string;
  confidence: "official" | "portal";
};
```

执行规则：

1. 先标准化代码：US 大写并保留 `.`/`-`；HK 左补零到五位；A 股保持六位并保留 SH/SZ 市场。
2. 先查本地 IndexedDB/服务端元数据缓存；已成功解析的交易标的不要重复联网。
3. 一个导入批次对去重后的 `market:symbol` 并发解析，限制并发数；批量官方目录只下载一次。
4. 每个候选结果必须校验返回代码与请求代码一致、名称非空、资产类型是股票或 ETF。
5. 记录来源和时间。官方目录可每日刷新；门户结果可按较长 TTL 刷新，用户单股“更新数据”时允许同时刷新名称。
6. 所有来源失败时，不展示名称输入框；导入确认页展示“名称补全失败，将自动重试”的异常项并提供“重新查询”。后台重试应轮换来源，而不是反复请求同一端点。

## 需要在实现前固定的测试夹具

- CN-SH 股票：`600519`
- CN-SH ETF：`510300`
- CN-SZ 股票：`000001`
- CN-SZ ETF：`159915`
- HK 股票：`00700`
- HK ETF：`02800`
- US Nasdaq 股票：`AAPL`
- US 非 Nasdaq 股票：`BRK.B`
- US ETF：`SPY`
- 不存在的代码、超时、403、429、HTML 错误页、空 JSON、代码不回显、编码错误

单元测试只用冻结夹具，live smoke 作为非阻断测试；外部端点波动不能使 CI 随机失败。
