# Strategy visual acceptance — first implementation slice

Date: 2026-10-11
Status: implementation-ready (independent acceptance pending)
Owner: coordinator (inline implementation)
Branch: `codex/strategy-visual-implementation-20261011`

## Goal

Turn the approved 0.7 strategy/review visual contract into one reviewable,
real-chart slice before changing the global visual surface. The slice must
prove the state contract and the visual contract together:

`S0 遮住未来 → 下一根/下一决策 → 主图出现新增 K 线/成交 → Text 批注 → 回看早期 → 保存 → 重开恢复`

The existing opt-in `designPrototype` seam remains the integration boundary.
The homepage/workbench visual theme is not copied into the review workspace,
and the public token migration is deferred until this slice has evidence.

## Approved references and constraints

- `.scratch/strategy-visual-acceptance-plan-20261011/visual-contract.md`
- `.scratch/strategy-visual-acceptance-plan-20261011/acceptance-standard.md`
- `.scratch/strategy-visual-acceptance-plan-20261011/DESIGN-COVERAGE.md`
- `docs/designs/2026-10-08-strategy-visual-system/README.md`
- `docs/specs/2026-09-25-chart-first-review-ui.md`
- `docs/specs/2026-09-25-chart-first-review-ui-elements.md`
- `docs/agents/development-workflow.md`
- `docs/agents/task-decomposition.md`

The implementation keeps S0/S1/S2 as one workspace, keeps market and execution
cutoffs separate, preserves original text and drawing anchors, labels
retrospective additions as `复盘补记`, keeps configured P/L colours, and never
uses future chart data to size an earlier viewport. A narrow desktop viewport
may document horizontal scroll; it is not silently treated as a mobile layout.

## Scope and non-goals

In scope:

1. Make the replay state transition observable and testable at the real chart
   boundary, including a newly visible bar/trade and a rewind that removes
   later facts.
2. Keep text editing/focus from triggering replay shortcuts and preserve the
   text source/stage after save and reload in the prototype repository.
3. Promote only the scoped visual rules needed by this journey: typography
   roles, focus ring, compact/comfortable control heights, chart-first spacing,
   cutoff labels, long Chinese wrapping, and the approved narrow-window flow.
4. Produce browser evidence for the recommendation route at 1440×900,
   1280×800, and approximately 390px, including selected and keyboard-focus
   states.

Out of scope for this slice:

- replacing the component library or front-end framework;
- migrating every business page to the 0.7 token set;
- adding new financial calculations, importing data, exporting reviews, or
  changing persisted production trade records;
- calling the remote integration workflow or pushing a branch.

## State contract to implement and verify

| Start | Action | Market cutoff | Execution cutoff | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| S0 / replay | Next bar | next complete candle knowledge time | fills mapped to that bar and no later fill | new candle is visible in the real chart; future OHLCV and fills remain hidden | replay state test + browser screenshot |
| S0 or S1 / replay | Next decision | target decision knowledge time | target execution id, preserving same-bar order | target trade marker and candle appear in the chart; previous decisions remain visible | replay state test + browser screenshot |
| Any replay state | Text focus/edit | unchanged | unchanged | shortcut/playback does not advance; text and stage source are retained | DOM interaction test + browser evidence |
| Later replay state | Return to early state | early saved cutoff | early saved execution boundary | later facts disappear from chart/list/summary; “已看后续” source remains | replay/persistence test + screenshot |
| Early state with draft | Save/reopen | saved values | saved values | plan, drawing text, stage and cutoffs restore together | repository test + browser reload |

## Implementation order (TDD)

### 1. Freeze the implementation baseline — complete

Files: `.scratch/strategy-visual-acceptance-plan-20261011/evidence/`,
`.scratch/strategy-visual-acceptance-plan-20261011/DESIGN-COVERAGE.md`,
`.scratch/strategy-visual-acceptance-plan-20261011/issues/01-*`.

Record the current commit, running command, route, viewport, and screenshots
before changing code. Confirm the real chart route is the recommended recall
route and that the fixture is not a mock-only canvas. Do not count DOM arrays
or a 200 response as chart playback evidence.

### 2. Lock replay behavior with a failing test first — complete

Files: `app/lib/replay/recall-replay.test.ts` and, if necessary,
`app/lib/replay/recall-replay.ts`.

