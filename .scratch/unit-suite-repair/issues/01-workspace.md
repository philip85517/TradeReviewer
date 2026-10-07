# 01 — Workspace entries and review contract

ID: USR-01
State: closed
Status: accepted
Assignee: workspace
Coordinator: /root

## Scope / refs
See ../DESIGN-COVERAGE.md owner workspace; exact failures in ../reports/prior-failure-census.json. Read current workflow and relevant original contracts before implementation. Preserve existing work.

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

Root reproduced the three independently failing default-5s journeys and accepted timer/query/synchronization repairs only in the owned test file. Original 91 runtime cases and assertion inventory retained. reports/workspace-three-frozen-one.log and reports/workspace-three-frozen-two.log each pass3/3; reports/workspace-full-frozen.log passes91/91; final bare full-unit-final-v2.log covers the full91 after the last synchronization. independent-review-final.md and independent-review-synchronization.md pass. No product/browser/persistence acceptance is applicable to test-only changes.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
