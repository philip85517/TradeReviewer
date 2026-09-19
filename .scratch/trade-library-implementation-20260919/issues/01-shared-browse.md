# 01 — 统一交易库入口与浏览状态

**What to build:** 首次实盘、股票视图、全部回合；双视图共享已生效筛选，重置和再次进入行为一致。

**Blocked by:** None — can start immediately

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 共用回合级筛选集合，股票按筛选后回合聚合，不泄露其他账户或年份数据
- [x] 首次最近成交在前；重置仅保留性质和视图，其余条件清空且排序归为最近成交
- [x] 恢复上次视图筛选排序；兼容既有浏览状态，不改变原始成交
- [x] 切换交易性质清除不兼容来源、账户、运行并提示

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
