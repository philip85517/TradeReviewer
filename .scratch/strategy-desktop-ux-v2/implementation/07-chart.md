# 07 Comparison chart

Owner: `/root/comparison_runtime_resume` · implementation model: `gpt-6-luna / max`.
Scope: new `comparison-chart.tsx`, `comparison-chart.css`, and this report. Runtime files remain frozen; surrounding comparison page integration belongs to `/root/comparison_ui_resume`.

Chart files are **FROZEN** for root browser acceptance as of 2026-09-30 after the SVG height/readout and endpoint-label spacing adjustments and scoped lint pass.

## Delivery

- Added the frozen `ComparisonChart` API and mode/series types from `INTEGRATION-07.md`. The chart consumes only `ResultAnalysis` points and the caller's displayed series; it owns no cursor, filter, or runtime state.
- Net value and drawdown draw the actual same-date points on a shared date scale, with a 1.0000 net-value reference or zero drawdown reference. The endpoint readouts use the final point provided by each analysis.
- Allocation uses a stacked area history from the selected analysis's actual `cashWeight` and `symbolWeights`, with a named cash/symbol key and the selected portfolio name. It renders one selected series only.
- Axis labels, grid guides and readouts share one measured SVG coordinate system; 12px labels map 1 CSS pixel to 1 viewBox unit after measuring the SVG. The SVG drawing itself is `clamp(320px, 40vh, 360px)` high; the surrounding frame grows to its height plus border, so readouts do not reduce the plot area or add a separate layout row.
- X07-08: the supplied `final-six-dd-1440.png` showed two `0.00%` drawdown endpoints overlapping at the top boundary. The previous final per-label top clamp could undo the 17px forward spacing (for all-zero endpoints, y=19 and y=36 were independently clamped to y=27 and y=36). End labels are now clamped to the allowed baseline band first, spaced forward at 17px, and shifted together if either boundary is exceeded; there is no later per-label clamp that can collapse the gap. At the approved 320/360px SVG heights, the drawdown baseline band accommodates four labels with room to spare. Root must still directly verify the final all-zero/six-series and near-bottom cases in the browser.
- The start label comes from `ResultAnalysis.startDate` / its actual first point, not the calendar's T0 cursor. A T0-only analysis shows a no-period message and no fabricated line or area. No benchmark or future ledger is introduced.

## Verification and remaining gates

- Read DD02, DD09, DD12 and DD13, the second-stage contract in `INTEGRATION-07.md`, and the C25–27 chart rows in `DESIGN-COVERAGE.md`.
- Directly inspected `screenshots/07/representative-fixed-1280.png` and `screenshots/reference/tradereview-1280.png` before implementation. The approved comparison context is dark TradeReview styling, full date axis, a 320px plot at the 1280×800 viewport, and no compression of the main plot into a narrow strip.
- `npx eslint app/components/strategy-prototype/comparison-chart.tsx` — PASS after X07-08 (exit 0). `git diff --check` — PASS for tracked changes; the chart module is currently untracked in the task worktree, so its file-specific formatting is covered by ESLint rather than that Git check.
- An earlier `npm run typecheck` passed after adding the chart, before comparison-page integration. A later check during call-site changes failed in the then-in-progress `comparison-prototype.tsx`; this owner has not rerun the repository-wide typecheck after integration. Root owns that final check.
- `comparison-prototype.tsx` now integrates the chart. The supplied `final-six-dd-1440.png` was inspected directly for X07-08 before the label-spacing correction; no browser capture after that correction, numeric browser check, or independent final visual PASS is claimed. Root and Astra retain those gates. No tests, browser, database, API, or new dependency actions were run.
