# 03 — Holding quote date fallback

ID: USR-03
State: closed
Status: accepted
Assignee: holdings
Coordinator: /root

## Scope / refs
See ../DESIGN-COVERAGE.md owner holdings; exact failures in ../reports/prior-failure-census.json. Read current workflow and relevant original contracts before implementation. Preserve existing work.

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

## Scoped acceptance 2026-10-06

Coordinator reviewed the actual one-line diff and source date/freshness branches. Exact case now passes and all 30 holdings tests pass (`../reports/holdings-green-case.log`, `../reports/holdings-green-full.log`). All source inputs and available-status assertions are retained; only deterministic asOf is added. Product UI/visual/persistence acceptance is not applicable because no product code changes. Waiting for integrated full-suite result before closing the issue.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

One-line deterministic asOf fixture accepted. holdings-red-20261006.log captures clock-driven stale failure; holdings-green-case.log1/1 and holdings-green-full.log30/30 pass, with full-unit-final-v2.log final integrated PASS. independent-review-scoped.md confirms source fallback, freshness window and both original assertions unchanged. Product clock/quote behavior untouched.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
