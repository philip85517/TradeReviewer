# Docker Compose 部署指南

部署命令应从本仓库的工作副本运行。默认目标目录为
`/Users/zhoulin/projects/TradeReview`；可通过 `DEPLOY_ROOT=/绝对路径` 覆盖。
目标目录不能是源仓库或其子目录。

## 首次部署

先在目标目录创建仅本机保存的配置，再按需编辑它；该命令只会在 `.env` 不存在时复制示例，绝不会覆盖已有配置。

```bash
make deploy-config
$EDITOR /Users/zhoulin/projects/TradeReview/config/.env
make deploy
make deploy-status
```

`make deploy` 创建一个新的 `app/releases/<release-id>`，用 Docker Compose 构建并启动它，健康检查成功后才原子更新 `app/current`。每个会改变部署状态的命令结束时都会打印目标目录和当前 release。

默认只监听 `127.0.0.1:3000`。若需要反向代理或公开访问，请在目标的 `config/.env` 中明确修改 `APP_BIND` 和 `APP_PORT`，然后运行 `make deploy`。

## 日常操作

```bash
make deploy-code                 # 仅发布应用代码
make deploy-status               # release、服务、绑定和 SQLite 状态
make deploy-backup               # 一致性 SQLite 备份到 data/backups/
make deploy-restore BACKUP=/absolute/path/to/backup.sqlite
make deploy-rollback             # 切换到前一个保留 release，并经健康检查确认
make deploy-down                 # 停止 Compose 服务（不会删除数据或 release）
make deploy                      # 再次构建并启动当前源代码
```

`deploy-restore` 需要绝对路径的常规文件；若同名 `.sha256` 文件存在，会先验证校验和。恢复前会额外创建备份，原备份和恢复前备份都会保留。`make deploy-restore` 在调用部署工具前检查 `BACKUP` 是否已设置。

## 数据与配置边界

代码发布只会写入 `app/releases/` 和临时 release 指针。它不会读取、复制、删除、迁移或覆盖目标的 `config/.env`、`data/sqlite/`、`data/backups/` 或 `logs/`。完整部署同样保留这些路径；它仅更新部署模板和 release 内容。

部署操作使用目标根目录的排他锁，若已有部署正在运行，第二个操作会立即失败而不是并发修改 release。构建、启动或健康检查失败时，旧 release 保持活动状态；失败候选 release 会被移除，不会触碰用户数据。

SQLite 通过 `./data/sqlite:/var/lib/tradereview` 与应用镜像隔离。该边界只保护服务端 SQLite 文件；浏览器的 localStorage 和 IndexedDB 仍是每台浏览器本机的数据，部署不会把它们迁移或同步到服务端。

Docker Compose 必须已安装并可用。部署脚本会使用目标下的 `compose.yaml` 和 `config/.env`；不要提交该 `.env` 文件，也不要把真实配置复制到镜像或仓库。
