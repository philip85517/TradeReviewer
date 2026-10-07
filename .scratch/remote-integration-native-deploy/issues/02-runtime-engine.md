# 02 — Check the actual SQLite runtime engine

ID: G05
State: closed
Status: accepted
Assignee: /root/runtime_engine
Coordinator: /root

Scope: preserve the approved exact Node26.0.0 / SQLite3.53.0 contract and existing native assertion result shape, but measure the live engine through isolated in-memory DatabaseSync and sqlite_version(). Build metadata cannot prove the live version. No business database, app UI, existing service or system runtime mutations.

Refs: AGENTS.md line17; conf/native-environment.json; scripts/native-environment.mjs lines27–36; docs/agents/development-workflow.md 本机统一业务入口; DESIGN-COVERAGE.md G05. UI elements/images/browser/visual checks are N/A for this native preflight correction.

Blocked by: none for test-first gate correction; runtime selection is coordinator owned. The original pin remains unless the user explicitly changes it.

Acceptance:
- [x] Failing regression demonstrates that a profile matching injected build metadata still rejects a different real SQL engine; owned temporary profile and in-memory SQLite only.
- [x] Live engine measured/closed synchronously; returned sqliteVersion is the measured engine; bad Node/path/profile still fail before native operations.
- [x] Native/deploy/debug suites, relevant integration/build/type/lint checks and independent review pass on the final configured runtime.
- [x] Preserve old runtime acceptance and append the newly discovered invalidation with evidence. Never relabel metadata-only observations as actual SQL checks.

Ownership: implementation agent may write only scripts/native-environment.mjs, scripts/native-environment.test.mjs and reports/runtime-engine-implementation.md under this task. First stage writes test only, no implementation until root observes RED. Coordinator owns config, startup pin alignment, runtime installation/selection, regression records and all test execution. Reviewer only writes their report. No nested agents, full tests, services, remote operations or other edits.

History: 2026-10-07 — source metadata is3.53.0, SQL query repeatedly3.53.1; otool links /usr/local/opt/sqlite, resolving to Cellar/sqlite/3.53.1. Historical runtime pin acceptance is invalid for actual engine identification; data and other evidence remain preserved.

## Coordinator acceptance — 2026-10-07

Coordinator /root independently accepts G05/G06/G07 on the frozen final candidate. Bare `npm run test:unit` passes 319 files / 3070 tests, with only the original 3 external-corpus files / 6 tests skipped; duration463.72s. `make deploy-test`60/60; `make debug-test`18/18; `npm test` builds and passes5/5 integration cases; typecheck exit0; scoped ESLint exit0 (2 existing debug-local unused-variable warnings). No timeout overrides, added skips, removed assertions or production UI changes. Source and installed fixture entrypoints select private Node26.0.0 / actual SQL3.53.0 even with ambient Homebrew SQL3.53.1; missing configured runtime fails without fallback. Final source hashes match the tested and reviewed candidate.

Evidence: reports/final-unit-result.json, final-unit.log, final-native.log, final-debug.log, final-build-integration.log, final-typecheck.log, final-scoped-eslint.log, source-freeze-verification.json, entrypoint-acceptance.json and final-native-review.md. Original FAILs and rejected experiments remain preserved. Live3022/3333 listener PIDs remain unchanged; existing processes' actual SQL versions are NOT VERIFIED. The installed production toolkit has not been updated by this integration. Actual deployment/restart acceptance is separate from this requested Git integration.

Accepted by /root for this issue's source/runtime/test scope after direct verification and independent review. See ../FINAL-ACCEPTANCE.md; historical failures are retained.
