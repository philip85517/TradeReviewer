# 交易库 V1.1 反馈设计决策地图

ID: TL11-MAP
Labels: wayfinder:map
State: open
Status: in-progress
Assignee: root
集成负责人: root

## Destination

厘清 V1.1 新增五条评论中的业务概念与交互规则，形成可交给后续设计修订使用的决策及验收依据。保留已选定的 E 整体布局；各项决策获得用户确认后再修订正式原型。

## Notes

- 用户已确认：“是，先形成设计决策地图（推荐）”；随后确认“按六组建立，先处理概念冲突（推荐）”。建图阶段已完成；用户随后要求“继续”，现进入逐票决策讨论。
- 反馈版本为 revision 5，原文与参考文件散列见[证据快照](../evidence/source-manifest.json)和[反馈覆盖表](../DESIGN-COVERAGE.md)。已确认约束与待决策问题分开记录，不能用建议代替用户决定。
- 保留 E 的布局层级、全站侧栏、无右上返回首页按钮、无“视角”装饰词、说明使用悬浮/聚焦入口、盈利绿/亏损红。保留已确认“最差练习回撤”，不能因采用模拟账户名称就把独立练习拼成连续权益曲线。
- 先处理概念冲突；无事实依赖的视觉探索可独立领取。下一会话默认领取编号最前的 frontier 票，每次只解决一张 HITL 票。
- 每次遵循 [wayfinder](/Users/zhoulin/.codex/skills/wayfinder/SKILL.md)；概念讨论使用 [grilling](/Users/zhoulin/.codex/skills/grilling/SKILL.md) 和 [domain-modeling](/Users/zhoulin/.codex/skills/domain-modeling/SKILL.md)，视觉决策使用 [prototype](/Users/zhoulin/.codex/skills/prototype/SKILL.md)。原型探索需用户真实反馈，不能自行验收代替选择。
- 使用[本地跟踪约定](../../../docs/agents/issue-tracker.md)。领取前重读并设置唯一 Assignee；结论独立保存在 comments/ 下，链接后才能按接受证据关闭。地图只索引已关闭票；未决票通过 `python3 .scratch/trading-library-v11-design-decisions/frontier.py --all` 查询。
- 本轮仅文档与源文件核对；不声明浏览器交互或视觉验收通过，不改评论状态、不改业务数据、不覆盖既有接受记录。

## Decisions so far

- [账户、练习与完整交易的边界](01-domain-boundaries.md) — 已确认文件练习、人的主动平仓回合及分层统计口径；行为识别另票跟踪。

## Not yet specified

概念讨论已暴露的行为识别、配对范围及分组修订对复盘归属的影响已形成独立子票。后续逐项决策若揭示其他跨模块说明冲突，再明确其具体问题；导入迁移执行仍在本轮范围外。

## Out of scope

产品代码实施、业务库修改、导入迁移执行、远端提交或发布；重新选择整体布局方案；本轮未反馈的全站页面重设计。正式原型修订及最终产品交付属于后续实施，视觉决策票内的小型比较样例仅供确认决策。
