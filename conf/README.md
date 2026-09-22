# 运行时配置

`runtime.json` 是本机开发的主配置，记录正式 SQLite 数据库路径、监听端口和主机名。项目版本包含此文件后，各个并行工作树会解析到同一个物理数据库路径；已有的旧工作树不会自动获得新版本中的配置。

解析优先级如下：显式 `TRADEREVIEW_DB_PATH` → 显式 `TRADEREVIEW_RUNTIME_CONFIG` → 项目 `conf/runtime.json` → 本机 `~/.config/tradereview/runtime.json` → 兼容默认值。`NODE_ENV=test` 会跳过项目和本机的隐式配置；测试需要配置时，必须显式设置 `TRADEREVIEW_RUNTIME_CONFIG` 指向隔离配置，测试写入仍必须显式设置隔离的 `TRADEREVIEW_DB_PATH`。

正式数据库必须已存在，错误配置会直接失败，不会回退或创建空库。开发、浏览器验收和并行任务需要写入时，先创建一致性备份，再通过 `TRADEREVIEW_DB_PATH` 指向独立数据库。
