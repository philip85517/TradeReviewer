# Integration coverage

Exact reference: current user request; docs/agents/development-workflow.md section 提交远端与同步基线的默认流程; .scratch/local-native-deploy/FINAL-ACCEPTANCE.md; .scratch/native-debug-baseline/FINAL-ACCEPTANCE.md; .scratch/unit-suite-repair/FINAL-ACCEPTANCE.md. No product/UI change in this integration task, hence UI element IDs/images and new browser writes are N/A.

| ID | Requirement / journey | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| G01 | Accepted source matches actual candidate; preserve previous/unrelated work and original data | root + independent review | reports/preflight-review.md; reports/final-stage-review.md; final-staged-manifest.json | PASS — reviewed task scope/source and safe exclusions |
| G02 | Commit and push codex/local-native-deploy before PR creation | root | git commit/push and remote SHA | unverified |
| G03 | PR base master, exact head, acceptable reviews/checks, remote merge | root | PR metadata/checks and merge receipt | unverified |
| G04 | Confirm PR MERGED and master contains merge; safely fast-forward clean master checkout | root | remote/local refs and clean checkout status | unverified |
| G05 | Fixed SQLite engine measured from SQL; reject mismatches before native side effects | runtime_engine (Luna) + root + independent reviewer | issues/02-runtime-engine.md; reports/runtime-engine-* | PASS — actual SQL guard; 60/18 native/debug; final build/type/lint; independent review |
| G06 | Existing refresh summary journey completes within original test budget and retains storage/provider/detail assertions | refresh_repair (Luna) + root + reviewer | issues/03-refresh-unit.md; reports/integrated-unit.log and refresh-* | PASS — targeted8/8 and bare full3070; original FAIL retained; unchanged budgets/assertions |
| G07 | Standard native/debug entrypoints resolve fixed privateNode/SQLite from profile; missingruntime fails without fallback | runtime_engine (Luna) + root + reviewer | issues/04-pinned-entrypoints.md; reports/pinned-entrypoints-*; reports/entrypoint-acceptance.json | PASS — actual private runtime, source/installed entrypoints and no fallback |

Remote G01–G04 remain pending until the actual commit/push/PR/merge/fast-forward operations complete. Source acceptance above does not claim a deployment of the merged release.
