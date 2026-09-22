# 全市场行情数据架构

- [独立行情数据模块重构决策地图](issues/02-refactor-map.md)：当前规划的权威入口，子票记录具体问题及答案。
- [任务规格](issues/01-platform-spec.md)：ready-for-agent，方向已确认，实施依赖地图中的前置决策。
- [审查证据与候选](../../docs/adr/0005-market-platform-architecture-review.md)。
- 当前阶段：用户已于 2026-09-22 指示“推进开发”，开始[独立行情同步与诊断入口](issues/13-module-implementation.md)，见[首期实施计划](implementation-plan.md)。质量阈值和来源组合等未决票仍保持开放。
- 推荐实施顺序：行情数据 module → 持久采集与诊断 → 研究快照。
- 查询当前可领取票：`python3 .scratch/market-data-platform/frontier.py`。
- 查看所有子票及依赖：`python3 .scratch/market-data-platform/frontier.py --all`。
- 生成最新依赖图：`python3 .scratch/market-data-platform/frontier.py --mermaid`。
- 地图中的决定逐票确认，不把推荐值写成用户已选择。本次实施不替代未决票的回答。
