# 03 - 业务版本与一致读取基础

ID: DBB-03
State: closed
Status: accepted
Assignee: /root/dbb_version
Coordinator: /root


**Files:** 唯一修改 `db/sqlite-schema.ts`、按需 `db/sqlite.ts`；新增 `app/lib/storage/trade-book-version.ts`、`trade-book-version.test.ts`；修改 `homepage-source-snapshot.ts` 及其测试。不得改HTTP合同，版本字段先在新独立读取接口输出，旧receipt结构兼容。
**Refs:** 设计4.3/4.4、6业务版本、8、9.2/9.3。
**Interfaces:** 新增 `BookVersion = { databaseId: string; epoch: string; sequence: number }`；导出 `readBookVersion(database: DatabaseSync): BookVersion`、`assertBookVersion(database, expected): void`、`rotateBookEpoch(database): BookVersion`。版本持久保存，普通重启不变。确切错误类型与模块位置在报告中供Task5消费。业务变化用事务内触发器覆盖现有入口（兼容期防漏），与后续唯一提交协调并不构成第二写权威。
**Blocked by:** None。
- [ ] 内存及双连接文件库先写版本不存在/不递增/重启验证测试；覆盖新成交、修改、删除、材料JSON语义变化、身份映射变化、仅名称变化、Recall/设置/行情不变。
- [ ] 新增migration15，已发布14次迁移不变；持久DB身份/epoch/counter，业务语义改变递增，事务回滚也回滚版本。恢复入口必须能显式换epoch且不可静默认旧库。
- [ ] 首页读取先同事务复制输入，再提交，随后进行摘要/形状验证；错误不得回滚已提交/调用者事务；不访问网络。
- [ ] 验证既有迁移升级、重启与并发读取；冻结候选并独立Luna审查。不改变财务资格。


## Acceptance

Attempts: 2/5, candidate 2 backend ACCEPTED. Evidence: ../evidence/task-3/

### Candidate 1 — FAIL
独立Luna F-1 Important：json_tree.atom 把两个不同超大JSON数字舍入为同一个REAL，来源语义变化漏增BookVersion。42项根验证通过不能覆盖该反例。见 task-3-luna-review-1.md。原实现者恢复候选2/5；4/9保持阻塞。

### Candidate 2 - backend ACCEPTED
Dedicated Luna spec PASS and quality PASS, F-1 closed, zero findings. Root independently ran 4 files / 86 tests PASS and read the complete review plus comparator code. Evidence: task-3-luna-review-2.md and evidence/task-3/root-verification-2.log. Task4 new source tables and Task9 runtime wiring remain separate gates.
