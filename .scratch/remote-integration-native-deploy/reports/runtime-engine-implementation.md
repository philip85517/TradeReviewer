# G05 runtime engine implementation report

## Stage 2 — implementation ready

- Changed only `scripts/native-environment.mjs` and `scripts/native-environment.test.mjs`.
- `assertNativeEnvironment` now validates the profile, Node version, and executable before opening SQLite, then synchronously measures `sqlite_version()` from an isolated `:memory:` `DatabaseSync` and closes it in `finally`.
- `versions.sqlite` is no longer used as a live-engine fallback. Synthetic tests use the explicit `getSqliteVersion` seam where a deterministic pinned value is needed.
- Synthetic expected Node, SQLite, and executable values are read from `nativeEnvironmentProfilePath()`; no Homebrew executable path is hardcoded.
- Synthetic Node and SQLite mismatch assertions require the exact configured profile version text in the thrown error.
- The deploy-runtime preflight test now passes `process.execPath` and an explicit simulated `3.52.0` SQL engine while retaining its inspection/start counters.
- The temporary-profile regression still injects matching `0.0.0` build metadata and expects rejection based on the live SQL engine.
- The three-field return shape remains `{ nodeVersion, sqliteVersion, nodeExecutable }`.

Per the bounded G05 instructions, tests were not run. Coordinator should run the scoped regression and full required checks on the selected runtime.
