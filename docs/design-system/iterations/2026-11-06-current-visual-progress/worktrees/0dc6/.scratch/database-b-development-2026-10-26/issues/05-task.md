# 05 - 持久计划、提交凭据与唯一写事务

ID: DBB-05
State: open
Status: acceptance-failed
Assignee: /root/dbb_socket_runtime_sol
Coordinator: /root


**Files:** 新增 `app/lib/storage/trade-changes.ts`、`trade-changes.test.ts`；修改 `sqlite-store.ts`（Task2交接后唯一owner）及按需新增migration17；修改 `sqlite-contracts.ts`。
**Refs:** 设计4.1、5、6、8、9；DB02。
**Interfaces:** `createTradeChanges(database, options?).prepare(intent): ReviewPlan`、`.commit({requestId,planId,choices}): CommitReceipt`、`.getCommit(requestId): CommitReceipt|null`。意图为导入候选/明确修订/只有材料三种；专项维护由Task6适配。服务器持久计划，默认TTL15分钟、最多10000候选、每份计划JSON最多16MiB，可显式配置且有限；超限明确拒绝。旧无版本替换明确拒绝，不能绕过新规则；只追加兼容入口也应委托同一规则。
**Blocked by:** Task1、2、3、4。
- [x] 测试预览后修订/新增/仅关联变化拒绝；复现123.45→130→旧输入不会改回；输入校验无半写。
- [x] 准备在短读事务复制基线，事务外匹配，持久化时复验版本；不可变计划，所有选择服务端验证。
- [x] commit先查幂等，匹配规范摘要；同计划同选择不同请求ID回原凭据并登记别名，异选择409；消费后即使过期仍可查原结果。事实/来源/审计/业务版本/凭据同事务。
- [x] 文件SQLite重启、两连接并发、故障注入、返回丢失及同ID恢复；TTL清理保留消费键与正式凭据。所有旧Store/脚本写入口登记归一，不能建立第二数据库权威。
- [x] 独立Luna规格/质量验收，协调者复验。


## Acceptance

Attempts: 2/5 frozen; scoped independent re-review pending. Candidate 1 independent Luna: Needs fixes (I-1 storage errors lose classification; I-2 malformed broker source evidence can be incorrectly excluded). Root 74 focused tests and frozen hashes passed, but do not close these gaps. Original FAIL retained. Candidate 2 assigned to original Sol implementer for combined fixes and baseline-provenance correction; review and root acceptance pending. Evidence: ../evidence/task-5/

## Dependency issue links

- [Task1](./01-task.md) must be accepted and closed.
- [Task2](./02-task.md) must be accepted and closed.
- [Task3](./03-task.md) must be accepted and closed.
- [Task4](./04-task.md) must be accepted and closed.

## 实施放行
Task1–4已独立验收，Task5候选1开始；Store/contracts/schema17和statement-market-repair.ts顺序移交，禁止共享文件并写。Task4 accountId可空及material-before-new-revision顺序见交接报告。


## Candidate 2 root checkpoint

Root read all 1203 compact fix-diff lines, independently verified all 13 source groups and 82 evidence hashes plus 78 original Candidate 1 package files unchanged. Native protocol tests 55 PASS; Store marker test 1 PASS / 71 skipped. These checks do not replace the pending original Luna scoped re-review. Evidence: `../evidence/task-5/root-candidate-2-verification.json`.

## Candidate 2 acceptance

Backend scope ACCEPTED, 2/5. Original dedicated Luna approved spec/quality and marked I-1/I-2/M-1 ADDRESSED; no new Critical/Important/Minor. Root read full review and compact fix diff, verified 13 source groups / 82 evidence hashes / 78 C1 originals, and independently ran 55 protocol + 1 late-marker tests PASS. Worker 333 PASS, tsc0 and lint0/5 baseline warnings retained. HTTP/UI, TradingView integration and whole feature are separate unverified gates. Task6 shared work and Task7 bounded core wiring are now explicitly released.

## 2026-10-27 实际 HTTP 回归：重开受影响的幂等门

旧候选2后端局部接受记录保留，但不能再作为当前完整通过结论。Task8真实socket首次执行发现同一合法旧修订请求首次200、原文重试409。初步定位为 request_json 混入服务端 recordedAt，详见 [DBB-10](10-legacy-revision-retry.md)。原有幂等测试未包含在此前root的298项子集中，需补回。修复实际候选1/5由 Sol6.1Ultra负责，独立 Luna5.6Max复核；仅授权 Store 与 trade-revisions.test.ts，不改HTTP合同或其他模块。受影响的Task6与Task7共享Store需复验，旧证据不删除。

## 2026-10-27 H6 第2/5轮定向修复进行中

独立 Luna 候选1 spec/quality FAIL 已由root源码复核：损坏历史scope在比较中触发原生异常，HTTP500而非兼容拒绝409；新请求也缺提前shape校验。原 Sol owner 在原两文件范围做第2/5轮，先RED后修复，候选1/旧socket失败锁保持不变。下一次真实运行须重新冻结并创建fresh run；当前未放行。详见[DBB-10](10-legacy-revision-retry.md)及 task-8-h6-luna-review-1.md。Task7仍FAIL/NOT ACCEPTED、Task8整体NOT VERIFIED；财务/Bars暂停。


## 2026-10-27 H6 candidate 3 bounded acceptance

Sol 6.1 Ultra candidate 3: focused 99 PASS, tsc exit 0; product unchanged from candidate 2 (related 299 PASS inherited). Dedicated Luna 5.6 Max review-3 spec/quality PASS. Root independently read the code/reports and ran 3 files / 138 tests PASS, exit 0; evidence task-8/h6-repair-3/root-focused-1.log and root-focused-result-1.json. Details and exact SHA: issues/10-legacy-revision-retry.md, latest entry. Runtime, new socket and full suite are NOT VERIFIED; do not close DBB-10. H6 3/5, I-1 2/5, V-1 1/5. Original FAIL records retained; Task7 NOT ACCEPTED, Task8 NOT VERIFIED, Finance/Bars paused, complete Home <=1s NOT VERIFIED.
