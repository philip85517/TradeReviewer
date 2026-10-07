# Independent native deployment / debug review

Reviewer: `/root/native_debug_review` (non-implementing). Last updated: 2026-10-06 11:58 UTC.

Review status: **SCOPED PASS — no unresolved confirmed findings**. All ten findings retain their original failing evidence and passing independent resolution checks below. This is a scoped review, not feature acceptance. The coordinator owns integration, actual browser/persistence journeys, formal control installation, and final acceptance.

## Contract and scope

Read `AGENTS.md`, `docs/agents/development-workflow.md`, this feature's `README.md` approved contract and `DESIGN-COVERAGE.md`. Reviewed source changes on `codex/local-native-deploy`, based on HEAD `63690a494b8ad403081c7720985be54a95db60c7`; implementation remains uncommitted and changed during review.

Read the debug launcher and tests, native environment/profile and tests, native deployment/runtime/toolkit modules and tests, source snapshot module/tests, generic deploy hooks, desktop command, root/target Makefiles, package scripts/lock metadata, integration-test caller, Vitest exclusion, and associated runtime/deployment documentation. No implementation files were modified by this reviewer. Only this report was written with the coordinator's explicit authorization.

All reproductions used owned temporary directories, synthetic SQLite databases, synthetic processes, or stubbed process inspection/signaling. No real business database was opened by the reviewer; no production service was installed, started, stopped, or otherwise controlled. No dependencies were installed. All owned fixture processes and directories were cleaned up.

Latest reviewed module hashes (SHA-256):

| Module | Hash |
| --- | --- |
| `scripts/debug-local.mjs` | `45e5a8e0447f6b6be707570c2d7859e22c992490771fc4af4026ff3347700972` |
| `scripts/deploy-native-runtime.mjs` | `45a353ae83cace5bfb1b6be8a66b82aa92eda845055f2e2893b80f1ce9e413da` |
| `scripts/deploy-native-toolkit.mjs` | `44061bbb9f3fd4dd54f41b2bc80032ae8fcc0ebcd81256898f94ddff3d6ef86e` |
| `scripts/native-environment.mjs` | `18e15ad2805532c622092de0ee4917c436a72baafb05b77905c8910c21c739e9` |

## Findings and resolution evidence

### F08 — Reused process group can pass orphan cleanup ownership (P1)

Original route: `scripts/deploy-native-runtime.mjs`, `stop()` orphan branch proved only that the runtime still held its old wrapper record and that the current listener had the same numeric group ID and release working directory. The owner subsequently records the healthy listener's full identity and requires it in orphan cleanup. The original route and a replacement after an owned listener was recorded now independently reject with no signal attempt.

Independent synthetic reproduction used an originally verified wrapper with start time `Tue Oct  6 19:52:00 2026`, then returned no wrapper process and a replacement listener with a different PID and start time `Tue Oct  6 19:59:00 2026`, the old numeric group ID, and the same release cwd. `stop()` accepted the replacement and attempted group `SIGTERM`. Signaling was stubbed, so no real process was touched. Result: `stopRejected:false`, `killed:[[-987654321,"SIGTERM"]`.

Remaining route: before the first listener identity is recorded, `waitHealthy()` trusts a numeric group match without proving that the original wrapper/group is still owned. A synthetic original wrapper with verified start time19:52 exited before first health sampling; a replacement listener with a different PID/start time19:59 reused its group ID, cwd and pinned executable and returned2xx on both health endpoints. `waitHealthy()` accepted and recorded this replacement; the strengthened orphan `stop()` then accepted that newly recorded identity and attempted group SIGTERM. Result: `healthyAccepted:true`, `stopRejected:false`, `killed:[[-987654321,"SIGTERM"]]`. All inspection, fetch, and signaling were stubbed; no real service or process was controlled.

Requested resolution: establish live ownership of the original wrapper/group before the first listener identity is recorded, or reject the first unproved orphan adoption. Preserve the recorded listener identity and revalidate it for later orphan cleanup. Add the first-health-after-group-reuse counterexample alongside legitimate wrapper and orphan journeys. Sent to the coordinator.

Resolution: **PASS independent rerun.** Before first child-listener adoption, the latest runtime verifies the live wrapper's PID/start time/group/cwd. First-health-after-reuse now times out without making a signal attempt; subsequent stop rejects. The null-timestamp, direct orphan-replacement, and recorded-owned-listener replacement cases also reject with `killed:[]`. The first version of this guard introduced F10 below, subsequently resolved independently.

