# 运行时配置

`runtime.json` 是本机正式业务配置，记录绝对 SQLite 数据库路径、3022 端口和主机名。项目版本包含此文件后，各个并行工作树会解析到同一个物理业务数据库路径；已有的旧工作树不会自动获得新版本中的配置。

`native-environment.json` 与项目 `.node-version` 固定 Node.js `26.0.0`、加载的 SQLite `3.53.0`。标准调试和发布入口通过 `scripts/native-node.sh`（部署侧 `ops/native-node.sh`）读取配置的绝对执行文件路径；文件缺失会失败。原生发布及标准调试在产生副作用前查询 `sqlite_version()` 校验实际引擎，不使用 `process.versions.sqlite` 代替。数据库结构版本仍由迁移管理。独立运行时来源和安装说明见 [固定原生环境](NATIVE-RUNTIME.md)。

标准 worktree 调试使用 `make dev` 或 `npm run dev`，固定监听 `127.0.0.1:3333`。每次启动只读打开本项目 `runtime.json` 指向的在线库，通过 SQLite backup API 制作包含 WAL 的一致性备份，验证后原子替换 `.data/tradereview-test.sqlite`，并显式传给调试服务。重启会重置此前测试修改；端口占用、测试库被使用、危险路径或备份失败会直接退出。标准入口拒绝端口、数据库和配置覆盖。

解析优先级如下：显式 `TRADEREVIEW_DB_PATH` → 显式 `TRADEREVIEW_RUNTIME_CONFIG` → 项目 `conf/runtime.json` → 本机 `~/.config/tradereview/runtime.json` → 兼容默认值。`NODE_ENV=test` 会跳过项目和本机的隐式配置；测试需要配置时，必须显式设置 `TRADEREVIEW_RUNTIME_CONFIG` 指向隔离配置，测试写入仍必须显式设置隔离的 `TRADEREVIEW_DB_PATH`。

正式数据库必须已存在，错误配置会直接失败，不会回退或创建空库。开发、浏览器验收和并行任务需要写入时，先创建一致性备份，再通过 `TRADEREVIEW_DB_PATH` 指向独立数据库。

自动化或特殊浏览器验收可绕过标准调试入口，调用底层启动器并自建隔离库：

```bash
TRADEREVIEW_DB_PATH=/absolute/path/to/isolated.sqlite \
  PATH="$PWD/node_modules/.bin:$PATH" \
  node scripts/start-local.mjs --dev --hostname 127.0.0.1 --port 3031
```

3031 仅为特殊验收示例。底层启动器不自动备份，调用方须准备、校验和清理自己拥有的数据库，不能将外部业务库当作测试清理目标。
