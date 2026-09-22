# 通过网页人工导入验证月结单的端到端验收地图

Label: wayfinder:map
Status: open

## Destination

在不删除现有服务端数据库的前提下，清理浏览器验证会话，通过已启动服务的真实网页人工导入路径导入 `/Users/zhoulin/Documents/交易` 中当前 PDF；用数据库和内部解析结果证明导入可复盘、同文档重导幂等、真实多笔成交不被误删，并合理表达新股配售、暗盘/OTC 与后续买卖。

## Notes

- 领域为 TradeReview 的月结单导入、持仓证据、交易回合和行情回放；沿用 `CONTEXT.md` 的术语。
- 主要操作必须走网页文件选择、预览、确认；数据库/API 只用于备份、读取和验收，不替代人工导入。
- “清理网页”只清理当前浏览器会话；服务端数据库先保留，并使用可恢复的验证数据边界。
- 原始 PDF 只读，不上传到仓库、不改写、不把账户或逐笔原文复制到验收文档。
- 复用历史月结单设计与时间证据：`docs/superpowers/specs/2026-09-07-monthly-statement-import-design.md`、`docs/research/monthly-statement-template-evidence.md`、`docs/research/monthly-statement-time-evidence.md`。
- 不把抽样通过当作全量通过；验收报告必须分别给出文件、成交、持仓、辅助流水、重复和 IPO 结果。

## Decisions so far

- [冻结当前 PDF 语料与验收样本](issues/01-corpus-inventory.md) — 已冻结 207 份 PDF 的文件边界、内容/语义重复样本、支持状态、时间精度及 P0/P1 验收样本；后续重复导入必须同时验证内容哈希与语义签名。
- [建立可恢复的网页与数据库验收环境](issues/02-verification-environment.md) — 已验证旧服务 `:3000` 与当前代码隔离服务 `:3001` 使用不同数据库；保留 SQLite 回滚点，并通过真实网页完成样例导入与重复导入幂等性验证。样例暴露的 `06969/6969` 标的键规范化问题转入后续票据。

## Not yet specified

- 当前服务运行状态、浏览器会话和 SQLite 实例如何安全区分；需要先探查运行状态。
- 同一文件修订、相同内容副本、同经济字段的真实多笔成交，在当前数据库中的具体对账口径需要结合样本确认。
- 配售事件与暗盘/OTC 成交在实际 PDF 中的证据形态、回放锚点和后续卖出关联，需要抽样原件后定案。
- 数据库行、内部 `TradeExecution`/`TradeEpisode` 和来源证据之间的最终验收不变量，需要看到运行结果后补充。

## Out of scope

- 删除、覆盖或迁移现有生产数据库；本次只允许可恢复的验证边界。
- 绕过网页人工路径直接把 PDF 解析结果写入数据库作为主验收方式。
- 修改原始 PDF、上传券商原件、报税/现金净值完整复刻，以及非股票/ETF 独立回放。
