# Regression verification

2026-09-30 root executed, no test timeout configuration changed. Scope isolated synthetic UI; product changes are new strategy-prototype files plus dev-only app/page branch; existing TradeReviewWorkspace and its dependencies unchanged.

- Full `npm run test:unit`: exit1, 284 passed/3 failed/3 skipped files; 2656 passed/39 failed/6 skipped tests. Original log unit-verification.log preserved. Many 5000ms timeouts under full parallel suite.
- Separate exact three failed files with `npx vitest run app/components/trade-review-workspace.refresh.test.tsx app/components/trade-review-workspace.test.tsx app/lib/storage/storage-boundary.test.tsx --maxWorkers=1`: exit1, 2 files pass, one fails; 74 pass/12 fail. Original timeout limits unchanged; log unit-failure-recheck.log.
- Unmodified HEAD ad460531ec217774a67daefa847de1a4c27b2a24 exported with git archive to unique temporary directory (path in baseline-verification-path.txt), same node_modules, command `vitest run app/components/trade-review-workspace.test.tsx --maxWorkers=1`: exit1, 62 pass/14 fail. All 12 current isolated failures occur on baseline too; current-only failures = 0, baseline has 2 extra timing-sensitive failures. Log unit-head-baseline.log.

This establishes observed remaining existing-workspace failures predate the strategy prototype. Full suite is NOT PASS; don't claim otherwise. Current scope typecheck/build/lint and browser/visual gates remain separately required. No source/test/timeout changes were made to mask these failures.

## Final frozen prototype checks
Root after final X08-01 CSS: typecheck PASS(exit0); scoped ESLint exit0, 0 errors/2 nonblocking unused-parameter warnings in strategy-prototype.tsx (stage/selectedStrategy); isolated-DB build PASS(exit0); git diff --check PASS. Logs final-{typecheck,eslint,build}.log. Browser tab6 error/warn logs empty after full fresh journey and reload. Entire unit suite is still NOT PASS as described above; these checks do not rewrite baseline failures.
