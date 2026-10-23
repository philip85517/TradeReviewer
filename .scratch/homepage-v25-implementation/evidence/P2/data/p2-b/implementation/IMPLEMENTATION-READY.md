# P2-B series implementation-ready candidate

2026-10-23. Owner `/root/filter_preparation`, actual **gpt-6.1-sol / ultra**. This is a frozen, bounded pure-data candidate for root's independent acceptance. It does not accept A performance, release UI/P4, or advance P2 formal **0/3**.

Only two new product/test files were authored for this slice:

| File | SHA-256 |
|---|---|
| `app/lib/reviews/homepage-v25-series.ts` | `30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6` |
| `app/lib/reviews/homepage-v25-series.test.ts` | `49b799ab415c20898d71c1d29a426ba2d10ff0052ec3defa6f329c224f5474ff` |

All other authored files are inside this new evidence directory. No A/F/S/ledger/UI/host/filter/config/database/dependency/shared-tracker changes, browser/service work, commits, or further agents were performed in this slice. The five frozen P3 product/test hashes were rechecked unchanged. All 19 entries in `INPUT-MANIFEST.json` still match, including the binding A source `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a` and A test `23f73d5a0e7c6758de5ac20f264083562ae41a502e4098b7ee6668e52fab70a8`.

## Authority and references

`../ROOT-DISPATCH.md` expressly allows isolated B development against financially correct frozen A while its cold performance remains FAIL. The root observation window was respected: no commands or writes during its all-silent interval; implementation resumed only after explicit release. This is an order adjustment for new files, not full A acceptance or a performance waiver.

Read versions are recorded in `INPUT-MANIFEST.json`. Before product/test creation, `DESIGN-COVERAGE.md` mapped HV25-14..22 and S01/S02/T01/X01/X02/L01 to the original HP02 lines191–252, Metric611–698, ChartTooltip872–959, and the original `period.svg`, `chart-hover.svg`, `chart-hover--keyboard.svg`, `chart-gap.svg`. All four originals were directly viewed through lossless renders in `references/`. These are reference renders, not running product screenshots. No design deviation was authorized.

## Callable interface and subsequent wiring seam

Exports:

```ts
buildHomepageV25Series(
  source: HomepageV25PreparedSource,
  input: HomepageV25SeriesInput,
): HomepageV25SeriesBundle

type HomepageV25SeriesInput = Readonly<{
  period: Readonly<{ start: string; end: string }>;
  asOf: string;
  targetCurrency?: string;
  requestGeneration: string;
}>;
```

The source is the actual opaque A handle. S/host supplies already resolved applied dates and the actual asOf instant. The function validates Gregorian `YYYY-MM-DD` bounds, enumerates both endpoints inclusively, and calls A's public batch projector exactly once. Each endpoint retains `at: YYYY-MM-DD`; A preserves historical date-only visibility and clamps today's point to the actual instant. No presets, current clock reads, financial formulas, extra cache, per-day builder, rounding, interpolation or new finance authority are introduced.

The bundle preserves A's `sourceId`, `revisions`, `policies`, `scope`, `points`, `current`, `feeFacts` by reference. Its new frozen wrapper owns `requestGeneration` and a frozen `boundary` with Shanghai timezone, normalized asOf, periodStart, requestedEnd and effectiveEnd. The generation is never written into A. Each call returns a new wrapper even when A reuses the same batch references.

`periodSummary` is the actual last **nonfuture** full boundary point, including all six period audit fields and complete evidence. Exposing the full point is additive to the proposed six-field Pick and avoids copying or dropping coverage. It can be null when the entire selected period is future; then `summaryState` is `future` and `effectiveEnd` is null. A final missing point stays the summary with its missing state and null dependent fields; it is never replaced by an earlier plottable point. Root should review this full-point/null contract explicitly when wiring.

Full consumer example, given the accepted source and S's applied request:

```ts
import type { HomepageV25PreparedSource } from "./homepage-v25-performance";
import {
  buildHomepageV25Series,
  type HomepageV25SeriesInput,
} from "./homepage-v25-series";

export function projectAppliedPeriod(
  preparedSource: HomepageV25PreparedSource,
  appliedRequest: HomepageV25SeriesInput,
  selectedDay: string,
) {
  const bundle = buildHomepageV25Series(preparedSource, appliedRequest);
  const summary = bundle.periodSummary;
  const cards = summary === null ? null : {
    net: summary.net,
    realized: summary.periodRealized,
    unrealizedChange: summary.unrealizedChange,
  };
  const point = bundle.points.find(item => item.key === selectedDay);
  const tooltip = point === undefined ? [] : bundle.tooltipFields.map(field => ({
    field,
    metric: point[field],
  }));
  return { bundle, cards, point, tooltip, current: bundle.current };
}

// S supplies these resolved dates; it also supplies the actual source/generation.
const request: HomepageV25SeriesInput = {
  period: { start: "2026-01-05", end: "2026-01-09" },
  asOf: "2026-01-07T08:00:00Z",
  targetCurrency: "CNY",
  requestGeneration: "g01",
};
```

