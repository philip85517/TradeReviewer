# 独立审查：展示缓存失效与重启原型 candidate-01

**结论：PASS（仅接受本冻结的合成原型）**。当前证据支持“成交版本本身不能识别名称/账户标签变化；展示缓存需要独立展示身份，并在读取期间保持 SQLite 快照一致”这一限定结论。它不证明现有产品有跨重启旧名称问题，也不构成产品实现、完整首页或性能验收。

## 冻结身份与检查命令

协调者提供的冻结锚点为 `SNAPSHOT.json` SHA-256 `c201116bd85402782ed58975dda49531a9cde27170c7216d8378a63fe5ffa28e`，`codeDigest` 为 `94650bf5b6abc549f9990b99e720e23e297e9291eef548ab4db32486513b3938`。审查前后均复算得到该快照 SHA；`SHA256SUMS` 的 44 项在测试前后两次均全部通过。各项覆盖冻结代码、产品引用、支持文档和 candidate-01 的既有证据。已读 `run.json`、四类并发/重启 JSON 及三个字段变化 JSON；冻结候选文件和原有结果未编辑、未覆盖。

本机继承的 `C.UTF-8` locale 不受 Perl `shasum` 支持，未设置 override 的 README 命令会在计算哈希前退出。审查改用下列命令完成了完整校验：

```sh
env LC_ALL=C LC_CTYPE=C LANG=C shasum -a 256 -c .scratch/display-cache-restart-experiment/SHA256SUMS
env LC_ALL=C LC_CTYPE=C LANG=C shasum -a 256 .scratch/display-cache-restart-experiment/SNAPSHOT.json
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/display-cache-restart-experiment/cache.test.mjs .scratch/display-cache-restart-experiment/restart-snapshot.test.mjs
```

固定 Node 26.0.0 / SQLite 3.53.0 测试实际结果为 16 项通过、0 失败，原始测试耗时约 1.09 秒。该耗时只是测试运行记录，不是性能测量。测试和额外故障注入只创建 `.data/display-cache-restart-worker/sample-*` 下的新合成库；没有打开正式数据库，也没有运行真实数据或产品服务。

另在一个新合成库中用 `BEFORE INSERT ON display_cache` 触发 `RAISE(ABORT, ...)`，注入刷新中途失败。刷新抛错后，旧 manifest、构建计数和缓存行仍完整；恢复原合成名称后，旧绑定仍可读。此为独立一次性负例，没有改测试或冻结结果。

## 验收发现

- 三个字段分别变更：`name`、`localizedName`、逐笔 `accountLabel` 的单字段用例均保持 `bookVersion`（合成 databaseId / epoch / sequence=7）与十字段 `factDigest` 不变，且使 `presentationDigest` 改变。显式刷新后只增加展示构建计数（1→2），事实构建计数保持 1；旧绑定先被明确拒绝，新读取匹配用例中的字面预期。`localizedName = NULL` 和空账户标签仅是本合成表语义，未当作真实产品删除行为。
- 十字段投影按冻结归档 `FACT_KEYS` 的键集合校验，事实包含 `id`、`instrumentId`、`accountId`、`market`、`symbol`、`side`、`executedAt`、`tradeNature`、`simulationRunId`、`importBatchId`。测试把缓存事实与两条完整合成事实逐字比较；名称/账户标签不混入事实投影。未变刷新还检查 `total_changes()` 不增加。
- 未变重启确实由不同 PID 的子进程重新打开同一私有 SQLite 文件。缓存结果和绑定不变，`factBuilds=1`、`displayBuilds=1`；同一 child 连接上的 `total_changes()` 为 0→0，差值为 0。这证明本原型没有重复 DML 构建，不代表没有读扫描、摘要计算或物理 I/O。
- 关闭期间改名的独立重启用例，child 首先得到 `CACHE_STALE`；显式刷新后只重建展示缓存，旧请求得到 `VERSION_CHANGED`，新读返回新名称，事实摘要和成交版本不变。
- WAL 并发正例在 worker 的读事务已读取元数据、尚未读取缓存行时暂停，经另一连接提交名称、localizedName、账户标签和缓存刷新后，worker 返回完整旧快照；之后新读取看到完整新展示。无事务负例使用相同屏障，确定性地观察到旧元数据与新缓存行混合，说明并发反例确实跨过了另一连接的提交。
- 缺失、非法、过期/foreign 绑定，缺失 book version、损坏缓存内容以及缓存记录中的旧 `codeDigest` 均有明确失败断言，没有静默返回旧展示。测试覆盖的是记录身份损坏拒绝，并未改写或替换实际代码来模拟部署升级。
- 原始 run 记载 17 个候选执行库路径，全部位于私有合成目录；保存的 10 份 JSON 对应逐字段版本/刷新、两种重启与两种 WAL 情形。prior-freezes 只读回执记载既有实验冻结文件 42 项无哈希差异。本次额外创建的合成库未写回冻结证据目录。

## 证据保全限制与实现身份边界

审查先将协调者提供的 snapshot SHA 作为外部信任锚，再核对清单并运行测试。`SHA256SUMS` 不自校验，`SNAPSHOT.json` 不把自身包含进清单以避免循环；snapshot 本身在本次审查前后 SHA 未变，且其内容记录 checksum 文件哈希。直接 `node --test` 入口没有内建冻结门禁，因此本次先手工验证清单。此流程可证明审查期间受清单覆盖的文件与给定锚点一致，不能抵御有人同时恶意替换快照、清单和验证逻辑，也不提供 TOCTOU 或符号链接攻击保证。

运行时绑定中的 `codeDigest` 只覆盖 `cache.mjs` 与真实 `trade-book-version.ts` 字节，不是完整构建或依赖闭包身份；`cache.mjs` 另导入了归档的 `FACT_KEYS`。冻结清单外部绑定了该归档文件，所以本审查确认的是这一精确冻结候选的行为；记录中的旧代码身份拒绝测试不能替代完整依赖变更测试。若将来把该机制用于产品，完整规则/代码版本身份仍需设计和验证。

## 接受边界与未覆盖

本轮接受范围是固定两条合成成交、一个合成标的、同一账户下两个不同逐笔标签，以及冻结候选实现本身。名称更新和刷新是两个事务；两者之间读到 stale 时明确拒绝，但实验没有证明源变更与展示投影在同一事务原子发布。WAL 结论只适用于这个 SQLite 原型和给定读事务生命周期。

以下仍为 **NOT VERIFIED**：实际产品数据库与跨表适配、真实名称/metadata 写入和删除语义、真实账户标签来源及显示优先级、产品启动/页面/API/HTTP 缓存接线、浏览器首屏或任何完整 UI、全量账本规模、稳定性能或一秒目标、真实导入、崩溃/断电恢复、非 ASCII 排序、恶意代码替换/TOCTOU。实验未访问正式库、未启动浏览器、未运行性能基准。不得把 CLI 合成测试描述成浏览器首屏通过或产品修复完成。
