# 04 — Independently accept integrated make deploy

ID: native-deploy-04
State: closed
Status: accepted
Assignee: /root
Coordinator: /root

## Scope
D01–D09 in ../DESIGN-COVERAGE.md. Approved chat design is binding.

## Refs
- ../DESIGN-COVERAGE.md
- ../../../docs/agents/development-workflow.md
- ../../../docs/agents/task-decomposition.md
- ../../../conf/runtime.json
- scripts/deploy.mjs existing release safeguards

## Blocked by
01 and 02 must be independently reviewed before integrated acceptance; CLI can develop against the fixed interfaces in parallel.

## Acceptance and counterexamples
- [x] Required behaviors and counterexamples: [coverage](../DESIGN-COVERAGE.md), [final acceptance](../FINAL-ACCEPTANCE.md).
- [x] Red/green and scoped regression: [final acceptance](../FINAL-ACCEPTANCE.md), with all earlier RED logs retained.
- [x] Coordinator independent review: [review record](../reports/independent-review.md), [integrated acceptance](../FINAL-ACCEPTANCE.md).

## Evidence
- Report: ../reports/acceptance.md
- UI/browser/visual: N/A for module scope; integrated real application smoke owned by coordinator.
- Tests create and clean only their own temporary resources; no formal target/process mutations.

## Dispatch
Explicit file ownership and interfaces supplied in the subagent prompt; no subdelegation, no commits/push/deploy of formal service.

## History
2026-10-06: confirmed scope; started.

2026-10-06: added independent fault-journey test slice owned by /root/native_runtime in scripts/deploy-native-safety.test.mjs; maps D05–D09. Target Makefile space detection initially failed actual make acceptance; root corrected and repeated full journey passed. Post-publication wrapper/listener identity review remains pending verification.

2026-10-06 10:08 +08:00: /root independently accepted this scope; State closed / Status accepted. Applicable publishing checks passed; full project FAIL and partial baseline NOT VERIFIED retained in FINAL-ACCEPTANCE.md. Post-publication wrapper/listener recovery and final rollback candidate-stop ownership passed fault tests, real Make and production rollback. Dependencies accepted; no pending publishing blocker.