### F09 — Toolkit canonicalization masks an unsafe target ancestor (P2)

`scripts/deploy-native-toolkit.mjs`, `beginNativeToolkitTransaction()`: the requested target is checked for a final-component symlink, then `realpathSync.native(dirname(target))` canonicalizes its parent before `rejectSymlinkAncestors()` examines it. An intermediate symlink therefore disappears from the path being validated.

Independent owned fixture: `linked-parent` was a symlink to a separate `outside` directory; targetDir was `linked-parent/target`. The transaction was accepted and wrote `outside/target/ops/native-environment.mjs`. Result: `rejected:false`, `outsideControlWritten:true`. The transaction was restored and the fixture removed. This does not affect the coordinator's known direct formal-root path, and native CLI validation provides a separate guard, but the direct toolkit API used for control installation does not uphold its own ancestor check.

Requested resolution: check requested ancestors before canonicalizing them, retaining only the explicitly supported macOS `/var` compatibility alias exception; add a parent-symlink target fixture. Sent to coordinator.

Resolution: **PASS independent rerun.** Latest toolkit validates requested ancestors before parent canonicalization. The same fixture rejects `Refusing symlink path` and writes no outside control file.

### F10 — First-adoption guard prevents read-only existing-service health/status (P1)

The new `waitHealthy()` guard initializes `adoptedFromVerifiedOwner` as `info?.pid === activeService?.pid`. A fresh runtime has no `activeService`, so this is false for every actual listener. The final health condition requires it even for the `!activeService` read-only branch. `nativeStatus()` creates a fresh runtime, inspects the existing release service, and calls this method; it therefore reports healthy/consistent=false for a healthy existing release.

Independent fixture returned a matching release cwd, pinned executable, well-formed PID/start-time record and2xx health endpoints, without calling runtime.start(). Result: `healthy:false`, `healthEndpointCalls:0`, `Native service health timeout: listener cwd does not match release`. All process inspection and HTTP were stubbed.

Requested resolution: allow read-only probes when this runtime has no active owned candidate; retain strict wrapper-adoption proof when it does. Add an existing-service health/nativeStatus regression. Sent to coordinator.

Resolution: **PASS independent rerun.** Latest initialization allows the no-activeService read-only probe while retaining the owned candidate's adoption guard. The same existing-service fixture now returns `healthy:true` and calls both health endpoints (`healthEndpointCalls:2`) without an owned start or any signal attempt. Actual source/installed nativeStatus against the real service remains a coordinator-owned acceptance check.

## Finding history and resolutions

| ID | Original counterexample / finding | Latest disposition and independent evidence |
| --- | --- | --- |
| F01 | Preflight rejected an open source WAL/SHM, preventing a normal live business WAL backup. | **RESOLVED / withdrawn against current code.** Source sidecars are checked for unsafe paths/links, not rejected merely for being open. Synthetic live source WAL backup succeeds; corresponding Node test passes. |
| F02 | Launcher assertion passed but `vinext`'s `#!/usr/bin/env node` could select an ambient wrong Node because debug child PATH omitted the pinned Node directory. | **RESOLVED.** Synthetic wrong-PATH fixture originally printed `WRONG_NODE_EXECUTED`, exit23. Latest debug PATH prepends `dirname(process.execPath)`; rerun prints `PINNED_VINEXT_EXECUTED`, exit0. Only harmless fixture commands were run. |
| F03 | Target database opened during the awaited backup was replaced because the last open-file check occurred before backup. | **RESOLVED.** Original synthetic backup hook opened the old target before returning: observer retained `prior-copy` while a new reader saw `fresh-source`. Latest final preflight after backup/quick_check rejects `fixed debug database path is already open`; no publication. |
| F04 | SIGTERM during pending backup left the process and debug lock alive, or killed the launcher before it could release its lock. | **RESOLVED for the reproduced pending-backup case.** Latest early abort handlers and cancellation race make the owned fixture exit1 and remove the lock within300ms; output `ERROR:startup cancelled`. Configuration resolution is also inside handler-cleanup try/catch. Independent late-completion fixture rejects cancellation and removes the lock first; writing the pending backup result afterward then resolving it leaves no temporary file and publishes no target. |
| F05 | Toolkit `copyFile()` wrote through an existing hard-linked destination and modified an outside alias; subsequent discard retained the corruption. | **RESOLVED.** Latest regular-file validation rejects `nlink > 1`; independent hard-link regression test preserves outside sentinel and passes. Rollback revalidates destination safety before writing/removing. |
| F06 | Removing old target WAL/SHM before a failing main-file rename lost committed old-copy WAL data. | **RESOLVED for publication rename failure.** Original actual SQLite fixture retained a committed `old-wal` row after its writer was SIGKILLed; injected rename EIO reduced the old copy to `['old-base']`. Latest quarantine/restore rerun retains `['old-base','old-wal']`, the old WAL before reopening, and releases the lock after the injected rename EIO. |
| F07 | A missing first process timestamp allowed stop of a replacement with the same PID/cwd/exact command. | **RESOLVED.** Original synthetic result: `startTime:null`, `stopRejected:false`, attempted group SIGTERM. Latest rerun rejects `Refusing to stop unrelated or stale process`, with `killed:[]`. Source now rejects ambiguous live ownership and ambiguous orphan cleanup when service timestamp is missing. |
| F08 | Orphan cleanup can accept a reused group ID and same cwd with a different listener PID/start time, including first-health adoption. | **RESOLVED.** Original and first-health routes reject without signaling after live wrapper verification and full recorded listener identity checks. |
| F09 | Toolkit canonicalization masks an intermediate target symlink before safety validation. | **RESOLVED.** Parent alias rejects before any outside control write. |
| F10 | First-adoption ownership guard also rejects every read-only existing-service health probe. | **RESOLVED.** Matching existing listener now receives both health probes and returns healthy without an owned start. |

