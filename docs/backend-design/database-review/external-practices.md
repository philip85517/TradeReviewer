# 数据库模型：外部实践与本项目适配审查

> 协调者补注：本报告已完成文档范围核验，见[最终验收](../../../.scratch/database-model-review-2026-10-26/FINAL-ACCEPTANCE.md)。下文保留作者提交时的证据边界与未验证项，不因报告接受升级为产品验收通过。

当前证据支持继续使用 SQLite，并先收紧事实、账户、证据和读取边界的业务约定；没有证据支持为了架构风格更换数据库或引入 ORM。最值得借鉴的是：账户余额可以独立于成交存在，证券事件与现金事件应有清楚的归属，金额计算应保留币种、原始精度和舍入责任。不能直接照搬别的项目的 `Float`、级联删除或完整现金账本。

本项目已经有正确的基础：逐连接开启外键，写入使用事务，金额以文本保留并用 Decimal 处理，原始成交来源及结算明细保存在 JSON，首页集合读取采用同一事务。优先审查这些约定是否覆盖所有入口，而不是先增表。`account` 或券商订单号没有独立表/列，不等于这些事实没有保存；导入记录的 JSON 也已经保存月结等证据。独立证据模型仍是候选设计，需要用“没有成交也有余额/月结”的场景论证。

## 范围与证据边界

- 查询日期：**2026-10-26**。SQLite 官方页面没有固定版本提交，以下记录的是该日查阅内容；项目原生环境固定为 SQLite **3.53.0**。
- 本地基线：工作区 HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，但工作区存在未提交修改，以下判断以本次读取的工作区源码为准，不能仅凭 HEAD 复现。
- 本文只做源码和公开资料审查；没有打开业务数据库、启动服务、写入数据或执行浏览器验收。实际孤儿记录、既有金额错误、去重误合并以及性能原因均 **未验证**。
- 财务 P1/F07、Bars 的暂停范围保持不变。本文没有授权修复、迁移、补齐完整现金账本或恢复这些工作。UI/视觉/数据库写入验收对本次纯文档研究 **不适用**。
- 查阅了 [现状稿](../current-state.md)、[目标候选稿](../target-design.candidate.md) 和下面列出的实际实现。公开查询仅发送公开仓库路径和公共文档 URL，没有上传项目源码或交易数据。

## 固定的公开来源

这里选择的是可以检查具体模型的相关项目；其成熟度或流行程度不构成本项目适配性的证明，也没有声称已运行这些项目。

