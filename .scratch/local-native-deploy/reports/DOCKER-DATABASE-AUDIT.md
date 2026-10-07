# Docker 与数据库版本只读核对

检查时间：2026-10-06 10:16–10:20 +08:00。未启动 Docker 或应用、未运行迁移、未修改业务数据库。数据库连接采用 `mode=ro` 并设置 `PRAGMA query_only=ON`。

## Docker

| 项目 | 结果 | 证据与限制 |
| --- | --- | --- |
| Docker Desktop | 4.84.0，build 234817 | `/Applications/Docker.app/Contents/Info.plist` |
| Docker CLI | 29.6.2，API 1.55，Git dfc4efb | `docker version --format '{{json .}}'` |
| 当前 context | desktop-linux | `docker context ls` |
| Docker 引擎 | 未运行，Server=null | `/Users/zhoulin/.docker/run/docker.sock` 不存在，API 无法连接 |
| 本地镜像及容器实际版本 | NOT VERIFIED | `docker image ls --digests` 与 `docker ps -a` 均因引擎不可访问而失败 |
| 容器实际数据库挂载、容器内 SQLite 版本 | NOT VERIFIED | 无法执行容器 inspect/exec；配置不能替代运行证据 |
| Docker 本地存储 | Docker.raw 存在，实际分配 41,277,079,552 字节（约 38.44 GiB） | `/Users/zhoulin/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw`；不能据此推断镜像版本 |

项目 Dockerfile 声明 `node:22-bookworm-slim`，通过 apt 安装未固定版本的 sqlite3。这仅是构建声明，不能证明已存镜像中的实际 Node 或 SQLite 版本。

## 数据库与源码

这里的业务 schema 版本取自 `schema_migrations.version`，不是 SQLite 引擎版本或 `PRAGMA user_version`。

| 对象 | schema / 迁移版本 | 状态 |
| --- | --- | --- |
| 正式业务数据库 | 14；迁移 1–14 均存在；最新 `tradingview-account-migration` | `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`；46,776,320 字节；data_migrations 版本 1 / complete |
| 旧 Docker 目录的历史数据库 | 6；迁移 1–6 均存在 | `/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite`；36,708,352 字节；data_migrations 版本 1 / complete |
| 旧目录另一个数据库文件 | 未初始化，无版本 | `/Users/zhoulin/projects/TradeReview/data/tradereview.sqlite`；0 字节 |
| 正式 app/current 源码 | 只定义到迁移 7 | release `20260923-master-ee76e83`；`db/sqlite-schema.ts` 的 SQLITE_MIGRATIONS 数组 |
| 当前工作区源码 | 定义到迁移 14 | HEAD `63690a494b8ad403081c7720985be54a95db60c7`；本次未重新获取远端，不能据此核实更晚的远端状态 |

两个数据库的 `PRAGMA user_version` 都是 0；这是未使用该字段，并不表示业务 schema 为 0。`PRAGMA schema_version` 分别为 52、27，是 SQLite schema cookie，也不代表业务迁移版本。

本机只读查询使用 SQLite 3.43.2；本机 Node v26.0.0 链接 SQLite 3.53.0。容器内 SQLite 引擎版本尚未验证。

## 配置的数据库连接

正式目录 `/Users/zhoulin/projects/交易空间/TradingReview` 和旧目录 `/Users/zhoulin/projects/TradeReview` 的 Compose 配置都将：

`/Users/zhoulin/projects/交易空间/database/TradingReview` → 容器 `/var/lib/tradereview`

容器环境变量为 `TRADEREVIEW_DB_PATH=/var/lib/tradereview/tradereview.sqlite`，因此配置指向正式 schema 14 的业务库。旧目录的 schema 6 数据库是历史文件，不是当前 Compose 配置选择的数据库。引擎停止，容器创建时的实际挂载与连接尚未验证。

正式和当前工作区的 runtime.json 同样指向上述外置业务库，端口均为 3022。旧目录 config/.env 的 APP_RELEASE_CONTEXT 已指向新的正式 app/current；旧目录自身的 app/current 仍指向历史 release `20260810T153856Z-74b1523e13`，不能把该历史目录当成实际 Docker 镜像版本。

## 一致性与运行状态

- 当前工作区源码迁移上限 14 与正式数据库迁移版本 14 一致。
- 正式部署源码迁移上限 7 与正式数据库迁移版本 14 不一致；这表明数据库迁移进度领先于该部署源码，尚未在本任务中验证此组合的运行兼容性。
- 当前 Docker 配置选择正式 schema 14 数据库，但实际已存镜像版本和容器连接未验证，无法判定镜像与数据库的一致性。
- 10:16–10:20 正式端口 3022 没有监听，绕过代理的 HTTP 请求返回 connection refused；`make deploy-status` 返回 observed=null、healthy=false、consistent=false。
- 10:08 的正式服务运行验收是当时的历史证据。此次发现它已经停止；本任务未诊断停止原因，也未执行启停、升级或修复。

独立复核：`/root/deploy_source` 只读复核了两库的 schema/data migration 记录及源码迁移上限。协调者再次直接查询数据库、读取源码和配置，并执行 Docker/API 与正式 HTTP 状态检查。

## 后续：用户授权正式运行后核对

2026-10-06 10:23–10:28 +08:00 已启动 Docker 引擎并恢复既有正式原生入口 3022，健康通过。真实 Docker inspect 证明既有容器实际仍挂载旧库 schema 6、绑定 4317，与当前 .env 不同；镜像源码仅定义到 migration 3。正式服务源码/接口为 schema 7，实际打开的正式库为 schema 14。完整证据和启动后数据指纹观察见 [FORMAL-RUNTIME-VERSION-AUDIT.md](FORMAL-RUNTIME-VERSION-AUDIT.md)。本页前面的 NOT VERIFIED 与停机状态保留为启动前历史记录。
