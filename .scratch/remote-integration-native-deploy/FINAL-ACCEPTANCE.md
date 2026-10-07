# Integration candidate acceptance

State: open
Status: integration-pending
Coordinator: /root
Branch: codex/local-native-deploy
Integrated base: origin/master 0b0113773a54f716d45b30bfb8bc03d22b99a181

Source, unit repair and pinned runtime gates G05–G07 are accepted; remote publication gates G01–G04 are pending actual execution. The user explicitly authorizes commit, task-branch push, PR to master, merge and safe local master fast-forward. No direct master push, forced synchronization, service restart or new application deployment.

| Gate | Evidence | Result |
| --- | --- | --- |
| Bare whole-unit suite, original budgets | reports/final-unit.log; final-unit-result.json | PASS:319 files/3070 tests; 3 original corpus files/6 original tests skipped;463.72s |
| Native deployment/debug | reports/final-native.log; final-debug.log | PASS:60/60 and18/18, no skips |
| Production build and isolated integration | reports/final-build-integration.log | PASS:build and5/5 |
| Typecheck | reports/final-typecheck.log | PASS:exit0 |
| Changed production/test code ESLint | reports/final-scoped-eslint.log | PASS:exit0;0errors/2 existing debug-local warnings; no repository-wide lint claim |
| Exact SQL engine and configured executable | reports/pinned-entrypoints-runtime.json; entrypoint-acceptance.json | PASS:privateNode26.0.0 actualSQL3.53.0, without DYLD overrides |
| Source/installed bootstrap, argument preservation and no fallback | reports/pinned-entrypoints-red-v2.log; pinned-entrypoints-green.log; entrypoint-acceptance-v2.log | PASS:valid RED then2/2 GREEN; source/installed make status; installed launcher exit propagation |
| Assertion/timeout safety and independent review | reports/refresh-review.md; final-native-review.md; pinned-runtime-doc-review.md | PASS:original assertions/budgets retained; reviewed candidate matches freeze |
| Source freeze | reports/source-freeze-verification.json | PASS:785 unit/compiled-source files and11 native/profile files unchanged |
| Service preservation | reports/service-preservation.json | PASS:3022PID98660/3333PID51308 retained; actual versions of those old processes NOT VERIFIED |
| UI/visual/browser/database write acceptance | Current correction is test and runtime/operations source only | NOT APPLICABLE: no production UI change or application deployment; historical browser evidence remains historical |

Original integrated timeout, runtime mismatch, invalid bootstrap test import, rejected synchronous navigation candidate and path-canonicalization fixture failure remain archived with final passing resolutions. The private runtime lives outside Git; its sources/checksums, build flags and dependency limitations are documented in conf/NATIVE-RUNTIME.md. Old installed production controls and existing services are not upgraded merely by merging source.

The raw historical logs include preserved whitespace and are excluded from the source/doc whitespace gate. No SQLite, WAL/SHM, private dylib/runtime binary or unrelated runtime-check-backups file may be staged.
