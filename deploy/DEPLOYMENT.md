# 本机发布指南

正式部署目录是 `/Users/zhoulin/projects/交易空间/TradingReview`，入口为
`http://127.0.0.1:3022/`。正式业务库由 `conf/runtime.json` 和部署侧
`config/runtime.json` 指向 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`。
本机默认采用原生 Node 生产服务。发布命令统一选择已提交的 Git 快照，并保存提交号；
`package.json` 的版本号不能单独证明两份代码一致。

原生环境固定为 Node.js `26.0.0`、加载的 SQLite `3.53.0`，依据项目
`conf/native-environment.json` 和 `.node-version` 校验。安装、构建和启动使用同一 Node
执行文件及 lockfile 的 `npm ci`；版本不符时在发布产生副作用前退出。SQLite 引擎版本
与数据库迁移结构版本分别核对。

源码侧 `scripts/native-node.sh` 和部署侧 `ops/native-node.sh` 从各自的环境配置读取
绝对 Node 路径；配置文件或执行文件缺失会失败。校验在内存库中查询 `sqlite_version()`，
不将编译元数据当作实际引擎版本。本机使用独立的 Node/SQLite 副本，来源和复建步骤见
[固定原生环境](../conf/NATIVE-RUNTIME.md)。更新源码不会自动替换已安装的运维工具或重启服务。

## 发布命令

在任意 TradeReview Git 工作副本执行：

```bash
make deploy                              # 当前 worktree 已提交 HEAD；支持 detached HEAD
make deploy REF=master                   # 刷新并部署 origin/master
make deploy REF=codex/example             # 指定本地分支
make deploy REF=<commit-sha>              # 指定已存在的提交
make deploy REF=master DRY_RUN=1          # 预览来源和目标，不起停服务或修改部署目录
make deploy-status                       # 检查发布元数据、实际进程、HTTP 和一致性
make deploy-rollback                     # 恢复上一个成功发布版本
make deploy-down                         # 停止已确认属于此目标的服务
make deploy-test                         # 发布工具的隔离自动化测试
```

`REF=current` 是默认值，表示执行命令所在工作副本的 HEAD。
当前源码有未提交改动时发布拒绝执行，先提交需要发布的修改再执行；未跟踪的应用源码
同样不能静默遗漏，构建产物、依赖、任务记录和业务数据不作为发布来源。
显式分支或提交部署其已提交快照，不受另一个工作副本的未提交改动影响。
`REF=master` 始终获取最新 `origin/master`，获取失败即失败，不回退到旧本地 master。
发布不切换开发分支，不快进或合并本地 master，也不执行 Git push。

`deploy-code` 是原生 `deploy` 的兼容别名。参数使用 Make 变量形式，例如
`REF=master`，不是 `make deploy master`。部署前本机需要固定版本 Node.js、npm、Git、tar、lsof
和 ps；依赖安装需要能访问 npm registry。

## 配置与目录

```text
TradingReview/
├── app/
│   ├── releases/<release-id>/   # 不可变源码快照、独立 node_modules、dist、release.json
│   └── current -> releases/<active-release>
├── config/runtime.json         # 已存在配置优先，发布保留
├── data/backups/               # 独立持久目录
├── logs/                       # 构建/服务日志
├── ops/                        # 发布工具与 start-native.command
├── Makefile
└── DEPLOYMENT.md
```

`DEPLOY_ROOT=/absolute/path` 可选择另一个部署目标，`DEPLOY_SOURCE=/absolute/git/worktree`
可选择源码仓库。目标根不能是源码仓库或普通子目录；配置、release、操作目录中的危险
符号链接会被拒绝。初次部署可从项目 `conf/runtime.json` 初始化配置，配置的数据库必须
已经存在，不会创建空白业务库。已有目标的 `config/runtime.json` 不被源码配置覆盖。

发布使用目标 runtime 配置。调用 shell 设置了 `TRADEREVIEW_DB_PATH` 或
`TRADEREVIEW_RUNTIME_CONFIG` 时，发布、回滚和停止命令会拒绝执行；请先清除它们。配置监听地址
限回环地址；端口被无关进程占用时失败，不停止该进程、不自动更换正式端口。

部署目标的 `make deploy-status`、`make deploy-rollback`、`make deploy-down` 可直接执行。
在目标侧再次发布，需要显式指定 Git 工作副本，因为 release 是不含 `.git` 的快照：

```bash
make -C /Users/zhoulin/projects/交易空间/TradingReview deploy \
  DEPLOY_SOURCE=/absolute/path/to/TradeReview REF=master
