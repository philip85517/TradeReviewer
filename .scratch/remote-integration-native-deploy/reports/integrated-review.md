# Independent integrated-source review

Reviewer: `/root/unit_review`, 2026-10-07 (Asia/Shanghai).

Reviewed local integrated HEAD `cf7d48cc4d0052841b64690085e68b23325ffaea`, with parents `0fa2812` and `0b0113773a54f716d45b30bfb8bc03d22b99a181`. The local `origin/master` ref is the latter commit. The original common ancestor is `63690a494b8ad403081c7720985be54a95db60c7`. No remote fetch or remote-state validation was performed.

**Conclusion: integration preservation and evidence archival PASS; native environment contract has one Important blocker.** The newly reported SQL engine version differs from the pinned version while the existing metadata-only guard passes. This report does not accept the full integrated feature or declare the PR ready to merge. Fresh unit/build/native verification and remote integration gates remain owned by the coordinator.

Only this report was written. Review used local source/document reads, read-only Git diff/object/index inspection, file-content hashes and Python byte comparisons. No source edits, tests, nested agents, service/process operations, database access, browser operations, remote actions or Git state mutations were performed. The active `actual-debug-restart.log` was not read or modified; its old committed Git blob was compared with the stable archive.

## Spec and Quality

| Axis | Result | Scope / reason |
| --- | --- | --- |
| Spec: preserve accepted native/unit changes and incoming master changes | PASS | Approved candidate identities remain intact; shared requirements and incoming UI bytes are preserved. |
| Spec: archive active evidence without altering its accepted bytes or service | PASS for source/index scheme | Exact file ignore, R100 archive and both acceptance references are correct. Current service state was not inspected. |
| Spec: enforce actual SQLite 3.53.0 | FAIL on coordinator-reported current environment | Profile and approved contract require 3.53.0; coordinator's SQL query returned 3.53.1 while the guard passed. See I01. |
| Quality | NEEDS CHANGE, one Important finding | Metadata is treated as the actual SQLite engine version, including release/status reporting. No additional integration-specific source finding was found. |

Critical: none. Important: I01 below. Minor: none in the assigned integration scope.

### I01 — Verify the actual SQLite engine before accepting the pinned environment

Location: `scripts/native-environment.mjs:29–36`, specifically line 31 and the check at line 34. Related contract: `conf/native-environment.json:3`, `.scratch/native-debug-baseline/README.md:12`, and `docs/agents/development-workflow.md:141`.

During this review the coordinator reported a fresh observation using the same configured `/usr/local/Cellar/node/26.0.0/bin/node`: `process.versions.sqlite` is `3.53.0` and `assertNativeEnvironment()` passes, but `new DatabaseSync(":memory:").prepare("select sqlite_version() as version").get().version` returns `3.53.1`. This is coordinator-executed evidence communicated directly to the reviewer; this reviewer did not execute a SQL query or independently establish the cause of the version difference. The actual shared-library/linking explanation remains under investigation and is not inferred here.

Source inspection confirms the impact: the guard derives `sqliteVersion` solely from `versions.sqlite`, compares that string with the profile, then returns it as measured runtime evidence. It never opens an isolated engine or asks SQLite for its actual version. Therefore the reported discrepancy satisfies the guard even though the operative engine does not satisfy the approved exact 3.53.0 contract. `scripts/native-environment.test.mjs:38–41` calls the same assertion and checks its returned value; it cannot detect this metadata/SQL disagreement. The injected versions tests likewise exercise only metadata values.

This affects more than documentation. `scripts/debug-local.mjs:179–180` uses the guard before preparing the debug database; `scripts/deploy-native-runtime.mjs:72–74` caches its result; `scripts/deploy-native.mjs:105–109` puts the result in `release.json`; status at `scripts/deploy-native.mjs:133–135` reports it as tooling/service runtime when the executable matches; and `deploy/ops/start-native.command:14` uses the same guard. The two health endpoints checked by the native runtime at lines 241–243 do not close this version gap. Consequently metadata 3.53.0 cannot be presented as proof of the actual SQL engine version.

Recommendation: resolve the actual engine discrepancy and make the gate/report distinguish and verify the effective SQLite engine, using an isolated query rather than business data. Retain the approved 3.53.0 contract unless its owner explicitly changes that contract; changing the expected number solely to make the current guard pass would not resolve the guard's missing observation. Preserve historical results, reopen the affected runtime-version acceptance, and obtain fresh evidence after the resolution before declaring native acceptance or merge readiness. This is a newly exposed contract gap, not evidence of a merge overwrite or a claim that every earlier runtime used 3.53.1.

## Exact branch scope and accepted candidate preservation

