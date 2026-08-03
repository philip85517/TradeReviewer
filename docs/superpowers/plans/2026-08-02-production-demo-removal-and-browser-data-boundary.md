# Production Demo Removal and Browser Data Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production entry point show only browser-imported stocks, while retaining the bundled XPEV demo for local development and tests.

**Architecture:** Add an explicit `showDemo` presentation flag to `TradeReviewWorkspace` and `EpisodeSidebar`. The production `app/page.tsx` passes `showDemo={false}`; the workspace default remains `true` so existing demo replay tests and local development keep their fixture. When demo is disabled and no imported stock is available, render a truthful import-empty state instead of a demo chart.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, CSS, vinext/Vite.

## Global Constraints

- Imported executions and import history remain in browser `localStorage`; do not migrate or clear them.
- Production must not render the XPEV demo card, demo search result, demo badge, or demo chart fallback.
- Development/test behavior remains demo-enabled unless a test explicitly passes `showDemo={false}`.
- Keep the existing demo replay API, demo fixtures, and demo-focused tests intact.

---

### Task 1: Add production-only demo visibility and empty state

**Files:**
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `app/components/review/episode-sidebar.test.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- `EpisodeSidebar` consumes optional `showDemo?: boolean`, defaulting to `true`; it produces a stock list whose count and cards include the demo only when enabled.
- `TradeReviewWorkspace` consumes optional `showDemo?: boolean`, defaulting to `true`; it passes the flag to `EpisodeSidebar`, excludes the demo from searchable instruments when disabled, rejects demo selection when disabled, and renders an import-empty review panel when no imported instrument is active.
- `app/page.tsx` produces the production boundary by rendering `<TradeReviewWorkspace initialFrame={getDemoReplayFrame()} showDemo={false} />`.

- [ ] **Step 1: Write the failing sidebar tests**

Create `app/components/review/episode-sidebar.test.tsx` with a minimal shared props fixture and these assertions:

```tsx
it("hides the bundled demo and reports zero stocks when demo is disabled", () => {
  render(<EpisodeSidebar {...props} importedInstruments={[]} showDemo={false} />);

  expect(screen.queryByText("小鹏汽车")).not.toBeInTheDocument();
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.getByText("暂无导入股票，请先导入交易记录。")).toBeInTheDocument();
});

it("renders imported stocks without adding the bundled demo", () => {
  render(
    <EpisodeSidebar
      {...props}
      showDemo={false}
      importedInstruments={[summaryFor("HK:1585", "1585", "雅迪控股")]}
    />,
  );

  expect(screen.getByText("雅迪控股")).toBeInTheDocument();
  expect(screen.queryByText("小鹏汽车")).not.toBeInTheDocument();
  expect(screen.getByText("1")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the sidebar tests and verify they fail for the missing behavior**

Run: `npm run test:unit -- app/components/review/episode-sidebar.test.tsx`

Expected: FAIL because `EpisodeSidebar` does not yet accept `showDemo`, still renders XPEV, and has no production empty state.

- [ ] **Step 3: Implement the minimal sidebar boundary**

In `EpisodeSidebar`:

```tsx
type Props = {
  // existing props...
  showDemo?: boolean;
};

export function EpisodeSidebar({ showDemo = true, ...props }: Props) {
  const stockCount = importedInstruments.length + (showDemo ? 1 : 0);
  // render the demo button only inside {showDemo && ...}
  // render the empty message when !showDemo && importedInstruments.length === 0
}
```

Keep the existing demo card markup and test defaults unchanged when `showDemo` is omitted. Add a compact `.episode-list-empty` style beside the existing episode-list styles.

- [ ] **Step 4: Run the sidebar tests and verify they pass**

Run: `npm run test:unit -- app/components/review/episode-sidebar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write the failing production workspace test**

Extend `app/components/trade-review-workspace.test.tsx` with a test that renders `TradeReviewWorkspace` using `showDemo={false}` and an empty browser store, then asserts that the XPEV card, `演示行情` badge, and demo chart heading are absent while the import empty state is present. Keep the existing demo-reachability test unmodified; it relies on the default `showDemo=true` contract.

```tsx
it("does not expose the bundled demo in production mode", async () => {
  render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);

  expect(await screen.findByText("暂无导入股票，请先导入交易记录。")).toBeInTheDocument();
  expect(screen.queryByText("小鹏汽车")).not.toBeInTheDocument();
  expect(screen.queryByText("演示行情")).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Run the workspace test and verify it fails for the missing production guard**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx`

Expected: FAIL because the workspace does not yet accept the flag and still falls back to the demo chart/search entry.

- [ ] **Step 7: Implement the minimal workspace and production-entry guard**

In `TradeReviewWorkspace`:

1. Add `showDemo = true` to `Props` and the function parameters.
2. Initialize `selectedInstrumentId` to `showDemo ? "demo" : ""`.
3. In `selectInstrument`, return immediately for `"demo"` when `showDemo` is false.
4. Build `searchableInstruments` with the demo item only when `showDemo` is true.
5. Pass `showDemo` into `EpisodeSidebar`.
6. Change the header badge to `本地导入` for an imported selection, `演示行情` only when demo is enabled, and `等待导入` for the production empty state.
7. When `!showDemo && !selectedImportedInstrument`, render a `.review-workspace-empty` section with the same import guidance, and do not render `ReviewChartWorkspace`. This prevents the hidden demo from leaking through the chart fallback.

Update `app/page.tsx` to pass `showDemo={false}`. Keep demo replay data and API imports available to the default/test path.

- [ ] **Step 8: Run the workspace test and verify it passes**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx app/components/review/episode-sidebar.test.tsx`

Expected: PASS, including the existing test that searches and replays XPEV with the default demo-enabled workspace.

- [ ] **Step 9: Run the focused regression suite**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx app/components/import/import-confirm-dialog.test.tsx app/components/review/episode-sidebar.test.tsx`

Expected: all focused component/import tests pass; imported localStorage data behavior is unchanged.

- [ ] **Step 10: Run repository verification**

Run: `npm run typecheck && npm run lint && npm test`

Expected: typecheck and lint exit 0; build and all rendered HTML tests pass. Existing Node/OpenCV/chunk-size warnings may remain, but no test or build failure is acceptable.

- [ ] **Step 11: Commit the implementation**

```bash
git add app/components/review/episode-sidebar.tsx app/components/review/episode-sidebar.test.tsx app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/page.tsx app/globals.css
git commit -m "feat: hide demo stock in production entry"
```
