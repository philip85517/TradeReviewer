# 如何建立可复现的现状基线

ID: page-reading-mvp-baseline
Labels: wayfinder:task
Parent: [首页与交易库一秒优化实验决策地图](00-map.md)
Mode: AFK
State: open
Status: in-progress
Assignee: root
集成负责人: 主协调者
Resolution comment: 尚无

当前进展：[真实数据副本基线与桌面读取观察](../real-baseline-2026-10-29.md)。桌面首页与交易库均复现读取超时；完整首屏端到端时间、热访问及数据变更后的首次读取仍未验证，本任务不关闭。

2026-10-29 补充：独立组合读取的真实规模实验已运行，但最终汇总和失败回执为空，整轮未验收；部分后端读取样本及原因见[实验记录](../../combined-read-experiment/reviews/measurement-06/REAL-RUN-COORDINATOR-20261029.md)。它不能替代本票的完整桌面首屏基线，也不解除后续决策票的依赖。

同一冻结副本上的非财务原型第二轮已完成，并通过限定范围的[独立验收](../../real-data-fact-experiment/INDEPENDENT-REVIEW-02.md)。其进程内读取不能替代本任务要求的浏览器基线；首次准备耗时和更新后的首次打开也需分别评估。

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
