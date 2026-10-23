# Exact commands and results

Working directory for every command: `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`. Native Node wrapper pins project Node26. No server/browser/database/integration commands were run. Commands below are read-only except writing the new seam evidence logs/snapshots. Final implementation hashes are in CANDIDATE-HASHES.json.

Final regression, exit0,5files244testsPASS (`regression-final.log`):

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/replay/position-ledger.test.ts app/lib/reviews/homepage-v25-performance.test.ts app/lib/reviews/homepage-v25-series.test.ts app/lib/trades/ipo-cost.test.ts app/lib/trades/bonus-share-evidence.test.ts > .scratch/homepage-v25-implementation/evidence/P4/seam/regression-final.log 2>&1
```

Strict dependencies, exit0 (`tsc-strict-dependencies-final.log`, empty):

```sh
./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit -p .scratch/homepage-v25-implementation/evidence/P4/seam/tsconfig.strict.json > .scratch/homepage-v25-implementation/evidence/P4/seam/tsc-strict-dependencies-final.log 2>&1
```

The evidence tsconfig extends the actual root strict compiler options, includes all four owned sources/tests and the three neighboring test files plus transitive dependencies. It disables incremental output/plugins only; no strict option is relaxed.

Four-file lint, exit0 (`lint-final.log`, empty):

```sh
./scripts/native-node.sh node_modules/eslint/bin/eslint.js app/lib/replay/position-ledger.ts app/lib/replay/position-ledger.test.ts app/lib/reviews/homepage-v25-performance.ts app/lib/reviews/homepage-v25-performance.test.ts > .scratch/homepage-v25-implementation/evidence/P4/seam/lint-final.log 2>&1
```

Accepted A input/current candidate complete public equivalence, exit0 (`public-equivalence.json`, stderr empty):

```sh
./scripts/native-node.sh .scratch/homepage-v25-implementation/evidence/P4/seam/public-equivalence.cjs > .scratch/homepage-v25-implementation/evidence/P4/seam/public-equivalence.json 2> .scratch/homepage-v25-implementation/evidence/P4/seam/public-equivalence.stderr.log
```

The native CommonJS loader transpiles local TypeScript, first substitutes only the accepted ledger/F input snapshots, clears app module cache, then loads current sources. It compares all public fields by deep equality, cached repeats, every prepared source/index/memo counter, and verifies explicit reads leave those counters unchanged. Small four-case correctness comparison only; no formal performance assertion or sample is generated.

Workspace TypeScript, exit0, empty `tsc-workspace-final.log`:

```sh
./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit --incremental false > .scratch/homepage-v25-implementation/evidence/P4/seam/tsc-workspace-final.log 2>&1
```

Earlier whole-workspace typechecks (`tsc-initial.log`, `tsc-1.log`, `tsc-2.log`) retain encountered failures. All two timePrecision owner errors, owner Map typing and new fixture typing were fixed within the four-file boundary. At `tsc-2.log` only parallel session-model test errors remained; this owner did not alter that work. Final workspace result is reported in VALIDATION.json rather than inferred from scoped checks.

Final snapshot/old-test/adjacent guard capture, exit0:

```sh
python3 .scratch/homepage-v25-implementation/evidence/P4/seam/freeze-candidate.py
```

RED→GREEN groups were run through the same pinned vitest command with their test-name filter. `red-o01-o02.log` contains real missing-interface failures before implementation; `green-o01-o02.log` passes the minimal4tests. Parent explicitly authorized expansion after reviewing exact interface and literal results. `red-o03-o08.log`→`green-o03-o08-2.log`, `red-coverage.log`→`green-coverage.log`, `red-exactness.log`→`green-exactness.log`, `red-fee-source.log`→`green-fee-source.log`, and `red-fee-knownness.log`→`green-fee-knownness.log` retain each later real failure and corresponding fix. Final244test run includes all of these additions.

Last targeted fee gate command (RED exit1, GREEN exit0):

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/reviews/homepage-v25-performance.test.ts -t 'P4 F fact seam fee unknown gates'
```

Implementation helpers and intermediate logs are preserved as new seam evidence. No old failure, acceptedA snapshot, budget threshold or original assertion was overwritten. Formal heavy A benchmark was not run; root quiet-window release and independent acceptance remain required.
