# 首页与交易库页面读取架构决策地图

ID: page-reading-architecture-map
Labels: wayfinder:map
State: open
Status: charted
Assignee: unassigned
集成负责人: 主协调者

## Destination

形成可供审核、实施和独立验收的首页与交易库后端读取接口和架构设计：说明页面所需摘要、分页、追溯、数据一致性、异常及一秒验收边界。

## Notes

- 面向非技术审核人员与专业人员：先给业务结论、例子和状态，再提供模块、字段和源码证据。[候选审查稿](../../../docs/backend-design/page-reading-architecture.candidate.md)是讨论材料，不是已批准规格。
- 用户已确认首页和交易库本地数据齐备时各自完整首屏 1 秒内，冷／热、服务重启首读、导入或修订后首读均分别覆盖。引用[既有恢复地图](../../home-trades-recovery-wayfinder/issues/00-map.md)和[读取架构问题](../../home-trades-recovery-wayfinder/issues/04-reading-architecture.md)，本图细化而不替代两者、其依赖或原有轮次。
- 依据[协议诊断](../../home-trades-recovery-diagnosis-2026-10-28/PROTOCOL-REVIEW.md)，34.33 MB 来自一次隔离副本样本；初步方向是页面专用摘要、分页与按需追溯，具体设计尚待审查。
- 保留工作区、正式业务库及原有失败证据。财务 P1/F07、Bars 及重复导入各自暂停状态不变；涉及已暂停范围的实施或实验须单独明确恢复，不能借新票重置轮次。
- 这是设计地图，不执行产品实现。HITL 决策只能由用户作出；继续地图时先领取一张可处理的票并保留独立 Resolution。精度、缺失、版本和可追溯性不得因优化被削弱。
- 参照 wayfinder、domain-modeling、codebase-design 和项目任务跟踪规范；必要时先 systematic-debugging 后讨论修复。

## Decisions so far

<!-- 建图时未领取或关闭任何问题。此前用户明确选择的一秒边界等事实放在 Notes 中，并引用原地图。 -->

## Not yet specified

- 不同交易库视图和后续页面扩展的数据组合，需在页面结果边界审查后依据具体设计进一步明确。
- 根据性能实验结果，可能需要细化数据恢复和资源限额；在实验前不预先假定实现细节。

## Out of scope

- 本地图不实施产品改造、写入正式业务数据库、发布或合并。
- 不恢复暂停的财务、Bars、重复导入任务，不宣称现有首页或交易库已通过一秒验收。
- 不重新设计与页面读取无关的策略、回放和数据导入内部流程。
