# 05 — 展示准确的已平仓盈亏与加权收益率

**What to build:** 股票与运行分组展示当前筛选的可信已平仓盈亏和开仓金额加权收益率。

**Blocked by:** 03 — 股票展开回合并进入复盘

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 分子分母来自同一可计算已平仓样本，未知与持仓中排除并解释
- [x] 开仓方向成交金额不含费，净盈亏扣费；支持分批、做空、配售且不重复计入
- [x] 10000赚1000及90000亏900合计收益率0.10%
- [x] 浮盈亏单列并注明行情时点/缺失，不能当已平仓盈亏
- [x] 不同性质、运行独立；先提供原币口径，未知不可零填充

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
