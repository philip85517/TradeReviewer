# Independent G05 engine-gate correction review

Reviewer: `/root/unit_review`, 2026-10-07 (Asia/Shanghai).

**Disposition: scoped PASS for the actual-engine gate correction. Final runtime selection and native acceptance remain pending.** The change fixes the metadata-only observation identified by I01 in `integrated-review.md`; it does not establish that the selected production/debug runtime or an existing service satisfies the approved pin. I01 and its original failure evidence remain preserved.

Reviewed the current worktree changes against integrated commit `cf7d48cc4d0052841b64690085e68b23325ffaea` in exactly `scripts/native-environment.mjs`, `scripts/native-environment.test.mjs` and `scripts/deploy-native-runtime.test.mjs`, together with issue `02-runtime-engine.md`, current G05 coverage, relevant workflow and unchanged callers. The coordinator clarified that read-only Git diff was allowed; no Git mutations or remote commands were performed. Only this report was written. No tests, SQL/database operations, services/process operations, browser, nested agents or source edits were performed.

## Spec

**PASS for source/API and the regression design.**

- `scripts/native-environment.mjs:27–35` opens only `:memory:`, performs synchronous `SELECT sqlite_version() AS version`, and closes the database in `finally`. Successful return and `prepare`/`get` failure both execute the close. Constructor failure has no returned connection to close. There is no business database path, file-backed fallback, extension loading or write query.
- Lines 39–44 validate the profile, Node version and executable before invoking the SQL probe at line 45. Bad profile/Node/path cannot enter the default probe. The source/installed profile lookup and synchronous exported API remain intact; line 47 retains exactly `{ nodeVersion, sqliteVersion, nodeExecutable }`. Its SQLite field comes from the SQL probe, not `process.versions.sqlite` or the injected metadata record. Probe errors propagate rather than falling back to metadata; an empty SQL result is rejected by the exact comparison.
- The new `getSqliteVersion` option is an explicit synchronous fixture seam. Normal debug/deployment/installed-launcher calls do not inject it. It is not exposed as an environment variable or CLI bypass. Existing `versions`, `execPath` and `profilePath` options still serve their prior fixture roles, with `versions.sqlite` deliberately no longer identifying the engine.
- The unchanged call order preserves the relevant side-effect gates: debug calls the assertion at `scripts/debug-local.mjs:179–180` before backup/lock/child setup; deployment calls it at `scripts/deploy-native.mjs:150` before target mutation/configuration/transaction work; runtime build and start call it at `scripts/deploy-native-runtime.mjs:172,187` before log creation, commands or service inspection/start; installed startup calls it at `deploy/ops/start-native.command:14` before executing the application.
- `scripts/native-environment.test.mjs:31–52` obtains a real in-memory engine independently, writes an owned temporary profile with SQLite `0.0.0`, injects matching `0.0.0` build metadata, and omits the SQL seam from the assertion under test. The unchanged old implementation therefore accepts that metadata and fails with “Missing expected exception”; the corrected default SQL path rejects it. Cleanup closes the independently opened connection and removes only the owned temporary directory. This is a meaningful regression against the original observation error rather than a mocked engine-only test.
- The original four environment cases remain; one regression is added. Synthetic success still checks the complete return object. Node, SQLite and executable mismatches remain separately checked. Profile validation and the no-argument exact Node26.0.0/SQLite3.53.0 assertions at lines 66–69 remain unchanged. The synthetic diagnostic regexes are broader (`/Node\.js/`, `/SQLite/`), so those two assertions no longer independently check the required-number text; the exact live pin is still asserted by the unchanged no-argument case, and the deployment mismatch retains `/SQLite 3\.53\.0/`. No case, skip or timeout was removed/added/extended to obtain a pass.
- The sole deploy-runtime test delta is line 250: use the actual executable and inject the deliberately wrong SQL engine `3.52.0`, allowing the SQLite branch to be reached after the new executable-first ordering. The rejection assertion and both zero inspection/start counters at lines 251–253 are unchanged. The bad-Node build test at lines 238–245 still asserts zero commands and no logs. The fixture correction follows the interface's new observation semantics without bypassing the tested branch.

The coordinator's preserved `runtime-engine-red.log` records one failing regression with “Missing expected exception”; `runtime-engine-green-regression.log` records that same named regression passing after the correction. These are coordinator-executed results, not reviewer execution. They establish the focused red/green evidence only; they do not establish all native suites or a final configured runtime.

## Quality

**PASS for the three-file correction; no Critical, Important or Minor changed-hunk defect found.**

The probe is a small private function, resource ownership is local, and the injected seam isolates synthetic checks while retaining a real default-path regression. Profile/Node/path checks precede work that could fail while opening SQLite. The expected mismatch error and the public result shape remain clear. Installed local Node typings (`node_modules/@types/node/sqlite.d.ts:228–242,275–280`) document synchronous `DatabaseSync`, `:memory:` and `close()`; the implementation uses that interface directly. There is no asynchronous leak or business-data dependency introduced by this correction.

Reviewed worktree SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| scripts/native-environment.mjs | `ac2ef89f00db03d221351c4780671266c715a9adda20f7389ae744fc9fe602da` |
| scripts/native-environment.test.mjs | `5de32f08aafa09992173a562d4b85caa73f83747d1c319da68ed1bc0787d3e92` |
| scripts/deploy-native-runtime.test.mjs | `ec185dcbe4f8e581f77f0b3c548b0e50cf8e7c9510fe459f73a9a316e2f38c93` |

## Remaining runtime/evidence boundary

The changed guard measures **the invoking process's loaded engine**. It does not query another already-running process. The unchanged `scripts/deploy-native.mjs:133–135` assigns the invoking process's measured record to `serviceRuntime` solely when the service executable path matches. The unchanged runtime health predicate at `scripts/deploy-native-runtime.mjs:234` checks executable/ownership/health, not a SQL version returned by that service. `makeEnvironment` at lines 37–44 copies the caller-provided environment before its normal override cleanup.

Therefore a temporary private-library probe in the tooling process cannot be used to conclude that an older same-executable service loaded the same SQLite library. Library overrides supplied to a child can also differ from the invoking process's environment. This is an existing evidence limitation outside the three-file correction, relevant to the coordinator's pending runtime choice; no claim is made here that the existing service actually uses a particular version. Resolve that proof boundary in final operational evidence or implementation before reporting the service's actual engine as accepted. The corrected local preflight does not by itself close it.

The current committed profile still requires Node26.0.0/SQLite3.53.0. Diagnosis records Homebrew metadata3.53.0 versus SQL3.53.1; the preserved official-runtime probe records Node26.0.0 with SQL3.51.3. The coordinator also reports that an isolated temporary private SQLite3.53.0 probe works. These observations are not a selected, configured, reproducibly launched final runtime. On the original Homebrew environment the corrected gate should reject, which is expected behavior rather than acceptance failure of this source correction.

Recommendation: accept this bounded correction for continued integration work. Keep G05 open until runtime selection/pin/startup alignment, actual relevant process engine evidence, fresh native/deploy/debug and applicable integrated checks, and independent final acceptance are complete. Do not relabel historical metadata observations as SQL measurements or use this scoped PASS as merge readiness.
