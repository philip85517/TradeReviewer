# Final acceptance

Current status: source/runtime correction accepted on2026-10-07; live deployment/debug verification remains pending. The2026-10-06 tables below are historical and their metadata-only SQLite identification was invalidated; see the appended regression and current source reacceptance.

State: open
Status: integration-pending (live deployment/debug verification)
Coordinator: /root
Accepted: 2026-10-06

All applicable requirements R01–R10 have supporting evidence. The repository-wide unit run remains FAIL as recorded below; acceptance is limited to the approved native deployment and isolated worktree debug contract. No application release, commit, remote push or merge was performed.

No business UI modification: UI design/visual fidelity and chart/replay journeys are NOT APPLICABLE. Actual debug startup/data loading/browser persistence are applicable operational acceptance gates.

Prior production service/version evidence is retained in ../local-native-deploy/reports/FORMAL-RUNTIME-VERSION-AUDIT.md. New before/after evidence must be captured for this task; prior reports alone do not prove the current state.

## Operational acceptance

| Gate | Result | Evidence |
| --- | --- | --- |
| Exact native runtime and dependency installation contract | PASS — Node26.0.0, built-in SQLite3.53.0, pinned executable and npm CLI, lockfile npm ci; mismatches reject before side effects | [Native suite57/57](reports/native-deploy-final-green.log), [independent review](reports/independent-review.md) |
| Native source/installed command selection | PASS — source and installed status healthy/consistent; installed dry run resolves explicit full SHA, port3022 and formal SQLite; native markers never silently select Docker | [Installed controls](reports/installed-controls-acceptance.json), [dry run](reports/installed-native-dry-run.json), [target selection](reports/target-make-selection.json) |
| Production preservation | PASS — release `20260923-master-ee76e83`, PID98660, current pointer and runtime-config hash unchanged; no formal restart | [Installed before/after](reports/installed-controls-acceptance.json), [installed status](reports/installed-native-status.json) |
| Real worktree startup / owned fixed copy | PASS — `make dev` on loopback3333; observed listener51308 cwd is this worktree; open DB files belong only to fixed test copy | [Listener evidence](reports/final-listeners.json), [startup](reports/actual-debug-restart-accepted.log) |
| Actual browser write / return / reload / restart reset | PASS — showVolume true→false persisted in SQLite and HTTP, survived return/reload/re-entry, reset to source true after restart and visibly confirmed in browser | [Browser journey](reports/browser-acceptance.json), [persisted setting](reports/debug-persisted-settings.json), [reload](reports/debug-settings-after-reload.json), [reset](reports/debug-reset-evidence.json), [reset screenshot](reports/debug-reset.jpg) |
| Source business-data safety | PASS —46 tables /209970 rows, schema/count/content fingerprints unchanged from pre-debug through control installation; both quick_check ok | [Final comparison](reports/formal-db-final-comparison.json), [before](reports/formal-db-before.json), [final](reports/formal-db-final.json) |
| WAL backup / publication / lifecycle counterexamples | PASS — real synthetic uncheckpointed WAL copied; failures preserve prior data; alias/open DB/occupied port/concurrency rejected; bounded owned shutdown and lock safety | [Debug15/15](reports/debug-final.log), [independent counterexamples](reports/independent-review.md) |
| Lower-level owned DB / dynamic-port integration | PASS — npm test built application and passed5 integration tests using explicit isolated fixture | [Build/integration](reports/npm-test.log) |
| Type and scoped lint | PASS | [Typecheck](reports/typecheck.log), [scoped lint](reports/scoped-lint-final.log) |
| Existing deployment and runtime configuration tests | PASS —58 deployment cases isolated;6 runtime-config cases | [Comparison and isolated rerun](reports/unit-comparison.json), [runtime config](reports/runtime-config-final.log) |
| Independent review | PASS — all ten confirmed findings resolved; final native57/57; reviewed hashes match accepted modules | [Review](reports/independent-review.md), [snapshot hashes](reports/reviewed-snapshot-hashes.json) |
| Browser blocking errors | PASS — no captured console errors | [Browser errors](reports/browser-errors.json) |
| UI/reference visual and chart/replay feature gates | NOT APPLICABLE — no application UI/business behavior changed; operational browser journey above remains applicable | Approved scope in README.md |

## Explicit failures and limits

- **FAIL, repository-wide unit run:**65 failed,2999 passed,6 skipped;9 failed files. [Full log](reports/full-unit.log) and [comparison](reports/unit-comparison.json) retain exact cases.40 failures match previous logs. Three deployment timeout cases passed the isolated58-case rerun. The other22 cases are UI/business tests without matching prior-log evidence; their cause was not established and they are not silently labeled baseline failures. No UI/business source is changed in this task. This operational acceptance does not certify those features or a repository-wide green suite.
- Historical native run52/53 exposed a startup-identity race. It is preserved in [original failed run](reports/native-deploy-final.log); the added guard/counterexample and final57/57 resolve it. Independent review preserves all other original reproductions and passing resolutions.
- Existing production release has legacy metadata (`fullcommit: UNKNOWN` in installed status); measured runtime is reported separately. No invented metadata was written to the release. The previously audited source revision remains prior evidence, not newly measured release metadata.
- Only control files were installed, with originals retained under `reports/control-backups/`. Rollback behavior is covered by synthetic transaction tests; an actual production-control rollback was not needed or exercised. No new application deployment was executed during this acceptance.
- Standard debug restart deliberately discards previous test edits. One listener at3333 means one worktree debug service at a time. Advanced automated fixtures retain explicitly owned DB paths and dynamic ports through `scripts/start-local.mjs`.
- Current modifications are uncommitted; default current-source deployment will reject them until committed. No automatic commit or remote integration is authorized.

## Developer operation

From the source worktree: `make deploy` publishes committed current HEAD; `make deploy REF=master` fetches remote master; append `DRY_RUN=1` to preview. `make deploy-status` checks pointer/process/runtime/HTTP agreement. `make dev` and `npm run dev` share the same fresh-copy3333 entry. The running preview is http://127.0.0.1:3333/; stop the foreground launcher with Ctrl+C before starting another standard debug session.

## 2026-10-07 integration regression — current gate FAIL

Actual SQLite engine gate invalidated: Homebrew Node metadata reports3.53.0 but in-memory SQL reports3.53.1. Prior metadata-only runtime acceptance is historical, actual engine check FAIL. No business database or existing service changed. See ../remote-integration-native-deploy/issues/02-runtime-engine.md.

## 2026-10-07 source/runtime correction accepted; deployment verification pending

G05/G07 source gates now PASS: assertNativeEnvironment queries actual sqlite_version() in a private in-memory database; configured bootstrap selects a new private exact26.0.0/3.53.0 runtime, and missing executable rejects without fallback. Native60/60, debug18/18, isolated source/installed make/status/launcher acceptance, build/integration5/5, typecheck and scoped lint (0errors/2warnings) passed. Independent final review and source freeze passed. See ../remote-integration-native-deploy/FINAL-ACCEPTANCE.md and its reports. Private runtime provenance is in ../../conf/NATIVE-RUNTIME.md (repository conf/NATIVE-RUNTIME.md).

The earlier metadata-only runtime PASS is invalid for identifying the actual engine. Prior data/browser/control-install evidence is preserved as history. Existing production toolkit and3022/3333 processes were not reinstalled/restarted in this Git integration; their actual loaded SQLite versions are NOT VERIFIED. Therefore the native deployment/debug feature remains open/integration-pending until a separately requested actual deployment/restart is verified; source acceptance does not close that live operational gate.
