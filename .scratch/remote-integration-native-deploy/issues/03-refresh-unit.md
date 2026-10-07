# 03 — Stabilize the saved refresh summary unit journey

ID: G06
State: closed
Status: accepted
Assignee: /root/refresh_repair
Coordinator: /root

Scope: diagnose the integrated full-suite 5000ms timeout in app/components/trade-review-workspace.refresh.test.tsx, test “refreshes the global saved summary after a single instrument update” (line380). Preserve all existing assertions, actual component/storage seam, navigation and data summary/detail outcomes; no new skips, higher timeout, mocked product component or product behavior change. This is test infrastructure work; UI images/elements and browser/visual gates are N/A because production rendering/state is unchanged. Any product defect discovered must be reported before expanding scope.

Refs: user “先进行全仓单测的修复工作”, current integration request; .scratch/unit-suite-repair/README.md 契约; app/components/trade-review-workspace.refresh.test.tsx lines177–197 and380–463; DESIGN-COVERAGE.md G06; docs/agents/development-workflow.md and task-decomposition.md.

Blocked by: none for diagnosis. Root owns all test execution and acceptance.

Acceptance:
- [x] Preserve the full-suite FAIL and diagnose the dominant delay or stale state with source and targeted coordinator evidence.
- [x] Bounded test-only fix retains provider call count, global complete/partial summary and reentered detail interval assertions with no timeout/skip change.
- [x] Targeted file and fresh bare full-unit suite pass; type/scoped lint pass; independent review confirms assertions/coverage.
- [x] Original unit acceptance records append regression and fresh evidence without erasing history.

Dispatch: stage1 read-only diagnosis of this test, its relevant component/storage/query code and prior unit repair evidence; write only reports/refresh-diagnosis.md. Root will execute timed original targeted file. Stage2 can edit only app/components/trade-review-workspace.refresh.test.tsx after source diagnosis and root authorization. Do not run tests, launch services, touch database files/config/product source, Git or remote, or spawn agents.

History: 2026-10-07 integrated bare full suite:318files pass/1fail/3skip,3069pass/1fail/6skip,490.66s. Test5121ms/file21303ms. See reports/integrated-unit.log and result.json. Old acceptance preserved but current whole-suite gate reopened.

## Coordinator acceptance — 2026-10-07

Coordinator /root independently accepts G05/G06/G07 on the frozen final candidate. Bare `npm run test:unit` passes 319 files / 3070 tests, with only the original 3 external-corpus files / 6 tests skipped; duration463.72s. `make deploy-test`60/60; `make debug-test`18/18; `npm test` builds and passes5/5 integration cases; typecheck exit0; scoped ESLint exit0 (2 existing debug-local unused-variable warnings). No timeout overrides, added skips, removed assertions or production UI changes. Source and installed fixture entrypoints select private Node26.0.0 / actual SQL3.53.0 even with ambient Homebrew SQL3.53.1; missing configured runtime fails without fallback. Final source hashes match the tested and reviewed candidate.

Evidence: reports/final-unit-result.json, final-unit.log, final-native.log, final-debug.log, final-build-integration.log, final-typecheck.log, final-scoped-eslint.log, source-freeze-verification.json, entrypoint-acceptance.json and final-native-review.md. Original FAILs and rejected experiments remain preserved. Live3022/3333 listener PIDs remain unchanged; existing processes' actual SQL versions are NOT VERIFIED. The installed production toolkit has not been updated by this integration. Actual deployment/restart acceptance is separate from this requested Git integration.

Accepted by /root for this issue's source/runtime/test scope after direct verification and independent review. See ../FINAL-ACCEPTANCE.md; historical failures are retained.
