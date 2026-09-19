# 07 — 表头排序与模拟运行限制

**What to build:** 两视图以表头控制最近成交、人民币盈亏与收益率升降序。

**Blocked by:** 02 — 高级筛选抽屉与来源平台筛选；06 — 跨币种人民币绩效展示

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 时间按入选回合最近成交；同值稳定，未知置后
- [x] 模拟盘明确选定一次运行才允许绩效排序
- [x] 清除运行时绩效排序直接归为最近成交，不记忆旧偏好
- [x] 重置排序同步更新表头与列表，窄屏等价控件可用
- [x] 汇率刷新后按当前排序统一重排，不改统计样本

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
