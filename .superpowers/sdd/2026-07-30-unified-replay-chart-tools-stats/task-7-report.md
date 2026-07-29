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

## Commit

`3f9572622e13bff1117a1649dd5214f9d1580820` (`feat: make chart drawings editable`)

## Review remediation — round 1

Implementation commit: `cba8a218313bca603e0d7cb7e664363d738ea509`

- Corrected the overlay interaction state so every non-cursor creation tool
  receives its initial pointer event while cursor mode remains available to
  the underlying chart.
- Whole-drawing drags now translate every anchor through the coordinate
  adapter in both time and price. Positive time movement is limited by the
  latest anchor's distance to the replay cursor, preserving relative geometry
  instead of independently flattening anchors at the boundary.
- Long and short risk/reward geometry is canonicalized before every add or
  replace command. Reversed creation drags are reflected into the selected
  direction with a 2R target, while crossed stop and target handles retain
  their independent distance on the valid side of entry.

### Remediation RED evidence

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx
# 8 failed, 5 passed
```

The failures directly reproduced the inverted drawing-mode class, unchanged
anchor times during whole-drawing movement, reversed stop placement, and
crossed stop/target handles.

### Remediation verification

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-layers-panel.test.tsx app/components/chart/chart-toolbar.test.tsx
# 3 files passed, 16 tests passed

npm run test:unit
# 46 files passed, 217 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0, no warnings

git diff --check
# exit 0
```

## Review remediation — round 2

Implementation commit: `7d287b891692e432d044ed22fbe54bee87fdf284`

- Kept the bitmap drawing overlay pointer-transparent in cursor mode so the
  lightweight chart continues to receive pan, scale, and crosshair gestures.
- Added cursor-only native capture listeners on the containing `.chart-stage`
  and routed their coordinates through the same selection, text-edit, handle,
  and whole-drawing gesture functions used by the targetable creation canvas.
- Capture listeners neither prevent default nor stop propagation, and they
  ignore events originating from the inline text editor.
- Made the inline text editor explicitly pointer-targetable even though its
  overlay parent is transparent.

### Round 2 RED evidence

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx
# 7 failed, 7 passed
```

The failures showed that stage-targeted cursor events did not select drawings,
open text editing, or produce whole/handle replacement commands. The
creation-mode canvas tests remained green.

### Round 2 verification

```sh
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-layers-panel.test.tsx app/components/chart/chart-toolbar.test.tsx
# 3 files passed, 17 tests passed

npm run test:unit
# 46 files passed, 218 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0, no warnings

git diff --check
# exit 0
```
