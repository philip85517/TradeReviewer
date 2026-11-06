# 02 - 正式写入校验与证券身份（DB03/DB04）

ID: DBB-02
State: closed
Status: accepted
Assignee: /root/dbb_validation
Coordinator: /root


**Files:** 唯一修改 `app/lib/storage/sqlite-store.ts`；可新增 `app/lib/storage/trade-fact-validation.ts` 与同名测试；新增 `sqlite-store.fact-invariants.test.ts`。其他Store测试只读，发现旧断言冲突向协调者报告。
**Refs:** 设计5.2、8、9.3；DB03/04探针。
**Interfaces:** 所有现有正式Store入口共用相同语义检查；建议导出 `assertTradeExecutionSemantics(execution: TradeExecution): void` 供提交模块复用。身份保护统一放在putInstrument，普通更新只能更改名称/展示元数据。保留现有公共签名，不在本票实现业务版本或prepare/commit。
**Blocked by:** None。
- [ ] 先复现同ID市场/代码/币种改写以及坏时间、非数字/非有限、负价、零/负数量、坏费用被接受；另加零价、date-only、高精度、未知费用正例。
- [ ] 提取并接入共用语义检查，保留simulation、settlement和审计检查，不转浮点，不扫描并删除历史坏数据。
- [ ] merge/migration/revision/metadata等受影响入口用真实SQLite证明拒绝后无半写，旧成交JOIN不变，名称更新仍生效；修订也允许合法零价与日期精度。
- [ ] 运行相关Store/修订/账户纠正回归并报告；冻结候选，由独立Luna审查。本票无UI修改，后续接线须单独验证。


## Acceptance

Attempts: 2/5, candidate 2 backend ACCEPTED. Evidence: ../evidence/task-2/

### Candidate 1 — 独立审查中
已冻结完整基线差异与哈希，专属审查者 /root/dbb_validation_luna（Luna5.6 Max）。协调者对Task1/2合并定向复验337/337 PASS；该结果不替代独立结论。

### Candidate 1 — FAIL
独立审查者 /root/dbb_validation_luna 确认 Important：显式替换先删除旧成交，随后遇到未替换成交的ID冲突仍可能提交，形成部分删除。 保留原候选包；候选2修复中，未接受。

### Candidate 2 — 后端任务局部 ACCEPTED
专属Luna规格/质量 scoped复验 PASS（task-2-luna-review-2.md），原I-1全矩阵ADDRESSED。协调者读fix.diff并独立真实SQLite7文件261/261 PASS（evidence/root-tasks-1-2-verification-2.log，16:37:58）；matcher另5文件96PASS。候选2不再修改，Store可在Task5依赖齐备后顺序交接。仅验收本票输入/身份/原子保护；旧UI全量提交不兼容已明确移交Task5/7，HTTP、文件重启并发、浏览器与整体仍NOT VERIFIED。5/5未触及，实际2/5。
