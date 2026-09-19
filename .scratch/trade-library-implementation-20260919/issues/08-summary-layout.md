# 08 — 交易库顶部与统计区重排

**What to build:** 紧凑顶部与四个主指标分层展示当前筛选的绩效及复盘进度。

**Blocked by:** 06 — 跨币种人民币绩效展示

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 主指标人民币已平仓净盈亏、加权收益率、胜率、复盘进度
- [x] 次级样本、平均盈亏、盈亏比、利润因子与说明层次清楚
- [x] 数量与绩效范围明确，运行/性质分组不混算，无样本不可用
- [x] 开始复盘仅进入当前筛选内待复盘回合；无目标不跨范围
- [x] 桌面窄屏可读，盈亏色与正负号并用，不重复大横幅

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
