# First-stage market data service

## Files

- Added `app/lib/market/market-data-service.ts`, a typed `refreshMarketData` seam around the existing daily and hourly synchronizers.
- Added focused behavior tests in `app/lib/market/market-data-service.test.ts`.
- Updated `app/components/trade-review-workspace.tsx` to consume the seam and removed the duplicated all-settled orchestration helpers.

## Behavior

The service runs daily and hourly refreshes independently, propagates an already-aborted signal and child/coverage-read `AbortError`, and never returns a partial outcome after cancellation. A failed interval retains its prior candles and coverage. Daily coverage read failures preserve fetched daily candles and prior coverage while reporting `storage-error` with `refreshErrorSource: "coverage-read"`. The prior 15m display remains when an hourly refresh returns no candles. `error` describes a low-level partial result; `refreshError` describes a refresh/read failure, and `status` describes the usable displayed result. Previous snapshots are copied and never mutated.

## Verification

- Initial test-first red run: service test could not resolve the not-yet-created module.
- `npm run test:unit -- app/lib/market/market-data-service.test.ts app/components/trade-review-workspace.refresh.test.tsx --run`: 15 passed.
- `npm run typecheck -- --pretty false`: passed.

Command output is retained in `focused-tests.log` and `typecheck.log` in this directory.

Follow-up acceptance coverage added a real lower-service cache integration test, delayed coverage cancellation, ordinary interval retention, combined partial/coverage diagnostics, typed failed range fields, and DOMException storage normalization. The follow-up service/integration run passed 12 tests; typecheck passed with output in `implementation-typecheck.log`.

The targeted full `trade-review-workspace.test.tsx` regression initially exposed a test race: it changed episodes before the first refresh had returned to an enabled terminal control. The test now waits for the first refresh button to be enabled and for the second details dialog to be present before clicking. Exact test and the full workspace file both pass (71/71); outputs are retained in `workspace-regression-fixed.log`.

The public result fields document that `status` comes from the attempted synchronizer (with daily failure status derived from retained coverage), `source` describes the low-level acquisition path, `error` is a partial usable-result diagnostic, and `refreshError` is orchestration/read failure with its stage. Hourly legacy 15m retention is explicitly represented by `retainedPrevious` and `interval`.

The final service/integration run passed 14 tests, including symmetric hourly rejection retention and typed daily exception failed-range diagnostics.

Final correction: aligned the mocked `MarketDataSyncError` constructor call with the production `(code, message, failedRanges)` signature. The final focused 14-test run and `implementation-final-typecheck.log` typecheck both pass.

Quality verification remains intentionally unclaimed; this seam only reports provider fetch/sync outcomes and does not infer research-grade data quality.
