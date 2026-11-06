# 数据库物理与逻辑模型独立审查

> 协调者补注：本报告已完成文档范围核验，见[最终验收](../../../.scratch/database-model-review-2026-10-26/FINAL-ACCEPTANCE.md)。下文保留作者提交时的证据边界与未验证项，不因报告接受升级为产品验收通过。

日期：2026-10-26。审查者：schema 独立审查 Agent；root 第 1 轮已核对主体证据与边界，本文按反馈修订，待最终核验。

**当前模型能承载成交、来源与复盘文档，但通用导入写入口尚未守住身份不变和修订前提。** 已确认四项可达问题：过期导入可以覆盖已审计修订；相同证券 ID 可以改成另一证券并改变旧成交的读取解释；普通成交的非法数字和时间字符串可以保存；普通秒级成交可能把不同实盘账户的两笔事实去成一笔。S01、S02、S04 这三项身份或覆盖问题为 P1，数值/时间入口问题 S03 为 P2。结论来自源码调用链及 root 的合成内存库反例；没有读取在线业务库，不能据此声称现有业务数据已经损坏。

本报告不提出完整会计账、逐字段规范化或迁移实施方案。金额使用十进制字符串、文档保留 JSON、冻结证据不外键绑定可变成交，都有合理业务依据。现有后端双稿中的新职责仍是候选设计；财务 P1/F07、Bars 等暂停事项保持暂停。

## 1. 范围、版本和证据边界

- 任务依据：[01-schema.md](../../../.scratch/database-model-review-2026-10-26/issues/01-schema.md)、根 AGENTS.md、`docs/agents/development-workflow.md`、`task-decomposition.md`、`issue-tracker.md`。采用 `review-design-logic` 的规则—实现—反例—竞争解释审查方式。
- 源码基线：HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，**工作区有未提交修改**；以下结论绑定本报告末尾 SHA-256，不把 HEAD 当成完整源码版本。
- 只读检查迁移、仓储、API、导入确认、修订、复盘保存和投影。未启动服务、未运行已有产品测试、未读写在线业务库。本文为纯文档审查，UI/视觉验收不适用；浏览器多窗口事故未现场复现。
- root 独立证据：[纯空库迁移脚本](../../../.scratch/database-model-review-2026-10-26/evidence/inspect-schema.mjs)、[物理结构](../../../.scratch/database-model-review-2026-10-26/evidence/schema.json)、[DDL](../../../.scratch/database-model-review-2026-10-26/evidence/schema.sql)、[真实 Store 合成反例](../../../.scratch/database-model-review-2026-10-26/evidence/store-probes.test.ts)、[反例执行结果](../../../.scratch/database-model-review-2026-10-26/evidence/store-probes.json)。固定 Node 26.0.0 / SQLite 3.53.0；14 个迁移在内存空库顺序执行。反例四项均通过，含义是**问题得到复现**，不是产品验收通过。
- 历史 Q02 等抽样记录、历史数量不作为当前在线数据。没有在线行数、完整性或损坏比例结论。

需求参照：[`current-state.md`](../current-state.md)区分已存事实、来源证据、金融解释与当前范围；[候选目标稿](../target-design.candidate.md)第二章 F02 条目（源码第 71 行）要求保存与修订不丢失、不重复、不静默覆盖原成交，M02 节（第 157–170 行）要求关联真实、原子提交、明确新增/重复/冲突结果。后者不等于已批准具体 schema。

## 2. 实体与物理边界

