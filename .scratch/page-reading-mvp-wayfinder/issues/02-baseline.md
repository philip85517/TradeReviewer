# 如何建立可复现的现状基线

ID: page-reading-mvp-baseline
Labels: wayfinder:task
Parent: [首页与交易库一秒优化实验决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

如何在不修改业务数据库的前提下建立可重复的隔离基线，并记录浏览器到数据库各段的时间、响应大小、机器和数据规模，以公平比较 MVP 与原实现？

## Scope / Refs

- [既有服务端和客户端分段测量](../../home-trades-recovery-diagnosis-2026-10-28/CONTINUATION-2026-10-28.md)
- [项目数据库与隔离规则](../../../conf/README.md)
- 同一数据副本、版本、环境、请求和浏览器条件下比较；任何写真正隔离路径。历史 34.33 MB 是单样本，不代表新基线。

## 验收标准

- [ ] 留下可重复执行命令、隔离数据库来源和版本、样本体量、服务及浏览器环境，不记录交易明细。
- [ ] 首页和交易库分别记录端到端和可解释的阶段时间，标识真实浏览器、单独探针及无法测量的部分；不跨实验简单加总。
- [ ] 记录冷／热、重启及导入或修订后首读覆盖情况；不能触及暂停范围的场景明确标记 NOT VERIFIED。

## Blocked by

无。
