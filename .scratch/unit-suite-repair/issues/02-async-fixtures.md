# 02 — Async fixtures and isolated storage

ID: USR-02
State: closed
Status: accepted
Assignee: async-fixtures
Coordinator: /root

## Scope / refs
See ../DESIGN-COVERAGE.md owner async-fixtures; exact failures in ../reports/prior-failure-census.json. Read current workflow and relevant original contracts before implementation. Preserve existing work.

## Blocked by
None for read-only diagnosis. Implementation ownership freezes after coordinator reviews red repro and root cause.

## Acceptance
- [x] Specific isolated red command and root cause evidence.
- [x] No deleted/skip/weakened assertions or raised default timeouts.
- [x] Relevant isolated regressions green.
- [x] Coordinator independently reviews changes and applicable product safety/browser/design gate.
- [x] Integrated full unit suite green; typecheck/appropriate further checks.

## Dispatch
Only report initially; no production files until bounded implementation authorization. No formal service/database access, no browser writes, no full-suite contention, no nested agents or remote actions.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

reports/async-diagnosis.md and root-diagnosis.md separate full-run worker contention from isolated cases; preserved serial-refresh red and refresh-order diagnosis are superseded by complete-file green. All unchanged dashboard/library/refresh/storage files pass in affected-files.log and full-unit-final-v2.log. No changes to these product or test files were required. Root accepts all existing cases with unchanged assertions/timeouts; no UI/browser/business DB gate applies.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).

2026-10-07 integration regression: saved-summary single refresh timed out in both full and isolated file runs. Prior acceptance preserved; G06 in ../remote-integration-native-deploy owns diagnosis, bounded correction and fresh full acceptance.

## 2026-10-07 integration reacceptance — PASS

The preceding refresh regression is closed by G06, preserving original failing runs and the rejected synchronous navigation candidate. The test now awaits the real asynchronous primary-navigation boundary, scopes data navigation and reacquires the returned data-management container; all8 cases/60 assertions remain, without added skips or raised timeouts. Targeted8/8 and fresh bare whole-unit319 files/3070 tests PASS, with only the original6 external-corpus skips. The extra6 passing tests come from integrated master; earlier3064 results remain historical. Native60/60, debug18/18, build/integration5/5, typecheck and scoped lint (0errors/2warnings) PASS. Independent G06 review PASS.

Evidence: ../remote-integration-native-deploy/reports/{refresh-final-targeted-v2.log,refresh-review.md,final-unit.log,final-unit-result.json,final-native.log,final-debug.log,final-build-integration.log,final-typecheck.log,final-scoped-eslint.log,source-freeze-verification.json}. Coordinator /root reaccepts the unit-repair scope. Product rendering/state is unchanged; browser/visual acceptance is N/A for these test-only changes. Service listeners and business data were not changed by this repair.