| 模型区域 | 当前身份与关系 | 读写和删除含义 | 判断 |
|---|---|---|---|
| 证券 | `instruments.id` 主键；普通写入口未要求 ID 与市场/代码一致 | 成交 FK `RESTRICT`，行情/覆盖/映射等 FK `CASCADE`；改行属性会影响 JOIN 读取 | 主键关联清楚；身份可变见 S02 |
| 成交与批次 | `executions.id` 主键；`instrument_id` 必须存在；批次可空、删除批次 `SET NULL` | `evidence_json` 保存来源与账户显示名；批次保存完整导入历史 JSON | 能保留独立成交；删除批次不会自动删成交，但会失去该关系，应有操作语义 |
| 账户与性质 | `executions.account` 为文本，性质/模拟 run 为列且也在来源 JSON 中 | 应用负责 canonical account、性质隔离与修正证据保护 | 无账户表本身不是缺陷；去重和单一事实来源仍需逐入口核对 |
| 旧复盘 | `reviews.episode_id` 主键；证券 FK `SET NULL` | 回合由成交推导，没有独立 episode 表；旧文档可继续保留 | 避免事实修订级联清掉历史笔记是合理选择 |
| 新复盘 | `recall_documents.episode_id` 主键，JSON 文档加持久 `revision` | 草稿/正式版分开；服务端事务保存并重建关系投影 | 聚合文档与可查询投影的边界明确，见优势 A03 |
| 复盘投影 | `episode_id + version_kind + entity_id` 等复合键，带 `document_revision` | 当前 draft/formal 分区重建；`document_revision` 是来源标记，不是所有历史修订的独立主键 | 不应把它当无限事件历史表；冻结版本在文档内部 |
| 行情与覆盖 | 证券/日期或 interval/时点/adjustment 复合键 | 外键删除证券时清理；provider、抓取时间、knowledge_at 等保留来源维度 | 本轮只审模型，不恢复 Bars 工作，不作覆盖充分性结论 |
| 账户迁移审计 | operation ID/幂等键、父操作 FK、before/after JSON 与 digest、aliases/dependencies | operation 下属行级联，含 commit/rollback 状态 | 有可追踪基础；本文未完整验收迁移执行器的业务安全性 |

DDL 依据：`db/sqlite-schema.ts:24–159,193–400,417–425`；账户迁移 DDL：`db/tradingview-account-migration-schema.ts:6–57`。表和索引是否足够需要查询负载证据，本文不凭表大、字段多或缺单列索引判错。

## 3. 已确认问题，按优先级排序

### S01 · P1 · 过期导入可覆盖后来保存的已审计修订

**结论：批处理原子性成立，但提交没有绑定用户确认时看到的旧事实。** `mergeTradeData` 对 `replaceExecutionIds` 逐 ID 删除，再合并传入成交，没有 expected revision、before 内容或范围快照校验（`app/lib/storage/sqlite-store.ts:1275–1285`）。专用 `reviseTrades` 却有请求幂等比较、before 全记录比较和可选 scope 比较（同文件 `:1323–1347`），二者保护不一致。

- **实际链：** 导入确认在 `app/components/trade-review-workspace.tsx:5450–5452` 计算替换 ID（包括已决冲突、同月文档行）；`:5492–5497` 提交客户端合并后的全量 `mergedExecutions` → `sqlite-http-client.ts:171` → `PUT /api/storage/trades`（`app/api/storage/trades/route.ts:32–43`）→ `mergeTradeData` → 无前提删除/插入。
- **触发反例：** A 打开导入预览，持有成交 e 的价格 `123.45`；B 先用 `reviseTrades` 将同一 e 改成 `130` 并留下 `trade_revisions`；A 再确认包含 e 的旧替换请求。最终成交恢复 `123.45`，B 的审计修订仍在。root 内存真实 Store 反例已复现这个顺序。
- **影响：** 最近一次已确认修订可能失效却没有冲突提示；数据库当前事实与最近审计意图分离。事务串行不能识别迟到命令。客户端成功后还直接设置其本地 `mergedExecutions`（workspace `:5508–5513`），未使用服务端结果重读。
- **竞争解释/边界：** “采用新导入”允许覆盖**用户看到并确认的**旧内容，但不自然包含未见到的 B 修订。账户纠正证据保护（store `:1644–1713`）可能阻止某些特殊替换，不覆盖普通成交此反例。单窗口无并发时不触发；未证明真实用户已经遇到双窗口事故。
- **最小后续验证：** root 对已给出的 Store 反例独立核对；若后续获准修复，再用两份预览基线验证迟到提交必须显式冲突或重新确认，并验证正常显式冲突选择、月结单替换和幂等重试仍保留。无需接在线库。

