# R2 Text cards / drawing toolbar report

## Scope

R2 owns the chart drawing surface and canonical capture only. The product files are frozen at this point:

- `app/components/chart/drawing-canvas.tsx`
- `app/components/chart/drawing-toolbar.tsx`
- `app/components/chart/canonical-chart-capture.ts`
- `app/components/chart/replay-chart.tsx` (capture-state provider only)
- `app/lib/chart/text-geometry.ts`

The corresponding drawing/capture/Text geometry tests are included. ReplayChart was only wired to pass the DrawingCanvas's view-only expansion snapshot into canonical capture; replay navigation/state and workspace/document/type owners were not changed.

## Implemented

- Replaced Canvas `var(--font-*)` values with Canvas-valid Geist/system fallback families. The shared `canvasTextFont` helper keeps the new Text default at 14px. The same valid family is used by capture marker labels and existing drawing labels.
- Added shared Unicode-aware Text measurement, compact/full card layouts, and bounded card geometry. CJK glyphs use an em-sized estimate with the same four-pixel painter inset, and card controls/numbering reserve their right and bottom lanes so a real 14px font does not overflow a narrow card.
- New anchored Text stores normalized card position in the existing optional `canvasX`/`canvasY` fields. Its time-price anchor remains in `anchors`; dragging the card emits a replacement with unchanged anchors and a moved card position. Legacy anchored drawings without card coordinates keep their original rendering, location, and field absence when only text is edited.
- Anchored cards receive a deterministic 12px number and a thin blue auxiliary connector to the projected time-price anchor. Card bounds clamp inside the canvas. Long positioned Text shows a two-line summary with an ephemeral live `展开`/`收起` control; expanded content is bounded to the plot with a visible ellipsis while the scrollable editor always retains and commits the raw multiline string.
- New Text uses readable `#e7edf6` body text and a dark anchored-card surface by default; the auxiliary card line/number remains blue. Existing `background`, `style.color`, `fontSize`, `textRevision`, and recall identity fields remain unchanged when editing. Free canvas Text remains free placement. The editor shell clamps to the plot and scrolls within short plots instead of covering the price axis.
- Live drawing and canonical capture use `paintDrawingScene` plus the same `textCardLayout`/`textCardGeometry` helpers. `DrawingCanvasHandle.getExpandedTextIds()` and the ReplayChart capture provider pass the ephemeral state into `CanonicalCaptureScene`; omitted captures use the compact view while raw content stays in the drawing for editable export.
- Compact E03 toolbar keeps Selection/Text and priority drawing tools visible while retaining the remaining legacy tools once in More; undo/redo/lock/clear are each rendered once and all tool buttons retain title/aria-label/aria-pressed.

## Astra R2-3 follow-up

- The expand/collapse control now uses a 12px label with a 44px square hit target. Its 44px right/bottom lane is included in shared card wrapping and height geometry, so the label does not cover the final text line.
- The editor is independent from the stored card width: the shell prefers a 220px editing surface when the plot permits, while a narrow plot clamps it to the available width. The textarea explicitly sets `min-width: 0`, `max-width: 100%`, and `box-sizing: border-box`, overriding the legacy `.drawing-text-editor` minimum without changing `app/globals.css`.
- `textEditorFrame` computes `maxHeight` from the final top position to the plot bottom; the shell scrolls vertically and the style bar scrolls horizontally when large fonts or narrow plots cannot show every control at once.
- The editor hint is also 12px, matching the auxiliary text minimum.
- New counterexamples cover the real inline button/textarea styles and assert `top + maxHeight <= plotHeight - 2`, in addition to the shared geometry tests.

## Red -> green evidence

The first targeted run was intentionally red after adding the R2 counterexamples:

```text
npx vitest run app/lib/chart/text-geometry.test.ts app/components/chart/drawing-canvas.recall-review.test.tsx
6 failed, 8 passed
```

After implementation, the owned drawing/capture suite is green:

```text
npx vitest run \
  app/components/chart/drawing-canvas.recall-review.test.tsx \
  app/components/chart/drawing-canvas.test.tsx \
  app/components/chart/drawing-toolbar.test.tsx \
  app/lib/chart/drawings.test.ts \
  app/lib/chart/drawing-geometry.test.ts \
  app/lib/chart/drawing-commands.test.ts \
  app/lib/chart/text-geometry.test.ts \
  app/components/chart/canonical-chart-capture.test.ts \
  app/components/chart/replay-chart.recall-review.test.tsx

9 test files passed, 97 tests passed

```

The Astra counterexample for new-card collapse/expand and legacy full text was red before the state predicate fix:

```text
npx vitest run app/components/chart/canonical-chart-capture.test.ts
2 failed, 7 passed
```

The follow-up red cases covered legacy coordinate absence, CJK/card bounds, plot-height truncation, editor clamping, and live-to-capture expansion-state handoff; they are included in the 97-test green run above.

Scoped lint is green:

```text
npx eslint app/components/chart/drawing-canvas.tsx \
  app/components/chart/drawing-toolbar.tsx \
  app/components/chart/canonical-chart-capture.ts \
  app/components/chart/replay-chart.tsx \
  app/lib/chart/text-geometry.ts \
  app/components/chart/drawing-canvas.recall-review.test.tsx \
  app/components/chart/drawing-canvas.test.tsx \
  app/components/chart/drawing-toolbar.test.tsx \
  app/components/chart/canonical-chart-capture.test.ts \
  app/lib/chart/text-geometry.test.ts \
  app/components/chart/replay-chart.recall-review.test.tsx
```

`npx tsc --noEmit --pretty false` exits 0 for the current shared worktree.

## R4 handoff contract

No new persisted drawing field is required. R4 document validation should continue accepting the existing optional Text fields: `placement`, normalized `canvasX`/`canvasY`, `textWidth`, `fontSize`, `background`, `recallOwnerId`, and `textRevision`, while preserving raw `text`, stable `id`, `style`, and anchors. The expansion state is view-only (`expandedTextIds` on canonical capture scene), so it must not be persisted or inferred into the Recall document. Export should read the raw `text` and stable identity/revision; a compact screenshot does not replace the original content.

## Limits

No browser/UI capture was run by this worker; root owns the real-browser visual gate. No full build or full repository test was run. ReplayChart was changed only for the explicit capture-state handoff above; replay navigation/state behavior was left untouched.
