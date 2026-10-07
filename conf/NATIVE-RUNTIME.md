# 固定原生环境

本机固定 Node.js `26.0.0` 和它实际加载的 SQLite `3.53.0`。`conf/native-environment.json` 保存绝对执行文件路径；标准调试和发布入口读取该路径，再由 `assertNativeEnvironment()` 在内存数据库中查询 `sqlite_version()`。`process.versions.sqlite` 是编译元数据，不能证明动态链接的库版本。数据库迁移版本是另一项信息。

2026-10-07 实测原 Homebrew Node 的编译元数据为 SQLite 3.53.0，实际加载 Homebrew SQLite 3.53.1；官方 Node 26.0.0 发行包实际为 SQLite 3.51.3。因此本机保留原确认的版本要求，使用新建的独立副本：

```text
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/
  bin/node
  bin/npm -> ../libexec/lib/node_modules/npm/bin/npm-cli.js
  bin/npx -> ../libexec/lib/node_modules/npm/bin/npx-cli.js
  lib/libnode.147.dylib
  lib/libsqlite3.dylib
  libexec/lib/node_modules/npm/
  tradereview-provenance.json
```

该副本未覆盖系统 Node、Homebrew 文件或现有服务。其他动态库仍依赖本机 Homebrew/系统环境；这不是可迁移至任意机器的完整运行时包。二进制不纳入 Git。新机器需要准备满足要求的运行时和配套 npm，更新执行文件路径并完成实际 SQL 校验，不能仅安装官方 Node 26 就视为符合要求。

## 来源与复建

Node、libnode 和 npm 来自本机 `/usr/local/Cellar/node/26.0.0`。SQLite 源码为[官方 3.53.0 amalgamation](https://www.sqlite.org/2026/sqlite-amalgamation-3530000.zip)，其中 `sqlite3.c` 的 SHA3-256 必须匹配[官方发布记录](https://www.sqlite.org/releaselog/3_53_0.html)：

```text
bb317fbbd2b3bc53233ddd5894bf4d2dc6f533445f350d4235dbcc86f65af4ec
```

在自己新建的临时目录解压并核对源文件哈希后，使用 Apple clang 编译：

```bash
clang -O2 -dynamiclib -fPIC -compatibility_version 9.0.0 -current_version 9.6.0 \
  -o libsqlite3.dylib sqlite-amalgamation-3530000/sqlite3.c \
  -DSQLITE_ENABLE_API_ARMOR -DSQLITE_ENABLE_COLUMN_METADATA \
  -DSQLITE_ENABLE_DBSTAT_VTAB -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS \
  -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_GEOPOLY -DSQLITE_ENABLE_MATH_FUNCTIONS \
  -DSQLITE_ENABLE_MEMORY_MANAGEMENT -DSQLITE_ENABLE_PERCENTILE \
  -DSQLITE_ENABLE_PREUPDATE_HOOK -DSQLITE_ENABLE_RTREE -DSQLITE_ENABLE_SESSION \
  -DSQLITE_ENABLE_STAT4 -DSQLITE_ENABLE_UNLOCK_NOTIFY -DSQLITE_USE_URI \
  -DSQLITE_MAX_VARIABLE_NUMBER=250000
```

将 Node、libnode、上述 SQLite 库、配套 npm 拷贝到一个尚不存在的新运行时目录，按上面的布局创建 npm/npx 链接。只修改该副本的 Mach-O 依赖：

| 文件 | 原依赖 | 新依赖 |
| --- | --- | --- |
| bin/node | @rpath/libnode.147.dylib | @loader_path/../lib/libnode.147.dylib |
| bin/node | /usr/local/opt/sqlite/lib/libsqlite3.dylib | @loader_path/../lib/libsqlite3.dylib |
| lib/libnode.147.dylib | /usr/local/opt/sqlite/lib/libsqlite3.dylib | @loader_path/libsqlite3.dylib |

使用 `install_name_tool -change <原依赖> <新依赖> <副本文件>`，并用 `install_name_tool -id @loader_path/libsqlite3.dylib <副本SQLite库>` 设置库 ID。对 SQLite、libnode、node 依次执行 `codesign --force --sign - <文件>` 并 `codesign --verify --strict <文件>`。不要修改 Homebrew 源文件或全局软链接。

取消 `DYLD_*` 覆盖后，直接调用新副本的 `bin/node`，同时检查 `process.versions.node`、`process.execPath` 和 `SELECT sqlite_version(), sqlite_source_id()`。本机 SQL source ID 为：

```text
2026-04-09 11:41:38 4525003a53a7fc63ca75c59b22c79608659ca12f0131f52c18637f829977f20b
```

完整 clang 命令保存在 [SQLite 构建凭据](../.scratch/remote-integration-native-deploy/reports/sqlite3530-private-probe.json)；复制及链接命令、已签名文件哈希、依赖和实测结果保存在 [运行时凭据](../.scratch/remote-integration-native-deploy/reports/pinned-entrypoints-runtime.json) 以及运行时目录的 `tradereview-provenance.json`。标准入口仍每次执行实际引擎校验；依赖变动导致不符合要求时会失败。

本次 Git 合并不等于正式部署。已安装的旧运维工具和运行中的旧进程不会因源码合并而改变；历史记录缺少实际 SQL 证据时保留未知状态。
