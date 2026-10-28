# 优先实验哪些计算和读取方式

ID: page-reading-mvp-candidate
Labels: wayfinder:task
Parent: [首页与交易库一秒优化实验决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

结合代码、审查和用户提出的导入时更新，筛选最值得先验证的最小方案：现有全量读取、仅轻量接口、变更后预先准备结果及混合方案的收益、成本和反例各是什么？明确实验假设、首批可复用结果、暂停范围和不允许简化的页面要求。

## Scope / Refs

- [独立审查报告](../../../docs/backend-design/page-reading-architecture-review-2026-10-29.md)
- [34 MB 样本和协议分析](../../home-trades-recovery-diagnosis-2026-10-28/PROTOCOL-REVIEW.md)
- [结果准备原决策](../../page-reading-architecture-wayfinder/issues/03-computation.md)
- 这是实验候选筛选，不关闭原有结果准备决策，也不作最终架构决定。

## 验收标准

- [ ] 对照候选路线，给出推荐及可证伪假设、预计收益路径、成本和不适合提前计算的部分，链接分析证据。
- [ ] 按首页与交易库区分必须保留的功能、字段、范围、未知/错误和追溯；指出尚未定稿的页面合同。
- [ ] 明确哪些子实验不触及暂停范围；不可直接复用实验假定为产品规则。

## Blocked by

无。