```

## 发布事务与版本核对

每个新 release 来自准确的 Git 提交，排除依赖、构建产物、业务库、任务目录和私密配置。
发布先独立执行 `npm ci`、`npm run build`，此时旧服务继续运行。构建成功后，工具重新
核对正式端口上的进程归属，停止旧服务并在同一端口启动新 release；该阶段有短暂停机。
通过实际监听 PID、物理工作目录、首页和 `/api/storage/status` 的只读健康检查后，才原子
切换 `app/current`。部署后服务在后台持续运行，日志位于目标 `logs/`。

`release.json` 记录完整 Git 提交号、来源 ref/分支、应用版本、构建时间及前一成功 release。
`make deploy-status` 将指针/版本记录与真实运行目录、PID 和健康状态对照。
新发布记录还包含实际 Node/SQLite 引擎版本和 Node 执行文件路径；历史记录缺少这些字段时显示未知，不补造历史运行信息。
缺少元数据的历史 release 显示版本未知，不能只从目录名字猜测完整提交号。
自动回滚要求当前和前一 release 都有完整、成功验收的元数据；首次接管旧部署后，
无法自动回滚到缺少元数据的旧 release。旧目录会保留，但不要凭目录名补造提交记录。

构建失败保持旧服务；启动、健康检查或发布失败会清理候选进程并恢复旧版本。
恢复失败时同时报告发布错误与恢复错误。发布锁覆盖构建、切换、控制文件更新和恢复，
活动部署不能并发执行。保留策略沿用现有 `RELEASES_TO_KEEP`（默认 5，至少 2），
始终保留当前和直接前一 release，只清理名称与路径经过核对的托管目录。

`deploy-rollback` 使用前一成功版本记录，执行相同进程和健康门禁；失败恢复回滚前版本。
代码回退不恢复数据库内容，数据库迁移须保持与保留版本兼容。备份与数据恢复是独立操作。
发布不覆盖数据库、已有 runtime 配置、备份或历史日志，也不共享旧 release 的依赖目录。

## 桌面启动与隔离验收

标准 worktree 调试执行 `make dev` 或 `npm run dev`，固定使用 `127.0.0.1:3333` 和
`.data/tradereview-test.sqlite`。每次启动先从在线正式库制作一致性备份并验证；重启重置
此前测试修改。端口、测试库占用或备份失败时直接退出，不自动换端口或连接正式库。
自动化测试自建隔离库、使用独立端口时调用底层 `scripts/start-local.mjs`，见源码
[运行配置](../conf/README.md)。

桌面 `tradeReview.command` 继续使用统一目录的 `ops/start-native.command`。
若正式服务已健康运行，双击只打开页面。若服务未运行，启动器在 Terminal 前台启动它；
这种手工启动的服务关闭窗口时停止。`make deploy` 启动的后台服务不依赖该窗口，使用
`make deploy-down` 停止。更新桌面副本：

```bash
install -m 755 deploy/ops/tradeReview.command "$HOME/Desktop/tradeReview.command"
```

发布验收使用唯一临时部署目录、独立 runtime 配置、独立数据库和空闲端口。应用测试
必须显式设置 `TRADEREVIEW_DB_PATH`；需要真实样本时通过 SQLite backup API 制作一致性
备份，不能直接复制活跃 `.sqlite` 文件而遗漏 WAL。发布工具的测试只清理自己创建的资源。

原生数据库备份应使用 SQLite backup API 或 SQLite CLI 的 `.backup`，备份后执行
`PRAGMA quick_check`。数据恢复前需要停止所有使用该数据库的进程。Docker 的备份/恢复
脚本依赖容器生命周期，不能用来恢复正在由原生 Node 使用的正式数据库。

## 显式 Docker 运维

原 Docker 实现继续保留，源工作副本通过 `make deploy-docker` 和
`make deploy-docker-*` 使用。仅未带原生配置、CLI 或启动器的旧 Docker 目标自动使用
Docker 后端；原生目标缺少控制文件时会失败。原生目标的无后端备份、恢复、配置命令会明确拒绝，避免误用。
以下规则仅适用于 Docker 目标；不要同时在同一端口启动 Docker 与原生服务。

# Docker Compose 后端

默认部署根目录是 `/Users/zhoulin/projects/交易空间/TradingReview`；可在源代码工作副本中通过
`DEPLOY_ROOT=/绝对路径` 覆盖。目标目录不能是源仓库或其普通子目录。完整部署完成后，
目标根目录也包含独立的 `Makefile` 和 `ops/deploy.sh`，因此状态、备份、恢复、回滚、
停止以及基于当前 release 的再次部署可以直接在目标根目录执行。

### 目标目录

```text
/Users/zhoulin/projects/交易空间/TradingReview/
├── app/
│   ├── releases/<release-id>/
│   └── current -> releases/<active-release>
├── config/
│   ├── .env
│   └── .env.example
├── data/
│   ├── backups/
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

