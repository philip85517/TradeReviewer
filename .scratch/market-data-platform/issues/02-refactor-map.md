# 独立行情数据模块重构决策地图

ID: market-data-refactor-map
Labels: wayfinder:map
State: open
Status: charted
Assignee: unassigned

## Destination

澄清独立行情数据 module 首期重构的全部前置决策，形成可交给实施的来源策略、数据口径、模块职责、诊断、迁移和验收依据；具体结论保存在各决策票。
终点是路线清楚、可写执行计划，不是重构代码已经交付。

## Notes

- 2026-09-22 用户指示“推进开发”：新增独立的[首期实施任务](13-module-implementation.md)，实施不依赖未知行情口径的可逆模块边界重构。原决策票仍待证据和真实交流，不因开始开发而自动关闭。
- 依据用户已确认的架构审查推荐：先独立行情数据 module，后续推进持久采集诊断与研究快照。本轮 wayfinder 请求把当前工作明确切换为规划。
- 沿用现有[需求规格](01-platform-spec.md)、[领域词汇](../../../CONTEXT.md)与[审查证据](../../../docs/adr/0005-market-platform-architecture-review.md)。旧 ADR 中未经核验的四源最小性、统一减时与可知时间推断不作为定论。
- 硬约束：每市场启用来源并集最多三个，全局尽量少；优先保留原始成交和有效行情；不推送、合并、发布；不将股票样本外推为全部 ETF 可用。
- 每次处理票使用 wayfinder；HITL 使用 grilling 和 domain-modeling，每次只问一个问题，不代用户作答；设计 module 时使用 codebase-design。外部知识需求明确后创建 research 票并依 skill 派研究代理。
- 本轮只建图，不领取、不关闭任何子票。后续会话先查询 frontier 再领取；最多解决一张非 research 票。
- 地图只索引已关闭票；open子票由查询获取。物理约定见[本地任务跟踪](../../../docs/agents/issue-tracker.md)，查询命令：`python3 .scratch/market-data-platform/frontier.py`；完整依赖：加 `--all`；依赖图：加 `--mermaid`。
- 本轮未创建research票：先明确已有证据不足和质量底线，才知道需要查询哪些上游文档或获取哪些响应；不将待查外部事实伪装成已知结论。

## Decisions so far

<!-- 建图阶段为空；已确认上下文放 Notes，不伪造本地图票的解决记录。 -->

## Not yet specified

- 标准口径和现有证据核对后，可能暴露新的来源授权、原始响应或企业行为证据缺口；问题清楚时拆成research/task票。
- 源集合及使用规模明确后，可能需要针对具体瓶颈的容量实验；目前不预设数据库替换或吞吐数值。
- 影子比较可能揭示历史数据修订的更多类型；具体处理决策在迁移规则讨论中再形成。

## Out of scope

- 本地图不实施生产重构、批量迁移或修复当前适配器。
- 后台持久worker、完整运维控制台和完整研究快照的实现属于后续地图；本期只确定接入约束。
- 任意插件执行框架、因子引擎、完整回测、交易下单、全部全球资产接入和提前建设分布式集群。