Add observable regression tests for the history boundary journey: advancing to
a saved replay state, opening full history, attempting a decision navigation,
returning to replay, and restoring global context; then switch timeframe while
history is open and keep all executions and post-trade candles. The focused
red run reproduced the lost candle before the smallest production fix. Preserve
same-bar execution ordering and the `NO_REVEALED_EXECUTIONS` boundary.

### 3. Lock source/stage persistence and focus safety — existing contract retained

Files: `app/components/design-prototype/recall-design-prototype.test.ts`,
`app/components/recall/recall-workspace.test.tsx`,
`app/components/recall/recall-workspace.tsx`, and only the adapter/data file
needed by a failing test.

The existing prototype and workspace tests cover the multiline Chinese Text
annotation with `原判断`/`当前补充` and `复盘补记`, and that an input or textarea
focus prevents replay keyboard shortcuts while the edit is active. The
reloaded projection must expose no future executions or counts. This slice did
not change the adapter or focus guard; it keeps those contracts intact and does
not turn local prototype storage into a claim of SQL persistence.

### 4. Apply the scoped visual contract — complete for this slice

Files: `app/components/design-prototype/recall-design-prototype.css`,
`app/components/recall/recall.css`, and, only for shared variables already used
by the route, `app/globals.css`.

Use the existing theme and component selectors. Set measured roles rather than
arbitrary per-control values: body 14/22, metadata 12/18, controls 13/20,
desktop control min-height 36, narrow ordinary control min-height 44, Lucide
18px at 1.75 stroke, focus ring 2px with 2px offset, spacing 4/8/12/16/24,
panel radius 8, control radius 6. Keep the P/L semantic colour configuration.
Ensure the stage/cutoff strip remains adjacent to the chart, long Chinese text
wraps without clipping, and the narrow route uses document flow rather than a
body overflow lock. The final fix scopes `body:has(.recall-design-prototype)`
to `overflow-y:auto; overflow-x:hidden`, so the native workspace keeps its
existing scroll ownership. Do not make all controls 44px on desktop or reduce
fixed comment content to fit.

### 5. Verify the browser journey and visual states — partial, evidence recorded

Run the local service on the project port for read-only preview. If a browser
step writes, use an isolated SQLite backup and explicit `TRADEREVIEW_DB_PATH`.
At each viewport, capture: S0 cutoff, after next bar/decision with the new
chart bar/marker visible, selected Text, keyboard focus, early rewind, and
reopen. The current browser pass covers the S1 newly revealed candle/marker,
selected phase, keyboard focus and the 1440/1280/390 layout/scroll states;
Text, early rewind, SQL save/reopen, touch and soft keyboard remain explicitly
`NOT VERIFIED`. Evidence is in
`.scratch/strategy-visual-implementation-20261011/evidence/`.

### 6. Run the repository checks and self-review — complete for this slice

Commands, in order:

```bash
npm run test -- --run app/lib/replay/recall-replay.test.ts app/components/design-prototype/recall-design-prototype.test.ts
npm run typecheck
npm run lint
npm run build
npm test
git diff --check
```

Inspect the diff for accidental data or broad style changes. The local task
tracker and implementation coverage record the targeted lint pass and the
repo-wide lint failure caused by existing `.scratch`/vendor files. The full
`npm test` command passed; real-browser, touch-keyboard, SQL save/reopen, and
export-font checks remain `unverified` because they were not run in this slice.

## Acceptance gates

- Functional: the real chart journey visibly reveals/removes the intended bar
  and trade, and save/reopen restores the exact draft and stage source.
- State safety: market and execution cutoffs stay independent; future facts do
  not leak through markers, lists, summaries, tooltip, or zoom range.
- Visual: the same route is compared at the approved desktop and narrow
  viewports; focus, selected, disabled, long Chinese, and chart-first spacing
  are directly reviewed.

Any required gate without evidence remains `unverified` and blocks a completion
claim. This plan does not authorize a push, merge, or remote publication.

## Current evidence

- [Implementation coverage](../../../.scratch/strategy-visual-implementation-20261011/DESIGN-COVERAGE.md)
- [Browser matrix](../../../.scratch/strategy-visual-implementation-20261011/evidence/2026-10-11-browser-matrix.md)
- [Verification log](../../../.scratch/strategy-visual-implementation-20261011/evidence/2026-10-11-verification.md)
