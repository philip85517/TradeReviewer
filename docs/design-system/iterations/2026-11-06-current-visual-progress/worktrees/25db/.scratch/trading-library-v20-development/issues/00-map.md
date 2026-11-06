# 交易库 V2.0 完整产品落地决策地图

ID: TL20-MAP
Labels: wayfinder:map
State: open
Status: in-progress
Assignee: root
集成负责人: root

## Destination

在已批准的 V2.0 视觉和业务合同之上，把完整产品落地所需的未决边界澄清到可实施；覆盖前端、独立练习/主动回合、导入更新、统计、真实回放返回链和独立验收。

## Notes

用户于2026-10-26确认“完整产品落地拆票（推荐）”；随后明确授权多个Sol 6.1 Ultra推进开发，每位配不同Luna 5.6 Max验收，root协调且同一问题5轮未解停止。执行范围依[开发协调](../EXECUTION.md)及已批准合同；未决HITL不由Agent代答。地图继续只管理问题，开发票不是地图子票，见[开发计划](../IMPLEMENTATION-PLAN.md)。

沿用 [交易库设计规范](../../../docs/design-system/trading-library-design-spec.md) 和 [V2.0十章视觉正文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，不得重新设计已确认规则。后续会话使用 wayfinder、grilling、domain-modeling；本地任务遵守[项目拆票标准](../../../docs/agents/task-decomposition.md)。现有 V1.1 决策地图的未结问题继续在原票解决，不重复建票或代替用户结论。

查询 `python3 .scratch/trading-library-v20-development/frontier.py`；`--external`查复用前沿，`--work`查开发票。默认每会话只领取一张可领取决策，先写Assignee；HITL必须来自用户真实答复。Resolution另存comments/<ID>/，再依法关闭并在本地图加一句摘要。建图会话不领取/解决子票。

## Decisions so far

- [账户、练习与完整交易的边界](../../trading-library-v11-design-decisions/issues/01-domain-boundaries.md) — 已有闭合决策确立练习、主动平仓回合和内部配对的区分；当前权威表述以V2.0及业务规范为准。
- [旧数据怎样映射为独立练习并保留复盘引用？](01-legacy-contract.md) — 只读事实和候选方案准备已接受；真实映射、用户政策与运行时契约继续保持未冻结。
- [一次练习的账户与标的边界是什么？](04-multi-scope.md) — 用户确认一份练习只含一个账户和一个标的；混合方向继续由既有方向票处理。
- [练习名称与日期口径](../../trading-library-v11-design-decisions/issues/02-practice-names-dates.md) — 原票用户决策已接受：唯一文件名日期及完整练习名前缀的内部配对标题；生产接线与具体技术合同仍待接受。

## Not yet specified

当前能明确表述的阻塞问题均已建票或复用原票。迁移与真实SDK适配证据取得后，如暴露无法预先限定的兼容问题，再从事实中新增具体问题，不预设实现结论。

## Out of scope

不改设计原稿、业务数据或运行配置，不安装监控，不发布远端issue，不提交/推送/合并/发布。产品实现按后续用户授权和依赖门槛推进。最终产品不包括分析/数据/策略整页重做，不把fixture算法或底部视觉样例工具移入正式产品。
