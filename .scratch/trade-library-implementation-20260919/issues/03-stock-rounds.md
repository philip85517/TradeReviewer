# 03 — 股票展开回合并进入复盘

**What to build:** 股票行原地展开独立回合，模拟运行分组，定位复盘并恢复浏览位置。

**Blocked by:** 01 — 统一交易库入口与浏览状态

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 同股跨账户合行，身份以证券标识为准不凭名称
- [x] 模拟盘同股按运行分组，不合并实验结果，友好名称与短号区分同股运行
- [x] 回合标明账户、起止时间、成交数、状态，点击进入准确回合
- [x] 返回恢复展开及滚动位置；包含已复盘回合仅放宽该股复盘状态，保留其他条件与全局汇总
- [x] 复盘保存后进度同步；原名次级可查

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