Additional coordinator findings were independently checked after owner changes:

- An unrelated hard-linked target main file rejects with `fixed debug database must not be hard-linked`.
- Signal handlers call bounded shutdown rather than awaiting a cooperative child close. The ignored-SIGTERM fixture waited for the child's own `CHILD_READY` after registering its handler, then signaled the launcher: latest launcher exited and released its lock within1.5s.
- A stubbed unkillable process group caused TERM/KILL attempts,20 liveness probes, exitCode1, and retained the debug lock; it was not silently released while process-group exit remained unproved.
- Injected quarantine removal EIO after main-file publication leaves the new main file with `['fresh-source']` and quick_check=`ok`; no old WAL/SHM are restored over it, and two quarantines remain. Startup fails and releases its lock. This is safe post-publication cleanup failure behavior: the new valid copy remains; it is distinct from pre-publication failure preserving the prior copy.

## Verification executed

| Check | Result / limits |
| --- | --- |
| Initial debug + native environment Node suite | PASS 7/7 on initial snapshot; superseded by later scoped runs. |
| Native toolkit, native deployment, native safety, source snapshot Node suites | PASS 36/36 on earlier reviewed snapshot. Runtime process-ownership changes made later require coordinator/final rerun. |
| Debug suite after cancellation/final preflight changes | PASS 9/9; later expanded to10. |
| Latest debug + toolkit suite | PASS 15/15. |
| Latest debug + environment + toolkit suite | PASS 19/19. |
| Runtime suite after recorded-listener ownership change | PASS 13/13 at that intermediate snapshot; first-health ownership counterexample was outside those13 tests and was later added. |
| Final native suite, sequential | PASS 57/57 in18.27s: environment, source snapshot, runtime, toolkit, deployment CLI and native safety. Includes rejected first health after wrapper exit, legitimate wrapper/orphan cleanup, null startup identity, and target-parent symlink checks. |
| Wrong-PATH debug launch | PASS on latest pin; harmless vinext stub uses expected executable. |
| Real synthetic live WAL source backup and write isolation | PASS in Node tests; actual copied source contents and separate writes checked. |
| Target opened during awaited backup | PASS latest rejection, after original failing reproduction. |
| Pending-backup SIGTERM | PASS latest exit1/lock removal; original failure retained above. |
| Backup finishes after cancellation | PASS temporary output removed after late completion, no target published. |
| Genuine old committed WAL + publication rename failure | PASS old main+WAL data preserved; original data-loss failure retained above. |
| Unrelated target main hard link | PASS explicit rejection. |
| Child ignoring SIGTERM | PASS bounded shutdown after child handler readiness. |
| Process group still alive after TERM/KILL | PASS conservative lock retention, exit1, and diagnostic. |
| Quarantine removal failure after publication | PASS fresh main quick_check=ok, no old-sidecar restoration; retained quarantines and failed startup are explicit. |
| Toolkit hard-linked destination | PASS rejection and outside sentinel preservation. |
| Desktop startup under restrictive `/usr/bin:/bin` PATH | PASS in owned fixture; observed Node26.0.0/SQLite3.53.0 at `/usr/local/Cellar/node/26.0.0/bin/node`. No real app service launched. |
| Missing startup timestamp / same PID+command replacement | PASS rejection after owner fix; original unsafe attempt retained above. |
| Reused group / orphan listener, including first-health route | PASS independent latest rejection; original failures retained under F08. |
| Toolkit intermediate target symlink | PASS independent latest rejection; original failure retained under F09. |
| Read-only existing-service health | PASS latest matching observed listener calls both endpoints and returns healthy; original failure retained under F10. |

