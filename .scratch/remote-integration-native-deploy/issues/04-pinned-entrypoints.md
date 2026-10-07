# 04 — Use the approved pinned runtime from standard entrypoints

ID: G07
State: closed
Status: accepted
Assignee: /root/runtime_engine
Coordinator: /root

Scope: uphold previously confirmed one-command native deploy/debug contract and exact Node26.0.0 + SQLite3.53.0. Ambient Homebrew Node loads3.53.1; official Node26 loads3.51.3. Root has independently compiled verified upstream3.53.0 in a temporary directory and measured correct SQL under HomebrewNode. Without an explicit user pin change, keep3.53.0. Root prepares a NEW private runtime at /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64 (copy owned Node/libnode/npm and verified SQLite; patch private dependencies only). Existing system runtimes/services/databases remain untouched. Binaries stay outside Git; source profile/entrypoints and reproducible provenance recorded.

Refs: AGENTS.md line17; user earlier confirmed native Node/SQLite/3333 fixed debug and one-command make deploy; conf/native-environment.json; docs/agents/development-workflow.md 本机统一业务入口; G05 and reports/sqlite3530-private-probe.json. UI images/elements/browser/visual gates N/A: runtime startup only, no product UI modification.

Journey: make deploy/status/rollback/down and make dev/npm run dev begin from ambient PATH, resolve executable from source conf or installed ops native-environment.json, execute only that configured runtime, then existing actual SQL preflight precedes side effects. A missing/invalid configured executable must fail; no fallback. Arguments, environment, signals and exit codes preserved by shell exec; no business configuration/database overrides.

Acceptance:
- [x] Private runtime measured26.0.0/SQL3.53.0 without DYLD overrides; provenance/hash/private dependency evidence recorded by root.
- [x] Source and installed entrypoints pick profile executable even when ambient PATH points to Homebrew3.53.1; startup/module/profile/npm alignment consistent.
- [x] Bootstrap test fails before implementation, then verifies actual SQL/executable and unchanged argument forwarding; missing configured runtime fails without fallback.
- [x] Native/debug/integration/type/scoped lint and independent review PASS; existing services untouched, old service version evidence remains unknown/invalidation retained.

Ownership: worker allowed scripts/native-node.sh (new), package.json dev command ONLY, root Makefile native targets ONLY, deploy/target/Makefile native targets ONLY, deploy/ops/start-native.command, scripts/deploy-native-toolkit.mjs/.test.mjs ONLY for installing/rollback ownership of new bootstrap, scripts/native-environment.test.mjs ONLY for new bootstrap tests/default probe executable. No Node path/pin config change, runtime installation, docs other than reports/pinned-entrypoints-implementation.md, tests execution, DB/service/Git/remote/subagents. Root owns conf/native-environment.json/private runtime/provenance/docs/all execution. Stage1 tests-only RED; no production edits until root observes RED.

History: 2026-10-07 original26/3.53.0 contract retained; no explicit user decision to change pin. Candidate private library SQL3.53.0 verified against upstream sqlite3.c SHA3-256 bb317fbbd2b3bc53233ddd5894bf4d2dc6f533445f350d4235dbcc86f65af4ec. Official3.51.3 candidate rejected, no installation.

## Coordinator acceptance — 2026-10-07

Coordinator /root independently accepts G05/G06/G07 on the frozen final candidate. Bare `npm run test:unit` passes 319 files / 3070 tests, with only the original 3 external-corpus files / 6 tests skipped; duration463.72s. `make deploy-test`60/60; `make debug-test`18/18; `npm test` builds and passes5/5 integration cases; typecheck exit0; scoped ESLint exit0 (2 existing debug-local unused-variable warnings). No timeout overrides, added skips, removed assertions or production UI changes. Source and installed fixture entrypoints select private Node26.0.0 / actual SQL3.53.0 even with ambient Homebrew SQL3.53.1; missing configured runtime fails without fallback. Final source hashes match the tested and reviewed candidate.

Evidence: reports/final-unit-result.json, final-unit.log, final-native.log, final-debug.log, final-build-integration.log, final-typecheck.log, final-scoped-eslint.log, source-freeze-verification.json, entrypoint-acceptance.json and final-native-review.md. Original FAILs and rejected experiments remain preserved. Live3022/3333 listener PIDs remain unchanged; existing processes' actual SQL versions are NOT VERIFIED. The installed production toolkit has not been updated by this integration. Actual deployment/restart acceptance is separate from this requested Git integration.

Accepted by /root for this issue's source/runtime/test scope after direct verification and independent review. See ../FINAL-ACCEPTANCE.md; historical failures are retained.
