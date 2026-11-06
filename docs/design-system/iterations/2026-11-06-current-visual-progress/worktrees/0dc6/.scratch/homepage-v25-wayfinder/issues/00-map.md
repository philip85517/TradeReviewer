# V2.5 首页代码设计决策地图

ID: homepage-v25-map
Labels: wayfinder:map
State: open
Status: charted
Assignee: unassigned
集成负责人: 主协调者

## Destination

在当前 master 和已批准 V2.5 上，明确首页及必要交易库接线的可复用代码、财务投影、状态/导航和公共规范迁移选择，形成能按完整用户旅程派发的代码设计与实现计划。终点是路线清楚、实现任务可准确编写，不是产品实现已交付。

## Notes

- 用户确认：首页完整落地＋V2.5 公共规范＋必要交易库进入/返回接线；共享规范先由首页采用，其他页面后续迁移。
- 基线与静态结论见 [可行性与候选批次](../README.md)、[版本证据](../baseline.json)、[设计覆盖初表](../DESIGN-COVERAGE.md)。当前远端 master 为 `5a94ee3f`。
- 当前正文与公共手册优先；交易库内部设计只约束必要接线。普通入口不加待复盘徽章、不带默认待复盘队列，持仓汇总用 C、徽章默认24px。这些已经确定的设计不在地图中重开。
- 每次工作先读 wayfinder、本项目 [本地跟踪](../../../docs/agents/issue-tracker.md)及 [拆票规范](../../../docs/agents/task-decomposition.md)。HITL 使用 grilling/domain-modeling；模块设计使用 codebase-design。实施另遵循 development-workflow 和 UI 验收模板。
- 本次只建图，所有子票不领取、不关闭；下一会话先查询 frontier、领取一票再工作。HITL 必须有人类真实回答，每会话最多解决一张非 research 票。
- 本次未创建 research 票：已知问题可由当前仓库证据与用户选择推动，没有预设外部供应商或新技术选型；后续确需外部知识再创建 research 并按技能派研究代理。
- 本地关系：子票 Parent 链接本地图；Blocked by 以命名链接保存；先建全部票再接依赖。查询 `python3 .scratch/homepage-v25-wayfinder/frontier.py`，加 `--all` 或 `--mermaid` 查看派生关系。

## Decisions so far

<!-- 建图阶段为空。用户范围确认属于 Notes，不伪造子票解决记录。 -->

## Not yet specified

- 若逐笔算例暴露账本输入的企业行为、费用/FX 时间或身份缺口，再具体确定需要何种补证、受限支持说明或数据修复，当前不预设完整外部采集工程。
- 数据规模与真实渲染证据明确后，再决定历史缓存、worker 拆分、窗口化或性能预算；不先编造吞吐与工期承诺。
- 对账或真实闭环可能暴露需要重开设计的矛盾；届时指向具体规范/状态提出，不悄悄更改已批准交互。

## Out of scope

- 本次产品代码实现、部署、推送与合并；地图只准备代码设计和执行计划。
- 交易库 V1.0 内部完整改版、模拟练习/配对/统计的新实现，及其他页面的全站视觉迁移。
- 新增窄屏/触屏设计；本期按当前已批准桌面视口规划，既有受影响行为的回归仍保留。
- 更换前端框架、数据库、状态管理或行情供应商，以及重写回放系统；必要接线影响的既有链路须回归。