Static review found consistent exact-runtime assertions before debug configuration/database side effects and native build/start/deployment mutations. Build uses pinned Node to invoke its npm CLI, `npm ci --include=dev`, then `npm run build`; service, desktop launcher and debug PATH pin the same Node. Source and installed profile/module selection is consistent. Release metadata records measured tooling runtime; status separates tooling runtime from observed service runtime and requires observed executable agreement for runtime consistency. Unknown legacy metadata is not silently rewritten as measured release runtime.

The standard launcher pins loopback3333 and the fixed copy and explicitly passes its path to the lower-level launcher. Redirecting standard-launcher environment/flags are rejected. The integration test retains an explicit owned temporary database and dynamic port through the lower-level launcher. Root and target command selection and documented reset behavior were reviewed for agreement.

Final native command: `node --test --test-concurrency=1 scripts/native-environment.test.mjs scripts/deploy-source.test.mjs scripts/deploy-native-runtime.test.mjs scripts/deploy-native-toolkit.test.mjs scripts/deploy-native.test.mjs scripts/deploy-native-safety.test.mjs`. Latest debug/environment/toolkit command: `node --test scripts/debug-local.test.mjs scripts/native-environment.test.mjs scripts/deploy-native-toolkit.test.mjs`. The latter passed before the coordinator started the real3333 debug journey; its debug module hash has remained unchanged since those independent checks.

## Acceptance still owned by the coordinator

**NOT VERIFIED by this reviewer:** formal toolkit installation/rollback on the actual deployment root; before/after production PID/current-pointer/config/business-data fingerprints; installed command status against the existing real service; actual worktree `make dev`/`npm run dev` process and fixed3333 listener; browser startup and actual persistence/reload/reset journey in the fixed isolated copy; real business-database logical fingerprint unchanged; full unit/type/lint acceptance and baseline comparison. No UI code changed, so supplied-design visual comparison is out of scope, but the required real-browser startup/persistence journey remains applicable.

The report does not replace the feature README, coverage table, or final acceptance gates. Known required FAIL/NOT VERIFIED checks must remain explicit until the coordinator resolves them.


## Final user-operation documentation and installed evidence review

2026-10-06: Read-only follow-up. Reviewed final `README.md`, `conf/README.md`, `deploy/DEPLOYMENT.md`, source/target Makefiles, package wiring, native CLI option handling, `start-native.command` and desktop launcher against the coordinator-provided installation/browser evidence. **PASS: no blocking instruction contradiction found.** Standard debug documents fixed loopback3333, the fixed `.data/tradereview-test.sqlite` online backup and restart reset; native deployment documents formal3022, committed Git refs, pinned26.0.0/3.53.0, existing config preservation and explicit Docker commands consistently with their implementation. Target-side republish requires an explicit Git source, as the command requires.

Read actual installed Makefile, DEPLOYMENT.md and ops/start-native.command without running them: all three are byte-for-byte equal to their source counterparts. Reviewed `installed-controls-acceptance.json`: old current release, PID/listener and config hash are identical before/after, with installed healthy/consistent status and measured pinned runtime. Reviewed `installed-native-dry-run.json`: exact submitted SHA and formal3022/database target agree with the documentation. Reviewed `browser-acceptance.json` and `formal-db-debug-comparison.json`: coordinator records actual isolated write, return/reload persistence, restart reset, and unchanged46-table formal-source fingerprint with both quick_checks=ok. These are evidence review, not new reviewer execution of production service or database checks.

The earlier NOT VERIFIED list is preserved as historical scope of this reviewer's executed checks. This appendix records review of subsequent coordinator acceptance evidence; final integrated acceptance remains the coordinator's responsibility. No implementation changes, additional tests or real service/database operations were performed for this follow-up.
