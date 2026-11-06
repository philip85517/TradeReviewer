# 01 本地视觉资料提取与独立复核

- ID: visual-consolidation-01
- State: closed
- Status: accepted
- Assignee: root
- 集成负责人: root
- 独立审查: visual_specs_home

## What to build / Scope

用户授权按聊天与版本时间，将未进入 master 的视觉资料 cherry-pick 到本地。限文档、设计原型及视觉证据，不含应用实现、数据库与服务变更；既有历史状态不改写为通过。

## Refs

- [来源、时间与选择结果](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/README.md)
- [项目流程](../../../docs/agents/development-workflow.md)

## Blocked by

无。

## Acceptance

- [x] 所有限定快照逐文件 SHA256 与目标一致；[2,184 文件证据](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/provenance/verification.json)。
- [x] 当前 candidate45 与 direct-v5、identity 分离，正式正文未擅自升级；[独立 36/36 检查](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/provenance/independent-review.json)。
- [x] diff 仅 docs/.scratch，master、交易库 V2.0 原包与各源 worktree HEAD 保持原样；[Git 证据](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/provenance/verification.json)。
- [x] 新索引链接有效；原始历史引用不自包含的边界明确；旧 FAIL、未审状态保留；[范围说明](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/README.md)。
- [x] 独立 Agent 审查与协调者最终接受已记录；[最终接受](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/FINAL-ACCEPTANCE.md)。

## Counterexamples / evidence

mtime 较新不表示用户批准；静态验收不表示产品完成；未提交资料先制作限定快照，不能用整个源 feature 引入业务代码。证据收录到 [最终接受记录](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/FINAL-ACCEPTANCE.md)。
