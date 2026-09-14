# Merge simulated replay reconciliation into master

## What to build

Commit the completed work and merge into local master, as requested on 2026-09-15. Preserve master’s replacement TradingView workflow, source records, and unrelated checkout files. No push requested.

Blocked by: none
Status: in-progress

- [x] Original feature committed as feb60e4.
- [x] Original feature npm test passed.
- [x] Resolve merge preserving current master pipeline and new acceptance coverage.
- [ ] Run merged typecheck, unit suite, build/runtime checks.
- [ ] Merge verified result into local master.

## Verification

- Original feature: npm test passed.
- Merged TradingView dispatcher/context/sample checks: 17 passed, including all four opt-in local CSVs.
- Merged typecheck passed.
- Default-parallel full unit run: 1491 passed, 10 failures (timeouts and missing UI after delayed import), 5 skipped. Log retained locally at /tmp/tradereview-issue17-merge-unit.log.
- Full repeat with --maxWorkers=2, unchanged timeout/assertions: 1501 passed, 5 skipped; 156 files passed, 2 skipped. Log: /tmp/tradereview-issue17-merge-unit-bounded.log.
- Resolution retained master's current TradingViewContextDialog and simulation adapter; obsolete dialog removed; new acceptance assertions use current source fields. Reviewed by coordinator.
