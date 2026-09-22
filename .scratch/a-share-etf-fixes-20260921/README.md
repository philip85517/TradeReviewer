# A 股持仓证据与 ETF 市场归因修复

计划：`docs/superpowers/plans/2026-09-21-a-share-etf-fixes.md`

## 任务索引

- [x] [01 - 招商证券证券余额证据](issues/01-china-merchants-position-evidence.md) — complete
- [x] [02 - 市场优先的交易室归因](issues/02-market-first-trading-room-attribution.md) — complete
- [x] [03 - 集成与真实页面验收](issues/03-integration-and-browser-verification.md) — complete

## 当前状态

- 诊断报告：`.scratch/a-share-current-return-diagnosis-20260921/diagnosis.md`
- 当前 worktree：`/Users/zhoulin/.codex/worktrees/ccc5/TradeReview`
- 原始 PDF：只读核验，不在本任务中修改。
- 隔离预览数据库：`/tmp/tradereview-a-share-fix-20260922.sqlite`
- 预览地址：`http://127.0.0.1:3023/`

## 本轮验收结论

- 原始招商证券 PDF 仅作只读输入；3 份用于复核的 PDF SHA-1 为 `04484819bb260e423bf9325c2fed1f6215d432b5`（2026 周霖）、`041391b3aec53cda368392f963a54f9da4d1124c`（2023 周霖）、`b858ab8d2fdce97ac894c2de1f939f99028eecdf`（2023 金小平）；原始数据库仍为 1857 条成交、236 个标的。
- 隔离数据库 `/tmp/tradereview-a-share-fix-20260922.sqlite` 同样为 1857 条成交、236 个标的。
- A 股月结单的“证券余额”已进入持仓证据：159608 的期初数量恢复为 10000/30000/15000，512560 的期初数量为 22400/42400，513010 的期初数量为 92400；A 股成交与持仓证据没有负数量。
- 年度 A 股页面当前显示“暂无样本”是因为 2026 年可见的已平仓回合仍缺少期初成本，不再把销售额冒充收益；当前持仓单独展示。
- 全量回归中唯一仍失败的是仓库原有 BOC parser 测试缺少 `.scratch/trading-room-implementation/reports/boc-source.html` fixture；本轮相关 8 个测试文件 174/174、工作区筛选回归 1/1、类型检查、构建和 `git diff --check` 均通过。