### S02 · P1 · 证券主键不变时可更改身份，重解释所有旧成交

**结论：`id` 的稳定性未延伸到证券的市场、代码和币种。** 通用 `validateInstrument` 只检查这些字段是字符串，不检查 canonical ID 与身份一致（store `:411–435`）；`putInstrument` 冲突更新无条件覆盖 `symbol/market/currency`（`:1599–1632`）。`mergeTradeData` 在读取当前成交前先写这些证券（`:1276–1277`）。

- **实际链：** 相同 trades API 的 `instruments` 参数 → `mergeTradeData` → `putInstrument`；随后 `getExecutions` JOIN 当前证券行（store `:1091–1093`），`mapExecutionRow` 用 JOIN 得到的代码、市场、币种重建 instrument（`:866–881`）。即使传入 `executions: []`，该链也能修改历史读取结果。
- **触发反例：** 已有 `HK:700 / HK / 700 / HKD` 的成交；提交相同 id、但 `US / OTHER / USD` 的证券行。root 合成库复现：历史 `getExecutions().instrument` 变为新身份，执行表原 `executions.currency` 仍是 HKD，形成两个持久字段/读取解释不一致。
- **影响：** 原证券的持仓、回合和报价归属可能随一次元数据更新变更；FK 确保“行存在”，不能保证“行仍指同一证券”。
- **竞争解释/边界：** 证券名称、本地化名称、交易所补充信息合理地可更新；代码更名或币种变更也可能是业务事件，但当前通用 upsert 没有区分该事件与新证券，也没有修订或有效期。专用 `reviseTrades` 的 `:1334–1335` 已拒绝更换市场/代码/币种，说明不是所有入口都允许此动作。正常解析器通常产生 canonical ID，降低普通 UI 误触概率，但 API 没有相同约束。
- **最小后续验证：** root 核对 instruments-only 反例及修改前后原始列/读取结果；另以只更新名称的样例确认合法更新边界。后续需要明确证券身份变更契约后再决定实现，不直接建议一次性改主键或数据迁移。

### S04 · P1 · 普通秒级成交的自动去重跨越两个明确实盘账户

**结论：账户是事实身份的一部分，但普通秒级成交去重没有始终使用该维度。** candidate key 只在 simulation 带 scope，在 date-only 带 account（`execution-reconciliation.ts:82–88`）；仅组内有 statementMonth/templateId 时再按账户分组（`:373–382`）。其余普通成交可进入同一核心组并选代表、将另一条称为 duplicate（`:456–467`）。

- **实际链：** `PUT /api/storage/trades` → `mergeTradeData` → `mergeExecutionsInTransaction`（store `:1760`）→ `reconcileExecutions` → 代表选择 → 只写 acceptedIncoming（store `:1788–1791`）。
- **触发反例：** root 合成库先后提交账户 A、B 的两条 explicit live 成交，ID 和 fileFingerprint 不同，证券 HK:700、秒级时点、方向、数量、价格、费用相同，均无 monthly/template/date-only。第二次返回 duplicate=1，重读最终仅一条成交。两账户隔离未被 FK 或主键补救。
- **影响：** 两个真实账户的相同行情成交可少保存一笔，从而改变账户事实集合。已确认的是这个受控反例，不是历史业务数据已经被错误去重。
- **竞争解释/边界：** 同一账户在不同工具中的临时名称可能需要合并，但不能无条件推断不同账户 ID 是同一账户别名；当前已有 canonical account 修正体系。月结、date-only、simulation 有各自保护，不能泛化为所有导入均跨账户合并。
- **最小后续验证：** root 核对第四个 Store 反例；再补同账户跨来源应去重、不同账户同来源应保留、已纠正账户别名应遵守明确映射三个对照，明确 ID 与别名契约后再决定设计。

### S03 · P2 · 普通成交的数字与时间只有字符串校验，可持久化非法值

