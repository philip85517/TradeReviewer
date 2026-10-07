# 05 — Bound full-suite worker contention

ID: USR-05
State: closed
Status: accepted
Assignee: unit_holdings
Coordinator: /root

## Scope / refs

R10 in ../DESIGN-COVERAGE.md; Task 3 and global constraints in ../IMPLEMENTATION-PLAN.md; reports/root-diagnosis.md and reports/affected-files.json. Existing test timeout failures under the default seven workers fall to three isolated workspace test timeouts at two workers; those three require their separate deterministic repair before this task starts. Local Vitest resolveMaxWorkers honors configured maxWorkers before hardware default.

## Blocked by

None for the disjoint config implementation: root's scheduling ruling in IMPLEMENTATION-PLAN.md permits it from the eight-file green and three isolated-failure evidence. Integrated acceptance requires the repaired complete workspace file and bare npm run test:unit; writing the bound is not proof of fixing the three isolated failures.

## Dispatch / allowed changes

Luna gpt-5.6-luna / medium; vitest.config.ts only. Add test.maxWorkers: 2 and one brief comment explaining contention between jsdom UI tests and child-process tests. Preserve setup, file isolation, default/per-case timeouts, collection, and all pre-existing native-runner exclusions. Compare the new diff against reports/vitest-config.before.txt; no unrelated formatting. No extra tests or processes, commits, deployment, database/service/browser operations, or nested agents. Record the scoped diff and rationale in reports/runner-bound-implementation.md.

## Acceptance

- [x] Root has authorized implementation using eight-file green / isolated workspace-failure evidence; final acceptance waits for all workspace cases.
- [x] Only the worker limit and its explanatory comment differ from the saved starting config.
- [x] Bare full-suite command passes with existing timeout budgets, collection and skips.
- [x] Root independently reviews and accepts the integrated change.

UI / real-chart / visual / database persistence gates: not applicable; test-runner scheduling only, no product or storage behavior change.

## Scoped acceptance

Root and fresh independent reviewer accepted the two-line scheduling delta against `reports/vitest-config.before.txt`. See `reports/runner-bound-implementation.md` and `reports/independent-review-scoped.md`. The remaining integrated gate is unchanged. The earlier description of a writing dependency is superseded by the explicit disjoint scheduling ruling above.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

Final bare full-unit-final-v2.log passes with configured maxWorkers2, no CLI overrides and unchanged timeouts/collection/six skips. Only the explanatory comment and worker limit differ from vitest-config.before.txt. Root and independent-review-scoped.md accept the scheduling change; all separately repaired workspace cases pass.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
