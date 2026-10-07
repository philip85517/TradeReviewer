# 01 — Pin the native runtime and unify deployment control

ID: NDB-01
State: closed
Status: accepted
Assignee: native_environment (gpt-5.6-luna)
Coordinator: /root

## Scope / What to build
R01–R03: exact Node26.0.0 / built-in SQLite3.53.0 profile and runtime gate, same Node executable for installation/build/service, release and status runtime evidence, installed startup and toolkit profile/module support. Preserve old deployment transactions and explicit Docker compatibility; production native control must not silently fall back to Docker.

## Refs
- ../README.md § Approved contract / Shared interface
- ../DESIGN-COVERAGE.md R01–R03
- ../../../docs/agents/development-workflow.md § 本机统一业务入口 / 开发与审查
- Existing scripts/deploy-native*.mjs and deploy/ops/start-native.command

## Blocked by
None. Debug launcher consumes the agreed assertion API once available; both may implement disjoint files.

## Acceptance and counterexamples
- [x] Tests fail before implementation for runtime mismatch/build/start/metadata behavior, then pass.
- [x] Wrong Node or SQLite fails before npm/service actions; configured executable is actually used.
- [x] Release and status record/report measured runtime; no fabricated values for legacy releases.
- [x] Toolkit installs module/profile and safe launcher; rollback restores previous control files.
- [x] Existing native transaction/ownership safety tests pass.

## Dispatch / ownership
Write only conf/native-environment.json, .node-version, scripts/native-environment.mjs and .test.mjs, scripts/deploy-native-runtime.mjs/.test.mjs, scripts/deploy-native.mjs/.test.mjs, scripts/deploy-native-toolkit.mjs/.test.mjs, deploy/ops/start-native.command, this issue and ../reports/native-environment.md plus red/green logs. Do not edit root Makefile, deploy/target/Makefile, package.json, docs, debug files, business code or other task records. No production deployment/service changes/DB writes; use owned temporary fixtures. No subagents. Report implementation-ready; root accepts independently.

## Coordinator acceptance — 2026-10-06

Accepted by /root after direct code review, independent review, and applicable operational checks. [Final acceptance](../FINAL-ACCEPTANCE.md) and [coverage](../DESIGN-COVERAGE.md) link native57/57, debug/environment15/15, existing deployment58/58, runtime-config6/6, build/integration5/5, typecheck/scoped lint, installed controls and unchanged formal service/data, and real browser persistence/restart-reset evidence. The broad repository unit run remains FAIL and is preserved explicitly; no repository-wide green claim or application release is made. Historical red/failing evidence is retained.
