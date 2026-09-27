# R3 layout implementation

## Scope

This pass completes the R3 workspace/sidebar/storyboard layout slice and wires
the stable R4 actual-metrics and manual-evaluation component interfaces. R1
replay state and chart files remain unchanged in this pass.

## Implemented

- Pre-entry keeps entry, direction, stop, target, and the real three-button
  size-mode group in the primary form. Capital, currency, price basis,
  as-of, and quantity-step provenance stay in the secondary disclosure.
- `PriceField` accepts a field-specific `inputMode`: prices, amounts, and
  quantity steps use decimal; editable currency and ISO as-of values use text,
  preserving incomplete strings through the existing updater.
- The plan sidebar exposes D02/E13-derived rows for notional amount plus
  position percentage, initial risk plus risk percentage, and expected reward
  plus R. Unknown values stay unknown and currency mismatches do not produce a
  percentage. Editing keeps these three rows as the only risk summary;
  read-only legacy plans retain the historical risk/R block.
- Holding and post-review use compact read-only plan/actual summaries. A
  partially open post-review episode shows realized net, floating gross, and
  the explicit `尚未平仓` reason through the shared metrics formatter.
- Post-review mounts the episode-level manual-evaluation section even when no
  exit decision exists. Its validity/error callbacks block retain/complete;
  snapshot editing reads only the frozen manual revision IDs.
- The secondary plan `<details>` uses a controlled `open` property, so
  `initialOpen` matches the actual DOM and user toggles remain authoritative.
- The replay footer shows short market/execution dates in the 48–56px bar and
  retains full market-time values in titles and accessible labels. The visible
  headline is intentionally short (`逐步 · 决策 N`) while the selected fill
  detail remains in its title. The labels distinguish `行情时间` from
  `成交截止`.
- The plan-derived `<dl>` overrides the legacy two-column sidebar grid so each
  D02 row stays on one line. Phase-secondary details remount by phase, making
  `initialOpen` deterministic when moving holding → post-review.
- The 1280px header keeps the 18px title, normal button hit targets, and
  non-wrapping export/toolbar labels. Storyboard selects/source controls use
  semantic surface colors, 14px text, 44px touch targets at narrow widths,
  three readable desktop columns, and no fixed 96px comparison viewport.

## Evidence

- `npx vitest run app/components/recall/recall-storyboard.test.tsx app/components/recall/recall-plan-revisions.test.tsx app/components/recall/recall-exit-evaluations.test.tsx app/components/recall/recall-plan-sidebar.test.tsx app/components/recall/recall-workspace.test.tsx app/components/recall/recall-actual-metrics.test.tsx app/components/recall/recall-manual-evaluations.test.tsx --reporter=dot`
  - 7 files, 75 tests passed.
  - Covers real size-mode buttons, field input modes, derived metrics, compact
    post-review partial-close metrics, no-exit manual tags, controlled details,
    real segmented exit controls, storyboard source/selection, retained
    snapshot paths, and cutoff labels.
- `npx eslint app/components/recall/recall-workspace.tsx app/components/recall/recall-workspace.test.tsx app/components/recall/recall-plan-sidebar.tsx app/components/recall/recall-plan-sidebar.test.tsx app/components/recall/recall-storyboard.tsx app/components/recall/recall-storyboard.test.tsx`
  - Passed.
- `npx tsc --noEmit`
  - The R3 files typecheck; the shared run is currently blocked by an unrelated
    duplicate `version` property in concurrently edited
    `app/components/chart/drawing-canvas.tsx:1243`.
- `git diff --check`
  - Passed.

## Pending acceptance

Root/Astra still owns fresh real-browser comparison at 1440, 1280, and 390
viewports, including header wrapping, sidebar/container breakpoints, mobile
keyboard behavior, and chart geometry. This report records code and scoped
test evidence; it does not claim those visual checks.
