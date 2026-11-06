# 仪表盘预计算、增量更新与缓存：一手资料研究

研究日期：2026-10-29。范围：公开官方文档中的成熟机制及其在单机 SQLite、交易财务计算场景中的适用边界。使用 research 技能；SQLite 专项由独立子代理核查官方文档。本次仅写本研究记录，未访问数据库、启动服务、测量性能或修改产品代码。

**结论：值得验证的组合是可重建的持久化读模型、按依赖更新、页面按需读取，以及明确的版本与发布状态。它不要求拆成多个服务、数据库或引入消息平台。普通热缓存、后台刷新和分页都不能单独证明本项目完整首屏低于 1 秒。** 下文将“官方文档事实”与“本项目推论／候选”分开；没有来源给本项目作性能保证。

## 1. 预计算读模型是成熟做法；粒度和更新方式仍需选择

| 编号 | 一手来源及其直接支持的论断 | 在本项目中的边界／推论 |
| --- | --- | --- |
| R1 | [Microsoft：Materialized View pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view)，Solution、Problems and considerations：按查询需要预生成并持久保存派生投影；查询方只读；结果可从来源重建。必须决定全量或增量刷新、是否阻塞读取，以及刷新期间返回旧版本还是当前结果。 | 可将交易来源与首页需要的摘要、持仓、曲线分开组织；“物化视图模式”比数据库内置同名对象更宽，不能据此声称 SQLite 自带自动维护物化视图。派生结果不能替代原始成交。 |
| R2 | [Microsoft：CQRS，共用一个数据存储](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs#separate-models-in-a-single-data-store)：读写模型可以共用同一个数据库，只分离模型与处理逻辑；文档也指出与事件溯源结合会增加复杂性。 | 单进程、同一 SQLite 中增加专用投影表就是可研究的起点；无需因“读模型”这个词引入微服务、Kafka、Redis或完整事件溯源。是否采用这些设施不由本文决定。 |
| R3 | [PostgreSQL 18：Materialized Views](https://www.postgresql.org/docs/18/rules-materializedviews.html)：存储查询结果可加快读取，但结果不一定最新；示例为历史销售汇总周期刷新。[REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html)说明刷新替换内容，`CONCURRENTLY`避免阻塞读，但要求特定唯一索引，同一视图仍只能进行一次刷新。 | 产品级实现也必须明确刷新及读阻塞规则；“有物化视图”不等于自动增量或实时一致。这些是 PostgreSQL 的产品能力，不能直接搬成 SQLite SQL。 |
| R4 | [Metabase：Model persistence](https://www.metabase.com/docs/latest/data-modeling/models/model-persistence#difference-between-persisted-models-and-caching)：将模型结果存为数据库表与缓存最终查询结果是不同层次。当前页面明确优先使用 Transforms，Model persistence 未来将弃用；支持列表为 PostgreSQL、MySQL、Redshift。 | 该来源只能说明成熟仪表盘产品区分“持久模型”和“查询缓存”；不能作为推荐在 SQLite 直接启用此产品功能的依据。 |

**项目推论：**优先辨认可复用的计算事实，再提供页面所需的整体摘要、图表点和列表页。不要把每个筛选组合完整复制一份，也不要让页面为了 8 行列表下载全部原始来源。“首页各组件共享事实”合理；共享数据的边界、字段和传输体积需要单独设计。曲线采样、舍入、缺失值与信息层级仍遵循已批准合同，不能借性能优化默改语义。

## 2. 增量更新的核心是正确识别受影响结果

| 编号 | 一手来源及其直接支持的论断 | 在本项目中的边界／推论 |
| --- | --- | --- |
| R5 | [dbt：Configure incremental models](https://docs.getdbt.com/docs/build/incremental-models#filtering-rows-on-an-incremental-run)：开发者必须定义每轮处理哪些新增或修订行；[unique key](https://docs.getdbt.com/docs/build/incremental-models#defining-a-unique-key)用于识别并更新既有行，缺失或不唯一可能导致重复或失败；[重建](https://docs.getdbt.com/docs/build/incremental-models#how-do-i-rebuild-an-incremental-model)说明计算逻辑变化后应重建历史结果。 | 工具不会自动证明业务依赖范围正确。仅按“业务日期晚于上次最大日期”读取，会漏掉更早日期的补录／修订；这是该筛选谓词的直接反例。只对新增行做 upsert，也不能自动修正依赖它的后续财务状态。本文不推荐为此引入 dbt。 |
| R6 | [SQL Server：Create indexed views](https://learn.microsoft.com/en-us/sql/relational-databases/views/create-indexed-views?view=sql-server-ver17)，Performance considerations：源表 INSERT／UPDATE／DELETE 同时维护相关索引视图，复杂或大量视图可能明显降低写入性能。 | 计算前移是在写入、准备成本与读取成本之间交换；不能只报告读取快了多少而忽略导入／修订的等待。此处借鉴取舍，不借用 SQL Server 的实现限制作为 SQLite 的事实。 |

**本项目候选，尚未实施或验证：**

- 对普通计数、独立行展示字段，可以研究局部更新；对成本、持仓、已实现盈亏和累计曲线，要先证明依赖和顺序规则。历史买入修订可能沿同账户同标的的后续交易传播，不能默认只改当天。
- 受影响范围至少分别考虑成交新增／删除／修订、标的映射、行情回补／修订、汇率回补／修订、计算规则或输出合同变化。实际依赖取决于本项目财务规则，不是官方资料已经替本项目确认的列表。
- 可以研究“把受影响账户／标的及最早日期标脏，合并同范围任务，从可信检查点重算后续”的方式；这是待实验的应用策略。全量重建应保留为恢复和对账路径。
- 增量结果应与相同来源版本、相同规则的全量重算逐项比较，覆盖删除、旧日期回补、重复任务、重启和规则变更；不能只验证新增一笔、只比较行数或只比较显示到小数两位的值。

## 3. 持久化与缓存失效解决不同问题

| 编号 | 一手来源及其直接支持的论断 | 在本项目中的边界／推论 |
| --- | --- | --- |
| R7 | [Microsoft：Cache-Aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside#problems-and-considerations)：缺失时仍要访问来源；过期太短导致频繁重读，太长会陈旧；该模式本身不保证缓存与来源一致，本地缓存还可能有各实例副本差异。 | TTL 是新鲜度策略，不是财务正确性的证明；单纯加内存缓存无法覆盖进程重启或失效后的首次读取。持久结果也必须检查依赖版本，不能“磁盘上存在就有效”。 |
| R8 | [Metabase：Refresh cache automatically](https://www.metabase.com/docs/latest/configuring-metabase/caching#refresh-cache-automatically)：普通策略在缓存过期后的首次查看才重新查询，首位访问者要等待；可选自动刷新在失效时提前重查，且有套餐、权限与参数组合范围限制。 | 热查询结果与重启、失效、首次筛选是不同场景。预热常用组合可作为额外优化，但不能假定全部账户、市场、期间、排序组合都已准备。 |
| R9 | [SQLite：PRAGMA data_version](https://www.sqlite.org/pragma.html#pragma_data_version)：只适合比较同一连接不同时点的值；同连接自身提交不会改变它；不同连接的数值没有可直接比较的意义。 | 不能拿它充当全局持久业务 revision。若有不经过统一写路径的外部修改，需要明确探测与重建策略。 |

**项目推论：**候选缓存键要绑定查询语义与来源／规则版本，包括筛选、期间、排序、分页、币种和适用的行情／汇率版本。采用显式 revision、依赖向量或其他机制仍须研究；单一“更新时间”未必表达这些独立来源。把派生结果设计为可删除重建，才方便遇到版本不兼容、损坏或失败时恢复。持久化减少重启后的重新计算需求，但磁盘持久化与应用／操作系统热缓存不是同一个概念。

## 4. 异步更新可改善交互，但必须管理提交、恢复与新鲜度

| 编号 | 一手来源及其直接支持的论断 | 在本项目中的边界／推论 |
| --- | --- | --- |
| R10 | [AWS：Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)，Intent、Implementation、Issues and considerations：数据写入与通知分别成功会造成双写不一致；同一事务记录业务变化及待发送事项是解决方式之一；消费者需处理重复及顺序。 | 单机可以借鉴“同库持久记录待处理工作”，由本地任务处理，不需要采用 AWS 服务或跨服务消息。重试应幂等；进程崩溃后待处理状态仍可发现。此迁移是本文推论，并非该文档给出的 SQLite 实现。 |
| R11 | [SQLite：Isolation](https://www.sqlite.org/isolation.html)：通常隔离配置下，其他连接只看见已提交的完整事务；WAL 读事务看开始时的快照；同一数据库同时只有一个写者。 | 投影和发布指针置于同库同一发布事务，可避免发布半份结果；跨接口仍需携带同一 generation，数据库不会替页面自动绑定版本。计算若在事务外进行，发布前需核对来源仍匹配，否则重算或拒绝发布。 |
| R12 | [SQLite：WAL](https://www.sqlite.org/wal.html)，Overview、Concurrency、Performance Considerations：多个 ATTACH 数据库只各自原子，不能视为整体原子；长读事务可妨碍 checkpoint，WAL 变大会影响读取；WAL 仍可能遇到 SQLITE_BUSY。 | 不宜为跨 HTTP 翻页长期保留数据库事务；可研究不可变 generation 与短事务。原始库与投影库分开后，不能声称跨库同时提交；必须显式校验和发布。后台计算不能无限占据写事务。 |
| R13 | [RFC 5861 §3](https://www.rfc-editor.org/rfc/rfc5861.html#section-3)：stale-while-revalidate 允许一定时间内先返回旧响应并在后台验证；它是允许陈旧的机制。该 RFC 是 Informational，非 Standards Track。 | 展示旧版并标注“更新中”是一种可讨论的体验；它没有把旧值变成最新值，也不能用来证明“最新完整首屏”达标。 |

**本项目候选状态合同：**分别记录 `sourceRevision`、`publishedRevision`、`generation`、规则版本、开始／完成时间、失败原因和依赖缺失情况。状态可为待更新、计算中、已发布、失败；具体命名仍待设计。导入提交成功和派生结果准备完成是两个事实。旧结果可否展示、如何提示需遵循用户认可的合同，不能在性能统计中将其当作最新结果。

既定目标还包含导入／修订后的首次打开，见本目录 [README](README.md) 和 [更新一致性问题](issues/05-update.md)。因此必须分别记录写入、准备与打开到最新完整首屏的等待。若预计算尚未完成，诚实显示“更新中”仍不等于该验收通过；不能通过后移计时起点隐藏准备成本。

## 5. 分页应缩小实际读取，而不是只截断浏览器展示

| 编号 | 一手来源及其直接支持的论断 | 在本项目中的边界／推论 |
| --- | --- | --- |
| R14 | [SQLite：Row Values §3.1 Scrolling Window Queries](https://www.sqlite.org/rowvalue.html#scrolling_window_queries)：`LIMIT x OFFSET y`计算前 x+y 行并丢弃前 y 行，成本随偏移增长；通过上一页末项的行值比较，可以更有效地继续读取。 | 大／深列表可以评估游标分页；游标应包含完整排序末项和唯一键，并绑定筛选、排序与 generation，避免相同排序值或更新期间的跳行／重复。小列表 OFFSET 仍可更简单；是否更快要测量。游标方案不能擅自取消既有按页跳转需求。 |
| R15 | [SQLite：Query Planning §1.6–1.7、§3](https://www.sqlite.org/queryplanner.html)：复合索引可支持多条件查找和排序；覆盖索引可免去回表；开发者需提供合适索引，规划器偶尔可能选择次优方案。 | 以真实筛选／排序检查查询计划与实际代价，不能以“建了索引”断言端到端达标。输出摘要覆盖整个筛选集合，不能把当前页 8 行的合计冒充整体。图表和总计与明细页可以不同形状，但须同一可解释的发布版本。 |

**项目推论：**后端内部将全部记录分批读取、最后重新拼成全部响应，不等于面向页面的分页。服务端真正只返回首屏所需字段、整体摘要和当前页，才能减少下载与解析；这仍不自动减少所有财务计算，后者要依靠正确预计算或有效查询。分页也不证明后续页、导出和总计的正确性。

## 6. 财务正确性和性能要独立验收

[SQLite：Floating Point Numbers §1](https://www.sqlite.org/floatingpoint.html#how_sqlite_stores_numbers)（R16）明确说明：范围内的 64 位整数精确，REAL 为近似 binary64，浮点计算会引入误差。**本项目推论：**增量与全量改变运算顺序可能产生差异；需明确金额、数量、价格、汇率的精度、舍入时点、累计方式与溢出边界。定标整数或十进制可以评估，但不能仅以“钱都存分”忽略价格、份额和汇率，也不能未经迁移设计改变已批准财务语义。

[SQLite：PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous)（R17）区分掉电耐久性：WAL＋FULL 提供 ACID；NORMAL 保持一致性，但掉电／系统崩溃后可能回滚近期已提交事务。**本项目推论：**可重建投影和原始成交可有不同恢复目标，但不得为缓存性能顺便降低原始事实的耐久性；应核实现用配置，本文未检查配置或数据库。

研究资料支持的是机制、权衡与应验证的边界。它们没有验证本项目的投影完整性、财务规则、依赖失效、真实导入或浏览器性能。下一轮证据应至少区分：

1. **正确性：**同版本全量与增量对账；摘要、曲线、持仓、分页／导出完整；回补、修订、删除、行情／汇率变化、重启和故障恢复。
2. **准备成本：**首次构建、日常增量、受影响后续重算及全量重建；导入提交到最新投影发布的总等待。
3. **真实页面：**冷／热、服务重启首读、导入／修订后首读，关联记录服务端、响应字节、下载、JSON／合同解析、页面计算、React 提交与实际完整展示。阶段和组件不可重复归因，独立实验数字不可拼接成一次导航。

本记录不声称已达到 1 秒、不调整现有验收口径、不授权产品实现，也不恢复已暂停的财务、Bars或重复导入任务。
