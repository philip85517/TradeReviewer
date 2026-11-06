# 后端设计审查资料

权威入口：[后端业务与数据设计审查地图](issues/00-map.md)。文档入口：[后端业务与数据设计](../../docs/backend-design/README.md)。

本轮只建图与准备审查材料，不领取、关闭或代替用户解决 HITL 决策。目标稿尚未批准。下一步建议首先审查辅助证据的业务范围；具体 frontier 由 issue 的 State、Assignee 和 Blocked by 派生。

只读查询：

    python3 .scratch/backend-design-wayfinder/frontier.py
    python3 .scratch/backend-design-wayfinder/frontier.py --all
    python3 .scratch/backend-design-wayfinder/frontier.py --mermaid

[设计覆盖](DESIGN-COVERAGE.md) · [文档验核记录](DOCUMENT-REVIEW.md) · [源快照](evidence/source-snapshot.json)

财务与 Bars 原暂停继续，原验收轮数未变化。本轮没有 UI／数据库写入验收要求：只有文档与只读派生查询，没有产品更改。
