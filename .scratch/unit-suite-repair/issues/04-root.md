# 04 — Integrated full-suite acceptance

ID: USR-04
State: closed
Status: accepted
Assignee: root
Coordinator: /root

## Scope / refs
See ../DESIGN-COVERAGE.md owner root; exact failures in ../reports/prior-failure-census.json. Read current workflow and relevant original contracts before implementation. Preserve existing work.

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

All322 files collected,3064 PASS/0 FAIL/6 original opt-in corpus skips in full-unit-final-v2.log. Native deployment57/57, debug15/15, typecheck/scoped lint/source consistency/whitespace pass. Root read and accepted every independent review. Seven pre-existing native exclusions are covered through operational make test entrypoints; shared4 environment tests are counted per invocation. Existing dirty native work preserved, no deployment/service/database/remote action.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
