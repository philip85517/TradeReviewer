本机部署过去依赖环境中的 Node，SQLite 版本检查只读取编译元数据；worktree 调试也缺少统一端口和独立测试数据入口。本次统一为 `make deploy`（当前已提交 HEAD）和 `make deploy REF=master`（最新远端 master），发布过程记录提交、运行环境和健康状态，并保留失败恢复与回滚能力。

原生入口固定使用配置中的 Node.js 26.0.0，实际查询 SQLite 引擎并要求 3.53.0；运行时缺失或不匹配会在原生操作前失败。`make dev` / `npm run dev` 固定在 127.0.0.1:3333 启动，每次用 WAL-aware 在线备份刷新 `.data/tradereview-test.sqlite`，并显式传给服务。正式业务库及 3022 服务继续保留。

修复全仓单测中的旧 fixture、异步工作区/导航及偏好持久化同步、测试并发与原生端口隔离问题，保留原有行为断言、测试预算和 opt-in 样本条件。未修改产品 UI 行为。

验证：

- 默认 `npm run test:unit`：319 文件、3070 项通过；原有 3 个外部样本文件 / 6 项测试因未提供样本而跳过。
- `make deploy-test`：60/60；`make debug-test`：18/18。
- `npm test`：生产构建及 5/5 隔离集成测试通过。
- 类型检查通过；变更代码 ESLint 0 错误、2 个已有警告。
- 实际 SQLite 版本、源码/安装后的运行时入口、缺失运行时拒绝、安装恢复及独立代码审查通过；最终测试与审查源码哈希一致。

固定运行时来源与复建说明见 `conf/NATIVE-RUNTIME.md`；二进制位于本机独立目录，不提交数据库或运行时二进制。历史失败和最终验收保留在 `.scratch/remote-integration-native-deploy/` 等任务记录。此 PR 不发布新应用版本、不重启当前服务，现有进程的实际 SQLite 版本未重新验证。仓库没有配置 CI，本次合并依据本地验证及独立审查，不报告 CI 通过。
