# 数据库模块重设计

**用户已选择B方向，正式设计候选通过第2轮独立可实施性检查，等待用户审定。** 本轮以现有排查证据为依据，重设计成交保存、来源关联和一致读取；具体设计审定后再讨论实施。

- 当前任务：[01 — 比较数据库模块的设计方案](issues/01-interface-design.md)。
- 正式候选：[数据库模块重设计](../../docs/backend-design/database-module-design.candidate.md)。用户原话“B”确认按业务职责拆分，成交提交模块拥有唯一写事务；不等于批准尚未展示的设计细节。
- 依据：[数据库建模综合审查](../../docs/backend-design/database-review/REVIEW.md)、[数据库现状](../../docs/backend-design/database-review/current-model.md)、[原后端目标候选](../../docs/backend-design/target-design.candidate.md)。
- 基点：含既有未提交修改的工作区，HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`；不是远端 master 审查。
- 协调者：`/root`；三个探索 Agent 均指定 `gpt-6.1-sol`、`ultra`，只读，不修改产品代码。
- 财务 P1/F07、Bars 保持暂停；本轮不恢复其实施或重置验收轮数。
- 不接触业务库，不提交、推送、合并或发布。文档范围无须 UI、数据库写入或性能验收；设计不表示修复完成或达到一秒目标。

正式候选不替换已有交互审查稿和评论版本。独立设计检查最多3轮，与产品修复验收轮数分开记录；最终状态见[本轮验收记录](FINAL-ACCEPTANCE.md)。

第一轮发现材料换版后的成交处置、既有TradingView专项迁移/回滚兼容两项缺口；已补齐，原始FAIL和第2轮PASS分别保存。候选中的业务取舍仍是待审建议，检查通过不是用户批准或产品通过。
