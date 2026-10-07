# Read-only submission preflight

Reviewer: `/root/unit_review`, 2026-10-07 (Asia/Shanghai). Scope: current accepted native/debug source manifests, unit-repair freeze, historical review disposition and acceptance evidence. Only this report was written. No implementation, tests, Git state changes, nested agents, service, database, browser or remote operations were performed. The explicitly requested `git hash-object` checks were read-only, without `-w`.

Conclusion: **PASS for the current source/evidence preflight.** No unresolved confirmed in-scope source-review finding or manifest mismatch was found. This is not remote-master integration or merge acceptance. The coordinator still owns the staged candidate, integration with the newer master, fresh required verification, push/PR/checks/merge and final ref synchronization.

## Current source matches reviewed freezes

Actual SHA-256 values were computed from file bytes with Python `hashlib.sha256`, then compared with `.scratch/native-debug-baseline/reports/reviewed-snapshot-hashes.json`. Every manifest entry is marked reviewed and matches:

| File | Actual SHA-256 (equals expected) | Result |
| --- | --- | --- |
| scripts/debug-local.mjs | `45e5a8e0447f6b6be707570c2d7859e22c992490771fc4af4026ff3347700972` | PASS |
| scripts/deploy-native-runtime.mjs | `45a353ae83cace5bfb1b6be8a66b82aa92eda845055f2e2893b80f1ce9e413da` | PASS |
| scripts/deploy-native-toolkit.mjs | `44061bbb9f3fd4dd54f41b2bc80032ae8fcc0ebcd81256898f94ddff3d6ef86e` | PASS |
| scripts/native-environment.mjs | `18e15ad2805532c622092de0ee4917c436a72baafb05b77905c8910c21c739e9` | PASS |

Actual Git file-content hashes were obtained with `git hash-object <file>` and compared with `.scratch/unit-suite-repair/reports/frozen-candidate-final-v2.json` (`frozenFiles` plus `nativeDebugFile`). All six match:

| File | Actual Git content hash (equals expected) | Result |
| --- | --- | --- |
| app/components/trade-review-workspace.test.tsx | `9da7b6ded0d0e46316be48fbedff3b6681a059a6` | PASS |
| app/components/trade-review-workspace.alias-recovery.test.tsx | `306070d24e4c55c4b55569a21db7e2ad0278a0aa` | PASS |
| app/components/test-support/legacy-sqlite-client.ts | `d53c142e7be3d4e81ab0745d3ca0322caabcc344` | PASS |
| app/lib/reviews/trading-room-holdings.test.ts | `b42f6b949f62d77084eb3184cbeb947d688d9d06` | PASS |
| vitest.config.ts | `ae70bc9a7278d6dab22a5b067378ec50d554babb` | PASS |
| scripts/debug-local.test.mjs | `3eea1bdd68c6e2d5db0a230e83d2ae166fdfa6ab` | PASS |

These checks establish identity for the listed manifest files. They do not certify every other file in the coordinator's staged-file plan or any source changes resulting from master integration.

## Review and acceptance disposition

- `.scratch/local-native-deploy/reports/independent-review.md:9–13` records resolution of tool-source selection, lock-scoped control restoration, physical paths, wrapper/listener identity, candidate-stop ownership, unsafe overlaps/log links, spaced target paths and rollback ownership. It concludes there is no remaining deployment-scope blocker. D01–D09 are accepted in that task's final acceptance and all four issues are closed.
- `.scratch/native-debug-baseline/reports/independent-review.md:60–71` records F01–F10 as resolved, with original counterexamples and independent passing resolutions preserved. The matching four-file SHA-256 snapshot is the final reviewed source, rather than one of the earlier failing runtime snapshots. Its final acceptance accepts R01–R10 operationally; all three issues are closed. Earlier reviewer-only NOT VERIFIED operational gates are followed by the report's evidence-review appendix at 121–127 and coordinator operational acceptance, rather than silently converted into reviewer-executed checks.
- The four unit-repair independent reviews retain separate Spec/Quality PASS conclusions and no actionable Critical/Important/Minor findings. `.scratch/unit-suite-repair/FINAL-ACCEPTANCE.md` and `reports/final-consistency.json` are accepted; R01–R13 and all ten issues are closed. The actual six-file hash check above matches that accepted candidate. The inventories preserve direct declarations/names/modes/budgets (workspace 89 direct declarations, expanding to 91 runtime cases; alias 4; holdings 27 direct declarations), and debug retains 11 cases/37 assertions. No new skips or raised timeouts were accepted.

