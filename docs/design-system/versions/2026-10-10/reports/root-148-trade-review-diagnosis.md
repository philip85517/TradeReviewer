> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](../README.md)。

# TradeReviewWorkspace three-test diagnosis

Date: 2026-10-10

## Scope

The root-146 full run reported three failures in `app/components/trade-review-workspace.test.tsx`:

- `returns notification reviews to their real analysis and data sources`
- `keeps imported review actions in the Recall frame without a duplicate page header`
- `keeps the latest Recall drawing draft while completion is gated`

The existing root-146 failure log is preserved at `reports/root-146-full-unit.log`.

## RED evidence

Root-146 (maxWorkers=2) reported 3,226 passed, 6 skipped, and three failures in 455.32s. The first and third failures were Vitest's default 5,000ms test timeout. The second failed inside `enterImportedReviewFromDashboard` at the `图表工具栏` wait, whose helper budget is 1,000ms (`trade-review-workspace.test.tsx:1047-1049`). No assertion showed an incorrect product state.

## Reproduction

The three titles were rerun with one worker and the default timeout:

```sh
npx vitest run app/components/trade-review-workspace.test.tsx \
  --maxWorkers=1 --reporter=verbose \
  -t 'returns notification reviews to their real analysis and data sources|keeps imported review actions in the Recall frame without a duplicate page header|keeps the latest Recall drawing draft while completion is gated'
```

Result: 1 file passed, 3 passed, 88 skipped, 15.26s. Timings were 3,675ms, 1,541ms, and 4,363ms respectively. The last journey is close to the 5,000ms default even when isolated.

The complete file was then rerun without changing code:

```sh
npx vitest run app/components/trade-review-workspace.test.tsx \
  --maxWorkers=1 --reporter=dot
```

Result: 1 file passed, 91 passed, 116.38s (`reports/root-148-trade-review-single-file.log`).

## Diagnosis and boundary

There is no single-worker reproduction of a product or assertion defect. The evidence is consistent with scheduler/resource contention in the root-146 parallel run, amplified by two intentionally long async journeys and the imported-review helper's local 1,000ms chart-ready budget. This is a diagnosis of the observed test-run behavior, not proof that CPU contention is the only cause. The chart-ready failure is specifically a test-helper readiness timeout; it does not establish that the chart failed to render in the product.

No production code or test assertion was changed. The existing dirty baseline remains intact. A final full-suite run with a controlled worker count is still required for the coordinator's gate; this focused pass does not establish browser acceptance.