**结论：错误不只存在于弱 DDL，真实服务写入口也接受它。** `validateExecution` 检查普通成交 quantity/price/fee/executedAt 为字符串（store `:530–554`），没有 Decimal/时间语义检查。`reconcileExecutions` 识别不了数值/时间时把 incoming 保留为 unmatched，并加入 accepted（`app/lib/import/execution-reconciliation.ts:393–398`），`writeExecution` 随后照值存入 TEXT（store `:1799–1865`）。

- **实际链：** `PUT /api/storage/trades` 的 body 仅做数组形状解析（route `:19–24`）→ 通用 merge 的 validator → reconcile → insert/upsert。root 用真实 Store 复现了非法时间、非数值 quantity、负 price、坏 fee 原样落库。
- **触发反例：** 一个合法证券、side/account/source 外壳中的普通成交，`executedAt="not-a-time"`、`quantity="not-a-number"`、`price="-1"`、`fee="bad-fee"`；无同候选冲突时可保存，不需要直接 SQL。它们不是合法的 date-only 或未知费用占位。
- **影响：** 后续按数值/时间解释的计算失去可信输入，可能报错或把记录划为无法解释；不在本文推断具体首页金额或已损坏在线行数。
- **竞争解释/边界：** reconciliation 保留“来源无法验证”的合法候选是合理的，但语义非法不是证据不足。正常导入解析器和 UI 编辑有较强校验；`reviseTrades` 另以 Temporal/Decimal 检查正数量/正价格/非负费用（store `:1310–1317`）。date-only、未知费用及可允许的费用调整需要各自契约，不能简单“一律 ISO 秒级/所有未知变 0”。金额 TEXT 本身不导致精度丢失。
- **最小后续验证：** root 核对当前坏字符串反例；后续若获准统一写约束，使用合法高精度小数、合法 date-only、unknown fee、simulation 和 settlement 五组边界对照，确保只阻断非法事实、不损失来源精度或未知语义。

## 4. 设计优点与其适用边界

### A01 · 批次事务和迁移防漂移是真实保障

`db/sqlite.ts:43–45` 为连接启用 FK/WAL/busy_timeout；`:117–125` 使用 `BEGIN IMMEDIATE`，失败 rollback。导入的证券、替换、成交和历史处于同一事务（store `:1275–1286`）；修订的事实与审计也同事务（`:1323–1364`）。例如历史插入违反约束时，前面的删除不应单独提交。它保证一个命令的整体性，**不保证命令看过最新事实**，S01 仍成立。

迁移以版本、名称、SQL checksum 登记（sqlite `:46–83`），已登记迁移被改写会拒绝；迁移 SQL 与记录一起提交。已发布分支冲突只识别精确旧 checksum 后搬移 v4→v5（`:60–69`），比无条件改号有更窄边界。root 干净内存库已顺序执行 14 个迁移；这不等于所有历史库升级路径、损坏 ledger 或人工变更 schema 已验证。无需因此在线打开业务库。

### A02 · 十进制字符串与来源语义避免过早失真

成交 quantity/price/fee 以及行情价格存 TEXT（schema `:53–57,78–101`），应用以 Decimal 解释，避免强制 SQLite REAL 带来的二进制近似；不存在“用 TEXT 就必然精度不足”的结论。`TradeExecution.source` 区分 timePrecision、时区/原文、费用 status、结算币种及 gross/net（`app/lib/trades/types.ts:59–148,159–178`）。例如 reported 的 0 与 unknown 的占位 0 可有不同证据含义；结算货币也未必等于证券报价币种。

边界是必须保留这些标记并验证数值有效，不能只凭一个 SQL fee/currency 列解释账务。S03 指向该入口语义校验，S02 指向重复币种字段不一致；本轮不要求改成完整复式账、不补造现金/汇率，也不把 reference cash 当完整账户余额。

### A03 · 新复盘文档有持久 CAS，JSON 和关系投影各有职责

