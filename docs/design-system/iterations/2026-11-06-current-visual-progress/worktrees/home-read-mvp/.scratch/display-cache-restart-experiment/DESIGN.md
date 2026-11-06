# 展示缓存失效与重启复用：限定原型

授权：协调者2026-10-29新任务及接受组合版本方案消息。仅合成数据、私有临时SQLite；最多3候选轮。文件唯一owner为update_experiment，协调者独立接受。既有投影、更新实验及冻结证据只读。无产品代码、UI、正式数据库、真实导入、财务、Bars或重复导入。

## 真实接口依据

- `app/lib/storage/trade-book-version.test.ts` 的 `ignores repeated facts, presentation names and account labels`：name、localized_name_json、evidence.accountLabel变化不改变bookVersion。
- `app/lib/storage/trade-book-version.ts`：bookVersion是databaseId/epoch/sequence；缺失/损坏明确BOOK_VERSION_UNAVAILABLE；读取沿用调用者事务。
- `app/api/storage/instruments/name/route.ts`、`instruments/metadata/route.ts`：名称/metadata写入口；metadata响应no-store。`app/api/storage/trades/protocol.test.ts:145` 验证同一成交版本读取新name且不重写executions。
- `app/lib/storage/sqlite-store.ts:881`与`:1714`：展示组装把instrument name/localizedName与逐成交evidence.accountLabel合并；账户标签并非本原型可假设的唯一账户级规范表。
- `app/lib/storage/homepage-source-snapshot.ts:22`及`stored-trade-snapshot.ts:147`：真实产品读事务复制后再物化；本实验不调用这些全产品路径。
- `../real-data-fact-experiment/archive/candidate-02/core.mjs:4`的10字段投影，以及`../update-publication-experiment/DESIGN.md`末段：名称/标签在原合同外。只读复用字段定义，不改既有合同。

当前产品启动fresh read，完整source payload已有digest。本实验反证的是未来只用bookVersion复用展示缓存的不足；没有证据声称当前产品已存在跨重启旧名称bug。

## 方案与边界

选组合凭据：bookVersion + presentationDigest + 规则/代码身份。presentationDigest来自按instrument ID / execution ID绑定的name、localizedName、accountLabel规范内容；每次读事务重新计算，JSON对象键顺序/空白不构成变化，字符串内容不做Unicode归一化。只覆盖当前两条合成成交涉及的字段，含同账户不同逐笔标签。真实产品可能有其他名称来源和显示优先级，均待验证。

备选live join每次读取名称较简单，但不能直接验证持久展示缓存失效；完整页面统一版本覆盖其他数据，超出本任务。当前选择由协调者接受，不把实验凭据当产品统一版本。

私有库包含合成最小product-shaped源表、trade_book_state、持久10字段投影及展示缓存。直接使用真实readBookVersion读取合成状态，不启动产品bootstrap。首建显式refresh；后续read必须带完整凭据。源名称变而缓存未刷新时明确CACHE_STALE；缓存已刷新而请求旧凭据时明确VERSION_CHANGED；缺失/非法凭据、缺失状态/缓存、代码规则或内容损坏分别拒绝，绝不返回旧名称或默认为0。

refresh在独立写事务计算当前输入；bookVersion与事实摘要不变则不重复写成交投影；presentationDigest不变则不重复写展示缓存。持久构建计数和独立子进程同一连接操作前后SQLite total_changes差值证明重启后未重复DML构建；不声称零物理IO。这里复用仍须扫描源字段验证摘要；计算presentationDigest可能昂贵，本轮不测耗时、不证明完整首页1秒。

合成名称源更新与refresh为两个独立事务，中间合法状态是明确拒绝stale；不证明源和缓存跨事务原子发布。读取以beginRead/finish暴露实验快照生命周期：同一deferred事务先验元数据，再读缓存行。独立worker连接WAL屏障保证元数据查询后另一连接提交名称更新和refresh；旧事务只见完整旧快照，新事务只见完整新快照或明确stale。另存无读事务的确定性混读负例。一个JS串行序列不算并发验收。

## 最小反例与验收

固定2条合成事实、1标的、同账户不同逐笔标签；name为非空中文/emoji，符合真实putInstrumentName非空条件。空字符串只用于合成accountLabel；localizedName变为SQL NULL只表示本合成表缺失语义，未验证真实metadata删除/优先级。nullable账户事实未覆盖。测试name、localizedName、标签各自变化，连续两次刷新，事实内容、factDigest与bookVersion不变；每次新读返回手工字面预期。缺失/过期/epoch或databaseId不同、损坏缓存拒绝。实际独立Node进程重开复用，关闭期间名称变化后拒绝旧缓存并显式刷新。双SQLite连接真实重叠读事务与负例。

不包含真实产品跨表/跨进程适配、真实名称写入事务与通知、迁移触发器覆盖、HTTP/浏览器缓存、全页版本、排序/搜索、崩溃/断电恢复、恶意并发修改实验代码、性能基准或扩大量级。UI/视觉不适用：没有产品接线或控件。完成后冻结candidate-01代码/设计/证据摘要，独立审查前保持open；失败保留，最多3候选轮。
