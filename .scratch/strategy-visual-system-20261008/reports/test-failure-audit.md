# Full unit-run failure audit

Date: 2026-10-08 (Asia/Shanghai)  
Scope: read-only failure diagnosis against `9c2b3d2`; the only implementation change made during this audit is the bounded prototype settings read in `app/components/design-prototype/recall-design-prototype.tsx`, with its focused tests. No production default flow, business storage, or sample CSS was changed.

## Evidence

| Area | Isolated command/result | Baseline/cause conclusion |
| --- | --- | --- |
| Holdings date fallback | `./node_modules/.bin/vitest run app/lib/reviews/trading-room-holdings.test.ts --reporter=verbose`: **28 passed, 1 failed**. The test's quote date is `2026-09-02`, while the test runs on `2026-10-08`; without an injected `asOf`, the requested 30-day freshness window makes both statuses `stale` instead of `available`. | A clean `git archive 9c2b3d2` copy with the same symlinked `node_modules` produced the identical **28/1** result. Confirmed pre-existing wall-clock-sensitive test assumption; unrelated to the prototype diff. |
| Refresh suite | `./node_modules/.bin/vitest run app/components/trade-review-workspace.refresh.test.tsx --reporter=verbose`: **7 passed**, 15.95s. | Test and workspace source are unchanged from `9c2b3d2`. The individual tests pass in isolation; the parent full parallel run's refresh timeouts were not reproduced here and remain consistent with worker/resource contention. |
| Storage boundary | Before the bounded fix, the isolated suite was **1 passed, 2 failed**: one import-empty UI wait and one structural failure because the prototype runtime-imported legacy `chart-settings`. After replacing that import with `createSqliteHttpClient().getSettings()`, the suite is **2 passed, 1 failed**; only the import-empty UI wait remains (`交易室共享范围` label not found). | A clean `9c2b3d2` archive also gives **2 passed, 1 failed** with the same label wait. The structural regression was task-local and is now removed; the remaining DOM wait is pre-existing. |
| Deploy suite | `./node_modules/.bin/vitest run scripts/deploy.test.mjs --reporter=dot`: **58 passed**, 51.03s. `node --test scripts/deploy.test.mjs` is not a valid runner for this file: it fails before collecting tests because the file uses Vitest globals (`describe`/`test`). | Deploy source and tests are unchanged from `9c2b3d2`. Isolated Vitest execution passes; the two full-run 5s timeout reports were not reproduced in isolation. |

The parent-reported full parallel run was `31 failed, 2694 passed, 6 skipped`, including five refresh failures, two deploy timeout failures, the storage DOM wait, a storage timeout, the prototype boundary import regression (fixed above), and the holdings date fallback. This report does not claim that all 31 failures were independently reproduced or baseline-tested.

## Bounded settings fix

The prototype now reads chart settings through the authoritative SQLite HTTP client (`GET /api/storage/settings`) after mount. It has no runtime import from the migration-only browser `chart-settings` module, does not write the business settings key, and surfaces a visible error instead of silently defaulting when the read fails. Focused prototype tests cover both successful reads and propagated read failures.

Commands passed after the fix:

```text
./node_modules/.bin/vitest run app/components/design-prototype/recall-design-prototype.test.ts --reporter=verbose
  6 passed
./node_modules/.bin/vitest run app/lib/storage/storage-boundary.test.tsx --reporter=verbose
  2 passed, 1 pre-existing DOM wait failure
npm run typecheck
  passed
```

## Remaining full-run blind spot

The full `trade-review-workspace.test.tsx` suite was run alone with the normal Vitest timeout (no timeout override):

```text
./node_modules/.bin/vitest run app/components/trade-review-workspace.test.tsx --reporter=dot
  1 file passed, 79 tests passed, 82.67s
```

The file and its workspace source are unchanged from `9c2b3d2`, so this isolated pass does not establish why the parent parallel run reported 20 timeout failures; it only shows those failures are not reproduced without parallel contention.

The affected recall/replay regression set was also run as one isolated command:

```text
./node_modules/.bin/vitest run \
  app/components/design-prototype/recall-design-prototype.test.ts \
  app/components/chart/drawing-canvas.test.tsx \
  app/components/chart/drawing-canvas.recall-review.test.tsx \
  app/components/chart/replay-chart.test.tsx \
  app/components/chart/replay-chart.recall-review.test.tsx \
  app/components/recall/recall-workspace.test.tsx \
  app/components/recall/recall-integration.recall-review.test.tsx \
  app/components/trade-review-workspace.recall-bridge.test.tsx \
  --reporter=dot
  8 files passed, 189 tests passed, 28.37s
```

These results are focused isolated evidence only; they do not turn the parent full parallel run into a full-suite pass.

## Limits

No production or prototype default behavior was changed to address the holdings, refresh, deploy, or remaining storage DOM failures. No browser run was performed in this audit, no business database was written, and the full parallel suite was not rerun after the bounded settings fix. The baseline copies used archived source at `9c2b3d2` with the existing `node_modules` symlink; the archive command emitted only the environment's harmless `Failed to set default locale` warning.
