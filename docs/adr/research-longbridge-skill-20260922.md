# 长桥行情源与官方 AI Skill 核查

核查日期：2026-09-22。范围：TradeReview 的美股、港股、A 股股票/ETF，1D、1H、15m，以及后续量化研究。本文只核查公开官方资料；未安装、注册、登录、购买、调用受鉴权行情、读取业务数据库或执行交易。下述“支持”是文档能力，不是本账户实测结果。

## 结论与决策

**长桥确有官方 AI Skill，且有官方托管 MCP、CLI 和多语言 SDK；它值得进入跨市场统一行情源候选，但标准公开配额不足以承诺全市场历史研究建库。** Skill 解决 Agent 如何调用，不能增加行情许可、历史长度或标的额度。官方入口直接指向 `longbridge/skills`；仓库当前列出 13 组技能，包括市场数据、技术分析、量化研究。[官方 Skill](https://open.longbridge.com/skill)、[官方仓库](https://github.com/longbridge/skills)

| 使用目标 | 评估 | 决策理由 |
| --- | --- | --- |
| 美/港/沪深股票与 ETF 的有限股票池复盘 | 有条件推荐 | 一套 SDK 覆盖三市场；原生 1D/60m/15m；须先验证账户权限及 K 线口径 |
| Agent 临时查行情、辅助研究 | 推荐小范围试用 | 官方 Skill + CLI 或 MCP 可以直接支撑；只授行情权限 |
| TradeReview 后端可重复采集 | 推荐 SDK 适配器 | 工程判断：应固定参数、限流、分页、缓存、质量检查，避免把自然语言 Skill 当采集契约 |
| 全市场持续历史回填、量化数据仓库 | 标准账户不适合作唯一主源 | 历史标的月额度最高公开档仅 3,000，且分钟窗口受资产分层限制 |
| 后复权、退市股完整历史、点时成分股研究 | 尚不能承诺 | API 只列 raw/前复权；没有发现足以证明完整研究级证券主表与退市覆盖的公开承诺 |

上表是基于后述官方能力与限制的选型判断。对“每市场最多 3 源、全局供应商尽量少”的约束，建议把长桥计作 **一个跨三市场供应商**，先评估为复盘主源/统一补充源；只有在确认全量授权、额度、分钟深度与数据许可后，才升级为全市场研究主源。不要为了补配额在三个市场机械增加三套同类来源，也不要把 Skill/MCP/SDK 算成三个独立数据源。

## 四层产品不可混为一谈

| 层 | 实际作用 | 前置条件与运行方式 |
| --- | --- | --- |
| Skill | 给 Agent 的指令与工作流 | 安装 Markdown 技能本身不等于获取数据或权限 |
| CLI | Agent/人通过命令取结构化数据 | 本地安装 `longbridge-terminal`，浏览器 OAuth 登录 |
| MCP | 由长桥托管的远程工具服务 | 支持 OAuth 2.1 的客户端；无需本地行情网关；账户及 scope 决定可见工具 |
| SDK/OpenAPI | 应用程序确定性接入 | OAuth 或兼容的 App Key/Secret/Access Token；SDK 自行管理行情连接 |

安装指南把 CLI 与 MCP 列为平台接入的两种途径，再单独安装 Skill。CLI 的 TUI 是可选交互界面；已核查的快速开始流程没有要求像本地券商网关那样另启动常驻桌面进程。这里的“无需额外网关”不代表流式订阅不需要运行进程与连接。[官方安装指南](https://open.longbridge.com/skill/install)、[CLI 仓库](https://github.com/longbridge/longbridge-terminal)、[SDK 快速开始](https://open.longbridge.com/docs/getting-started)

官方公布的 Codex Skill 安装示例是以下两条，仅供未来审阅后执行；本次未执行：

```text
codex plugin marketplace add longbridge/skills
codex plugin add longbridge@longbridge-skills
```

CLI 路径先安装并运行 `longbridge auth login`；MCP 全球端点为 `https://mcp.longbridge.com`，大陆 AP 账户可用 `.cn`，美国账户必须用 `.com`。行情类技能只需 Quote 权限，账户类可能要求 Trade。仓库安装文档仍残留旧版技能名称/数量，故应固定版本并复核实际包，而非照搬旧清单。[Skill 安装](https://open.longbridge.com/skill/install)、[仓库安装说明](https://github.com/longbridge/skills/blob/main/docs/install.md)、[MCP](https://open.longbridge.com/docs/mcp)

## 注册、开户、KYC、资金与费用

必须区分平台账号、实盘证券账户、API 开通和行情卡四件事：

1. 当前官方 FAQ 明确允许**不开实盘证券账户，使用模拟账户开发和调试**；在开发者中心开通并取得凭证。模拟与实盘共用 App Key/Secret，行情权限关联这组凭证，交易账户使用不同 Access Token。不能把模拟账户理解为绕过行情购买。[General FAQ Q1–Q4](https://open.longbridge.com/docs/qa/general)
2. 另一官方总览/快速开始仍写“App 完成开户 + 开发者认证/OpenAPI 权限申请”。MCP 前提则是完成 onboarding 的有效账户**或模拟账户**，故不能断言所有路径都强制实盘开户，也不能承诺邮箱注册后匿名直连。身份/KYC、可开户地区与具体 onboarding 要求应以用户所属实体当时页面为准；本次未核实该用户账户。[平台总览](https://open.longbridge.com/docs)、[MCP 前提](https://open.longbridge.com/docs/mcp#prerequisites)
3. 公开资料没有给出“所有基本行情必须先入金”的统一要求；但资产会改变历史标的额度和分钟历史深度。因此“基础调用免费”与“满足大量回填需多少资金/商业权限”必须分开。不要为了增加行情额度建议用户下单或投入资金。[历史 K 线权限](https://open.longbridge.com/docs/quote/pull/history-candlestick#permission-description)

SDK/接口接入免费不等于所有数据免费。当前 pricing 列 US LV1 免费、HK LV1 与 CN LV1 为免费促销；A 股实时限定中国大陆 IP，其他地区延迟 15 分钟。OpenAPI 行情权限与 App/PC/Web 分离。页面默认展示 HK LV2 为 HK$558/月、OPRA 为 HK$22/月，但存在续费/周期选项，这不是该用户最终报价，也不是本任务 OHLCV 的必购套餐。[官方定价](https://open.longbridge.com/pricing)

**官方文档有矛盾，不能掩盖：** Quote Overview 仍写 HK BMP 延迟约 15 分钟且无推送、HK LV1 需购买；较新的接口权限块与 pricing 写免费赠送 HK LV1，官方 2023 年公告也包含 OpenAPI 免费升级。较合理解释是旧文案未同步，但这是推断；上线依据应是账户实际权限表和样本响应。[Quote Overview](https://open.longbridge.com/docs/quote/overview)、[权限配置源文件](https://github.com/longbridge/developers/blob/main/quote-permissions.yaml)、[官方公告](https://longbridge.com/sg/zh-CN/newsroom/press-release)

当前公开定价页未见足以统一说明“非专业/专业用户”、机构、地区实体收费差异的完整矩阵；**不能把免费/促销推广到所有身份和用途**。量化建库和对外展示还需核实数据保留、衍生数据和再分发权限。官方市场行情条款限制未经书面许可的复制、分发及商业利用；本报告不把技术可下载等同于已获相应用途授权。[官方市场行情服务条款](https://longbridge.com/hk/zh-CN/support/topics/misc/5ctiji)

## 覆盖、配额和历史深度

官方列美股、港股、A 股股票/ETF；沪深后缀为 `.SH`/`.SZ`，美股 `.US`、港股 `.HK`。这证明多市场覆盖，但并不证明北交所、OTC、所有退市证券、所有 ETF 都有完整历史。[行情 FAQ Q3](https://open.longbridge.com/docs/qa/broker#q3-what-is-the-available-subscribing-securities-and-corresponding-symbol-formats)

| 限制项 | 公开规则 |
| --- | --- |
| 一般行情 | 每账号 1 长连接、最多同时订阅 500 标的；10 次/秒，并发最多 5；SDK 会主动节流 |
| 历史 K 线 | 60 次/30 秒；每页最多 1,000 根；按日期/偏移查询，不是一次全量下载 |
| 历史标的月额度 | 100 / 400 / 600 / 1,000 / 2,000 / 3,000 |
| 对应资格 | 开户 / 资产 HK$1万 / 8万 / 40万或月成交订单>160 / 400万或>1,600 / 600万或>2,500 |
| 计数 | 自然月去重标的，同一标的重复请求只计一次；月初重置、不累计；提升通常下一交易日生效 |

[一般行情频率](https://open.longbridge.com/docs)、[历史 K 线配额、分页与限流](https://open.longbridge.com/docs/quote/pull/history-candlestick)

| 市场 | 日及更长周期源端起点 | 分钟源端起点 |
| --- | --- | --- |
| 港股 | 2004-06 | 2008-11 |
| 美股 | 2010-06 | 2003-09 |
| A 股 | 1999-11 | 2022-08 |

这些是**源端覆盖起点，不是任意账户可取的起点**。三市场共用说明：资产低于 HK$8万，分钟最多近 3 年；达到则最多近 8 年，按自然月计算，仍受实际上线/上市时间限制；更长历史联系官方。因此在 2026-09，低档账户约从 2023-09 可取分钟，高档理论窗口从 2018-09，但 A 股仍不早于 2022-08。这是按文档规则推算，未登录验证。[历史范围](https://open.longbridge.com/docs/quote/pull/history-candlestick#description-of-historical-candlesticks-range)

普通 `candlesticks` 只返回最近最多 1,000 根，更深历史须用 history 接口。定价页“unlimited/no hard usage caps”不能推翻接口页的频率、标的数和窗口约束。[普通 K 线](https://open.longbridge.com/docs/quote/pull/candlestick)、[定价](https://open.longbridge.com/pricing)

## K 线语义与研究风险

| 项目 | 已确认 / 尚待确认 |
| --- | --- |
| 周期 | 原生 `15`、`60`、`1000` 分别对应 15m、1H、1D |
| 复权 | `NoAdjust` 与 `ForwardAdjust`；未列后复权 HFQ。不能将前复权等同总收益或已获得点时复权因子 |
| 返回时间 | API 统一 Unix UTC timestamp；SDK 映射日期对象 |
| bar 标签 | 文档只称 Candlestick timestamp，未明确每种周期的开端/尾端规则；不能直接断言是 bar start。特别是日线标签、港/A 午休与美股小时残段，需要实测 |
| 常规/扩展时段 | SDK 默认 `Intraday`；MCP history 默认 `all`，不显式传参会产生口径差异 |
| 夜盘 | US LV1 文档称已包含，仍须 `enable_overnight`/`LONGBRIDGE_ENABLE_OVERNIGHT=true`；不是港股能力 |

[周期与复权枚举](https://open.longbridge.com/docs/quote/objects)、[时间格式](https://open.longbridge.com/docs/getting-started#time-format)、[Python SDK](https://longbridge.github.io/openapi/python/reference_all/)、[MCP history 参数](https://open.longbridge.com/docs/mcp)、[夜盘 FAQ](https://open.longbridge.com/docs/qa/broker)

工程建议：持久化 raw 与前复权时分开键，并记录 `provider + symbol + period + adjust + session + fetched_at`；UTC 用于存储，交易日与时间窗口用交易所时区及市场日历计算，美股使用 `America/New_York` 处理 DST，不能固定减 4/5 小时。跨源核对应显式选择 regular/all，并测试 DST 切换周、午休、半日市、拆股/分红、停牌、ETF。以上是接入设计建议；本次没有证明供应商所有样本都满足这些约定。

还需区分“无数据、无权限、超过月额、分页被截断”。MCP 的 offset 文档特别提示权限限制时可能返回少于请求数量，不能仅凭 HTTP 成功认为完整。策略挖掘还应要求退市/更名映射、点时证券池、公司行动版本和质量统计；公开 API 功能清单并不足以排除幸存者偏差。[MCP 工具参考](https://open.longbridge.com/docs/mcp)

## 运行与后续验收

当前 SDK 已由 `longport` 更名 `longbridge`；推荐 OAuth，支持浏览器授权、自动持久化与刷新；旧 App Key/Secret/Access Token 路径仍兼容。OAuth 与旧 API key token 不是同一类凭证，不应混用刷新逻辑。生产采集应由一个账号级服务协调连接、缓存和限流，而不是 UI、多 worker 与 Agent 各自争用连接。[快速开始](https://open.longbridge.com/docs/getting-started)

本任务只需要行情：后续 PoC 使用 Quote scope、QuoteContext 或行情工具白名单，排除下单、改单、撤单、定投与自选写操作。长桥 MCP 本身包含交易/自动化能力，安装它不能自动视为纯只读。[MCP 能力与授权](https://open.longbridge.com/docs/mcp)

若用户随后授权验证，建议先用模拟账户或已有行情账户，在独立临时目录验证少量股票/ETF：确认实际权限与剩余额度；每市场各取 1D/1H/15m；验证分页边界和 bars 标签；抽样核对历史最早日期、复权及扩展时段；记录实际版本与延迟；确认本地长期缓存、量化研究及可能的展示用途许可。未完成这些步骤前，结论应保持“文档可行、账户未验”，不应报告为已接入或已通过。
