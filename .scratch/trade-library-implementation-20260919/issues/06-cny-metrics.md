# 06 — 跨币种人民币绩效展示

**What to build:** 按同一快照将净盈亏与开仓金额折算人民币，统一展示汇总与收益率。

**Blocked by:** 04 — 手动刷新汇率与持久化快照；05 — 展示准确的已平仓盈亏与加权收益率

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 跨币种收益率为折算净盈亏合计除以折算开仓金额合计
- [x] 保留原币，刷新后所有指标同快照更新
- [x] 人民币10000赚1000及美元1000亏100，汇率7时结果1.76%
- [x] 缺汇率两侧同时排除并披露样本，不修复历史结算歧义
- [x] 不同模拟运行独立展示，不生成跨运行总收益

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
