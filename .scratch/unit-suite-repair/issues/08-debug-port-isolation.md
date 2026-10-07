# Native debug tests — host port isolation

State: closed
Status: accepted
Assignee: unit_market_adapter
Coordinator: /root
Refs: DESIGN-COVERAGE.md R13; scripts/debug-local.test.mjs:21–115; scripts/debug-local.mjs:105,119,190; reports/debug-test-final.log

Observed red: make debug-test gives 10 passed / 5 failed, 15 total; five failures stop at `port 3333 is already occupied`, before their intended backup/launch/corruption/cancellation branches. Current authorized 3333 preview remains running. Production fixed-port refusal is correct; these non-port tests must isolate the existing port probe seam while keeping real temporary SQLite/storage assertions.

Allowed file: scripts/debug-local.test.mjs only. Add `isPortOccupied: () => false` through existing options at non-port calls that currently probe host 3333: first copy, failed backup, valid standard launcher, corrupt backup, synchronous spawn failure, cancellation. Keep existing port-rejection test's `isPortOccupied: () => true` unchanged. Do not alter production port probe, preflight, path checks, assertions, mocks for backup/spawn, fixture records, test names/counts/timeouts, or earlier cases already using explicit false. No shared wrapper or new API required. Compare exact new delta against reports/debug-local-test.before.mjs because this file was already untracked before the current repair.

No tests/nested agents/browser/service/DB outside temporary test fixtures/deploy/remote. Root sole test executor. Write reports/debug-port-isolation-implementation.md and freeze promptly. Root requires exact-delta independent review plus bare make debug-test with current 3333 service still present; make deploy-test 57-pass and bare Vitest 3064-pass evidence remain valid because only excluded native debug test file changes.

- [x] Actual existing failure captured; exact intended branches retained.
- [x] Only option injection through existing test seam; occupied-port rejection unchanged.
- [x] Independent review passes and original 11 debug / 4 environment tests pass.
- [x] Root closes ledger only after every applicable gate passes.

Implementation frozen; report moved by root from an accidentally written top-level reports path into reports/debug-port-isolation-implementation.md in this task directory. Exact delta is six existing option injections; source remains unchanged. Root make debug-test passes15/15 in reports/debug-test-final-v2.log while the original node51308 listener remains on3333. Debug case inventory remains11 test declarations /37 assertion calls with unchanged names, modes, budgets, methods and expected values; callbacks reviewed separately against before snapshot. Scoped ESLint and git diff --check exit0. Fresh independent review still pending; prior debug-test-final.log FAIL is retained.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

Exact six existing isPortOccupied:false option injections accepted; occupied=true refusal case byte-for-byte unchanged. debug-test-final-v2.log15/15 (11 debug+4 environment), independent-review-debug-port.md, debug-case-inventory-final.json11 declarations/37 assertions and scoped lint pass. Root observed existing node51308 listener3333 before/after this run. debug-local.mjs hash unchanged. Historical10/15 red is retained, not an active failure.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
