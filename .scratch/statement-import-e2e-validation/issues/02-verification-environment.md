# 建立可恢复的网页与数据库验收环境

Type: task
Label: wayfinder:task
Status: resolved
Assignee: Codex
Parent: ../map.md
Blocked by: none

## Question

探查已启动服务、浏览器页面和 SQLite 边界，设计并执行可恢复的验证环境准备：清理当前网页会话但保留现有数据库，记录备份/回滚点、服务实例、数据库路径和导入前计数。如何证明后续网页导入读写的是预期实例？

## Answer

- 原有服务继续保留在 `http://localhost:3000`，进程为旧 worktree `/Users/zhoulin/.codex/worktrees/61fb/TradeReview`，数据库为 `/Users/zhoulin/.codex/worktrees/61fb/TradeReview/.data/tradereview.sqlite`；探查前计数为 `executions=3, instruments=1, import_batches=1, reviews=2`，探查后仍保持该计数，未覆盖既有数据。
- 已用 SQLite `.backup` 建立回滚点 `/tmp/tradereview-validation-before.sqlite`，SHA-256 为 `65dd5789ccaa0338047f8e6d2dc5fca031333e91c5de2f8bf70925ad00300511`，备份大小 237568 bytes。恢复时停止验证服务后，将该备份作为验证库回填即可；原生产/旧服务库不参与写入。
- 为当前代码 `8638fc4` 建立隔离验证副本 `/tmp/tradereview-validation.wqk7r1/tradereview.sqlite`，从上述旧库备份而来，导入前计数为 `3/1/1/2`；服务由 `/Users/zhoulin/.codex/worktrees/ad94/TradeReview` 启动在 `http://localhost:3001`，进程工作目录和 `TRADEREVIEW_DB_PATH` 均已核验指向该 worktree 与隔离库。
- 浏览器验证会话使用 in-app browser 的 tab `3` 打开 `http://localhost:3001`；旧的 3000 页面只保留用于确认旧实例未被改写。当前代码的真实文件选择器、月结单核对、证券元数据重试和最终确认路径均已走通。
- 通过网页导入 `/Users/zhoulin/Documents/交易/富途/港股/2024-05.pdf` 后，核验 API 与 SQLite 均为 `executions=6, instruments=3, import_batches=2, reviews=3`；API 返回的新批次为 `futu:c40c843d8ee5977e`，含 3 笔成交和 1 条持仓快照。三笔同一秒、同价成交仍保留独立 `sourceOrder=0/1/2` 与行号 `19/32/45`，证明网页写入的是当前隔离实例且没有错误合并。
- 同一 PDF 再次通过网页文件选择器导入并确认后，SQLite 计数仍为 `6/3/2/3`，同一 `import:futu:c40c843d8ee5977e` 批次被更新而没有新增成交行；这验证了重复导入的写入幂等性。当前预览的“重复成交”显示为 0，是因为相同来源 ID 走 upsert，不是因为产生了第二份交易；后续验收仍需补充同经济字段不同来源文件的语义去重断言。
- 当前样例还暴露出一个待后续票据处理的兼容性问题：来源证券代码为 `06969`，元数据重试返回 `6969`，验证库出现 `HK:06969` 与 `HK:6969` 两个 instrument 行；这不影响本票据的环境边界结论，但必须在后续标的规范化票据中修复，避免复盘分叉。

结论：验证环境已建立且可回滚；3000 旧实例与 3001 当前代码实例、两套数据库边界清晰，真实网页导入和重复导入均已由 API/SQLite 交叉证明。后续票据可以在隔离库继续执行全量与专项验收。
