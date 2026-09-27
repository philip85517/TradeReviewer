# R10 plan-price action layout

## Diagnosis

The overlap in `R9-preview-ready.png` came from the auxiliary `显示计划价格` button being positioned inside `.chart-stage` at `right: 76px; top: 36px`. That is the same right-axis area where lightweight-charts renders the gold plan-price axis label, so the button covered the `计划入场` label. The existing `适应全部` action is positioned by the recall shell at `left: 52px; bottom: 8px`; the drawing toolbar occupies the shell's separate 48px left column.

## Fix

The action remains attached to the existing `fitPlanPrices` handler and keeps its label/behavior. Its fixed chart-stage position is now `left: 76px; bottom: 48px; z-index: 8`, placing it beside/above the existing lower-left fit action, clear of the right price-axis labels, the 48px drawing toolbar, and the chart's bottom time-axis band. It does not add a row, change chart height, or alter the plan/side-panel layout.

The new `recall-plan-price-action` class reuses the recall navy surface, border, muted text, hover treatment, and a 36px minimum desktop hit target. The existing `.recall-workspace button` responsive rule keeps the action at 44px on narrow layouts, and the shared `@media (pointer: coarse)` rule keeps it at 44px for touch pointers even when the viewport is wider than 700px.

## Verification

```text
npx vitest run app/components/chart/replay-chart.test.tsx app/components/chart/replay-chart.recall-review.test.tsx --maxWorkers=1 --reporter=dot

Test Files 2 passed (2)
Tests 43 passed (43)
```

The existing plan-price behavior test now also asserts the action class and fixed `left: 76px` / `bottom: 48px` placement before clicking it; the test still verifies that clicking fits plan prices without changing the logical time range. `git diff --check` passes for the scoped chart, test, and recall CSS files.

Build, browser, and database checks were left to the coordinator. The coordinator should verify the 1280px and 390px real layouts against the supplied screenshot path:
`.scratch/chart-first-review-implementation/repair/reports/R9-preview-ready.png`.
