# 全市场行情架构审查与深化候选

日期：2026-09-21。状态：审查建议，等待候选选择；不是已实施决策。

范围：现有 A 股、港股、美股股票/ETF 行情，未来证券池采集、完整性诊断与量化研究。依据当前代码基线 07f86b8 与既有探测 JSON；本轮没有重新调用外部行情，没有读写交易数据库。

## 必须重开 ADR-0004 的证据

ADR-0004 的减少来源、明确口径与固定优先级目标保留。以下执行规则需在实施前修订，不能照原文直接写入生产。

| 原假设 | 当前证据 | 应对 |
| --- | --- | --- |
| 四源是最小集合 | 东财与百度在响应层已覆盖样本组合；腾讯与 BaoStock 提供冗余。但响应成功不等于质量合格 | 定义覆盖、最低冗余和质量条件后再求最小集合，不宣称四源最优 |
| 每个请求最多三源即可 | 用户要求每市场最多三源 | 对该市场全部周期/资产类型的启用来源取并集，限制 ≤3 |
| 1H 全部减 60m | 港股上午尾段、美股下午尾段可能仅 30m；固定 session 还未表达半日市 | 根据版本化交易日历定位实际桶起止；必须先证实来源标签语义 |
| 东财美股可作主源 | AAPL 探测首尾时间为 02:30Z/08:00Z，落在美股常规交易时段外 | 隔离为时间语义待核验，不能推断统一时差修正 |
| 价格仅格式不同 | 600519 首根 high：腾讯/BaoStock 1322.8，东财 1323.0 | 逐根校验价格精度与取样范围，不按单一 close 判一致 |
| raw 就可以混合成交量 | 同样本 volume：腾讯 6554.64、东财 6555、BaoStock 655464 | 显式来源/市场/资产单位与精度；这一个样本的 100 倍关系不能推广到所有市场 |
| 收盘等于可知时间 | 同步代码以名义时长推定 knowledgeAt | 分开 barEnd、来源发布时间、抓取时间；无证据就不能承诺严格历史可知 |

这些结论使用的探测仅保存首根摘要与区间边缘，不包含完整上游 payload。下一阶段须保留脱敏响应并做全区间 contract 验证。

## 候选一：行情数据 module（Strong）

Files：providers/router.ts:145、contracts.ts:103/140、sync-service.ts、intraday-sync-service.ts:607、aggregate.ts:34（均在 app/lib/market 下）。

Problem：调用方需理解来源顺序、稀疏度、raw 标签与覆盖提交，interface 泄漏 implementation 知识；日期/session 知识分散，locality 不足。

Solution：深化行情数据 module，将来源策略、归一化、验收、coverage 和提交集中；保留已有多个真实 provider adapter 与存储 adapter 的内部 seam。具体 interface 在选定后设计。

Before：复盘调用方 → 日线/盘中同步 → router → provider adapter → 分散的 coverage 与存储。

After：复盘与研究调用方 → 行情数据 module → 内部 provider / 存储 adapter。

Deletion test：删除这个 module 会让同一套口径、完整性和归因规则重新分布到每个调用方。depth 来自这些不变量被隐藏，leverage 来自调用方和测试共用一个 seam。

Testing：复用当前 sync 与 repository 注入 seam，验收持久化结果及缺口诊断，而非内部 helper 调用次数。优先修正错误接受数据的问题。

## 候选二：持久采集与行情完整性诊断 module（Strong）

Files：trade-review-workspace.tsx:2626、refresh-queue.ts:56、market-data-fetch.ts:48、market-data-job-recovery.ts:5、market-data-repository.ts:52。

Problem：队列与配额在浏览器调用中持有；过期任务标记失败不等于持久租约和恢复。已有任务表不能证明存在可恢复后台执行器。

Solution：集中任务生命周期、来源配额、attempt、检查点和完整性核对。复盘与运维只申请和观察任务；先在当前部署中独立 worker 运行。

Before：浏览器队列 → 多处重试/超时 → 本地任务状态。

After：复盘/运维 → 持久采集 module → 行情数据 module；尝试证据 → 同一诊断读取路径。

Deletion test：删除该 module 后恢复、幂等和限流规则重新进入每个采集调用方。通过把租约与幂等提交留在一个 implementation 增加 locality，通过统一任务 seam 提供 leverage。

Testing：从申请到中断、重启、租约过期、重放、原子提交和诊断全程验收。保留已经成功的提交，不因取消回滚有效行情。

## 候选三：研究快照 module（Worth exploring）

Files：db/sqlite-schema.ts:76/88、app/lib/storage/market-data-repository.ts:31、app/lib/market/contracts.ts:26。

Problem：行情当前主键不含数据版本，读取不表达快照或历史证券池。插件若直接读可变表，会各自重建历史条件，难以复现。

Solution：固定证券池版本、行情修订、日历/口径版本和截止条件，供只读研究调用方使用。先实现复现能力，再按证据扩展严格历史可知能力。

Before：各插件 → 可变行情表＋当前证券列表＋各自的时间判断。

After：研究调用方 → 研究快照 module → 版本化行情及历史证券池。

Deletion test：删除这个 module 会迫使每个插件重复版本选择、质量过滤及前视约束。depth 与 leverage 来自统一研究语义，locality 来自版本修订规则集中；不为尚不存在的插件框架发明 adapter。

Testing：同一快照在新修订后保持读取一致；历史证券池保留退市证券；无可知时间证据时明确研究限制。验证结果必须注明筛除与缺失原因。

## 推荐与阶段

推荐先选候选一；候选二用于全市场运行和运维，候选三用于未来量化消费。第一期继续同仓库独立 module，避免在未测容量前强行迁移存储或引入分布式平台。对 SQLite 的使用通过批量写入、独立行情数据文件的迁移计划和容量基线评估；保留真实存储 adapter seam，达到资源阈值再决定替换。

实施规格已经发布到本地 Markdown 任务跟踪，标记 ready-for-agent，并明确以候选及测试 seam 确认为依赖。依赖未解除前不修改生产行为。
