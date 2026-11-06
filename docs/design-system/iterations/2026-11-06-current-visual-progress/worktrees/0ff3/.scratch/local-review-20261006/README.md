# 本地 review 服务 — 2026-10-06

Scope: 获取远端基线、安装依赖、启动当前工作树并交付可检查的本地预览。无功能实现或完整功能验收。

State: closed
Status: accepted
Assignee: coordinator

## 运行信息

- 预览：<http://127.0.0.1:3031/>
- 工作树：`/Users/zhoulin/.codex/worktrees/0ff3/TradeReview`
- 代码：`63690a4`；`git fetch origin master` 成功，HEAD 与 origin/master 一致。
- 环境：Node v26.0.0、npm 11.12.1；`npm ci --no-audit --no-fund` 成功，安装 636 个包。
- 数据库：本目录 `review.sqlite`，通过 SQLite backup API 从配置主库生成；显式 `TRADEREVIEW_DB_PATH`，review 修改仅写入副本。
- 服务：后台独立进程组，npm PID 97600，监听进程 PID 97617；绑定 127.0.0.1:3031。
- 日志：[service.log](service.log)；运行元数据：[service.json](service.json)。

## 启动验收

协调者于 2026-10-06 10:17（Asia/Shanghai）独立核验：

- PASS：首页、SQLite 状态与成交接口 HTTP 200，加载 1866 条成交、236 个标的；见 [HTTP 证据](http-verification.json)。
- PASS：真实 Codex 内置浏览器已打开最终 URL，呈现“我的交易室”、持仓表和历史交易摘要，浏览器 error 日志为空；预览页已保留供用户 review。
- PASS：当前浏览器侧栏窄视口的可见页面渲染完成；这只是服务启动 smoke check，不是整页视觉或响应式验收。
- PASS：监听进程 cwd 与 SQLite 文件句柄指向本工作树及独立副本；交付时服务持续运行。
- PASS：备份 quick_check = ok；原始成交表前后摘要相同；见 [数据库证据](database-backup.json)。
- NOT APPLICABLE：全量功能测试、设计对照、核心写入/回放旅程、真机触屏；本次只交付既有应用的运行环境，没有修改产品功能。

页面可显示行情/估值“暂不可用”及缺口说明。此次启动没有补全历史行情，也未把这些提示认定为功能通过。

## 重启

服务停止后执行：

```bash
bash /Users/zhoulin/.codex/worktrees/0ff3/TradeReview/.scratch/local-review-20261006/start.sh
```

脚本在前台运行，关闭终端或 Ctrl+C 会停止该次服务。保留当前副本，不重新覆盖 review 数据。

任务：[01-start-local-review](issues/01-start-local-review.md)。流程：[开发流程](../../docs/agents/development-workflow.md)。