`saveRecallDocument` 先取写锁再读 revision、比较 expectedRevision（`app/lib/recall/server-repository.ts:129–143`）；服务端加 revision/updatedAt（`:169–175`），显式 finalize 才更新正式版，自动保存不能回传 lastCompleted 改正式版（`:145–167`）。文档 JSON、计划/评估/指标投影同事务更新（`:179–192`）。这比浏览器时间戳胜出更稳健，也不以读取 receipt 的随机 ID 代替持久版本。

JSON 是权威聚合，投影可重建（`app/lib/recall/plan-projections.ts:4–9`）。冻结指标从文档而非当前成交草稿重建（`metric-projections.ts:5–27`）；历史 execution/ref ID 不外键绑定可变成交，允许后续修订成交而保留当时依据。例如一笔成交被修订/删除后，冻结复盘仍应说明“当时看到了什么”，不能直接级联抹除。

边界是当前查询分区不是所有文档 revision 的独立快照表，维护工具也不能单写投影或只删文档。当前正常 service 链已把同步责任封在事务内，不能只凭没有文档 FK 就认定生产孤儿。

### A04 · 去重考虑多重成交和来源质量，并非简单 UNIQUE(时间,价格)

`execution-reconciliation.ts:400–469` 按来源保留最大成交重数，再选证据代表；`:434–453` 保留报告费用冲突供明确选择。秒级时间先规范化，日期精度有独立排序和账户边界；simulation 候选带 run scope（`:40–103,145–209`）。同一秒同价的两笔真实成交不应被一个通用 SQL 唯一键直接挤掉，这个设计方向合理。

边界是“哪些字段共同构成同一事实”仍需覆盖所有账户/性质组合，已确认账户反例见 S04，性质风险见 R01；SQL `id` 唯一和来源 fingerprint 唯一不替代该业务判定。

## 5. 待验证风险，不作为已发生故障

### R01 · P2 · 普通秒级成交的自动去重可能跨非模拟性质

**源码支持的风险：** live 与 unknown 未在普通 candidate key 中分开（`execution-reconciliation.ts:82–88`）。账户维度已单独验证为 S04；性质维度仍需核对是否存在被授权的 unknown→live 证据升级规则。

**反例与链：** 同账户、两个不同文件，各一条证券/时点/方向/数量/价格/报告费用相同、ID 不同，一条 live、一条 unknown，走 trades API→merge→reconcile，可能归为 duplicate。竞争解释是新来源确认了原 unknown 的性质，此时明确的证据升级可能正确；反例是否构成缺陷取决于此升级规则。simulation 有独立 scope，不能泛化为模拟/实盘必然合并。

**最小验证：** 合成空库提交 live/unknown 和不同 simulation run 对照，检查保存数量、性质和 duplicate/conflict 报告，并追查当前解析器的性质证据来源；先确定升级是否要求人工确认。未完成前不定为性质事实丢失。

### R02 · P2 · 相同 execution.id 的不同事实可能先被当重复，绕过核心冲突

`reconcileExecutions:306–345` 先按 id 分组，直接 `selectRepresentative`，其余加入 identityDuplicates；本段未先要求账户/证券/数量/价格一致。比如两个输入碰巧同 ID 但数量不同，有可能被称为 duplicate，而非后续核心 conflict。实际链仍是通用 merge→reconcile。竞争解释是 ID 已由全部来源稳定、无碰撞地产生，且同 ID 只表示同一事实的证据升级；本轮未证明所有解析器/旧迁移均满足此前提。

最小验证是同 ID 分别改核心数量、账户、证券与只补费用证据四组对照，结合 ID 生成点核对提交报告；已有账户纠正保护需保留。暂不把“可构造 API payload”直接等同正常解析器必撞 ID。

### R03 · P3 · 多处 JSON/列重复信息和旧时间戳写策略依赖受控入口

