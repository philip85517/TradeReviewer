# Task 7 report — editable drawing overlay and layers

## Scope

- Expanded the drawing toolbar to expose all ten specified drawing tools with pressed state.
- Added additive/optional controlled canvas props (`episodeId`, selection, command callback, planned risk) while retaining the existing `onAddDrawing` fallback.
- Added canvas creation, cursor clamping, text editing, selection, locked-drawing protection, local drag previews, and one `replace` command per completed drag.
- Added the layer manager with rename, visibility, lock, ordering, deletion, boundary states, and focusable controls.
- Passed the optional controlled drawing props through `ReplayChart` without changing existing consumers.

## RED evidence

Command:

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-layers-panel.test.tsx
```

Observed failures before implementation: the layer-panel module did not exist; the toolbar lacked `垂直线`; the canvas lacked a semantic image role and ignored the new `onCommand` contract. The new interaction tests therefore failed for the intended missing behavior.

## GREEN and verification evidence

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-layers-panel.test.tsx app/components/chart/chart-toolbar.test.tsx
# 3 files passed, 8 tests passed

npm run test:unit
# 46 files passed, 209 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0, no warnings

git diff --check
# exit 0
```

## Files

- `app/components/chart/drawing-toolbar.tsx`
- `app/components/chart/drawing-canvas.tsx`
- `app/components/chart/drawing-canvas.test.tsx`
- `app/components/chart/drawing-layers-panel.tsx`
- `app/components/chart/drawing-layers-panel.test.tsx`
- `app/components/chart/replay-chart.tsx`
- `app/globals.css`

## Concerns

The Task 7 controlled command props are intentionally additive, so the current workspace remains on the legacy add-only callback until Task 10 adopts `DrawingHistory` commands. The new layer panel is delivered as a reusable controlled component; top-level panel visibility/state wiring is deferred to the planned consumer migration.
