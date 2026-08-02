# Docker Compose 部署指南

默认部署根目录是 `/Users/zhoulin/projects/TradeReview`；可在源代码工作副本中通过
`DEPLOY_ROOT=/绝对路径` 覆盖。目标目录不能是源仓库或其普通子目录。完整部署完成后，
目标根目录也包含独立的 `Makefile` 和 `ops/deploy.sh`，因此状态、备份、恢复、回滚、
停止以及基于当前 release 的再次部署可以直接在目标根目录执行。

## 目标目录

```text
/Users/zhoulin/projects/TradeReview/
├── app/
│   ├── releases/<release-id>/
│   └── current -> releases/<active-release>
├── config/
│   ├── .env
│   └── .env.example
├── data/
│   ├── sqlite/tradereview.sqlite
│   └── backups/
├── logs/
├── ops/
│   ├── deploy.sh
│   ├── deploy.mjs
│   ├── backup-db.sh
│   ├── restore-db.sh
│   ├── healthcheck.sh
│   ├── status.sh
│   └── run-command.mjs
├── compose.yaml
├── Makefile
└── DEPLOYMENT.md
```

## 首次部署与重复部署

在源代码工作副本执行：

```bash
make deploy
make deploy-status
```

第一次 `make deploy` 会自动创建完整目录、`config/.env.example`、权限为 `0600`
的 `config/.env`、SQLite/备份/日志目录以及初始 SQLite 文件，然后才调用 Compose。
若部署前需要修改端口等配置，可先执行：

```bash
make deploy-config
$EDITOR /Users/zhoulin/projects/TradeReview/config/.env
make deploy
```

`deploy-config` 和重复的完整部署都不会覆盖已有 `config/.env`。完整部署也不会覆盖
SQLite、备份或日志。默认只监听 `127.0.0.1:3000`；公网域名、HTTPS、反向代理及
`APP_BIND=0.0.0.0` 均需明确配置。

## 日常操作

可从源工作副本运行下列命令；完整部署后，也可在目标根目录运行相同目标：

```bash
make deploy-code
make deploy-status
make deploy-backup
make deploy-restore BACKUP=/absolute/path/to/backup.sqlite
make deploy-rollback
make deploy-down
make deploy
```

目标根目录的 `deploy`/`deploy-code` 以 `app/current` 为源创建一个新 release；
源工作副本中的命令以当前工作副本为源。所有脚本路径和自定义部署根目录都会按独立参数
引用，不依赖调用者的当前相对路径。

## 发布、失败恢复与保留

每次发布先创建 `app/releases/<release-id>`，再构建、启动并等待服务健康；成功后才
原子替换 `app/current`。完整部署的 Compose、Makefile、文档、配置示例和 `ops/`
控制面会先保存恢复快照。构建、启动、健康检查、指针发布或保留清理失败时，工具会恢复
旧控制面，重新构建并启动原 active release，并再次执行健康检查。恢复本身失败不会被
隐藏；错误会同时报告原失败与恢复失败。

失败输出包含经过配置值脱敏的 Compose 日志、active release 和可执行的回滚命令。
Compose 子命令、运维子进程、服务健康轮询和 HTTP 请求都有有限超时。

`RELEASES_TO_KEEP` 默认是 5，且必须至少为 2。每次成功发布后只删除经过名称、类型和
路径验证的非 active release；符号链接、未知目录和 active/直接前一 release 不会被清理。
部署锁保存 PID、主机、时间和随机所有权令牌；同机 owner 进程已经退出的锁可安全回收，
活动锁、无效锁和尚未达到跨主机超时的锁不会被抢占。

## 配置和凭据边界

源同步与 Docker 构建上下文会排除 `.env`/`.env.*`（保留示例）、`.npmrc`、
常见私钥/证书密钥容器以及根运行时数据目录。完整部署只发布明确允许的控制面文件，不会
复制本地 `deploy/config/.env`。不要在代码目录、release 或镜像中保存真实凭据。

`make deploy-code` 只创建应用 release 和执行健康门禁，不写入或删除
`config/.env`、`data/sqlite/`、`data/backups/` 或 `logs/`。
所有 release 都复用同一个 `data/sqlite/` 目录；发布应用代码不会创建另一套业务数据库。

## SQLite 备份与恢复

`make deploy-backup` 使用 SQLite 原生在线备份写入 `0600` 临时文件，执行
`PRAGMA quick_check`，计算 SHA-256，并在通过完整性检查后生成同名的
`.metadata.json`（schema 版本、浏览器数据迁移版本/状态和各业务表记录数），再以原子重命名
发布元数据、校验文件和备份。默认保留天数
从目标 `config/.env` 的 `BACKUP_RETENTION_DAYS` 读取；也可直接运行
`ops/backup-db.sh --retention-days N` 覆盖。清理只处理格式正确、非符号链接的备份及其
checksum/metadata sidecar。
一次性 SQLite 容器使用当前运维用户的 UID/GID，避免在主机备份目录中留下不可管理的
root 所有文件。

`deploy-restore` 只接受绝对路径的普通非符号链接文件；存在 `.sha256` 时必须先通过
校验。工具先创建当前数据库的一致性备份，在同目录临时数据库中恢复并检查完整性，然后
停止应用并原子交换数据库。启动或健康检查失败会换回原数据库、重新启动原应用并再次
检查健康；恢复失败和恢复过程的错误都会保留并报告。

## 数据边界

SQLite 通过 `./data/sqlite:/var/lib/tradereview` 与镜像层隔离，是交易、导入历史、复盘、
行情、设置等业务数据的唯一持久化来源。升级后的浏览器会将旧
`localStorage`/`IndexedDB` 数据一次性迁移到 SQLite；旧浏览器数据仅保留为短期只读回滚副本，
正常运行不再读取或写入它。`make deploy-status` 会显示 active release、监听地址、数据库大小、
schema/data migration 状态、各业务表记录数以及最新备份的校验状态。

Docker Compose 必须已安装并可用。部署前可用
`docker compose --env-file deploy/config/.env.example -f deploy/compose.yaml config --no-env-resolution`
验证模板；生产操作使用目标根目录的 `compose.yaml` 和 `config/.env`。
