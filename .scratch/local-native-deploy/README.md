# Local native deployment

State: closed
Status: accepted
Coordinator: /root
Baseline: 63690a494b8ad403081c7720985be54a95db60c7
User approved the bounded in-chat design on 2026-10-06: make deploy current HEAD / REF=master / specific Git ref, immutable commit metadata, independent dependency installation/build, health-gated native replacement and recovery, status/rollback, preserve business config/data.

Owners: source snapshot /root/deploy_source (gpt-5.6-luna, medium); native process boundary /root/native_runtime (gpt-5.6-luna, medium); CLI/lifecycle /root/deployment_flow_audit (gpt-5.6-luna, medium); Makefiles/docs/integrated acceptance /root.

UI elements, screenshot references, chart state and write journeys: not applicable, operations tooling only. No production restart or deployment is needed for implementation acceptance. Tests use unique temporary Git/target/database directories and spare ports, with explicit TRADEREVIEW_DB_PATH for application tests. Never change other worktrees or the formal database.

- [01 Source selection](issues/01-source.md)
- [02 Native runtime](issues/02-runtime.md)
- [03 CLI and lifecycle](issues/03-cli.md)
- [04 Integrated acceptance](issues/04-acceptance.md)

Additional bounded slices: native_runtime owns toolkit transaction and scripts/deploy-native-safety.test.mjs (D05–D09 fault journeys); deploy_source independently reviews the integrated runtime/CLI/toolkit/Makefiles. Coordinator accepts actual make and production browser evidence.

Coordinator accepted D01–D09 on 2026-10-06 10:08 +08:00. [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md) records evidence and regression limits; [version audit](reports/VERSION-AUDIT.md) lists all worktrees and the unchanged formal service; [browser smoke](reports/browser-smoke.md) describes the running isolated empty-database production instance.

45 deployment tests, 58 Docker tests, npm test/build, typecheck and scoped lint pass. Full business Vitest/lint remain FAIL; only part of their baseline failures were verified, the rest remain NOT VERIFIED. No formal deployment, commit, push or merge was performed.