### 首次部署与重复部署

在源代码工作副本执行：

```bash
make deploy-docker
make deploy-docker-status
```

第一次 `make deploy-docker` 会自动创建完整目录、`config/.env.example`、权限为 `0600`
的 `config/.env`、SQLite/备份/日志目录以及初始 SQLite 文件，然后才调用 Compose。
若部署前需要修改端口等配置，可先执行：

```bash
make deploy-docker-config
$EDITOR /Users/zhoulin/projects/交易空间/TradingReview/config/.env
make deploy-docker
```

`deploy-config` 和重复的完整部署都不会覆盖已有 `config/.env`。完整部署也不会覆盖
外置 `SQLITE_HOST_DIR` 中的 SQLite、备份或日志。未配置 `SQLITE_HOST_DIR` 的旧部署继续使用
`./data/sqlite`。默认只监听 `127.0.0.1:3022`；公网域名、HTTPS、反向代理及
`APP_BIND=0.0.0.0` 均需明确配置。

Docker runtime 镜像默认使用 `mirrors.aliyun.com` 安装 SQLite CLI，以适配当前网络对
`deb.debian.org` 的访问限制；可在目标 `config/.env` 中将 `DEBIAN_MIRROR` 改为可访问的
Debian 镜像主机名后重新部署。镜像地址只接受主机名，不接受路径、协议或命令字符。

### 日常操作

可从源工作副本运行下列命令；完整部署后，也可在目标根目录运行相同目标：

```bash
make deploy-docker-code
make deploy-docker-status
make deploy-docker-backup
make deploy-docker-restore BACKUP=/absolute/path/to/backup.sqlite
make deploy-docker-rollback
make deploy-docker-down
make deploy-docker
```

目标根目录的 `deploy`/`deploy-code` 以 `app/current` 为源创建一个新 release；
源工作副本中的命令以当前工作副本为源。所有脚本路径和自定义部署根目录都会按独立参数
引用，不依赖调用者的当前相对路径。

### 发布、失败恢复与保留

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

### 配置和凭据边界

源同步与 Docker 构建上下文会排除 `.env`/`.env.*`（保留示例）、`.npmrc`、
常见私钥/证书密钥容器以及根运行时数据目录。完整部署只发布明确允许的控制面文件，不会
复制本地 `deploy/config/.env`。不要在代码目录、release 或镜像中保存真实凭据。

`make deploy-docker-code` 只创建应用 release 和执行健康门禁，不写入或删除
`config/.env`、`data/sqlite/`、`data/backups/` 或 `logs/`。
所有 release 都复用同一个 `SQLITE_HOST_DIR` 目录；发布应用代码不会创建另一套业务数据库。

### SQLite 备份与恢复

`make deploy-docker-backup` 使用 SQLite 原生在线备份写入 `0600` 临时文件，执行
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
检查健康；恢复失败和恢复过程的错误都会保留并报告。恢复前必须停止所有使用该 SQLite
文件、WAL 或 SHM 的数据库消费者；脚本会在停止 Compose 应用后检查仍打开的文件，无法
检查或仍有消费者时拒绝交换并保持原库不变。

### 数据边界

SQLite 通过 `${SQLITE_HOST_DIR:-./data/sqlite}:/var/lib/tradereview` 与镜像层隔离，是交易、导入历史、复盘、
行情、设置等业务数据的唯一持久化来源。升级后的浏览器会将旧
`localStorage`/`IndexedDB` 数据一次性迁移到 SQLite；旧浏览器数据仅保留为短期只读回滚副本，
正常运行不再读取或写入它。`make deploy-docker-status` 会显示 active release、监听地址、数据库大小、
schema/data migration 状态、各业务表记录数以及最新备份的校验状态。

Docker Compose 必须已安装并可用。部署前可用
`docker compose --env-file deploy/config/.env.example -f deploy/compose.yaml config --no-env-resolution`
验证模板；生产操作使用目标根目录的 `compose.yaml` 和 `config/.env`。
