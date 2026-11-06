# Independent full-suite failure triage

Date: 2026-11-06  
Candidate manifest: `review-candidate-manifest.json`, product SHA `f58e0cfa909635925e75f1a8e2e04331c1f102dc47f26391bb15a41913f12247`  
Run log: `/tmp/tradereview-write-precompute-full-20261106.log`

## Scope and evidence limits

This is a read-only triage of the coordinator's full-suite log and current/frozen source. I did not run tests, builds, or services, open either business database, inspect the coordinator's acceptance database, or edit product/tests. The suite result in the log is **392 files passed, 17 failed, 3 skipped; 5,773 tests passed, 97 failed, 6 skipped; 858.25 seconds**.

The candidate manifest binds the reviewed source version and shows the scoped changes are limited to the Task 1/Task 2 candidate files. Where the frozen byte subset contains source, I compared it directly. The coordinator also reports representative old-byte reruns: one workspace import case and one SQLite-store TradingView case failed on old bytes; a recovery-refresh case passed when run alone on old bytes. Those representative controls are useful but do not establish the baseline status of all 97 failures. I did not independently run those controls and have no raw old-byte run log in this report.

## Findings

### 1. `sqlite-store.test.ts`: two snapshot failures are caused by Task 1 queue installation; audit-only semantics need a deliberate boundary

**Severity: P2, scope: Task 1 integration; Task 2 not implicated.**

`db/sqlite.ts` adds `ensureHomepageRefreshQueue(database)` after `initializeSqlite()`. The new triggers in `app/lib/storage/homepage-refresh-queue.ts:10-12, 67-75` include `import_history_audit_state`, `import_history_plan_proofs`, `import_history_memberships`, `import_history_material_refs`, and `import_history_audit_dirty`. An update to any column advances `homepage_view_input_state.revision` and upserts the default queue with a `conservative-global` reason. `ensureImportHistoryAudit()` increments `import_history_audit_state.generation` when it rebuilds (`app/lib/storage/import-history-audit.ts:46-82`). The store tests create their databases through `openSqliteDatabase()` (`app/lib/storage/sqlite-store.test.ts:38-42`), so these new triggers are active in the failures.

The log’s failures at `sqlite-store.test.ts:501` and `:993` show only two added product-side rows: input revision **18 → 22**, and the default pending queue generation **18 → 22**, with the final reason `import_history_audit_state:update:conservative-global`. The first case has `summary.changes=[]` and a review-required identity plan; the second expects product tables unchanged immediately after preparing the same-locator/different-run review. The expected audit/plan additions are separately asserted by the existing helpers. The queue and input-version tables are not among the excluded management/audit tables, so the failure is not explained by an omitted derived column.

The transaction boundary matters: `trade-changes-engine.internal.ts:218-225` runs `ensureImportHistoryAudit()` before committing a prepared plan. A review-required commit fails at `:383` before the apply path. Thus the observed queue is created by the successful **prepare/audit transaction**, not by the rejected commit itself; the log does not show a second queue mutation caused by the refusal. The pending queue row is real, but this test does not start a worker or prove a result was published.

Audit data is a genuine homepage dependency in general. `readImportHistoryCommits()` (`import-history-audit.ts:87-105`) can remove or restore `committedDuplicateTradeCount` depending on the audit trust state and certified membership rows. A change to trust/readiness, dirty state, proof completeness, committed membership/count, or material references can therefore change homepage-visible evidence and must invalidate. The `generation` value itself is not read by this projection. In the failing review-only scenario, the expected new proof has `scope_json="[]"`, `consumed=0`, no membership/material-reference change, and the review summary has no business changes; that combination appears not to change the final homepage projection. It is therefore a strong candidate for conservative but unnecessary work, rather than a demonstrated financial qualification change. The log does not include before/after serialized homepage payloads, so projection equality is inferred from the code path, not measured here.


The Task 1 `backend-report.md:9` explicitly documents that audit-state maintenance may raise the global revision and must not be described as a trade change. That satisfies the plan’s requirement to disclose conservative audit-derived queueing, so these two failures alone do **not** establish a specification violation. Per coordinator instruction, no trigger or audit-qualification changes are requested here: the specification permits conservative global invalidation, and audit trust/qualification must not be weakened. The acceptance boundary should remain explicit: preserve invalidation for changed trust or committed evidence; record the empty/unconsumed review-proof rebuild as conservative audit-derived work and count it as a performance gap unless shown to affect the homepage projection. Do not resolve the failing assertions by silently filtering queue/input-state rows. A targeted test should distinguish a true audit qualification change from a review-only proof, and a rollback/rejected-commit case should show no new valid queue generation attributable to the rejection.

