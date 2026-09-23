# 0007：长桥、AKShare、富途 Skill 与行情数据源可用性

日期：2026-09-22。状态：研究建议，未批准切换生产路由。

本次核验官方文档、官方代码和明确标识的社区项目。未安装 Skill、登录券商账户或执行行情接口实测；接口延迟、实际权限、费用和样本质量尚无账户级测量结果。

## 结论

优先验证长桥作为跨美股、港股、沪深股票及 ETF 的统一行情适配源；富途作为同级候选，已有账户和行情权益时可优先验证富途。AKShare 适合低门槛研究、标的发现及补充数据接入，但应按真实上游管理，不能当成与东财、腾讯相独立的兜底源。

三者均不能仅凭“免费”或“全市场覆盖”宣传，确认为可持续、无限制的全市场历史仓库来源。最终采购/接入选择要同时满足标的全集、退市标的、分钟历史、使用权限、更新配额和质量要求。

## Skill 与接入方式

| 维度 | 长桥 Longbridge | AKShare | 富途 Futu |
| --- | --- | --- | --- |
| 官方 Skill | 有：官方开发者站与 `longbridge/skills` | 本次在官方仓库未发现；存在社区 Skill/MCP | 有：官方 Skills Hub 与 OpenD Skills |
| Skill 的作用 | 指导 AI 调用 CLI/MCP/SDK | 包装 Python 数据接口 | 指导 AI 调用行情、交易和订阅接口 |
| 后台确定性接入 | 优先官方 SDK/API | Python adapter/worker，记录实际上游 | 云 REST 或 OpenD+SDK；两条通道分别验收 |
| 本地运维 | 凭证、连接、限流与权限管理 | Python 依赖、上游变更、超时与封禁管理 | REST 管理 OAuth/密钥；OpenD 另需守护进程、登录、重连与版本管理 |

