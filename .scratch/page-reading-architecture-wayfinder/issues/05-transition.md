# 如何验证和切换新读取协议

ID: page-reading-architecture-transition
Labels: wayfinder:grilling
Parent: [首页与交易库页面读取架构决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
Resolution comment: 尚无

## Question

新旧接口如何并行核对、逐步接入和退出旧链路？如何在隔离副本开展桌面、数据准确性和性能独立验收，并在失败时保留可信状态？

## Refs

- [首页与交易库恢复地图](../../home-trades-recovery-wayfinder/issues/00-map.md)
- [后端接口与架构审查稿](../../../docs/backend-design/page-reading-architecture.candidate.md)
- [前端控件与视觉空间诊断规范](../../../docs/agents/frontend-control-audit.md)

## 验收标准

明确迁移前后数据等价、响应体与分段耗时、错误和回退策略、真实桌面操作及 1 秒矩阵；对失败与未验证保留状态。必须有用户真实决策及独立 Resolution。

## Blocked by

- [怎样准备结果才能满足一秒并保持正确](03-computation.md)
- [跨页、数据变更与多来源版本怎样一致](04-consistency.md)
