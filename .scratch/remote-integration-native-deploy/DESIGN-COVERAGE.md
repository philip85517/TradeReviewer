# Integration coverage

Exact reference: current user request; docs/agents/development-workflow.md section 提交远端与同步基线的默认流程; .scratch/local-native-deploy/FINAL-ACCEPTANCE.md; .scratch/native-debug-baseline/FINAL-ACCEPTANCE.md; .scratch/unit-suite-repair/FINAL-ACCEPTANCE.md. No product/UI change in this integration task, hence UI element IDs/images and new browser writes are N/A.

| ID | Requirement / journey | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| G01 | Accepted source matches actual candidate; preserve previous/unrelated work and original data | root + independent review | reports/preflight-review.md; reports/final-stage-review.md; final-staged-manifest.json | PASS — reviewed task scope/source and safe exclusions |
| G02 | Commit and push codex/local-native-deploy before PR creation | root | reports/remote-integration-receipt.json; PR38 published head0e336c6 (receipt-time snapshot) | PASS |
| G03 | PR base master, exact head, acceptable reviews/checks, remote merge | root | PR38; reports/remote-integration-receipt.json | PASS — MERGED, no configured checks or review blockers |
| G04 | Confirm PR MERGED and master contains merge; safely fast-forward clean master checkout | root | reports/remote-integration-receipt.json; master-preservation-before.json | PASS — receipt-time same2d22bb2, fast-forward,25 untracked entries unchanged |
| G05 | Fixed SQLite engine measured from SQL; reject mismatches before native side effects | runtime_engine (Luna) + root + independent reviewer | issues/02-runtime-engine.md; reports/runtime-engine-* | PASS — actual SQL guard; 60/18 native/debug; final build/type/lint; independent review |
| G06 | Existing refresh summary journey completes within original test budget and retains storage/provider/detail assertions | refresh_repair (Luna) + root + reviewer | issues/03-refresh-unit.md; reports/integrated-unit.log and refresh-* | PASS — targeted8/8 and bare full3070; original FAIL retained; unchanged budgets/assertions |
| G07 | Standard native/debug entrypoints resolve fixed privateNode/SQLite from profile; missingruntime fails without fallback | runtime_engine (Luna) + root + reviewer | issues/04-pinned-entrypoints.md; reports/pinned-entrypoints-*; reports/entrypoint-acceptance.json | PASS — actual private runtime, source/installed entrypoints and no fallback |

Pre-merge snapshot: remote G01–G04 remain pending until the actual commit/push/PR/merge/fast-forward operations complete. Source acceptance above does not claim a deployment of the merged release.

## Remote integration completed — 2026-10-07

Coordinator /root verified PR38 MERGED, task branch head0e336c6559b3124562c2346ff13d249e74cdc29e and merge2d22bb28516aebb34788e2337ae908b4f2f53c94 on origin/master. Local master /Users/zhoulin/Documents/TradeReview safely fast-forwarded to that merge, with tracked files clean and all25 unrelated untracked entries byte-identical. Merged tree matches the tested candidate. PR has no configured checks/review requirement; local verification/independent review passed. No force/direct-master push, branch deletion, actual deployment or service restart.3022/3333 original listeners retained; their actual SQL versions remain NOT VERIFIED.

Evidence: reports/remote-integration-receipt.json and https://github.com/philip85517/TradeReviewer/pull/38. This local completion record was written after merge; committed pre-merge records remain historical snapshots. All requested Git integration gates G01–G07 accepted; separate live deployment/debug verification remains pending in native-debug-baseline.