The example passes complete metrics, not formatted strings or new totals. UI must use each metric's availability/coverage/reasons/original amounts, draw only eligible `point.net` values, retain future gray placeholders and gap explanations, and format only at presentation. Tooltip order is the exported frozen tuple `marketValue`, `unrealizedNet`, `lifetimeRealizedNet`, `lifetimeNet`, `net`, `periodFees`. Current comes solely from `bundle.current`; it does not come from the period summary. Unknown lifetime/FX cannot be filled from period or latest values.

Invalid or reversed dates throw the existing typed `HomepageV25ProjectionInputError` with code `period-invalid` before projection. A's asOf/source errors propagate unchanged; a date-only asOf retains `as-of-instant-required`. The function does not commit applied state. Host/S must reject stale source/generation results and commit the accepted bundle atomically. Actual cancellation, late-result rejection, return/reload and controls are not exercised by this synchronous module.

## TDD and verification evidence

All financial fixtures use real `buildInstrumentTradeSummaries` → `buildTradeLibraryEntries` → `prepareHomepageV25Source` → public A projection. No financial result mocks were used.

| Evidence | Result |
|---|---|
| `RED-01-missing-module.log` | exit1; import resolution failure, no tests executed |
| `RED-02-callable-boundary.log` | exit1; typed callable stub against real A; 17 failed / 1 passed of18 |
| `GREEN-01.log` | exit1; first complete implementation, 16 passed / 2 failed of18 |
| `GREEN-02.log` | exit0; 18/18 passed |
| `FINAL-targeted-tests.log` | exit0; new B18 + frozen adjacent A141 = **159/159**, 2 files; 8.92s total test command, not a financial performance benchmark |
| `FINAL-typecheck.log` | exit0; scoped TypeScript; no diagnostics |
| `FINAL-lint.log` | exit0; exact two new files; no diagnostics |

The two GREEN-01 failures were evidence-format assumptions in the tests. Source tracing confirmed A canonically orders historical executions as `early/later/dated`, and dated FX `money.fx.asOf` is the exact endpoint cursor `2026-01-30T15:59:59.999Z`. Only those expectations were corrected. Every literal financial amount from the approved eight-oracle plan was unchanged. The failing logs remain preserved.

Commands ran under native Node **v26.0.0** from repository root:

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/reviews/homepage-v25-series.test.ts --maxWorkers=1
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/reviews/homepage-v25-series.test.ts app/lib/reviews/homepage-v25-performance.test.ts --maxWorkers=1
./scripts/native-node.sh node_modules/typescript/bin/tsc -p .scratch/homepage-v25-implementation/evidence/P2/data/p2-b/implementation/typecheck.config.json
./scripts/native-node.sh node_modules/eslint/bin/eslint.js app/lib/reviews/homepage-v25-series.ts app/lib/reviews/homepage-v25-series.test.ts
```

## Version-bound pure-data coverage

| Oracle / requirements | Executed journey | Worker evidence |
|---|---|---|
| O01 / HV25-17/19 | Historical day versus actual current instant; date-only and exact execution visibility | PASS |
| O02 / HV25-17/18 | Shanghai first instant and one millisecond boundary, opening evidence | PASS |
| O03 / HV25-17/18/19 | Seven inclusive cross-year days, 365/366, invalid dates/range/asOf | PASS |
| O04 / HV25-16/19/22, X01/X02 | Future placeholders, independent current, missing final summary and allfuture null summary | PASS |
| O05 / HV25-14/15/20/21, S01/S02/T01/L01 | Six amounts0/0/30/30/10/0, lifetime independent of start, missing inception truthful | PASS |
| O06 / HV25-14/15/16/19/22, X01/X02 | Partial fees18/16/14/−4/12/3/1, missing quote dependencies, genuine zero | PASS |
| O07 / HV25-16/20/21, X01/X02 | Endpoint FX240/−160/80, native10/source cursor, latest-only unknown, independent current840 | PASS |
| O08 / HV25-18/19, S01/S02 | Single batch/new wrapper, immutable generation, full object identity and source content invalidation | PASS |

Root's independent scoped tests/source/type/lint and eventual performance acceptance are separate from this worker coverage. The final output manifest binds both source files, all evidence files and validation results to hashes.

## Unresolved gates

| Gate | Status / owner |
|---|---|
| Root independent acceptance of this frozen B candidate | PENDING; root |
| A cold complete three-market performance | **FAIL**, last root observation2.62s versus required2s; unchanged and unwaived |
| B's own full-source cold/repeat overhead | **NOT MEASURED**; root's later quiet window; A timing does not stand in for B |
| P2 formal acceptance | **0/3**, unchanged |
| UI/P4 release | **NOT RELEASED** |
| Chart pointer/keyboard/touch, actual reveal/gray region/gaps, generation cancellation, whole-page visual and actual persistence/return/reload | **NOT VERIFIED**; root integrated ownership |

Frontend audit trigger: this data adapter will affect chart/control state wiring when integrated. Current scope has zero rendered controls and no host integration; its scoped inventory is the pure journeys above. It supplies no UI/browser/persistence acceptance evidence. All original chart journeys remain required at integration. No service or preview was created for this data-only slice, and no UI delivery is claimed.

This report and `OUTPUT-MANIFEST.json` freeze the implementation-ready candidate. Do not alter the two source/test files or their evidence until root requests a specific revision.