### 2. `sqlite-store.test.ts`: `FILE_TRADES_ALREADY_EXIST` has no direct Task 1/2 path

**Severity: P2, attribution: unproven; no direct candidate cause identified.**

The first storage failure is `SqliteStore.assertLegacyFileTradesExist()` at `app/lib/storage/sqlite-store.ts:2197`, reached from the test’s second `store.mergeExecutions(preview.records)` call (`sqlite-store.test.ts:177`). That guard intentionally throws when every incoming candidate is already present with the same recognized platform/file fingerprint/format rule. The actual exception is therefore consistent with the current guard, while the test expects the repeated file import to return normally. The guard and test are outside the candidate’s changed file set. This is a strong indication of an existing test/behavior mismatch, but only a baseline run can prove it predated this candidate.

### 3. Trading-room history and holdings failures are pure projection mismatches; no Task 2 causal path found

**Severity: P2, attribution: unproven; no direct candidate cause identified.**

The log reports 17 failures in `app/lib/reviews/trading-room-history.test.ts`, one in `app/lib/reviews/trading-room-holdings.test.ts`, and one in `app/components/dashboard/room-holdings.test.tsx`. Examples include expected daily PnL `{USD: "300"}` but actual `{}`, expected a holding/quote price but actual `undefined`, and date sampling differences (`2026-09-18` expected, `2026-09-20` actual). The room-history/holdings implementations are present byte-for-byte in the frozen source subset and are outside Task 1/2’s changed modules. They consume the shared `position-ledger.ts`, which is also unchanged; the Task 2 homepage financial source model does not import these room projections. These are direct-value assertion failures, not evidence of SQLite queue behavior.

The root full-suite log establishes that the failures are current. It does not establish why the pure projections differ from their fixtures, or whether the same assertions failed on the frozen baseline. No baseline run was done, so I do not label them pre-existing or Task 2 regressions.

### 4. Import-flow failures stop at an unsupported test-harness route

**Severity: P2 test-coverage blocker; production causality unresolved.**

The log lists 37 failures in `app/components/trade-review-workspace.import-flow.test.tsx` (47 tests total). Representative failures show the workspace in its startup error state with `Unsupported workspace operation: GET /api/storage/homepage-catalog`; `openImportManagement()` then throws `import entry is not ready` at test line 254. The current SQLite workspace harness dispatches status/bootstrap/homepage-source and other routes, but has no `GET /api/storage/homepage-catalog` case (`app/components/test-support/sqlite-workspace-harness.ts:175-199` and route switch). It initializes SQLite directly through `initializeSqlite()`, so it also bypasses the new queue hook.

This is a harness failure before the import journeys execute. The frozen `homepage-view-client.ts` already called the same catalog URL synchronously; Task 1 adds bounded polling for a 202 response, but the failing harness throws before it can return any HTTP response. That makes the missing fixture route the immediate cause and weakens attribution to the new 202 behavior. The coordinator reports that a representative workspace-import case fails on old bytes too, supporting a baseline fixture mismatch for that case; it does not prove that all 37 current failures are baseline failures or that the production journey passes.

### 5. One recovery-refresh test remains unexplained by baseline controls

**Severity: P2, attribution unresolved.**

`app/components/trade-review-workspace.test.tsx` reports “Recovery identity binds the actual refresh retry key and accepts same-batch completion” failing in the full candidate suite: the DOM lacks the expected “查看持仓详情” button. The coordinator reports that the same test passes when run alone against old bytes, but the candidate full-suite failure remains unassigned. This is evidence against classifying all unrelated failures as pre-existing; it could be a candidate interaction or suite-load/order effect. No causal conclusion is made here.

## Triage conclusion

For the reviewed failures, I found no direct Task 2 code path in the room-history/holdings or repeated-file-import assertions. The two SQLite snapshot failures are directly caused by Task 1’s new persisted input-generation/queue side effect; they do not show a trade mutation or a queue created by the rejected commit itself. Audit trust and committed membership are legitimate invalidation dependencies; the specific empty pending-review proof appears not to alter the final homepage projection, so its extra generation/task is recorded as a conservative performance gap, with no request to weaken audit qualification or change the trigger in this read-only triage. The workspace import-flow suite is currently blocked by a missing harness route, and a representative old-byte failure supports that fixture diagnosis. The recovery-refresh failure remains unassigned despite its old-byte single-test pass. These findings do not support labeling all 97 failures as baseline.

This report is triage only. It is not a Task 2 acceptance verdict, not proof that any unexplained failure is pre-existing, and not evidence that the complete homepage meets the one-second target.
