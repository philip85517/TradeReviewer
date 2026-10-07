# 01 — Select committed Git release source

ID: native-deploy-01
State: closed
Status: accepted
Assignee: /root/deploy_source
Coordinator: /root

## Scope
D01,D02 in ../DESIGN-COVERAGE.md. Approved chat design is binding.

## Refs
- ../DESIGN-COVERAGE.md
- ../../../docs/agents/development-workflow.md
- ../../../docs/agents/task-decomposition.md
- ../../../conf/runtime.json
- scripts/deploy.mjs existing release safeguards

## Blocked by
None

## Acceptance and counterexamples
- [x] Required behaviors and counterexamples: [coverage](../DESIGN-COVERAGE.md), [final acceptance](../FINAL-ACCEPTANCE.md).
- [x] Red/green and scoped regression: [final acceptance](../FINAL-ACCEPTANCE.md), with all earlier RED logs retained.
- [x] Coordinator independent review: [review record](../reports/independent-review.md), [integrated acceptance](../FINAL-ACCEPTANCE.md).

## Evidence
- Report: ../reports/source.md
- UI/browser/visual: N/A for module scope; integrated real application smoke owned by coordinator.
- Tests create and clean only their own temporary resources; no formal target/process mutations.

## Dispatch
Explicit file ownership and interfaces supplied in the subagent prompt; no subdelegation, no commits/push/deploy of formal service.

## History
2026-10-06: confirmed scope; started.

2026-10-06 10:08 +08:00: /root independently accepted this scope; State closed / Status accepted. Applicable publishing checks passed; full project FAIL and partial baseline NOT VERIFIED retained in FINAL-ACCEPTANCE.md. Post-publication wrapper/listener recovery and final rollback candidate-stop ownership passed fault tests, real Make and production rollback. Dependencies accepted; no pending publishing blocker.
