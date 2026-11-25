# Git 归档与基线数据库同步

2026-11-26（Asia/Shanghai）。本批按用户要求整理既有实现及文档依赖，检查数据库差异，先备份再同步，并验证同步后的完整一致性。没有新增产品功能；既有页面验收仅归档，不作为本次重新验收。

## 结论

**数据库同步通过。** 正式业务库、不可变源快照、同步后的主工作区基线库，76 张表（含 SQLite 内部表）、504,682 行的结构与内容摘要完全一致。三者 `integrity_check` 均为 `ok`，外键违规为 0。逐表行数和摘要见 [consistency.json](consistency.json)。

同步后另用当前代码的 `validateFull`，分别通过新建的只读 SQLite 连接检查两库当前首页发布：版本 `76a83ca8-32b7-495e-a1a4-865be4decc44`，业务日 2026-11-25，824 个平仓回合、328 个覆盖对象、301 个目录对象；两个库结果相同。见 [publication-validation.json](publication-validation.json)。这证明持久化发布可被当前校验器完整读取，不代表所有原始凭证缺口已经消失。

## 为什么需要同步

当前分支及 Git 中的 `conf/runtime.json` 指向正式业务库；主工作区另有一处原先就存在的未提交配置修改，仍指向旧迁移库。因此两个物理文件没有自动共享后续修复。本次保留该配置修改，将已修复的正式业务库完整同步到它所使用的基线文件。

| 项目 | 同步前的旧基线 | 正式业务库及同步后的基线 |
| --- | ---: | ---: |
| 全部表数（含内部表） | 47 | 76 |
| 全部行数 | 210,956 | 504,682 |
| 成交 | 1,866 | 1,931 |
| 导入批次 | 213 | 224 |
| 证券 | 236 | 239 |
| 复盘记录 | 138 | 138 |
| 复盘文档 | 5 | 5 |
| 成交修订记录 | 11 | 11 |
| 日行情 | 154,410 | 154,579 |
| Schema 迁移记录 | 14 | 22 |

正式业务库已经包含此前的补录、来源证据修正与 LI 软件赠股回填。当前验收预览与正式业务库的成交、导入、证券内容摘要相同；预览中的派生查询缓存及验收状态不作为本次同步来源。

同步前已检查旧库与源库的共同表：旧库没有独有主键，成交及复盘内容没有被遗漏；部分现有记录的来源证据、证券元数据和更新时间不同。旧库独有的 `legacy_migration_runs` 表只有一条旧迁移回执，随完整旧库备份保存，没有混入正式源库以改变同步结果。可重查的前后清单见 [preflight.json](preflight.json)，其中只保留表、主键列名、数量及变化字段，不导出记录内容。

## 来源、目标和备份

- 正式来源：`/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`。
- 主工作区基线：`/Users/zhoulin/projects/交易空间/database/TradingReview/migrated-20261028-0955/database.sqlite`。
- 备份目录：`/Users/zhoulin/projects/交易空间/database/TradingReview/backups/20261126-baseline-sync-20261125T163145220Z/`。

备份目录保存 `baseline-before.sqlite`（旧基线完整备份）、`source-snapshot.sqlite`（正式源库的一致性快照）、各自校验清单、`baseline-runtime-before.json`（原配置）和 `sync-result.json`（操作回执）。目录权限 0700，备份文件权限 0600。这些私人数据保存在数据库目录，不进入 Git。

备份和同步均使用 SQLite 在线备份 API，包含已提交的 WAL 内容；没有用普通文件复制拼接数据库和 sidecar。同步前确认来源与目标无人打开，再重新验证来源/源快照、目标/旧备份仍一致，随后以源快照覆盖目标。同步操作时间为 2026-11-26 00:34:52—00:35:16（Asia/Shanghai）。

| 摘要 | SHA256 |
| --- | --- |
| 旧基线 | `05a72c0f222b87b4b78127c3e94397614f65d664103fe3c350c18041e77f77ce` |
| 正式来源、源快照、同步后基线 | `c350ae5c0ba1826b1c32d16262f91f24f17e4ced3544a2ca15bf9b1b03df02d2` |

摘要覆盖表/索引/触发器等 schema、全部表的逐行内容及重复行数量、应用 ID、用户版本和编码，忽略物理行顺序。它是逻辑一致性摘要，不是 SQLite 文件字节摘要。两处配置仍指向不同物理文件，结论针对本次同步时点；未来写入不会自动互相复制。

## Git 归档与验证范围

既有实现、相关单测、数据合同、设计变更、历史结论及必要版本依赖均纳入本轮暂存清单，共 131 个文件：83 个已有文件修改、48 个新文件，其中 88 个应用文件（含 31 个测试文件）、43 个文档及核对工具文件。应用的 692 个相对依赖与正式 Markdown 的 191 个相对链接均已核对闭合，没有漏掉四个新增核心实现依赖。正式依赖入口见 [文档归档](../2026-11-26-git-archive/README.md) 与 [来源对照](../2026-11-26-git-archive/SOURCE-MAP.md)。历史 PASS、FAIL、NOT VERIFIED 和适用范围保留；私人截图、账单、数据库及运行日志不随 Git 分发。归档文档使用仓库内相对链接，启动统一遵循 `make dev` 的隔离备份流程。

本批验证：正式文档链接闭合、临时目录引用检查、Git 暂存清单与依赖核对、`git diff --check`；数据库全量内容及结构摘要、完整性/外键检查、当前发布的实际只读校验。本批未改变产品逻辑，因此没有重跑产品测试、视觉验收或性能压测，也没有将历史测试结果重新签为本批通过。没有提交、推送或合并。

只读复核命令（从仓库根目录运行，使用项目固定的 Node/SQLite 版本）：

```sh
./scripts/native-node.sh docs/reports/2026-11-26-baseline-database-sync/verify-databases.mjs \
  'source=/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite' \
  'baseline=/Users/zhoulin/projects/交易空间/database/TradingReview/migrated-20261028-0955/database.sqlite'
```

输出只含数量和摘要；不写数据库。若库在后续业务操作后发生变化，应重新确认来源与变更，不能用本次回执宣称仍然一致。