`origin/master...HEAD` contains 266 changed paths: 32 repository source/config/test/documentation paths, plus 76 paths under `.scratch/local-native-deploy`, 61 under `.scratch/native-debug-baseline`, and 97 under `.scratch/unit-suite-repair`. No other task evidence directory appears in this branch delta.

The repository paths map to the accepted work:

- Native deployment D01–D09: source selection, runtime/toolkit/CLI modules and their tests; `scripts/deploy.mjs`; source/target Makefiles, deployment guide and native launcher; README/config/workflow wiring. These are the accepted native task's operational files and supporting evidence.
- Native/debug R01–R10: `.node-version`, `conf/native-environment.json`, `scripts/native-environment.mjs` and its tests, `scripts/debug-local.mjs` and its tests; exact Node engine metadata in package/lockfile; fixed debug command wiring and isolated lower-level storage-test caller. The full-profile version assertion remains subject to I01 despite its bytes matching the accepted snapshot.
- Unit repair R01–R13: the workspace test, alias recovery test, real-IDB fixture adapter, deterministic holdings date, worker bound and non-port debug test seam injections. Their original assertions, cases, default timeout and skip constraints remain covered by the retained independent unit reviews and matching freeze.

Across all 32 repository paths, only `AGENTS.md`, `README.md` and `docs/agents/development-workflow.md` differ between accepted task commit `0fa2812` and integrated HEAD; those differences are incoming master workflow additions. Every other repository path in the task delta has the same Git blob as `0fa2812`. Thus integration did not alter the accepted native modules or unit repair. In particular, the master-to-HEAD Vitest delta still includes the earlier native-runner exclusions plus the later unit repair's `maxWorkers: 2`; it is not attributed wholly to the unit repair. Package/lockfile changes pin the engine rather than changing dependencies.

The following identities were recomputed from actual worktree bytes and HEAD objects, not accepted solely from the coordinator's freeze JSON:

| Native file | Worktree and HEAD SHA-256, equal to reviewed snapshot |
| --- | --- |
| scripts/debug-local.mjs | `45e5a8e0447f6b6be707570c2d7859e22c992490771fc4af4026ff3347700972` |
| scripts/deploy-native-runtime.mjs | `45a353ae83cace5bfb1b6be8a66b82aa92eda845055f2e2893b80f1ce9e413da` |
| scripts/deploy-native-toolkit.mjs | `44061bbb9f3fd4dd54f41b2bc80032ae8fcc0ebcd81256898f94ddff3d6ef86e` |
| scripts/native-environment.mjs | `18e15ad2805532c622092de0ee4917c436a72baafb05b77905c8910c21c739e9` |

| Unit-repair file | Worktree `git hash-object` and HEAD blob, equal to final-v2 freeze |
| --- | --- |
| app/components/trade-review-workspace.test.tsx | `9da7b6ded0d0e46316be48fbedff3b6681a059a6` |
| app/components/trade-review-workspace.alias-recovery.test.tsx | `306070d24e4c55c4b55569a21db7e2ad0278a0aa` |
| app/components/test-support/legacy-sqlite-client.ts | `d53c142e7be3d4e81ab0745d3ca0322caabcc344` |
| app/lib/reviews/trading-room-holdings.test.ts | `b42f6b949f62d77084eb3184cbeb947d688d9d06` |
| vitest.config.ts | `ae70bc9a7278d6dab22a5b067378ec50d554babb` |
| scripts/debug-local.test.mjs | `3eea1bdd68c6e2d5db0a230e83d2ae166fdfa6ab` |

Hash identity establishes source preservation. It does not prove I01's actual-engine contract, fresh execution results or all integration gates.

## Master UI and four shared-file requirements

All 446 tracked production `app/` paths from local `origin/master` (excluding `.test.` paths and `/test-support/`) have the same Git blobs at integrated HEAD. The only task changes under `app/` are its four test/fixture files. Incoming master dashboard files were additionally compared with actual worktree content hashes:

| Incoming production UI file | Identical master / HEAD / worktree blob |
| --- | --- |
| app/components/dashboard/review-dashboard.module.css | `da89fd26f9307cab930c995dfe5b1902402d74f0` |
| app/components/dashboard/review-dashboard.tsx | `19e79908774c276b9e945dab7c409b3d4aa7b63e` |
| app/components/dashboard/room-performance-hit-testing.ts | `ed58c5456b9f14c15c2a00996aeae34169c45d21` |
| app/components/dashboard/room-performance.module.css | `526e87d19e2262c408437fbf54c0d619c2885b62` |
| app/components/dashboard/room-performance.tsx | `2a69bc529d62b30a5ef243c3673061551eb6f5a0` |

