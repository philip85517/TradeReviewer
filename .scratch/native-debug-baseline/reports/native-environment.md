# Native environment implementation report

Status: implementation-ready
Owner: native_environment (gpt-5.6-luna, medium)

## Scope

Implemented the pinned Node.js 26.0.0 / built-in SQLite 3.53.0 profile and synchronous `assertNativeEnvironment(options = {})` shared by source and installed native tooling. The assertion returns the measured `{ nodeVersion, sqliteVersion, nodeExecutable }` record and rejects mismatched versions or executables before native build/start/deployment side effects.

Native build and service startup now invoke the configured Node executable. Release metadata records measured tooling runtime evidence, while status labels tooling runtime separately and reports service runtime only when the observed listener executable matches the pinned executable. Legacy release metadata remains runtime-unknown rather than receiving fabricated values. The toolkit copies the profile and assertion module and retains transactional rollback behavior. The installed launcher checks the profile and starts npm through the pinned Node executable.

## Evidence

- Red baseline: `native-environment-red.log` — module missing before implementation (`ERR_MODULE_NOT_FOUND`).
- Green targeted suite: `native-environment-green.log` — 38 tests passed, 0 failed.
- Command: `/usr/local/Cellar/node/26.0.0/bin/node --test scripts/native-environment.test.mjs scripts/deploy-native-runtime.test.mjs scripts/deploy-native-toolkit.test.mjs scripts/deploy-native.test.mjs`
- Measured runtime: Node.js 26.0.0, SQLite 3.53.0, `/usr/local/Cellar/node/26.0.0/bin/node`.

## Files

Owned implementation files are `conf/native-environment.json`, `.node-version`, `scripts/native-environment.mjs` and its test, native runtime/deployment/toolkit modules and tests, and `deploy/ops/start-native.command`. Existing unrelated dirty deployment work was preserved.

## Limitations

The coordinator still needs to independently run the broader integration/type/build checks and inspect the combined deployment/debug behavior. No production deployment, service control, installation, or business database write was performed.

## Follow-up hardening

Toolkit installation now rejects symlinked target parents before canonicalization, hard-linked control files and revalidates rollback destinations before writing, preventing outside inode mutation. Native stop handling now accounts for the deterministic startup race where the initial `ps` identity sample is unavailable: ambiguous live processes are rejected rather than signaled, while an already-exited startup process still cleans up when no listener remains.

Orphan cleanup is now tied to the listener identity captured by a successful health check (listener PID, start time, process group, cwd, and executable). A later listener sharing only the old group or cwd is rejected and is never signaled.

Before adopting a listener owned by a wrapper child, the original wrapper PID must still be observable with its recorded start identity, group, and release cwd. A wrapper that exits before first health prevents adoption; the first-health 2xx regression proves no foreign listener is adopted. The orphan cleanup regression waits for a verified health observation before the wrapper exits. Read-only status probes may verify an existing pinned listener without adopting cleanup ownership.
