# 真实业务库运行入口

已在工作树根目录验证，当前服务 PID 29149 / 会话 97376，地址 [http://127.0.0.1:3333/trades](http://127.0.0.1:3333/trades)。如需重新启动，先停止占用该端口的本任务服务；冲突时失败，不另换端口。

```sh
env -u NODE_OPTIONS -u TRADEREVIEW_DB_PATH \
  TRADEREVIEW_RUNTIME_CONFIG="$PWD/conf/runtime.json" \
  PATH="/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin:$PWD/node_modules/.bin:$PATH" \
  WRANGLER_LOG_PATH=.wrangler/wrangler.log \
  /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node \
  scripts/start-local.mjs --dev --hostname 127.0.0.1 --port 3333
```

前提：cwd 为 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。沿 `conf/runtime.json` 解析 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`。配置文件默认端口 3022 保留，命令显式使用当前网页端口 3333。Node 26.0.0 / SQLite 3.53.0。

标准 `make dev` / `npm run dev` 会创建并接入 `.data/tradereview-test.sqlite` 隔离快照，适合开发及写验收；它们不是本次真实业务库连接命令。重启标准调试会清除前次隔离修改。

当前服务具有既有自动复盘保存和标的名称缓存写入，浏览不等于数据库只读。不得在真实库上做写入验收；写验收必须显式设置 `TRADEREVIEW_DB_PATH` 为隔离库。[已观察副作用](DIAGNOSIS.md)仍未修复。
