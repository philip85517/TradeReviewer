# 04 最新完整文档核对、独立分支推送与 PR

- ID: visual-consolidation-04
- State: open
- Status: integration-pending
- Assignee: root
- 集成负责人: root
- Base: origin/master（开始时 d95afc37；提交前重新 fetch）
- Branch: codex/visual-specs-consolidation-20261106

## What to build / Scope

用户最新要求：“先确认当前完整版的文档类型/内容的最新性，没有矛盾冲突，没有worktree设计文档等的遗漏，现在本地作为独立分支，push到远端，再推进PR”。此前范围调整：“剩余一些设计相关的确认我们快速推荐，暂时认为是暂定的，我们本次迭代的目标是merge所有已经推进的最新文档进展内容的merge，而不是细节的确认”。

保留完整已推进的视觉文档、图稿、生成源、原型、评论身份、任务/覆盖/验收及历史溯源；核对所有注册 worktree 的 tracked 与 untracked 非忽略文档。区分当前规范、最新暂定方案、被取代历史；不把文件 mtime 当用户批准时间，不删除旧 FAIL，不把历史 PASS 外推给本轮。

本轮不做产品实现、业务数据修改或 UI/数据库验收；纯文档检查按项目流程不适用这些门槛。保留源 worktree、local master 及其中未提交修改。用户已授权 push 本分支及创建以 master 为 base 的 PR；本票不自动合并 PR。

## Blocked by

无。文档检查和独立审查已完成，当前等待本票负责的远端提交与 PR 核验。

## Plan / Ownership

1. root 冻结 worktree / 文档类型清单，独立只读 Agent 核对复盘、策略遗漏和当前规范冲突。
2. root 补齐遗漏，建立最新文档入口、决定状态与冲突优先级，纳入本次确认图。
3. root 执行来源字节、链接、生成一致性、评论身份和 git diff 检查；独立 Standards / Spec 复核最终范围。
4. root 仅提交任务文档，push 独立分支，创建/复用 master PR，核对远端提交并记录 URL。

## Acceptance

- [x] 所有注册 worktree 均有版本、状态、文档类型、覆盖/排除依据及采集截止，见[worktree 核对表](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/WORKTREE-COVERAGE.md)。
- [x] 当前入口明确旧回合、旧摘要及旧跟随规则的覆盖关系；剩余细节暂定，见[当前合同](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/README.md)。
- [x] 最新资料有保存路径，历史有溯源，原 FAIL / NOT VERIFIED 保留，见[类型与来源](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/WORKTREE-COVERAGE.md)。
- [x] 当前入口、生成阅读页、评论身份和来源清单检查通过；历史全包空白不作通过声明，见[机器验证](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/verification.json)。
- [x] 独立 Standards / Spec 复核完成，无未解决的文档范围阻断项，见[最终验收](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/FINAL-ACCEPTANCE.md)。
- [ ] 远端分支与本地提交一致，PR base 为 master，URL 已附当前聊天。

## Refs / Evidence

- [当前完整版文档入口](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/README.md)
- [原始保全与出处](../../../docs/design-system/iterations/2026-11-06-visual-spec-consolidation/README.md)
- [此前内容评审](02-master-core-review.md)
- [已确认及暂定设计记录](03-core-design-alignment.md)

## Verification status

文档范围已由 root 按最新静态结果和独立 Standards / Spec 报告接受；远端交付未完成前本票保持 open / integration-pending。未以旧验收替代本轮检查。未请求默认实现模型 gpt-5.6-luna：本轮仅协调者维护文档及独立只读审查，无产品实现派发。

## Counterexamples / evidence

文件 mtime 不等于用户批准，旧 PASS 不等于本轮 PASS，批量暂定不等于全部最终冻结，完整保全不等于产品验收。来源已有缺链与失效评论图锚点不伪造修复；有限快照不承诺源 worktree 后续更新已纳入。证据见[最终验收与明确限制](../../../docs/design-system/iterations/2026-11-06-current-visual-progress/FINAL-ACCEPTANCE.md)。
