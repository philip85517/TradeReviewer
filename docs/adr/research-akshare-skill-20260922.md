# AKShare 与社区 Agent Skill 行情能力核查

核查日期：2026-09-22。范围：美股、港股、A 股及 ETF 的 1D / 1H / 15m，Agent Skill 来源、费用与授权、接入边界。本次仅联网读取官方文档、公开源码与封装作者自己的仓库；没有安装软件、调用行情接口、使用账户凭据或读写交易数据库。本文是候选调研，不代表已实测可用或批准生产接入。

## 结论

AKShare 适合作为 **Python 数据采集 SDK 的候选**，优先验证 A 股和沪深 ETF 日线及近期分钟线、港股日线；不宜据此承诺美股长期 15m / 1H 历史。它调用东方财富、腾讯、新浪等上游；接入 AKShare 并不会自动增加独立行情源数量。[东财实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py)、[腾讯实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_tx.py)、[新浪实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_zh_a_sina.py)。

官方软件采用 MIT；官方项目概览同时明确接口与相关数据仅用于学术研究。因此“SDK 免费”“无需个人 API Key”“行情允许商用或再分发”是三件事。本次未取得底层行情用于商用、公开展示、再分发或长期存储的明确授权，不能将 SDK 许可证视作行情许可证。[MIT](https://github.com/akfamily/akshare/blob/main/LICENSE)、[官方使用范围说明](https://akshare.akfamily.xyz/introduction.html)。

## 1. 官方、社区 Skill 与 MCP 的来源

| 对象 | 已核实身份 | 对本项目的意义 |
|---|---|---|
| `akfamily/akshare` | 官方 Python SDK。2026-09-22 读取的完整 `main` 树 SHA 为 `0191689d57c667b7c7a198fd0cf97316837ef311`，`truncated=false`，未检出 `SKILL.md` 或含 `skill` 的路径。 | 本次未发现官方 AKShare Agent Skill；这一结论限定在已检查的仓库快照，不能断言互联网不存在任何官方关联 Skill。[完整树](https://api.github.com/repos/akfamily/akshare/git/trees/0191689d57c667b7c7a198fd0cf97316837ef311?recursive=1) |
| `akfamily/aktools` | 官方关联 HTTP API 包装器；官方概览指向它。 | HTTP 封装不是新增数据供应商，也不能直接叫 Agent Skill。[官方介绍](https://akshare.akfamily.xyz/introduction.html)、[AKTools 仓库](https://github.com/akfamily/aktools) |
| `Z-AErIs/akshare-open` | 社区作者仓库，确有带 YAML 元信息的根目录 `SKILL.md`，以及调用 AKShare 的 Python 脚本；作者声明 MIT。 | 这是可核实的社区 Agent Skill，未发现 AKFamily 官方维护或背书证据。[SKILL.md](https://github.com/Z-AErIs/akshare-open/blob/4414efd78267bcb97642752d8e3c68c0d228a0c6/SKILL.md)、[许可证](https://github.com/Z-AErIs/akshare-open/blob/4414efd78267bcb97642752d8e3c68c0d228a0c6/LICENSE) |
| `wukan1986/akshare_mcp` | 作者明确称为 AKShare 的 MCP Server 封装。 | 是第三方工具协议封装，不因名称含 AKShare 就成为官方 Skill。[作者 README](https://github.com/wukan1986/akshare_mcp) |

社区 Skill 不能直接据宣传认定可接入：其 `hist_us_min()` 向 `ak.stock_us_hist_min_em()` 传入 `period`，而当前官方函数签名仅有 `symbol/start_date/end_date`。这是静态源码可确认的签名不匹配；本次未运行，因此不声称观察到了实际异常。它的美股日线示例使用裸 `AAPL`，脚本直接透传，而官方东财接口要求诸如 `105.AAPL` 的市场代码，代码映射也须另验。[社区调用代码](https://github.com/Z-AErIs/akshare-open/blob/4414efd78267bcb97642752d8e3c68c0d228a0c6/scripts/stock/hist.py)、[官方函数](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py#L1688)。

建议：Skill 可辅助研究和操作指导；应用后端采用经过测试的 SDK 适配器，避免让 Agent 解释、文本截断或社区 CLI 默认参数进入稳定行情路径。这是基于上述接口差异的工程建议，不是官方架构要求。

## 2. 账户、费用、授权与运行条件

- **账户与注册**：本次检查的东财、腾讯、新浪股票 K 线实现不要求调用者提供账户、个人 API Key 或注册令牌；东财源码中固定的 `ut` 参数不能等同于用户账户凭据，也不代表授权合同。此结论仅覆盖本文列出的接口，不能推广到 AKShare 的全部数据接口。[东财源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py)、[腾讯源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_tx.py)、[新浪源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_zh_a_sina.py)。
- **软件费用**：MIT 许可的软件可免费取得和使用，须保留规定的版权与许可声明；仍有运行环境、网络、缓存和维护成本。没有据此核实付费行情权限或可采购的服务保障。[许可证](https://github.com/akfamily/akshare/blob/main/LICENSE)。
- **底层数据权利**：官方研究用途说明不构成东方财富、腾讯、新浪或交易所向本项目授予的商用行情合同。本次没有完成逐个上游、交易所、市场、用途的授权核验，公开展示或商业再分发应列为未通过项，而不是标成“免费可商用”。[官方说明](https://akshare.akfamily.xyz/introduction.html)。
- **环境**：当前官方 `pyproject.toml` 要求 Python `>=3.11`，并依赖 pandas、requests 等；社区 Skill 写的 Python 3.9+ 与当前包元数据不一致，接入应以固定版本包元数据及验证结果为准。[官方元数据](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/pyproject.toml)、[社区说明](https://github.com/Z-AErIs/akshare-open/blob/4414efd78267bcb97642752d8e3c68c0d228a0c6/SKILL.md)。

## 3. 按市场和周期的真实能力

下表“支持”指文档或源码有对应参数，不等于已经连通、完整覆盖所有证券或有深度保证。`1H` 对应 `period="60"`，`15m` 对应 `period="15"`。`raw/qfq/hfq` 分别对应 `adjust=""/"qfq"/"hfq"`。

| 市场/资产 | 1D 接口及上游 | 15m / 1H | 复权及历史深度边界 |
|---|---|---|---|
| A 股 | `stock_zh_a_hist`，东财；`period="daily"` | `stock_zh_a_hist_min_em`，东财原生 15/60 | 日线与 15/60 参数均有 raw/qfq/hfq；分钟只应承诺“近期”，不承诺任意开始日期都能回补。1m 是近 5 个交易日、无复权。[实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py#L952) |
| 沪深场内 ETF | `fund_etf_hist_em`，东财 | `fund_etf_hist_min_em`，东财原生 15/60 | 日线与 15/60 有 raw/qfq/hfq；1m 近 5 个交易日、无复权，其他分钟深度没有固定保证。ETF 代码由专门 ETF 列表/映射确认。[ETF 实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/fund/fund_etf_em.py#L237)、[基金文档](https://akshare.akfamily.xyz/data/fund/fund_public.html) |
| 港股股票 | `stock_hk_hist`，东财；`stock_hk_daily`，新浪日线备选 | `stock_hk_hist_min_em`，东财原生 15/60 | 东财支持 raw/qfq/hfq；1m 走 5 日趋势端点，15/60 走 K 线端点。官方港股分钟说明总体写“最近 5 个交易日”并提醒延时，参数表又特指 1m；因此 15/60 的确切深度为待实测，不从端点参数推导更长保证。[东财实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py#L1395)、[新浪实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_hk_sina.py)、[官方股票文档](https://akshare.akfamily.xyz/data/stock/stock.html) |
| 美股股票 | `stock_us_hist`，东财；`stock_us_daily`，新浪日线备选 | **未核实原生 15/60**。`stock_us_hist_min_em` 没有 `period`，只取 `trends2/get` 的 5 日分钟趋势 | 东财日线参数有 raw/qfq/hfq，但官方特别提醒复权参数是否生效；新浪日线文档提供 raw/qfq，不应补称 hfq。美股分钟无 `adjust`，有更新延时；最多作为待校验的短窗口聚合原料，不能补出长期历史。[东财实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py#L1688)、[新浪实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_us_sina.py)、[官方股票文档](https://akshare.akfamily.xyz/data/stock/stock.html) |
| 美股/港股当地上市 ETF | **待逐证券核实**：本次未找到“所有 US/HK ETF 均保证可由股票接口获取”的官方合同 | 不因股票接口接受某代码就认定完整覆盖 | 沪深的 `513500` 等跨境 ETF 属于中国上市基金，不能拿它证明美国交易所 ETF 的覆盖。当前 ETF 源码按沪深代码识别市场。[ETF 市场映射](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/fund/fund_etf_em.py#L220) |

A 股另有 `stock_zh_a_hist_tx`（腾讯日线，raw/qfq/hfq）与 `stock_zh_a_daily`（新浪日线）、`stock_zh_a_minute`（新浪 1/5/15/30/60）。新浪分钟源码请求 `datalen="1970"`，这是请求行数，不是 1970 天或历史起始年份，也不是保证必返 1970 根；没有任意历史分页参数。复权步骤失败时源码可直接返回原分钟结果，故仅看调用参数不能证明复权成功。[腾讯实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_tx.py)、[新浪分钟实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_zh_a_sina.py#L350)。

东财多处先取上游返回数据再按 `start_date/end_date` 本地切片；`beg=0`、`lmt=1000000`、默认开始于 1970/1979 年都不能证明上游确有这么深的历史。准确最早时间、证券覆盖和缺口只能由后续采样确认。[东财切片实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py)。

## 4. 口径、时间与质量风险

| 核查项 | 已知证据 | 适配要求（建议） |
|---|---|---|
| 成交量单位 | 官方文档将东财 A 股成交量标成“手”，港股/美股相应历史接口标成“股”；ETF 历史表未明确单位。[股票表](https://akshare.akfamily.xyz/data/stock/stock.html)、[ETF 表](https://akshare.akfamily.xyz/data/fund/fund_public.html) | 不能统一乘 100。按端点、市场和证券类型记录源单位，未知保留 unknown，用价量额与独立样本核实。 |
| SDK 已做换算 | 当前腾讯日线源码按代码前缀分支乘 100，金额乘 10000，声明输出股/元；换算分支含 `sz000` 例外。[腾讯源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_tx.py) | SDK 输出和直接腾讯响应不能共用未经辨别的换算；canary 包括 `sz000001`、沪市主板和科创板，检查是否仍有证券差异。 |
| 时区与交易日 | 东财分钟实现将日期解析为无时区字符串，没有提供统一的带时区时间戳；美股官方样例从 `21:30` 到次日凌晨。[源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py#L1758)、[样例](https://akshare.akfamily.xyz/data/stock/stock.html) | 不把所有返回值当交易所本地时间或 UTC。核实上游墙钟时间，再转换；美国夏令时、跨自然日及交易日归属必须单独验收。 |
| Bar 起止与 session | 所检查接口没有输出明确的 bar-open/bar-close 标识或统一交易时段元数据。[东财实现](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock_feature/stock_hist_em.py) | 核验 09:30/午休/收盘边界，确定 60 分钟锚点与尾部不足 1 小时 bar；不默认跨午休、盘前盘后和常规时段混合聚合。 |
| 零开盘及复权 | 官方 A 股 1m 示例提醒旧交易日 open=0；HK/US 1m 样例也出现 0。官方数据说明另记录后复权 OHLC 负值案例。[股票样例](https://akshare.akfamily.xyz/data/stock/stock.html)、[数据风险记录](https://akshare.akfamily.xyz/data_tips.html) | 不用零 open 合成“有效 OHLC”；不能用上一收盘或第一笔 close 无标识地补造开盘。raw/qfq/hfq 分开缓存，并保留复权证据与质量标志。 |

## 5. 可靠性、并发与冗余

官方介绍承认目标网站变化会引发接口异常、需要持续更新；答疑对超时建议降低频率。源码存在固定 15 秒超时的东财调用，也存在默认无超时的新浪/腾讯调用；没有统一总请求预算。未找到适用于这些端点的官方可依赖 QPS、并发额度或可用性 SLA，不能虚构“免费无限调用”或“每天多少次”。股票文档中某些“访问无限制”的措辞也不能代替上游的服务合同或实际限流行为。[官方维护说明](https://akshare.akfamily.xyz/introduction.html)、[答疑](https://github.com/akfamily/akshare/blob/main/docs/answer.md)、[股票文档](https://akshare.akfamily.xyz/data/stock/stock.html)、[新浪源码](https://github.com/akfamily/akshare/blob/0191689d57c667b7c7a198fd0cf97316837ef311/akshare/stock/stock_zh_a_sina.py)。

工程建议：按实际上游建立限流、熔断和共享请求队列；初始 canary 串行，缓存去重，有限退避与总超时后退回已有缓存。具体节流间隔是项目策略，不能说成厂商允许额度。对于无法取消的同步请求，须验证 worker 超时后的底层工作是否还继续占用资源；不能只对等待 Promise/线程设置超时便认定已取消。

冗余应记录 `upstream=eastmoney/tencent/sina`、`transport=akshare/direct`、函数名与 SDK 版本。例如“直接东财 + AKShare 东财”共享网站、数据生成链路和潜在封禁；“MCP → AKShare → 东财”再多一层封装也不是第三份独立报价。“AKShare 腾讯”可提供另一个上游候选，但完整的数据血缘独立性本次未核实。[三类上游对应实现](https://github.com/akfamily/akshare/tree/0191689d57c667b7c7a198fd0cf97316837ef311/akshare)。

## 6. 接入前小规模验证门槛（未执行）

1. 固定 SDK 版本/源码 SHA，使用独立 Python 环境、隔离的临时行情库和明确证券列表。记录函数、真实上游、参数、抓取时间、首末 bar、返回行数、单位、时区假设、复权模式与延时。本次未安装，故不存在“已连通”结论。
2. 覆盖 A 股沪深主板/科创板/北交所、沪深股票 ETF/债券 ETF/跨境 ETF，港股普通股，以及美股普通股、拆股证券和当地上市 ETF。逐项确认支持；代码不能解析、空结果和确无交易必须区分。
3. 日线测近期与一个跨拆股/分红的旧区间；15/60 测近期和超出近期窗口的旧区间。请求旧日期若仅返回近期数据或空集，标记 coverage 不足，不能成功落成“该区间无交易”。港股分钟的文档范围差异必须由数据边界解决。
4. 核验 OHLC 顺序、重复、缺口、零 open、成交量/额倍率；用另一实际上游比对相同交易日和复权口径。未经验证的 qfq/hfq 与未知单位不进入普通“已验证”缓存。
5. 核验时间含义、美国夏令时两侧、跨日、午休、半日市和非完整尾 bar；US 的 1m→15/60 聚合必须在有效 open 和 session 规则通过后才可启用，否则列“不支持”。
6. 至少跨两个交易日的低频重复抓取，记录错误率、截断、延时和结构漂移；模拟超时/限流/上游不可达，验证有限重试、取消、旧缓存及不覆盖正确数据。只对通过的“市场 × 证券类别 × 周期 × 复权”组合开放。
7. 本地研究与对外商业服务分开决策；后一用途必须先补足相关上游数据授权证据。技术采样成功不能替代许可确认。

上述为本项目建议的验收门槛，不是 AKShare 声称已提供的能力或服务承诺。当前判断：**有条件候选；社区 Skill 不直接作为生产数据接口；US/HK ETF 全覆盖、长期分钟、固定限额/SLA、商业数据权限均未验证。**