Both incoming dashboard test files also match master/HEAD/worktree. All 14 incoming-master paths outside the four shared paths match those three identities, including the frontend audit standard, decomposition/UI/QA/issue workflows, CONTEXT and the home-click acceptance evidence. This confirms integration preservation, not a new behavioral or visual acceptance of PR37.

The four shared files retain both sets of requirements:

- `AGENTS.md:5` retains master's intent-based frontend-control audit and independent acceptance requirements; line 17 retains the native task's fixed3333, WAL backup, reset, failure/isolation and version-pin contract. The existing remote workflow and data/design constraints remain.
- `README.md:69–80,109–131` retains the native startup/deployment/reset instructions; line 137 retains master's frontend-audit integration. No incoming audit requirement was dropped.
- `docs/agents/development-workflow.md:49–63,85,98,125` retains master's frontend audit triggers, scoped exclusions and delivery checks; lines 122 and 141–153 retain fixed standard debug and the explicit isolated lower-level alternative. The remote sequence at lines 69–75 still requires applicable checks before branch push/PR/remote merge and safe baseline synchronization.
- `tests/local-dev-storage.test.mjs:43–53` retains owned temporary DB, free port and direct `start-local.mjs` invocation, compatible with fixed3333 standard debug. Lines 61–67 retain HTTP200, master's schema14 assertion, owned-child shutdown and temporary-directory cleanup. Its schema14 assertion was already present in `0fa2812`; integration required no further blob change. The original 30-second readiness budget is unchanged. The test does not redirect standard debug or clean an external configured database.

## Archive/index correctness and excluded data

The pending index diff contains exactly `.gitignore`, the two native-baseline acceptance Markdown files and the R100 log rename. There are no unstaged tracked changes at the time of inspection.

- `.gitignore:55` is the exact anchored path `/.scratch/native-debug-baseline/reports/actual-debug-restart.log`. `git check-ignore --no-index -v` matches that active path and does not match `actual-debug-restart-accepted.log`. It does not broadly suppress other task logs or the archive.
- The index contains only `actual-debug-restart-accepted.log` for these two names; its old active path is absent. The archive and its indexed blob match the original `0fa2812` log byte-for-byte: **21,218 bytes**, Git blob `c57993b136a27c75edb34cb0c306ea6d99be2f84`, SHA-256 `4378f9301363724bd3c1aa0fadffbc058f355f42a8b80349e7b6f5acf2d25536`. This comparison read the old Git object, not the active local log.
- `.scratch/native-debug-baseline/DESIGN-COVERAGE.md:10` and `FINAL-ACCEPTANCE.md:21` both link the stable archive. A Markdown-only search of the native-baseline task found no remaining startup link to the active log. Their statuses, results and evidence wording are otherwise unchanged by the index delta; the archival scheme does not rewrite old failures or manufacture new acceptance.
- The entire `0fa2812` tracked tree contains no `.sqlite`, `.sqlite3`, `.db`, WAL/SHM/journal sidecar paths, `.data/` paths or `.scratch/local-native-deploy/runtime-check-backups/` paths. All 250 added-file blobs were also checked for the SQLite file header; none is an SQLite database. Existing `reports/control-backups/` entries are operational scripts/Makefile/docs/manifest, not database backup binaries. The current runtime-check-backups directory remains untracked and was not changed by this reviewer.

The service's continued operation and preservation of the live log are coordinator observations; this review confirms the repository/index design and byte preservation without service or active-log inspection.

## Retained limits and disposition

The preflight's retained historical reviews and unit-repair closures remain valid as source/evidence history. The final-v2 pre-integration bare run records 3064 PASS and six original external-corpus skips; it is not substituted for the coordinator's fresh integrated run. Six opt-in corpus cases and the old whole-repository ESLint limit of 13 errors /40 warnings remain explicit. Scoped lint success does not establish repository-wide lint success. The accepted concurrent-read adapter error-order caveat also remains.

I01 specifically reopens the actual runtime-version gate; previous metadata/version assertions and 57/57 native results cannot close a newly observed operative-engine disagreement. The coordinator owns updating the affected issue/coverage/acceptance records under the current workflow, resolving I01 and binding fresh verification to the eventual candidate.

Recommendation: accept this report's integration-preservation, shared-file, data-exclusion and archival checks only. Keep actual native-engine acceptance and fresh integrated unit/build/native results pending; no overall PR merge-ready or G02–G04 PASS claim is made. Follow `docs/agents/development-workflow.md:69–75` for the authorized branch push → PR to master → required checks/review → verified remote merge → safe local-master fast-forward sequence after the blocking contract and required verification are resolved.
