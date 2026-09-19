# Review return regression

The workspace now records whether a review was opened from the trading room or the trade library. The review sidebar uses the matching return label and action. A trading-room return leaves the mounted dashboard in place, preserving its filters, period, and trend/calendar view. Library returns continue through the existing browse-state reset path, preserving filters and expanded stock context. Completing the review queue still advances to the next queued episode; when the queue is exhausted it returns to the recorded source view.

## Verification

Focused regression tests:

```text
npx vitest run app/components/trade-review-workspace.test.tsx -t 'returns to the trading room|returns to the library' --maxWorkers=1
Test Files  1 passed (1)
Tests  2 passed | 69 skipped (71)
```

Requested workspace/sidebar regression run:

```text
npx vitest run app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx app/components/trade-review-workspace.refresh.test.tsx app/lib/storage/storage-boundary.test.tsx app/components/review/stock-episode-navigation.test.tsx --maxWorkers=1
Test Files  5 passed (5)
Tests  113 passed (113)
Duration 87.04s
```

Type checking:

```text
npm run typecheck
exit 0
```

The earlier dashboard fixture/category failure and the intermediate assertion failure are preserved in `.scratch/trading-room-implementation/reports/merge-return-regression.log`; the final run above passed after test-only fixture/filter and nested-query corrections.
