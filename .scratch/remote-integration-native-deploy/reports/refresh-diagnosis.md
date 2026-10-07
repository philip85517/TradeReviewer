# G06 refresh summary timeout diagnosis

Date: 2026-10-07
Owner: `/root/refresh_repair`
Stage: 2 bounded test-only correction

## Reproduction

The coordinator's original targeted run reproduces the failure without a full-suite load:

```text
npm run test:unit -- app/components/trade-review-workspace.refresh.test.tsx
8 tests: 7 passed, 1 failed
refreshes the global saved summary after a single instrument update: 5114ms
Test timed out in 5000ms
file duration: 17575ms
```

The integrated bare run independently recorded the same test at 5121ms in a 490.66s run (318 files, 3069 passed, one failure, six original skips). Therefore the timeout is local to this journey; it is not explained by concurrent full-suite pressure.

## Source finding and counterevidence

The test has a stale-scope smell at [app/components/trade-review-workspace.refresh.test.tsx:424](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/app/components/trade-review-workspace.refresh.test.tsx:424):

```tsx
await openDataManagement();
const dataManagement = getDataManagement();
expect(await within(dataManagement).findByText("部分可用 1 个标的")).toBeVisible();
...
await user.click(screen.getByRole("button", { name: "数据" }));
await screen.findByRole("region", { name: "数据管理" });
await waitFor(() =>
  expect(within(dataManagement).getByText("更新完成 1 个标的")).toBeVisible(),
);
expect(within(dataManagement).getByText("部分可用 0 个标的")).toBeVisible();
```

The assertion after line 436 is scoped to the element captured before the test leaves the data page. The test already reacquires the region with `screen.findByRole` at line 437 but discards that result. Reacquiring the region for the assertions remains a sensible bounded test cleanup, preserving the existing summary labels, provider call-count assertions, detail dialog assertions, storage seam, and complete navigation journey.

However, this is not yet proven to be the timeout cause. Coordinator inspection of [app/components/trade-review-workspace.tsx:5890-5904](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/app/components/trade-review-workspace.tsx:5890) confirms `DataManagement` is always mounted; navigation changes the parent container's `display`/`aria-hidden` state rather than unmounting that subtree. The previously captured region may therefore be the same connected DOM node after return. Stage 2 timing instrumentation must measure `dataManagement.isConnected` and equality with the freshly queried region before accepting this hypothesis.

The component source confirms that this is the correct boundary for a test-only synchronization repair. The data page is rendered from `DataManagement` at [app/components/trade-review-workspace.tsx:5890-5921](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/app/components/trade-review-workspace.tsx:5890), while the single-instrument completion writes the terminal job to storage and updates `marketDataJobsRef` before calling `refreshSavedGlobalMarketSummary` at [app/components/trade-review-workspace.tsx:3984-4013](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/app/components/trade-review-workspace.tsx:3984). That summary function derives the inventory from the current execution snapshot and durable jobs, then updates `marketDataRefresh` at [app/components/trade-review-workspace.tsx:3316-3360](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/app/components/trade-review-workspace.tsx:3316). No product-source race or missing persistence call is indicated by the inspected chain.

## Measured dominant work

The temporary timing probe was run across the complete eight-case file and then removed. The file passed; the target journey completed in 3287ms with these elapsed milestones:

```text
render 5, initialData 498, firstRound 964, firstDetail 1910,
refreshCalls 2024, returnData 2513, summary 2522,
secondRound 2921, secondDetail 3256, final 3287
```

At the return-data milestone, `dataManagement.isConnected` was `true` and the freshly queried region was the same DOM node. This disproves the stale-node explanation as the dominant cause. The long segments are the first detail/navigation portion (about 946ms from first-round to first-detail) and return navigation (about 489ms from summary completion to the return-data milestone). Those measurements are consistent with avoidable broad and duplicate role traversals in the test, rather than a summary persistence delay.

## Broad-query cost

The journey uses several page-wide `screen` queries after navigating between large workspace views. In particular, the detail action performed a page-wide `findByRole` followed by a second page-wide `getByRole` for the same button, and the return navigation searched the whole workspace for the 数据 button. These traversals account for the measured dominant work described above. The neighboring hard-failure journey uses similar queries and passes, so the evidence supports a narrow duplicate/traversal reduction rather than a broad query rewrite or timeout change.

## Ranked hypotheses

1. **Unscoped and duplicate workspace queries add avoidable latency (high confidence).** The milestone trace places the dominant elapsed work around first detail and return navigation, while the same connected region is retained across navigation. Scoping known navigation actions and collapsing duplicate detail-button lookups directly targets that measured work.
2. **Stale post-navigation region scope (disproved as dominant cause).** The data-management region remained connected and equal to the fresh query at return. Reacquiring it is retained as hygiene, not presented as the timeout root cause.
3. **A product persistence/state race (low confidence).** The inspected order is terminal `putMarketDataJob` → ref update/state update → `refreshSavedGlobalMarketSummary`; a product defect would require evidence that the fresh scope still never receives `更新完成 1 个标的` after the test-only scope repair.

## Stage 2 timing probe (authorized; removed)

The coordinator authorized temporary milestones in the failing test only, with elapsed `performance.now()` timing. The probe used stderr output after console output was absent from the runner log, captured the required milestones, and logged connectivity and region identity at return. It was removed before the bounded correction was left in place.

## Bounded correction applied (exact test file)

Only `app/components/trade-review-workspace.refresh.test.tsx` was changed. The existing 主导航 region is awaited with `findByRole` in the initial `openDataManagement` helper (the coordinator's targeted RED run showed that synchronous `getByRole` raced the async workspace load), then reused to scope the 数据 button; the already-loaded return navigation remains synchronously scoped. Each 行情数据详情 action now awaits one `findByRole` result and clicks that result, eliminating the prior duplicate page-wide `findByRole`/`getByRole` traversal. The post-return data-management region is freshly retained for assertions as navigation hygiene. All real user actions, provider/storage seams, navigation/detail steps, and assertions remain intact; no timeout, skip, mock, or production change was introduced.

## Distinct product issues

None established. The production chain inspected has the required durable write and summary recomputation. If the bounded query correction still times out in the coordinator's targeted run, that should be investigated separately from the disproved stale-node hypothesis.