Spec: **PASS within this preflight scope.** Quality: **PASS within this preflight scope.** Critical: none. Important: none. Minor: none.

## Historical FAIL versus current accepted evidence

| Preserved historical result | Subsequent closure / current disposition |
| --- | --- |
| Local-native full unit: 39 FAIL / 3025 PASS / 6 skips | Superseded for the current candidate by unit repair's final bare full run: 3064 PASS / 0 FAIL / the same 6 skips. The old partial baseline diagnosis remains historical; this review does not relabel all original failures as proven baseline failures. |
| Native/debug full unit: 65 FAIL / 2999 PASS / 6 skips, including 22 UI/business cases whose cause was not established then | Closed by the later complete unit-repair run and accepted R01–R13 evidence. Original failure logs and uncertainty at the time remain preserved. |
| Native 52/53 startup-identity failure | Final reviewed guard/counterexample and native 57/57 close the failure; matching final module hashes were verified above. |
| Unit repair first frozen full run: 3062 PASS / 2 FAIL | Final v2 run closes import-toolbar and alias-persistence synchronization failures, retaining real paths and original assertions. |
| Native debug first run: 10 PASS / 5 FAIL from the live 3333 port probe | Existing non-port test seam isolation and final debug 15/15 close it; occupied-port rejection remains unchanged. |

The actual final unit/native log summaries were read, not merely the acceptance labels:

- `reports/full-unit-final-v2.log`: 319 files passed / 3 corpus files skipped (322 collected); 3064 tests passed / 6 skipped (3070 collected); 449.66 s. Manifest records bare `npm run test:unit`, no CLI worker/timeout overrides.
- `reports/deploy-test-final.log`: 57 passed, 0 failed, 0 skipped.
- `reports/debug-test-final-v2.log`: 15 passed, 0 failed, 0 skipped. Coordinator acceptance records the original 3333 listener retained; this preflight did not inspect the listener.
- Typecheck and scoped-lint final records report exit 0. The typecheck log contains the expected `tsc --noEmit` command, and scoped lint logs contain no diagnostic output. Their exit status comes from the coordinator's final-consistency record, not a new reviewer execution.

`unit-entrypoint-audit.md` correctly distinguishes Vitest from native Node entrypoints: the seven pre-existing native exclusions are covered by `make deploy-test` and `make debug-test`; environment cases occur in both commands and must not be added as unique tests twice.

## Limits retained for the remote integration report

1. Six external-corpus tests remain unexecuted: monthly (1) requires `BROKER_CORPUS_ROOT`, China Merchants (1) requires `CHINA_MERCHANTS_CORPUS_ROOT`, and TradingView (4) requires `TRADINGVIEW_SAMPLE_DIR`. Source skip conditions and the final log agree. They are not six passing tests or newly introduced skips.
2. Repository-wide ESLint has not been repaired or newly certified. `.scratch/local-native-deploy/reports/lint.log` retains **13 errors / 40 warnings** (`FINAL-ACCEPTANCE.md:42`); later evidence is scoped ESLint PASS. A successful unit/type/scoped-lint result does not establish whole-repository lint PASS.
3. The accepted fixture adapter can choose the first temporal rejection when multiple independent getters fail concurrently. Its earlier serial error priority is not retained; no such priority contract was found, and it still has no cross-getter atomic snapshot. This accepted caveat remains in the final unit acceptance; it is not a newly unresolved issue.
4. Current operational service/data/browser evidence remains historical coordinator evidence. This preflight did not run a service, inspect a database or validate present listener/browser state, and does not authorize an application deployment.
5. Per the coordinator's remote observation, master is two commits ahead of the old candidate HEAD, including `0b01137` from PR37. This reviewer did not fetch or verify remote refs. Existing green evidence belongs to the pre-integration frozen candidate; it cannot alone certify the resulting integrated source.

Recommendation: the coordinator may continue the already authorized remote-integration workflow with the current accepted candidate. Keep this preflight scoped to G01's source/evidence portion; staged-scope/data preservation, fresh integrated verification and G02–G04 remain coordinator-owned and unverified by this report. Follow the current workflow's task-branch commit/push → PR to remote master → required checks/review → remote merge verification → safe local-master fast-forward sequence. No integrated-green or merge-ready claim is made here.
