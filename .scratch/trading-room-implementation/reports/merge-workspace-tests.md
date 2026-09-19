# Merge workspace test report

## Scope

The four requested workspace/storage test files were run together with one Vitest worker and the default test timeout:

```text
npx vitest run app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx app/components/trade-review-workspace.refresh.test.tsx app/lib/storage/storage-boundary.test.tsx --maxWorkers=1
```

## Initial result

The first run completed with 107 passing tests and one failure (4 files, 108 tests). The failing case was:

```text
app/components/trade-review-workspace.refresh.test.tsx
  refreshes the global saved summary after a single instrument update

TestingLibraryElementError: Unable to find role="button" and name "开始复盘"
```

The master trade-library redesign now enters a stock round through the stock expand and child-round buttons, so the test's stale direct `开始复盘` lookup did not match the merged navigation.

After changing the test to use the existing stock-round helper, a focused rerun exposed the persisted expanded stock state on the second visit:

```text
TestingLibraryElementError: Unable to find role="button" and name /^展开.*交易回合$/
```

The helper now accepts either `展开` or `收起` and only clicks the toggle when it is not already expanded. This is a test-only adaptation; product code and fixture dates were unchanged.

## Final result

Focused confirmation of the formerly failing case:

```text
Test Files  1 passed (1)
Tests  1 passed | 6 skipped (7)
```

Final requested four-file run:

```text
Test Files  4 passed (4)
Tests  108 passed (108)
Duration 85.23s
```

No product files were changed for the test adaptation. The non-FX homepage BOC import and endpoint test changes remain in the shared worktree for the coordinator's merge review.
