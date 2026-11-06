# 01 - 成交身份与重数（DB01）

ID: DBB-01
State: closed
Status: accepted
Assignee: /root/dbb_match
Coordinator: /root


**Files:** 修改 `app/lib/import/execution-reconciliation.ts`；增加/修改同目录 `execution-reconciliation*.test.ts`，可新增专用 `app/lib/storage/sqlite-store.reconciliation-scope.test.ts`（不得修改Store）。
**Refs:** 设计5.1、9.3；原DB01探针。
**Interfaces:** 保留现有 `reconcileExecutions`、`applyExecutionReconciliation`、candidate/core/source helper调用签名；候选隔离账户、性质、模拟运行；sourceTradeId仅在其真正来源语义下使用，订单号不当成成交号。现有月结/日期精度/模拟排序必须兼容。
**Blocked by:** None。
- [ ] 测试跨账户相同时间/价格/数量保留两笔、同文件不同稳定行保留重数、同文件重导不增、跨文件歧义需选择、性质及模拟运行隔离；先记录RED。
- [ ] 根据已复现根因改候选分组与一对一匹配，不做全局集合去重、不更改解析器性质语义。
- [ ] 用现有reconciliation及新真实Store测试验证GREEN。报告中标出无法证明身份的输入。
- [ ] 冻结所改文件hash与相对基线diff，独立Luna规格/质量审查后协调者复验。本票不涉及UI改动。


## Acceptance

Attempts: 2/5, candidate 2 backend ACCEPTED. Evidence: ../evidence/task-1/

### Candidate 1 — 独立审查中
已冻结完整基线差异与哈希，专属审查者 /root/dbb_match_luna（Luna5.6 Max）。协调者对Task1/2合并定向复验337/337 PASS；该结果不替代独立结论。

### Candidate 1 — FAIL
独立审查者 /root/dbb_match_luna 确认 Important：同指纹但缺有效稳定行定位时，被错误当成独立成交直接接受；负数/小数行号可达。 保留原候选包；候选2修复中，未接受。

### Candidate 2 - backend task ACCEPTED
Dedicated Luna: F-1 ADDRESSED, quality Approved, no new Critical/Important. Reviewer focused matcher7/Store7 PASS. Root read fix.diff and independently ran matcher5 files96PASS and storage7 files261PASS, including this task Store11. Evidence: task-1-luna-review-2.md, evidence/task-1/root-verification-2.log, evidence/root-tasks-1-2-verification-2.log. Original FAIL retained, final attempts2/5. Task5 authoritative commit and integrated HTTP/UI remain pending.
