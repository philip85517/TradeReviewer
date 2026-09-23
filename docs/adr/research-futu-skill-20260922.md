# 富途官方 Skill、MCP 与行情 API 调研

核验日期：2026-09-22。状态：官方资料研究，**未登录、未安装、未购买行情、未做真实账户 canary**；未读写业务数据库。本文不是已接通验收报告。文档以当日 v10.11 和新开发者门户为准；部分网页通过只读 HTTP 抓取补充浏览工具的超时结果。

## 结论

富途已经有**官方 Agent Skill、官方托管 MCP、免 OpenD 的 REST API**。因此不能再根据旧教程把富途概括成“必须证券开户＋本地网关＋第三方 MCP”。新云通道值得先做只读验证；如果账户在美、港、沪深市场的 1D/1H/15m 均满足需求，一个富途供应商就可能覆盖三市场。但现在没有真实权限与数据证据，不能承诺它已比长桥稳定或已能替代长桥。[官方门户](https://open.futunn.com/zh-cn/)

**建议顺序（本项目判断）：**先验证官方 Cloud REST 历史 K 线，AI 临时查询用官方 MCP；如云端历史覆盖/权限不满足，再评估 OpenD。Skill 是调用方法和代码指导，不能替代后台行情适配器、缓存、复权/时间语义与可靠性控制。不要因为 Skill 易安装就给每个市场再添一个供应商。

## 三种官方入口必须分开

| 入口 | 已核验事实 | 对 TradeReview 的意义 |
| --- | --- | --- |
| OpenD Skill | 官方 `futuapi` 与 `install-futu-opend` 两个模块，官方域名发布安装包；使用前仍需手动登录 OpenD。2026-03-20 更新日志已宣布支持 Codex | 属于官方工具，不是未经证实的 GitHub 包；主要降低安装和写调用代码的门槛 |
| 官方 MCP | `https://mcp.futunn.com/mcp`，托管 HTTP＋OAuth；可仅授予 `quote:read`，与交易读写权限独立 | AI 查行情最短路径；不需自己维护 MCP wrapper，不等于应用已自动接入 |
| Cloud REST | `https://webapi.futunn.com`，OAuth 2.1＋PKCE 推荐，也兼容签名 AppKey；无需专用 SDK/本地网关 | 对现有 Web 后端更直接，省掉 OpenD 进程；仍需令牌存储、刷新、限流和行情规范化 |

来源：[官方 Skill 文档](https://openapi.futunn.com/futu-api-doc/en/intro/ai.html)、[官方 Skill Hub](https://www.futunn.com/en/skillhub/openapi)、[更新日志](https://openapi.futunn.com/futu-api-doc/changelog/changelog.html)、[MCP 概览](https://open.futunn.com/mcp-docs/overview)、[MCP FAQ](https://open.futunn.com/mcp-docs/faq)、[REST 入门](https://open.futunn.com/api/overview/getting-started)。本次无需引入任何第三方 Futu MCP/REST wrapper；名称包含 Futu 或 futuapi 不是官方身份证明。

## 账户、开户、入金和费用

### OpenD 的现行规则

富途账号注册后即可登录 OpenD，**无需先开证券账户**；第一次使用需问卷评估和协议确认。注册账号、证券开户/KYC、入金、行情订阅是不同步骤，不应合并成统一前置条件。[登录权限](https://openapi.futunn.com/futu-api-doc/en/intro/authority.html)

以下是 OpenD 文档的行情规则，**不能直接推定 Cloud REST/MCP 也采用同一矩阵**：

| 市场（股票和 ETF） | 文档当前权限 | 关键条件 |
| --- | --- | --- |
| 港股 | 中国内地验证用户免费 LV2；全球用户免费 LV1，LV2/SF 可购买 | 文档说明内地/全球按 OpenD 登录 IP 区分 |
| 美股 | Nasdaq Basic＋TotalView＋NYSE ArcaBook 的 LV3 推广期免费 | 非永久免费承诺；ArcaBook 深度需非专业用户评估；OTC 不支持 |
| 沪深 A 股 | 中国内地验证用户免费 LV1；全球/机构用户不支持 | 不可把“支持 A 股代码”当成所有账号都有权限 |

API 和 App 行情权限不同，App 已有行情不能证明 API 可用。权限等级也影响时延及接口能力。[官方权限表](https://openapi.futunn.com/futu-api-doc/intro/authority.html)

美股 API 数据源组合可能导致当日开盘价与 App 不同；不能无条件称为全美综合行情。官方 FAQ 明确此次推广包括 NYSE/Nasdaq 等上市股票和 ETF 的历史 K 线、快照与实时订阅。[行情 FAQ](https://openapi.futunn.com/futu-api-doc/qa/quote.html)

API 无额外接口费用不代表所有行情免费。官方费用页把行情价格交由对应行情卡购买页；本次 HK LV2 购买页出现重定向循环，**未核实可适用于该用户的当前付费金额**，不填写猜测价格，也不引用其他地区 moomoo 价格作为富途香港通用报价。[费用](https://openapi.futunn.com/futu-api-doc/en/intro/fee.html)、[HK LV2 官方商品页](https://qtcard.futunn.com/intro/hklv2?type=1&is_support_buy=1&clientlang=0)

未来交易另有证券账户、市场交易权限及资金要求；A 股实盘仅部分 A 股通标的，不应把此交易限制等同于 A 股行情覆盖限制。[交易 FAQ](https://openapi.futunn.com/futu-api-doc/en/qa/trade.html)

### Cloud 的已知与未知

云端可用 OAuth 细粒度授权；MCP FAQ 也明确账号、地区会限制市场/功能，鉴权成功不证明行情全部可用。令牌可自动刷新，刷新失败或闲置超过 14 天可能需重新授权。[MCP FAQ](https://open.futunn.com/mcp-docs/faq)

云行情 WebSocket 文档进一步明确权限档位和额度会限制订阅。[登录鉴权](https://open.futunn.com/zh-cn/api/quote/push/auth)。本次公开资料没有核实 Cloud 历史 K 线的完整地区/付费矩阵、延迟时长、历史符号额度或开户/资产门槛，必须用用户真实只读授权再验证；不能将主页“免费”宣传扩展为无限量、全地区、全历史数据授权。

## 1D、1H、15m 历史 K 线：两条协议的具体差异

| 项目 | OpenD 历史接口 | Cloud REST 历史接口 |
| --- | --- | --- |
| 接口 | `request_history_kline` | `GET /api/v1.0/quote/{symbol}/history-kline` |
| 周期 | `K_DAY`、`K_60M`、`K_15M` 均有 | `ktype=2/9/7` 分别对应 1D/1H/15m |
| 复权 | 默认 `AuType.QFQ`；`NONE` 原始价格 | 默认 `autype=1` 前复权；`0` 不复权、`2` 后复权 |
| 分页 | 默认 `max_count=1000`；这不是硬总量上限，`None` 可要求整个区间，但官方建议超千根分页；使用 `page_req_key` | `num` 默认/上限 **370**；`next_time` 按文档回传下一页 `end` |
| 时间 | `time_key` 字符串；港/A 北京时间、美股美东时间 | `time_key` Unix 毫秒；另有 `date`、`time_zone` |
| 覆盖 | 分钟最近 **8 年**，日线最近 **20 年**，日以上不限制；实际上市/交易数据仍决定可得范围 | 本次未找到可据以承诺的历史年限 |
| 非常规时段 | 美股盘前/盘后/夜盘仅 60m 及以下，可能不足 2 年；`session` 优先于旧参数，历史不接受单独 `OVERNIGHT` | `extended_time=0/1/2`，分别默认、包含盘前盘后、包含夜盘 |

来源：[OpenD 历史 K 线](https://openapi.futunn.com/futu-api-doc/quote/request-history-kline.html)、[K 线枚举](https://openapi.futunn.com/futu-api-doc/en/quote/quote.html)、[Cloud 历史 K 线](https://open.futunn.com/api/quote/basic-data/history-kline)。OpenD 省略起止日期时默认一年查询窗，**不是只能取一年历史**。

Cloud 历史页将 `end` 声明为日期字符串，却要求分页把毫秒 `next_time` 回传 `end`；概览还说明日期区间接口以 `pagination.has_more` 判断结束。因此必须验收真实多页响应与参数，不盲目依赖某一个示例。[分页概览](https://open.futunn.com/api/quote/overview)

### 额度与限流（仅 OpenD 已获明确数值）

2026-04-16 的更新明确取消开户登录门槛，并将历史额度周期从 30 天缩短为 **7 天**。旧 PDF 的 30 天规则不再作为当前依据。[版本变更](https://openapi.futunn.com/futu-api-doc/changelog/changelog.html)

| 资产/交易条件 | 实时订阅额度 | 历史 K 线符号额度 |
| --- | ---: | ---: |
| 资产不足 HKD 10,000（含仅注册） | 100 | 100 |
| 资产至少 HKD 10,000 | 300 | 300 |
| 资产超过 HKD 500,000，或月成交订单超过 200，或月成交额超过 HKD 2,000,000 | 1000 | 1000 |
| 资产超过 HKD 5,000,000，或月成交订单超过 2000，或月成交额超过 HKD 20,000,000 | 2000 | 2000 |

历史额度按 7 天内不同证券占用，同证券不同周期不重复计数；不是 K 线根数。实时订阅按证券×类型占用，所以每股同时订阅 1D/1H/15m 通常用三份。这里列出的股票额度与期权额度独立。[额度说明](https://openapi.futunn.com/futu-api-doc/en/intro/authority.html)

历史接口每 30 秒 60 次；分页仅首页受此频次限制，后续页不受这一条规则限制。可查询 `get_history_kl_quota(get_detail=True)` 做预算。实时订阅至少一分钟后才可取消。[历史接口限制](https://openapi.futunn.com/futu-api-doc/quote/request-history-kline.html)、[额度查询](https://openapi.futunn.com/futu-api-doc/quote/get-history-kl-quota.html)、[订阅限制](https://openapi.futunn.com/futu-api-doc/quote/sub.html)

**Cloud 数值不可照搬**：云限流页只公开 429、`Retry-After`、有限指数退避等策略，没有本次可核验的统一数值/历史额度周期。[Cloud rate limit](https://open.futunn.com/api/overview/rate-limit)

## 对齐与运行可靠性

- 本次查到的历史接口将时间称为 K 线时间，**没有足够明确的一手证据证明所有市场/周期均是开盘标签或收盘标签**。在 canary 对齐交易所首尾分钟、午休和 60m 尾段之前，不应在适配器里统一加减周期。
- Cloud 历史页明确成交量以股计，并有 `volume_precision` 缩放，股票/ETF 通常为 0；成交额字段没有本次可确认的统一币种说明，须按证券币种验证。OpenD 字段不能直接复制 Cloud 的缩放假设。
- Cloud 页把 `time_zone=-300` 例子写作美国夏令时，存在明显表述疑点。项目应保留 epoch、市场日期，按 `America/New_York` 规则核验夏/冬日期，不能硬编码固定 UTC 偏移。这是待验证项，不声称服务实际返回错误。
- 复权必须显式传值并进入缓存键；复盘成交对应原价，量化连续收益对应复权序列，不能沿用默认前复权后再与原始成交价格直接比较。以上为项目接入建议，依据上述字段定义，不是已完成验证。

传统 OpenD 额外有本地守护进程和端口（常用 `127.0.0.1:11111`）、短信/设备锁、网络重连、版本升级等运维。官方 FAQ 确认记住密码的令牌过期叠加网络波动可能导致无法自动重连；多终端可能争抢最高行情权限，一个账号最多同时登录 10 个 OpenD，连接上限 128。[OpenD FAQ](https://openapi.futunn.com/futu-api-doc/qa/opend.html)

因此相较长桥一类直接 SDK/云 API，**传统 OpenD Skill 不天然更简单**。新 Cloud REST 去掉这一常驻进程，具有更低接入复杂度的潜力；其实际可靠性和行情权益仍缺 canary 证据。用于未来个人量化，OpenD 8 年分钟历史是有吸引力的文档能力，但 100 个证券/7 天的基础额度不适合无限全市场扫描。

## 使用授权与下一步验收

官方把 API 定位于程序化交易、量化研究，并提供回测 Skill，支持个人自动化使用这一方向；这不等于无条件的数据再分发权。服务协议限制数据在授权范围内个人使用，未经数据方书面同意不得向第三方重新分配/传播。面向他人的共享网站、数据包发布、多人行情服务，以及具体非展示用途授权，需单独核实；个人本地复盘与公开分发不能视为同一许可。[API 介绍](https://openapi.futunn.com/futu-api-doc/intro/intro.html)、[服务协议](https://www.futunn.com/about/services?lang=zh-cn)

建议先安排一次独立只读 canary：仅 `quote:read`，选美股/ETF、港股/ETF、沪深股票/ETF各代表，分别取 1D/1H/15m、至少三页、跨复权事件、美国 DST、港/A 午休与收盘；记录地区、实际权限、延迟、最早日期、限流/令牌失效行为、分页无重漏。行情缓存与原始交易库分离。上述验收全部未执行。

若 Cloud 三市场通过，可优先使用一个富途供应商；如 A 股地区权益失败或历史不足，再由整体方案增加一个必要来源，而不是同时维护 Skill、MCP、OpenD、REST 四条生产取数链。每市场最多三个供应商是上限，不是必须凑满的目标。
