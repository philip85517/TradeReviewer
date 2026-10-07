# 02 — Start safe worktree debugging from an online SQLite copy

ID: NDB-02
State: closed
Status: accepted
Assignee: debug_launcher (gpt-5.6-luna)
Coordinator: /root

## Scope / What to build
R04–R08: dedicated scripts/debug-local.mjs at fixed loopback3333, fixed worktree .data/tradereview-test.sqlite, read-only SQLite backup API/quick_check/atomic refresh, explicit DB env, port/path/in-use/concurrency checks and child lifecycle. Every standard restart resets the copy. Invalid/failed preparation never launches server or falls back to production.

## Refs
- ../README.md § Approved contract / Shared interface
- ../DESIGN-COVERAGE.md R04–R08
- ../../../docs/agents/development-workflow.md § 数据安全与功能验收
- Existing scripts/runtime-config.mjs and scripts/start-local.mjs (read-only dependencies)

## Blocked by
Final runtime integration waits for 01 assertion module; prepare independent backup/lifecycle tests with owned fixtures meanwhile.

## Acceptance and counterexamples
- [x] Test first and preserve red/green evidence for missing debug behavior.
- [x] Real synthetic WAL data is present in backup; writing copy does not change source.
- [x] Restart refreshes copy; failed backup/check retains prior copy and does not spawn server.
- [x] Port occupied -> failure before copy, foreign listener untouched.
- [x] Samepath/realpath/hardlink/symlink/open target and concurrent startup rejected.
- [x] Lock spans service lifetime; signal/child exit release it, no stale descendants.

## 验收证据

- 自动化 / 领域：[`reports/debug-launcher-green.log`](../reports/debug-launcher-green.log), [`reports/debug-launcher.md`](../reports/debug-launcher.md)
- 初始失败：[`reports/debug-launcher-red.log`](../reports/debug-launcher-red.log)
- 浏览器/视觉：不适用；本票只实现 native debug 控制脚本，协调者负责真实应用启动验收。
- 协调者补充验收：真实3333服务、固定测试库、浏览器写入/返回/刷新及重启重置均通过，见下方最终验收。

## Dispatch / ownership
Write only scripts/debug-local.mjs and scripts/debug-local.test.mjs, this issue, ../reports/debug-launcher.md and red/green logs. Do not edit start-local/runtime-config, package.json, Makefile, docs, environment/native tooling or business UI. Use assertNativeEnvironment agreed in README; communicate API issue to root. No production DB access/copy, no3333 actual app startup; root owns that. Synthetic tests must own temp directories/ports and all cleanup. No subagents. Report implementation-ready; root accepts independently.

## Coordinator acceptance — 2026-10-06

Accepted by /root after direct code review, independent review, and applicable operational checks. [Final acceptance](../FINAL-ACCEPTANCE.md) and [coverage](../DESIGN-COVERAGE.md) link native57/57, debug/environment15/15, existing deployment58/58, runtime-config6/6, build/integration5/5, typecheck/scoped lint, installed controls and unchanged formal service/data, and real browser persistence/restart-reset evidence. The broad repository unit run remains FAIL and is preserved explicitly; no repository-wide green claim or application release is made. Historical red/failing evidence is retained.
