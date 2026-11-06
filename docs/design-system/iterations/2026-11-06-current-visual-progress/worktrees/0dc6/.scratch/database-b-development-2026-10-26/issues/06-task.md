# 06 - TradingView专项迁移和回滚兼容

ID: DBB-06
State: open
Status: candidate-2-in-progress
Assignee: /root/dbb_tv
Coordinator: /root


**Files:** `tradingview-account-migration-store.ts` 及专项测试；Task5交接后 `trade-changes.ts`。不得新增一般账户合并。
**Refs:** 设计8.1。
**Interfaces:** 专项prepare/commit/rollback公开语义保留，内部应用接受已有事务上下文，统一提交所有权；专用意图纳入持久计划。普通Recall保存不改变。
**Blocked by:** Task4、5。
- [ ] 先写专项操作改变新材料账户投影、原观察不变、回滚继续增版本的测试。
- [ ] 保留旧摘要、守恒、行审计、别名、Recall和本金依赖保护；额外检查独立领域并发及新关联，禁止嵌套事务。
- [ ] 历史操作保留查询及可证明回滚；不能证明时列具体阻塞，不全部停用。
- [ ] 跑完整原专项测试及新增反例，由单独Luna验收。


## Acceptance

Attempts: candidate1/5 FAIL; candidate2/5 in progress. Separate Luna scoped re-review and root acceptance pending. Evidence: ../evidence/task-6/

2026-10-26 root放行独立专项Store/snapshot/contracts/测试，与Task5无重叠文件并行。统一engine/共享Store接入仍被Task5验收阻塞；详见本计划Task6 brief末尾裁定。独立部分通过不构成整票接受。

## Dependency issue links

- [Task4](./04-task.md) must be accepted and closed.
- [Task5](./05-task.md) must be accepted and closed.

## 当前交接

Task5候选2已接受，root明确释放共享Store/contracts/engine交由原dbb_tv独占；dbb_mapping并行独占source-materials.ts和新专用测试。固定来源接口见task-6-source-report；内部专项提取见最新brief。候选仍1/5、尚未冻结/验收，来源子任务和整票分别由专属Luna5.6Max审查。

## 来源映射子任务局部接受

候选1专属Luna5.6Max Approved、root81PASS/32manifest匹配，源代码保持冻结。仅接受source authority子任务；整票engine实际ledger/provenance、晚期验证/receipt/facts/reference/version一致事务及类型检查继续NOT VERIFIED。

## 20:36 整票候选1冻结

实施者392项＋来源81项通过；root复核24项整票文件与2项来源依赖hash全部匹配，并独立运行专项Store 68项通过。整票专属dbb_tv_luna（Luna5.6Max）审查中。root提出同operationId未提交计划过期/版本变化后重新预览可能仍返回旧计划的具名疑点，交本轮审查；尚非确认缺陷。Task7在途类型诊断、真实HTTP和最终集成仍NOT VERIFIED，不关闭本票。

## 候选1独立验收FAIL，候选2实施

Luna Important P1确认request-alias表不在final/replay精确证明内，可能漏掉late trigger额外绑定。root独立读路径确认，原Sol按systematic-debugging先RED再修复；覆盖正向、逆向与consumed-plan alias，禁止通过仅加入快照导致合法alias误报。旧证据及失败报告保留，最多5候选，最终HTTP/UI仍NOT VERIFIED。

## 20:52 原候选2冻结，等待原Luna scoped结论

manifest SHA256 444418d1e7faf94fead9d1d37b89a096169e43054fd55e8a368392c20224d33d；root32项（24源码/副本、2来源依赖、6日志）匹配，原c1仅2文件改变。root真实SQLite聚焦6 PASS / 68明确skipped，3.02s，证据root-whole-candidate-2-hashes.json/tests.log。原专属Luna5.6Max已恢复scoped复验P1及fixdiff回归；尚未接受，Task8执行仍blocked。

## Task6 candidate2 后端局部 ACCEPTED（2026-10-26）

原专属 Luna5.6Max scoped 复验 P1 ADDRESSED、无新增 Critical/Important/Minor；root 已读完整复验，32项冻结校验及独立6个真实SQLite晚期别名反例通过，接受前再次核验26项源码/依赖一致。候选2/5关闭本票后端实现，原候选1 FAIL保留。证据：task-6-luna-review-2.md、root-whole-candidate-2-hashes.json、root-whole-candidate-2-tests.log；398项实现者回归、TSC/lint/diff-check通过。真实HTTP、桌面UI、全仓与部署不在本次局部接受内，Task8仍等待Task7最终冻结。
