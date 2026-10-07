# 正式启动后版本核对

用户授权：当前聊天“正式运行后检查版本”。检查时间：2026-10-06 10:23–10:28 +08:00。恢复既有正式原生服务并启动 Docker Desktop；没有创建新版 release、切换 app/current、提交或推送代码。旧 TradeReview/TradeRadar 容器均保持停止。

## 正式服务

入口：[http://127.0.0.1:3022/](http://127.0.0.1:3022/)。正式启动脚本为 `/Users/zhoulin/projects/交易空间/TradingReview/ops/start-native.command`。后台 launcher PID 98642（PPID 1），实际监听 PID 98660；日志 `/Users/zhoulin/projects/交易空间/TradingReview/logs/runtime-version-check-20261006.log`。

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| release | `20260923-master-ee76e83` | 实际监听进程 cwd 与 app/current 物理目录一致 |
| 完整源码提交 | `ee76e830f548ef456f8e193d57d165889ac56412` | Git tree 中 1,182 个 tracked blob 与 release 全部相同；0 缺失、0 差异；[源码比较](formal-runtime-source-compare.json) |
| package version | 0.1.0 | release package.json |
| Node / SQLite 引擎 | v26.0.0 / 3.53.0 | lsof 确认实际 executable `/usr/local/Cellar/node/26.0.0/bin/node`；[引擎版本](formal-runtime-engine.json) |
| HTTP / 运行身份 | 200；healthy=true、consistent=true | [启动](formal-runtime-start.json)、[健康接口](formal-runtime-health-final.json)、[最终状态](formal-runtime-status-final.json) |
| 实际打开的业务库 | `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite` | lsof 确认 PID 98660 打开该物理文件，符合 runtime.json |
| 数据库实际迁移版本 | schema 14；data migration 1 / complete | 只读查询 schema_migrations/data_migrations；[数据库检查](docker-runtime-db-after.json) |
| 接口报出的 schemaVersion | 7 | `/api/storage/status`；这是源码定义的迁移上限，不是数据库实际迁移记录 |

接口差异的直接源码证据：正式 release `app/lib/storage/sqlite-store.ts:805` 的 getStatus 和 `:810` 的 getBootstrap 都返回 `SQLITE_MIGRATIONS.at(-1)?.version`。正式 release 仅定义 migration 1–7；数据库已经记录 1–14。HTTP 200 和 consistent=true 证明运行身份/目录/健康一致，不能证明源码与数据库迁移进度一致，也不代表已接受全部旧版本业务功能的兼容性。

浏览器实际加载正式首页，“我的交易室”和已有交易范围显示完成，控制台 error 日志为空。只打开首页检查加载，没有进行导入、保存、删除、复盘编辑或图表操作。此范围是运行和版本核验，不是产品全流程验收。

## 本地 Docker 镜像与实际已创建容器

Docker Desktop 4.84.0（234817），CLI 和 Engine 均为 29.6.2。Docker 引擎本轮已运行，上一轮无法核实的镜像/容器信息现已由真实 Docker API 核实，见 [docker-runtime-verified.json](docker-runtime-verified.json)。

| 项目 | 实际结果 |
| --- | --- |
| 镜像 | `tradereview-app:latest` |
| 不可变镜像 ID | `sha256:523bdb011b76635b82e5aa2824c8112ff157a6911b2dbc43456a8663b0e1f0c4` |
| 镜像创建时间 | 2026-08-10T15:40:01.165522467Z（北京时间 23:40） |
| 应用 package version | 0.1.0 |
| 镜像内 Node / SQLite 引擎 | v22.23.2 / 3.51.3 |
| 镜像源码迁移定义 | 1–3，上限 3 |
| 镜像完整应用 Git SHA | UNKNOWN：镜像无 Git revision 标签，历史目录后缀不是已核实提交号 |
| 已创建容器 | `tradereview-app-1`，ID `6be64675f2f667a6d07357bb59b8fd2001125f41be763e12644244e661859772` |
| 容器状态 | exited，退出码 137；本轮未启动旧应用容器 |
| 实际已创建端口绑定 | `127.0.0.1:4317 -> 3000` |
| 实际已创建数据库挂载 | `/Users/zhoulin/projects/TradeReview/data/sqlite` → `/var/lib/tradereview`，RW=true |
| 对应数据库 | `/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite`，schema 6；data migration 1 / complete |

镜像内版本与挂载数据库查询使用同一不可变 image ID 的临时 helper：rootfs 只读、网络禁用、数据库 bind 只读、DatabaseSync readOnly 和 query_only。helper 完成后自动移除，不启动旧应用或执行其初始化迁移。镜像源码也由 `docker cp` 从停止的既有容器中读取。[提取的 schema](docker-image-files/sqlite-schema.ts) 和 [package](docker-image-files/package.json) 保留。

**实际容器挂载与当前 .env 不一致。** 当前正式/旧目录 .env 都指向新的正式数据库目录和 3022；既有容器却保留创建时的旧数据库目录与 4317。修改配置文件不会自动重建已创建容器。因此上一轮“当前配置指向 schema 14”仍然正确，但不能用于判断现存容器；真实 inspect 确认现存容器对应 schema 6。

## 一致性结论

- 正式运行源码 `ee76e83`：源码/接口 schema 7，对应实际数据库 schema 14，不一致。
- 本地旧 Docker 镜像 `523bdb011b76`：源码 schema 3，对应既有容器挂载数据库 schema 6，不一致。
- 既有容器保存的数据库挂载与端口也不符合当前 .env。
- 当前工作区 HEAD `63690a494b8ad403081c7720985be54a95db60c7` 源码迁移上限 14，与正式库的迁移版本相同。本轮未获取远端，也未将该源码部署到正式入口；最近核实远端 master 的时间仍为 09:39。
- 两个应用 package version 都是 0.1.0，不能用它判断版本一致性。

## 数据保留与观察

启动前通过 SQLite backup API 创建独立一致性备份，quick_check=ok，路径和校验和见 [docker-runtime-db-before.json](docker-runtime-db-before.json)。备份权限 0600，位于本任务 `runtime-check-backups/`，未设置为业务入口。

启动与只浏览首页后核对 46 张表的内容指纹：44 张表全部一致，包含 executions 的全部 1,866 条原始成交；没有表发生行数增减。两个表有以下内容变化，不能把本轮称为数据库完全未修改：

- instruments：23 行 metadata_json 和 updated_at 更新，行数仍为 236。
- reviews：1 行仅 updated_at 更新，行数仍为 138，复盘其他字段相同。

精确变化字段统计见 [formal-runtime-content-changes.json](formal-runtime-content-changes.json)。运行恢复会调用既有应用初始化，浏览器加载也会运行既有页面逻辑；本任务没有直接写入上述业务表、运行修复脚本或恢复旧数据覆盖当前内容。包含原始成交的 44 张表内容保持一致。

独立源码核对支持两条现有首页初始化写入机制：正式 release `app/components/trade-review-workspace.tsx:2020–2038` 在 hydration 后运行证券元数据队列，`app/lib/instruments/resolve-service.ts:284` 写入 repository，最终 `app/lib/storage/sqlite-store.ts:1281–1308` 更新 metadata_json/updated_at；同一 workspace 的 `:2253–2268` effect 调用 enqueueDrawingState，`:2199` 调用 putReviewState，`sqlite-store.ts:1600–1620` 对 reviews 回写 updated_at。观察与这些机制相符；本次未采集逐请求写入 trace，不能仅凭源码证明全部 23 次元数据写入和单次复盘写入的精确调用归因。协调者已直接复核正式 release 的以上源码，避免混用较新工作区行号。

协调者独立核验：/root。实际正式服务保持运行，Docker 引擎保持运行；旧应用容器保持停止。需要手工启动时执行正式 `ops/start-native.command`，它使用当前 app/current 和正式 runtime 配置；桌面 tradeReview.command 检测同一正式服务并打开 3022。