| 来源 | 固定版本与实际查阅源码 | 证据类型及用途 |
| --- | --- | --- |
| Ghostfolio | [3.92.0 发布记录](https://github.com/ghostfolio/ghostfolio/releases/tag/3.92.0)，提交 `7429176b44d6bde31baf3b02acecef1a9cbaaf06`；[Prisma 模型](https://github.com/ghostfolio/ghostfolio/blob/7429176b44d6bde31baf3b02acecef1a9cbaaf06/prisma/schema.prisma) | 项目实现：观察账户、余额、订单与证券身份的关系；不是金融通用规范。 |
| Portfolio Performance | [0.89.0 发布记录](https://github.com/portfolio-performance/portfolio/releases/tag/0.89.0)，提交 `20d7fb690ad532c5f4a8813f6c4f365745e37c7d`；[AccountTransaction](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/AccountTransaction.java)、[BuySellEntry](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/BuySellEntry.java)、[Transaction](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/Transaction.java)、[Values](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/money/Values.java) | 项目实现：观察账户事件、证券成交配对、金额组成与精度；Java 对象关系不能作为数据库原子性的证明。 |
| SQLite 官方 | [外键](https://www.sqlite.org/foreignkeys.html)、[类型](https://www.sqlite.org/datatype3.html)、[浮点数](https://www.sqlite.org/floatingpoint.html)、[JSON](https://www.sqlite.org/json1.html#the_json_valid_function)、[事务](https://www.sqlite.org/lang_transaction.html)、[WAL](https://www.sqlite.org/wal.html)、[在线备份](https://www.sqlite.org/backup.html) | 官方引擎规则：约束连接、类型、事务与备份行为，不能替代业务约定。 |
| Martin Fowler | [Money，2003-03-05](https://martinfowler.com/eaaCatalog/money.html) | 作者设计文章：解释金额与币种、舍入应共同建模的原因；不是 SQLite 存储格式规范。 |

固定提交的源码通过 GitHub 只读文件接口核对；公开网页和发布记录同时通过网页检索查阅。未使用随主分支变化的源码链接作模型证据。

## 针对性对照

下列“最小验证”是进入后续设计或修复时应执行的验收，不是本次已通过的测试。所有写入验证都应显式使用隔离数据库。

### 1. 外键：现有连接初始化应保留，完整性检查要覆盖历史数据

**官方规则。** SQLite 外键必须在各连接上启用，不能依赖默认值；事务内部切换不会生效。子表外键列索引通常有助于父记录更新/删除检查，但不是启用约束的前提。[SQLite 外键说明](https://www.sqlite.org/foreignkeys.html)

**本地已确认。** [sqlite.ts](../../../db/sqlite.ts) 的 `initializeSqlite` 开启 `foreign_keys`；[sqlite-schema.ts](../../../db/sqlite-schema.ts) 对成交到证券使用 `RESTRICT`，导入批次删除对成交使用 `SET NULL`。成交有 `(instrument_id, executed_at)` 索引。此选择能保护被成交引用的证券，并允许批次生命周期与成交事实分离。首页 [homepage-source-snapshot.ts](../../../app/lib/storage/homepage-source-snapshot.ts) 还会显式检查孤儿成交。

**适用与边界。** 保留上述机制，不因其他项目使用级联删除而改为级联。外键只能保护已经声明的关系；`account` 文本和 JSON 中的归属仍需业务检查。历史数据可能来自旧连接或旧程序，开启外键不证明历史库没有孤儿。[sqlite-store.ts](../../../app/lib/storage/sqlite-store.ts) 的 `getExecutions` 使用内连接，因此通用读取若无单独完整性检查，孤儿行可能不出现在结果中；这只是静态风险，不是已经发现丢成交。

**最小验证。** 新连接检查 `PRAGMA foreign_keys`；在隔离库验证拒绝无证券成交、拒绝删除被引用证券、删除批次后仍能读取成交及其来源；对既有库做只读 `foreign_key_check` 并区分“检查成功”与“结果无错误”。

### 2. 类型与金额：TEXT 可以保留精度，但必须有统一入口约定

**官方规则。** SQLite 普通表使用动态类型，列声明的亲和性不等于严格业务类型；`STRICT` 也不能自动定义金额精度或日期语义。二进制浮点数只能近似表示多数十进制小数。[类型规则](https://www.sqlite.org/datatype3.html)、[浮点数精度说明](https://www.sqlite.org/floatingpoint.html)

**本地已确认。** 成交数量、价格、费用使用 `TEXT`，代码引入 Decimal，因此不能将“金额是文本”直接判为存储错误。当前 `validateExecution` 对主要数量、价格、费用及执行时间以字符串检查为主，而 `reviseTrades` 对修订值另做 Decimal 有限值、正负范围和 `Temporal.Instant` 检查；两条入口的强度不一致。结算明细另有数值格式和范围检查。入口差异由源码支持，但上游可能还有校验，不能据此宣称数据库已有非法金额。[sqlite-store.ts：validateExecution / reviseTrades](../../../app/lib/storage/sqlite-store.ts)

**适用与边界。** 应先统一“合法十进制文本、数量/价格/费用边界、时间格式、显示舍入”的业务约定，再决定放在哪些应用或数据库约束层。不要先把文本转为 `REAL`，也不要仅为使用 `STRICT` 而迁移。表约束、应用校验、导入错误反馈承担不同职责。

**最小验证。** 通过所有正式写入入口尝试空串、非数字、非有限值、非法时间、负数量/费用，并验证一致拒绝；高精度数量和价格读写往返不变；重算时避免隐式转成 JavaScript Number 或 SQL 浮点聚合。当前源码差异需要入口追踪与上述验证才能定性为可触发缺陷。

### 3. JSON：保留来源有价值，语法合法不能代替业务结构

**官方规则。** `json_valid` 检查 JSON 语法；合法值可以是对象、数组或标量，它不验证账户、币种、字段结构与跨记录引用。[SQLite JSON 说明](https://www.sqlite.org/json1.html#the_json_valid_function)

**本地已确认。** 表对多处 JSON 使用 `json_valid`，但成交来源、账户标签、券商订单及成交分组、原始结算明细等由 JSON 保存；导入历史的 `reconciliation_json` 保存完整导入记录，读取时还投影月结证据并记录投影缺口。因此“没有订单号列/独立月结表”不能推出“订单号/月结证据已经丢失”。相反，应用对这些结构的约定、版本变化和缺口反馈需要明确。[sqlite-store.ts：mapExecutionRow / getImportHistory / putImportHistory](../../../app/lib/storage/sqlite-store.ts)、[TradeExecution.source](../../../app/lib/trades/types.ts)

**适用与边界。** 常查、需唯一性或需要跨实体完整性约束的事实可以论证提取为列或独立对象；低频来源细节适合继续保留 JSON。是否拆表应由查询、归属和生命周期决定，不能按“JSON 不正规”作决定。独立证据候选模型尤其要证明无成交证据能够保存、定位与重读，且不强行挂到一笔成交上。

**最小验证。** 对结构合法但字段缺失/类型错误的 JSON 明确拒绝或保留错误状态；用“月结有余额但零成交”、多币种月结、修订后重读三个场景验证来源与归属；证明原始文件定位、业务证据和页面投影没有被误当成同一个 ID。

### 4. 事务：写入原子性与读取一致性是两条独立约定

**官方规则。** SQLite 可以并行读，但同一时刻只有一个写事务；读取事务看到稳定快照。`BEGIN IMMEDIATE` 提前取得写事务，可能返回忙；`BEGIN` 事务不能直接嵌套，嵌套需求使用保存点。[SQLite 事务规则](https://www.sqlite.org/lang_transaction.html)

**本地已确认。** `withSqliteTransaction` 使用 `BEGIN IMMEDIATE` 并在失败时回滚，`mergeTradeData` 将证券、成交替换/删除及导入历史放在同一事务。首页 `readHomepageStoredCollection` 用 `BEGIN DEFERRED` 将各集合、计数、孤儿检查及证据投影放在同一读取事务；通用 `getBootstrap` 本身没有包围所有查询的事务。[sqlite.ts](../../../db/sqlite.ts)、[sqlite-store.ts](../../../app/lib/storage/sqlite-store.ts)、[homepage-source-snapshot.ts](../../../app/lib/storage/homepage-source-snapshot.ts)

**适用与边界。** 首页的读取边界值得保留，但不能推导所有调用者都得到同样快照。随机读取凭证、读取时刻和内容摘要各自有用，都不能独自证明数据库的终身历史完整，也不应冒充持久数据库版本号。不要为补齐这些语义直接引入事件溯源或 CQRS。

**最小验证。** 隔离库两连接交错读写，确认同一次集合读取的计数、内容和摘要来自同一状态；导入在中途失败时成交和历史同时回滚；查明事务工具是否可能重入。并发测试成功也不证明证据本身完整，后者需单独场景验收。

### 5. WAL：保留现有在线备份规则，不把并发能力误当成多写者

**官方规则。** WAL 允许读写共存但仍只有一个写者；长读取可能阻碍检查点推进。WAL 使用共享内存及伴随文件，不适合作为跨机器网络文件系统上的通用方案。在线备份接口用于得到一致副本，直接复制正在写入的主文件不能据此保证完整。[WAL 官方说明](https://www.sqlite.org/wal.html)、[在线备份说明](https://www.sqlite.org/backup.html)

**本地已确认。** 初始化启用 WAL 与 5000ms 忙等待；项目要求开发服务使用 WAL 感知在线备份及显式测试库路径。此规则与 SQLite 的机制相符。[sqlite.ts](../../../db/sqlite.ts)、[运行配置说明](../../../conf/README.md)

**适用与边界。** 先保留单机 SQLite 与既有备份方式。没有锁等待、事务时长和查询证据，不能把超时归咎于 WAL、缺 ORM 或数据库规模，也不能靠自动换端口/回退到业务库掩盖失败。

**最小验证。** 在隔离源库持续写入时执行既有在线备份，检查副本完整性及业务记录一致性；制造写锁验证明确失败/重试语义和错误反馈。这里没有执行此验证，也没有评估线上锁争用。

### 6. Ghostfolio：借鉴账户与余额身份，保留本项目自己的业务范围

**项目实现。** Ghostfolio 的 `Account` 与 `AccountBalance` 独立建模，余额按账户、用户、日期唯一；`Order` 另引用账户。`SymbolProfile` 有内部 ID，同时按数据源和代码做唯一约束。其订单与余额金额使用 `Float`。[固定提交模型](https://github.com/ghostfolio/ghostfolio/blob/7429176b44d6bde31baf3b02acecef1a9cbaaf06/prisma/schema.prisma)

**可以借鉴。** 余额不必伪装成证券成交；账户身份与展示名分开，证券身份与行情提供方代码分开。本地已有 `instruments.id` 和 `provider_symbols` 的分工，应保留。账户目前主要为 `executions.account` 文本及来源标签，现金基线则按交易性质、账户、币种和模拟运行构成业务键，存在值得统一说明的归属约定。[sqlite-schema.ts](../../../db/sqlite-schema.ts)、[cash-model.ts](../../../app/lib/cash/cash-model.ts)

**不应照搬。** 不能由其 PostgreSQL/Prisma 选择推导本项目需要迁移，不能照搬浮点金额或删除级联。它的用户边界也不能取代本项目真实/模拟与模拟运行边界。

**风险与最小验证。** 用同名不同账户、同账户不同币种、真实与多个模拟运行、无成交现金基线往返四组案例验证隔离；同代码不同市场和同证券多提供方别名不得错误合并。是否新增账户表需先确认稳定身份来源、重命名和合并规则，而非先画表。

### 7. Portfolio Performance：区分账户事件、证券事件及它们的连接

**项目实现。** `AccountTransaction` 包含入金、出金、利息、股息、费用、税及买卖等类型；证券引用可以为空。`BuySellEntry` 将账户交易与证券交易配对，相关金额、币种和日期设置同时更新两侧。这证明其领域对象显式处理两种事件及连接，并不能证明数据库事务或所有账务恒等式。[AccountTransaction](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/AccountTransaction.java)、[BuySellEntry](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/BuySellEntry.java)

**可以借鉴。** 月结余额、开户持仓和账户现金事实不应靠制造买卖成交保存。本地已有现金基线与来源结算明细；目标候选稿的独立证据对象应先明确“属于账户、证券还是一次导入”，再讨论如何供页面引用。若以后确需证券/现金双侧事件，应有一个写命令负责关联与一致修订，并避免收益和现金流重复计数。

**不应照搬。** Portfolio Performance 的完整投资组合核算范围不能成为当前功能的前置条件；不能据此恢复暂停的财务工作，或马上引入复式记账。当前现金基线不是完整现金流水账，必须保留这一含义。

**风险与最小验证。** 零成交但有利息/余额证据仍可保存、回到页面并重读；一条来源不要同时作为余额和现金流重复使用。将来若批准双侧事件，再验证原子修订、删除与重复导入，不能仅测试对象回调。

### 8. 金额组成与舍入：保留原始结算，明确谁承担余数

**外部证据。** Portfolio Performance 的 `Transaction.Unit` 区分总额、税和费用，并携带金额、外币金额及汇率；其拆分代码明确处理独立舍入不能自然保证总和一致的问题。`Values` 对金额与报价设置不同精度。这是该项目的具体取舍，不能直接作为本项目的固定小数位规则。[Transaction](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/model/Transaction.java)、[Values](https://github.com/portfolio-performance/portfolio/blob/20d7fb690ad532c5f4a8813f6c4f365745e37c7d/name.abuchen.portfolio/src/name/abuchen/portfolio/money/Values.java)。Fowler 的 Money 文章同样把币种混用和舍入作为金额建模要解决的问题。[作者原文](https://martinfowler.com/eaaCatalog/money.html)

**本地对应。** `TradeExecution.source.settlement` 已能保留数量、毛额、净额、费用与币种，分组成交保存各笔数量/价格/毛额。应优先保留这些原始值，并明确计算值与原始结算值的差异；不能从页面显示的已舍入单价倒推并覆盖原始金额。[成交类型](../../../app/lib/trades/types.ts)、[保存路径](../../../app/lib/storage/sqlite-store.ts)

**风险与最小验证。** 用高精度证券价格、外币结算和多笔费用分摊样本验证原始文本往返；分摊总和与来源总额相等，余数去向可解释。币种、费用口径或汇率缺失应保留未知状态，不能凭别的项目使用两位金额精度而补零或制造准确性。

## 供整合审查的判断

| 判断 | 证据级别 | 对设计稿的处理 |
| --- | --- | --- |
| 普通 JSON 约束只保证语法；主要成交入口与修订入口的金额/时间校验强度不同。 | **源码确认**；可触发性与既有坏数据未验证。 | 在候选稿补清统一事实约定及写入口责任，再用正式入口反例验证。 |
| 无成交账户事实应能独立存在；账户身份、真实/模拟范围与币种必须明确。 | **外部实现支持的设计建议**；不是已批准的表结构。 | 用零成交、多账户/多币种和模拟运行案例决定证据/账户边界，不直接增表或启用完整账本。 |
| TEXT+Decimal、来源 JSON、外键、导入事务及首页读取事务值得保留。 | **本地实现确认**；覆盖所有入口仍需验证。 | 先补覆盖和约定，不以换引擎、字段外提或分层名称代替正确性证明。 |
| 缺独立字段/表不能直接等于证据丢失；读凭证不能直接等于历史完整。 | **源码与引擎规则支持**。 | 现状稿区分“已保存”“可查询”“归属明确”“可证明完整”四种状态，保留投影缺口。 |
| 实际孤儿、既有金额错误、去重误合并、页面持久化及性能根因。 | **未验证**。 | 本研究不作缺陷定案，也不将其他项目模型当作运行证据。 |

本报告可作为候选设计的约束清单，不能替代独立功能验收。后续只有在具体修复或模型变化获授权后，才执行对应隔离库与实际页面旅程验证。

## 本地源码指纹

记录用于区分工作区版本；若后续实现改变，应重读相关判断，不能沿用旧结论。

| 文件 | 本次读取 SHA-256 |
| --- | --- |
| `db/sqlite-schema.ts` | `55c3f10bfbb097155acf4963fae9d3e1eeb92f062cae415ff3ea5d2989b4e7e5` |
| `db/sqlite.ts` | `20b1b5fcf117e400914bf4fa3b56e5df3f45919b17489cc94228530f04d9d7dc` |
| `app/lib/storage/sqlite-store.ts` | `95249464037d0a44a04c35175fa069ba6ac27c614ef561c558fc50f80712d948` |
| `app/lib/storage/homepage-source-snapshot.ts` | `96bd3fa1e782e46ef7a8792248a0063e8fba331693b1ecc81780eaf98658e183` |
| `app/lib/cash/cash-model.ts` | `3e77466d3eef4552058ccc3e89b4ed612b7b97672a133e7e3c0b279f4590c9c1` |