`source.tradeNature/simulationRunId` 与对应列重复；读取只在 JSON 缺字段时补列（store `:849–864`）。导入历史全对象放 reconciliation_json；`source_fingerprint` 虽有 SQL UNIQUE，但 `putImportHistory` 未写该列（schema `:37`，store `:1868–1892`），当前去重主要在应用，而非该唯一键。旧复盘按客户端 updatedAt 的 `Date.parse` 比较（`:1895–1898`）；等时或非法日期不提供 CAS，新复盘已有更强 revision。

触发反例分别是维护工具只改列不改 JSON、把 nullable fingerprint 唯一误认成重导保障、两份旧复盘同时间互相覆盖。竞争解释是现有 writer 同步写、旧复盘只用于兼容，当前正常新保存走 A03，因此这些不是已经证实的服务故障。最小验证是在合成库列出所有允许 writer，核对 JSON/列不变量；确认旧复盘入口仍否可由当前 UI 保存及并发要求。无需全库拆 JSON 或引入跨全部表的全局 revision。

## 6. 后续核验顺序与交付边界

1. root 独立验收 S01–S04 的反例、行号和 scope，保留“可达 Store/API 行为”与“已发生 UI 事故”的区别。
2. 最小验证 R01 性质判等和 R02 同 ID 核心变更，明确稳定身份契约；结果决定是否提升为确认问题。
3. 若进入后续获批设计，优先统一通用导入与专用修订的身份、前提和语义校验，再评估需要哪些 DDL 约束。可先形成接口契约，不预设拆表、迁移或完整账务模块。

本次唯一产物是此报告。没有修复、schema 变更、在线数据处理或恢复暂停任务；不能以本文代替后续实现、数据修复与产品验收。

## 7. 所读版本指纹

下列 SHA-256 绑定未提交工作区版本。辅助依据还包括 `app/lib/storage/trade-revisions.ts`、`app/lib/trades/types.ts`、`app/lib/instruments/display-name.ts` 和上述项目工作流；完整受保护源码基线由 root 存在 [source-baseline.json](../../../.scratch/database-model-review-2026-10-26/evidence/source-baseline.json)。

| 文件 | SHA-256 |
|---|---|
| db/sqlite-schema.ts | `55c3f10bfbb097155acf4963fae9d3e1eeb92f062cae415ff3ea5d2989b4e7e5` |
| db/sqlite.ts | `20b1b5fcf117e400914bf4fa3b56e5df3f45919b17489cc94228530f04d9d7dc` |
| db/tradingview-account-migration-schema.ts | `25fd508f423db51a3d9e8652806d0fe35382cf906f44180345f64cc8319babad` |
| app/lib/storage/sqlite-store.ts | `95249464037d0a44a04c35175fa069ba6ac27c614ef561c558fc50f80712d948` |
| app/lib/import/execution-reconciliation.ts | `e82b1749bd9ea068b88ede17caeb2876328b2835c57158e4bdc0d5da84eddbc2` |
| app/api/storage/trades/route.ts | `9b65fec2067ae0dfd7b486a33ace58dc1a7570ecab3387ef9c5d65e32a98c8db` |
| app/lib/storage/sqlite-http-client.ts | `9df447e07dcc05f0a625debdaccc1bad711d8d037203220deae8a06e4403a5e9` |
| app/components/trade-review-workspace.tsx | `b9c7e37d68269d49276b2e529bb0c0d435ebc47e07a073d91ecc614c4c60a11b` |
| app/lib/recall/server-repository.ts | `bfd9cdf1a417d82bb7750199295e6c9d0ae4fae6528b67c2529b217ca776446b` |
| app/lib/recall/plan-projections.ts | `8e24f42591babc6a465340c0102a7ada68c7c70c2a2e7b3e43e303fe40971f10` |
| app/lib/recall/metric-projections.ts | `aec53805d920351d4942f531e2b31e916995ca97d2d2af534331265113e10219` |
| docs/backend-design/current-state.md | `3389492fcd029c6e370462de646c582f9e3fff5d7813241210d619d90e768d3f` |
| docs/backend-design/target-design.candidate.md | `c1e38c52949dc05e86570f9cc67378eec25054f70eb1a6052267fcfe5f224897` |
