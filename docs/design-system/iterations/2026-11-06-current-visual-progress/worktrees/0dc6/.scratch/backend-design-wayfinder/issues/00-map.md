# 后端业务与数据设计审查地图

ID: backend-design-map
Labels: wayfinder:map
State: open
Status: charted
Assignee: unassigned
集成负责人: root

## Destination

形成与视觉规范总分写法一致、可供用户逐层 review 的后端业务与数据设计：从功能与领域到关键数据链路的模块、处理对象和数据对象。使读取／校验协议及职责缺口得到明确设计决策，再交给后续实现规划。

## Notes

- 用户确认“全局总图＋数据读取链路深入”，并选择“现状说明与目标设计分成两份”。确认的是范围和组织方式，尚未批准候选业务设计。
- 本地图默认只作决策。用户本轮明确要求撰写文档，因此允许创建[现状说明](../../../docs/backend-design/current-state.md)和[目标候选稿](../../../docs/backend-design/target-design.candidate.md)作为讨论材料；这不代表子票已解决或进入产品开发。
- 每次先读 wayfinder、grilling、domain-modeling 和 codebase-design；本地关系遵守[tracker](../../../docs/agents/issue-tracker.md)。一次后续会话只领取并解决一张 HITL 决策票，必须有用户真实判断。
- 财务 P1/F07、Bars 保持原 3/3 暂停及失败记录，不改名恢复、不重置轮数。设计确认不自动授权实施。以后若获实施授权，沿用逐项独立验收与最多3轮。
- 用户当前 Agent 偏好为 Sol 6.1 Ultra；本轮独立检查只审文档，不更改产品。
- [设计覆盖](../DESIGN-COVERAGE.md)记录功能与证据，[源快照](../evidence/source-snapshot.json)标定本轮现状。没有需要 cwd 外知识的 research 子票，不创建外部研究分支。

## Decisions so far

尚无已关闭的子决策票。上方用户确认的范围与文档组织方式仅作为建图边界。

## Not yet specified

- 在资格与模块所有权定稿后，是否需要持久证据关系、读模型投影或兼容迁移，以及迁移形态。
- 性能实验定位到具体热点后，如何在不改变已审业务语义的前提下选择缓存、批处理、计算位置与失效策略。
- 第一条主链设计稳定后，哪些复盘／回放／策略子领域值得继续深入对象级审查。

## Out of scope

- 本轮产品修复、重构实现、数据迁移、UI交付、部署、提交和推送。
- 财务／Bars 暂停任务恢复；完整现金账审计；用新票重置旧验收轮数。
- 回放、策略等领域的内部类和算法实现设计；全局功能图只保留职责与 Interface 概要。
- 用读取摘要通过、骨架先显示或取消必要内容代替完整首屏一秒验收。
