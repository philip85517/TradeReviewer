# Native CLI scoped evidence

Status: accepted by coordinator
Owner: /root/deployment_flow_audit (gpt-5.6-luna / medium)

Initial RED imported the missing deploy-native.mjs module. Initial GREEN passed 3 CLI tests; the expanded final CLI suite passes 11. Toolkit is a separate 4-test suite. Together with source 13, runtime 11 and safety 6, make deploy-test passes 45 tests.

After the coordinator moved old-service stop outside the rollback candidate try, the CLI suite passed 11/11 again in [cli-final.log](cli-final.log). Subsequent real deployment and installed target rollback passed in [production-deploy-accepted-final.log](production-deploy-accepted-final.log) and [production-rollback-final.log](production-rollback-final.log).

The CLI suite verifies parsing, dry-run target nonmutation, build failure preserving old service, malformed/symlink configuration, foreign listener refusal, ambient runtime overrides, external current/config paths, held lock refusal, source/target overlap and rollback cleanup limited to its own candidate handle. Additional cross-module startup/post-publication recovery, ownership races, toolkit restoration and failed-recovery evidence is in [safety-tests-final.log](safety-tests-final.log) and [make-acceptance.json](make-acceptance.json).

The CLI snapshots exactly committed source, builds before interrupting the old service, validates actual healthy listener identity, atomically publishes current and records full SHA/ref/build/version/previous-success metadata. Rollback uses recorded previousRelease, never filename order. Status reports physical cwd/PID/health consistency; legacy metadata stays UNKNOWN. Toolkit bytes come from the executing tooling and install/restore inside the same lock.

Vitest excludes all five operational Node test files, run through make deploy-test. The existing scripts/deploy.test.mjs remains Vitest and passes 58 tests separately. Full project FAIL / NOT VERIFIED limitations are retained in [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).

No formal target/database or port 3022 process was started, stopped or deployed. All mutating acceptance used uniquely owned temporary targets and isolated databases.
