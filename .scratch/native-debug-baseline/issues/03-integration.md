# 03 — Integrate commands, preserve production and accept real debug startup

ID: NDB-03
State: closed
Status: accepted
Assignee: /root
Coordinator: /root

## Scope / What to build
R01,R02,R04,R09,R10: wire make dev/npm dev, preserve isolated automated-test callers, configure test runner exclusions, synchronize runtime/deployment/developer workflow docs, independently review both slices. Install verified native control toolkit in production without replacing active release, stopping service or writing business DB. Accept actual3333 service and fixed test copy.

## Refs
- ../README.md approved contract
- ../DESIGN-COVERAGE.md
- ../../../docs/agents/development-workflow.md

## Blocked by
- [01 — Native environment](01-native-environment.md) for final integration/installation
- [02 — Debug launcher](02-debug-launcher.md) for actual server acceptance

## Acceptance and counterexamples
- [x] Applicable Node tests, existing deployment tests, typecheck/build/runtime integration pass; baseline failures named separately.
- [x] Independent review findings resolved.
- [x] Source and installed production status report accurate environment; production service/release/config retained.
- [x] Real3333 listener belongs to current worktree and opens .data/tradereview-test.sqlite.
- [x] Real browser page loads SQLite records without blocking console errors; persistence/reload in isolated copy verified.
- [x] Source logical data fingerprint before/after unchanged; online backup and test-copy checks saved without business details.
- [x] Final docs/coverage/issues/acceptance consistent and evidence linked.

## Evidence
[Final acceptance](../FINAL-ACCEPTANCE.md), [coverage](../DESIGN-COVERAGE.md), and [independent review](../reports/independent-review.md).

## Coordinator acceptance — 2026-10-06

Accepted by /root after direct code review, independent review, and applicable operational checks. [Final acceptance](../FINAL-ACCEPTANCE.md) and [coverage](../DESIGN-COVERAGE.md) link native57/57, debug/environment15/15, existing deployment58/58, runtime-config6/6, build/integration5/5, typecheck/scoped lint, installed controls and unchanged formal service/data, and real browser persistence/restart-reset evidence. The broad repository unit run remains FAIL and is preserved explicitly; no repository-wide green claim or application release is made. Historical red/failing evidence is retained.