来源：[长桥官方 Skill](https://open.longbridge.com/skill)、[AKShare 官方项目](https://github.com/akfamily/akshare)、[社区 AKShare Skill](https://github.com/Z-AErIs/akshare-open)、[富途官方 Skill](https://www.futunn.com/skillhub/openapi)、[富途云接入](https://open.futunn.com/api/overview/getting-started)。社区封装存在不代表 AKShare 官方背书。本机当前可用 Skill 清单中未找到这三家的对应条目。

本次所查社区 AKShare Skill 向美股分钟函数传入 `period`，但官方当前函数没有该参数，另有证券代码映射疑点。这是静态代码差异，未运行；足以说明不能仅凭 Skill 的能力清单判断接口可用，详见 AKShare 附件。

## 账户、费用与权限

| 维度 | 长桥 | AKShare | 富途 |
| --- | --- | --- | --- |
| 注册 | 需要长桥账户及授权 | 本次研究的公开行情接口不要求 AKShare 账户/token | OpenD 需要富途/对应 moomoo 账户；云端需 OAuth 或开发者密钥 |
| 是否必须真实证券开户 | 当前 FAQ 允许模拟账户调试；平台介绍仍描述开户流程，需按所在地区验证 | 不需要券商开户 | 当前 OpenD 文档明确登录不要求证券开户；首次使用需问卷与协议 |
| 是否必须入金 | 不能把入金视为所有调试的前提；历史额度、深度与资产等级有关 | 无入金门槛 | 基础登录不要求入金；更高额度与部分权益有资产/交易要求 |
| 接口是否免费 | 不额外收 API 接入费；高级行情另计 | 开源软件免费；不代表上游数据无限制或可再分发 | 基础 API 接入免费；不同市场/账户的行情权限另核验 |
| 免费行情 | 当前定价页称美/港/A 基础行情附赠；港股说明与概览页冲突 | 免费获取公开网页数据，缺少统一 SLA | OpenD 依地区、身份、行情卡与品种而异；App 权益不能直接替代 API 权益 |
| 地域限制 | A 股实时权限受地区/IP 规则限制 | 上游网络与访问规则各异 | OpenD A 股权限受用户验证类型及登录 IP 影响 |

来源：[长桥 FAQ](https://open.longbridge.com/zh-CN/docs/qa/general)、[长桥定价](https://open.longbridge.com/zh-CN/pricing)、[长桥行情概览](https://open.longbridge.com/zh-CN/docs/quote/overview)、[富途权限与额度](https://openapi.futunn.com/futu-api-doc/en/intro/authority.html)、[AKShare 项目概览](https://akshare.akfamily.xyz/introduction.html)。

**明确保留的冲突与未知：**长桥定价页/历史 K 线页称默认港股 LV1，行情概览仍描述免费 BMP、无推送、LV1 需购买；不能承诺免费实时港股。长桥 FAQ 的无需真实开户与平台介绍的开户流程也不一致。富途云端不能因为存在 REST/MCP 就被推定与 OpenD 共享免费权限、历史深度或限额。报价应以用户所属实体、地区、账户实际权益页面为准，不引用无法普遍适用的单一月费。

AKShare 官方明确将接口和数据定位于学术研究。软件许可证、获取能力、行情使用/存储/分发权益须分别判断；未来面向他人的量化插件应先确认数据授权，不能把 MIT 软件许可当作行情转授权。

## 市场与周期覆盖

ETF 是资产类别，不是独立市场。分别验收 US/HK/CN × stock/ETF；不能用一只美股或沪深 ETF 的结果证明其他市场 ETF 可用。

| 市场/品类 | 长桥 | AKShare 本次核验的接口 | 富途 |
| --- | --- | --- | --- |
| 美股股票、ETF | 文档覆盖；1D/60m/15m 待账户抽样 | 股票日线可用接口；`stock_us_hist_min_em` 是近期分时，不提供原生 15m/60m 参数。美股 ETF 需逐标的验证 | 支持相应 K 线周期；实际市场/品类权限待账户验证 |
| 港股股票、ETF | 文档覆盖；1D/60m/15m 待账户抽样 | 港股日线与 15m/60m 接口；ETF 必须验证代码覆盖 | 同上；免费实时权限单独核验 |
| 沪深股票、ETF | 文档覆盖；不推定北交所、退市及全量全集均覆盖 | 股票及场内 ETF 各有日线与 15m/60m 接口 | 文档提供相应能力，但 A 股地区/身份权限是前置条件 |

AKShare 主要候选：`stock_zh_a_hist`、`stock_zh_a_hist_min_em`、`stock_hk_hist`、`stock_hk_hist_min_em`、`stock_us_hist`、`stock_us_hist_min_em`、`fund_etf_hist_em`、`fund_etf_hist_min_em`。名称中的 `em` 指东财；这不是新独立上游。美股近期分时即使可聚合，也不等于获得多年 1H/15m 历史。

来源：[长桥历史 K 线](https://open.longbridge.com/docs/quote/pull/history-candlestick)、[长桥 MCP 周期定义](https://open.longbridge.com/zh-HK/docs/mcp)、[AKShare 股票文档](https://akshare.akfamily.xyz/data/stock/stock.html)、[AKShare 基金文档](https://akshare.akfamily.xyz/data/fund/fund_public.html)、[富途 OpenD 历史 K 线](https://openapi.futunn.com/futu-api-doc/quote/request-history-kline.html)、[富途云 K 线](https://open.futunn.com/zh-cn/api/quote/realtime/cur-kline)。

## 历史配额、吞吐与全市场建库

| 接入通道 | 已核实的公开限制 | 对本项目的影响 |
| --- | --- | --- |
| 长桥历史 K 线 | 每自然月去重标的 100–3,000，按账户等级；单次最多 1,000 bars；60 次/30 秒；分钟历史长度与资产有关 | 适合有限持仓/研究池；不能保证每月覆盖全市场历史补数。分页与提速无法突破标的额度 |
| 富途 OpenD 历史 K 线 | 当前文档为 7 天滚动去重额度，注册档 100；首页 60 次/30 秒，续页另有规则 | 较适合分批有限标的；仍需把历史标的额度与实时订阅额度分开建模 |
| 富途云 REST 历史 K 线 | `num` 上限 370，以 `next_time` 翻页；云端频率、历史深度和标的额度未获完整公开保证 | 单独适配和测量；不得挪用 OpenD 的 1,000 条、7 天额度或历史年限 |
| AKShare | 上游各自限制，没有统一公开并发承诺；分钟接口多为近期数据 | 从保守并发开始；没有公布限额不等于无限。失败可能需上游修复而非重试 |

来源：[长桥历史 K 线与账户分层](https://open.longbridge.com/docs/quote/pull/history-candlestick)、[富途额度](https://openapi.futunn.com/futu-api-doc/en/intro/authority.html)、[富途 OpenD 分页与限流](https://openapi.futunn.com/futu-api-doc/quote/request-history-kline.html)、[富途云历史 K 线](https://open.futunn.com/api/quote/basic-data/history-kline)。详尽账户档位和资料冲突见各平台研究附件。

额度必须区分：请求速率、并发连接、订阅标的/类型、历史去重标的、单页 bars、历史深度、实时延迟。不能将多个指标合成一个“并发度”。当前没有同网同机实测，因此不对三家响应速度和数据正确率给出伪精确排名。

## 口径与现有架构的衔接建议

以下是设计建议，不是本次已实现功能，也不替代 ADR 0004–0006 的现有批准状态。

1. **Skill 放在交互层。**量化插件和后台任务调用稳定的 market-data-service；服务经 provider adapter 访问 SDK/API。不要让后台采集依赖自然语言、Agent 对话或 Skill 安装状态。
2. **来源与通道分开。**示例：`provider=eastmoney, access=akshare`；`provider=futu, access=rest|opend`。同一上游的不同封装不算独立容灾；富途两种通道也不能算两家供应商。每市场最多三源约束应覆盖该市场所有周期/资产类型的启用源并集。
3. **权限先于路由。**维护 market/asset/interval/adjustment/session/history 的能力和账户权益；区分 `unauthorized`、`unsupported`、`quota_exhausted`、`rate_limited`、`transient_error`、`partial_data`。无权限、无历史覆盖不能靠无限重试恢复。
4. **统一原始价格基线。**显式请求不复权；富途 OpenD 默认 QFQ，REST 默认也为前复权，不能省略。长桥只核实 raw/前复权，未见 HFQ 枚举；AKShare 按具体接口设定。保留实际返回的复权方式、因子版本及来源；前复权序列会随后续事件变化，不能冒充点时历史。
5. **时间与交易时段显式化。**保留原始时间、IANA 时区、bar 标签语义和交易日。富途 OpenD 返回市场本地字符串，REST 为毫秒 epoch；长桥与 AKShare 按字段定义解析。长桥 SDK history 默认 Intraday、MCP 默认 all，必须显式限定相同时段。统一开/收盘锚点必须经样本校验，不统一减 60 分钟，不固定美东 UTC 偏移。午休、夏令时、半日市及尾部短 bar 单独验收。
6. **行情质量可诊断。**验证 OHLC 合法性、重复/缺口、成交量单位、复权事件、返回条数和历史截断；保存原始 payload 摘要、请求参数、抓取时间、供应商版本与规范化版本。`empty` 不直接等于停牌，HTTP 成功不等于数据完整。
7. **集中管理预算和连接。**多 worktree/进程不能各自耗尽同一账户额度；历史回补、日常更新、用户交互分别排队，配额耗尽先暂停低优先级任务。同源失败共享熔断，账户权限失败与上游网络失败分开记录。

## 建议的下一步验收

先验证一个券商来源，不同时将三家加入生产路由。默认先长桥；如果已有富途账户与合适权益，则先富途，减少新增账号与运维成本。AKShare 可先开展无凭证的公共数据样本验证，但仍按实际上游计数。

只读样本矩阵：AAPL/SPY、0700/2800、600519/510300，各测试 1D/1H/15m。不以这些样本推断全市场全集。补充拆股/分红、停牌、午休、DST 切换、半日市和退市样本；历史请求跨分页边界，记录 requested/returned 时间范围与最早 bar。

记录权限与延迟级别、最早可得日期、p50/p95 延迟、错误率、吞吐、去重标的额度变化、OHLC 差异、成交量单位、缺口率和源时间标签。并发只在账户许可范围内逐级测量；费用、证券开户或权限购买不属于本次研究动作。原始样本存隔离研究目录/测试数据库，不写共享业务数据库。

转为生产候选的门槛：确认实际账户权益与用途、目标 universe 覆盖、回补预算、日常更新预算、口径一致性和故障恢复；之后再决策替换哪家既有 provider，以保持每市场最多三源、全局来源尽量少。

## 研究附件

- [长桥：官方 Skill、权限、费用与历史配额](research-longbridge-skill-20260922.md)
- [AKShare：官方与社区边界、接口覆盖及上游依赖](research-akshare-skill-20260922.md)
- [富途：Skill、OpenD 与云端接入及权益](research-futu-skill-20260922.md)
