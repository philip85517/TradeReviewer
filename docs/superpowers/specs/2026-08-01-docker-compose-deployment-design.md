# TradeReview Docker Compose 部署设计

日期：2026-08-01

## 目标

增加一键部署能力：在工程当前目录执行 `make deploy`，默认将完整部署工程发布到 `/Users/zhoulin/projects/TradeReview`。部署目录包含代码、Docker Compose 服务定义、配置模板、SQLite 存储目录、日志目录、备份目录和运维脚本。

本期不改变 TradeReview 当前以浏览器 `localStorage`/IndexedDB 保存交易、复盘草稿和行情缓存的数据模型。SQLite 作为独立的部署存储基础，提供初始化、备份、恢复和健康检查能力，为后续服务端数据迁移保留边界。

## 部署边界

SQLite 采用卷级隔离。SQLite 不是网络数据库服务，因此应用容器通过固定数据目录访问 SQLite 文件；隔离目标是让代码发布、镜像层和配置同步不触碰数据卷。若未来要求应用完全不接触数据库文件，需要另行迁移到 PostgreSQL 或增加数据库 API 服务。

目标目录结构：

```text
/Users/zhoulin/projects/TradeReview/
├── app/
│   ├── releases/<release-id>/
│   └── current -> releases/<active-release>
├── config/
│   ├── .env
│   └── .env.example
├── data/
│   ├── sqlite/
│   └── backups/
├── logs/
├── ops/
│   ├── deploy.sh
│   ├── backup-db.sh
│   ├── restore-db.sh
│   └── healthcheck.sh
├── compose.yaml
├── Makefile
└── DEPLOYMENT.md
```

`config/.env` 首次从模板生成，后续部署永不覆盖。默认应用绑定 `127.0.0.1:3000`；公网域名、HTTPS 和反向代理均需显式配置。

## 命令契约

```bash
make deploy
```

完整部署创建缺失目录，初始化配置和 SQLite 目录，同步代码、Dockerfile、Compose 文件和运维脚本，构建并启动应用，执行健康检查。它保留已有 `.env`、SQLite 文件、备份和日志，不执行数据库恢复或删除。

```bash
make deploy-code
```

仅代码覆盖只创建新的应用 release，同步代码和构建上下文，构建/重启应用容器并在健康检查通过后切换 `app/current`。它不读取、复制、删除或迁移 `data/`，不覆盖 `.env`，不修改备份和日志。

辅助命令：

```bash
make deploy-status
make deploy-backup
make deploy-restore BACKUP=/absolute/path/backup.sqlite
make deploy-rollback
make deploy-down
make deploy-config
```

`deploy-rollback` 只回退应用 release，不回滚数据库。数据库恢复必须通过显式的 `deploy-restore` 执行，并先创建当前数据库的安全副本。

## Compose 与发布流程

Compose 提供应用服务和 SQLite 存储边界。应用镜像使用 Node.js 22 构建，运行现有 `npm run start`；配置以只读方式注入，数据目录单独挂载。SQLite 初始化、权限检查和一致性备份由 `ops/` 脚本完成。

每次代码发布使用时间戳或 Git SHA 作为 release ID。脚本先在新目录同步并构建，只有健康检查通过才原子切换 `current` 并重启应用。旧 release 保留最近 5 个，供代码回滚使用。

部署脚本必须：

- 使用绝对路径并拒绝源目录等于目标目录。
- 使用部署锁，防止并发发布。
- 将同步删除范围限制在新建的 `app/releases/<release-id>`。
- 在构建、启动或健康检查失败时保留旧版本。
- 输出容器日志、当前 release 和可执行的回滚命令。

## 配置与数据安全

配置变量至少包括 `APP_PORT`、`APP_BIND`、`COMPOSE_PROJECT_NAME`、`RELEASES_TO_KEEP` 和 `BACKUP_RETENTION_DAYS`。`.env` 不进入代码同步、不进入镜像、不进入 Git。

SQLite 备份使用原生一致性备份方式，保存到带时间戳和校验和的 `data/backups/`。普通部署不覆盖数据库；恢复失败或校验失败时不得替换原文件。

## 验证策略

自动化测试覆盖：首次初始化、重复部署、代码-only 不触碰存储、配置保留、路径安全、并发锁、构建失败不切换、健康检查失败不切换、release 回滚、SQLite 备份和恢复。

部署验收还需在临时目标目录运行 `make deploy`、`make deploy-code`、`make deploy-status` 和 `make deploy-rollback`，检查应用健康、容器状态、`.env` 内容、SQLite 文件校验和数据目录快照均符合预期。
