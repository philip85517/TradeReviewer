# Native deployment and worktree debug baseline

State: closed
Status: accepted (deployment/debug scope)
Coordinator: /root
Approved design: user confirmed the concrete design in this chat on 2026-10-06.

## Approved contract

- Production remains native Node.js at `127.0.0.1:3022`, deployment root `/Users/zhoulin/projects/交易空间/TradingReview`, business SQLite `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`.
- Source and installed production deployment commands use native tooling. Preserve releases, current pointer, existing configuration and database. This task updates the control toolkit; it does not publish new application code or change the running release.
- Pin and check the observed runtime: Node.js 26.0.0 and built-in SQLite 3.53.0. Dependency installation uses package-lock.json and npm ci. Record the actual runtime with release/status evidence. SQLite schema versions remain migration-controlled.
- `make dev` and `npm run dev` start the current worktree on `127.0.0.1:3333` with `<worktree>/.data/tradereview-test.sqlite`.
- Every standard debug startup performs a read-only, WAL-aware SQLite online backup from the configured production database, verifies quick_check, and atomically refreshes the fixed test copy. Restart resets prior debug modifications.
- Reject occupied port, source/destination alias or hard link, unsafe symlink paths, in-use test database, concurrent startup, invalid runtime and invalid/failed backup. Never fall back to the business database.
- Explicit integration-test databases and dynamic ports remain available through the lower-level launcher; test fixtures own all cleanup.

## Ownership

- native_environment (gpt-5.6-luna, medium): environment profile/module, native deployment/startup and toolkit files/tests.
- debug_launcher (gpt-5.6-luna, medium): dedicated debug launcher and its Node tests.
- /root: Makefile, package metadata, integration-test caller, Vitest exclusions, documentation/workflow, integration and independent acceptance.
- Independent review: a non-implementing reviewer checks both slices and integration.

## Shared interface

`scripts/native-environment.mjs` exports synchronous `assertNativeEnvironment(options = {})`; no-argument use verifies the source/installed profile and returns `{ nodeVersion, sqliteVersion, nodeExecutable }`. Tests may supply a versions record/execPath/profilePath to exercise mismatches. Source profile is `conf/native-environment.json`; installed toolkit carries its own `ops/native-environment.json` and module. Both debug and deployment call this assertion before side effects.

## Tasks and evidence

- [01 — Native runtime and deployment control](issues/01-native-environment.md)
- [02 — Safe fixed-port debug startup](issues/02-debug-launcher.md)
- [03 — Integration and acceptance](issues/03-integration.md)
- [Requirement coverage](DESIGN-COVERAGE.md)
- [Final acceptance](FINAL-ACCEPTANCE.md)

Prior deployment acceptance is preserved in `.scratch/local-native-deploy/`; this adds a new accepted scope and does not overwrite historical evidence.

## Accepted result — 2026-10-06

The coordinator independently accepted the operational contract. Verified native controls are installed in the production directory. Its existing release `20260923-master-ee76e83`, listener PID98660, configuration, and all46 business-table fingerprints remain unchanged. Worktree debug is running at http://127.0.0.1:3333/ using only `.data/tradereview-test.sqlite`; actual browser writes survived navigation/reload and reset after `make dev` restarted from the online source. Browser error logs are empty.

Native deployment57/57, debug/environment15/15, existing deployment58/58, runtime configuration6/6, typecheck, scoped lint and build/integration5/5 passed. Independent review resolved all ten confirmed findings. The broad repository unit run remains FAIL (65 failures); only40 were present in prior logs, three deployment timeouts passed isolated rerun, and22 other UI/business failures have no matching prior-log evidence. These are preserved explicitly in final acceptance; no repository-wide green claim or new application release is made.

Changes remain uncommitted. `make deploy` requires a committed current HEAD; `make deploy REF=master` obtains remote master. See [Final acceptance](FINAL-ACCEPTANCE.md) for evidence and operational limits.
