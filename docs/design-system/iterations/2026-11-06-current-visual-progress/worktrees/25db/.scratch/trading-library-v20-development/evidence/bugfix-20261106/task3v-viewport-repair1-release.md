# 3V06 — initial chart viewport repair1: RELEASED

Root owns integrated acceptance; journey_ui sole implementation owner. Exact writable product paths: `app/components/chart/replay-chart.tsx` and its existing `replay-chart.test.tsx`. No page/controller/Canvas/backend/client/CSS/DDL changes, no HTTP/DB/browser/STOPPED/fullsuite by implementer. Raw before/current SHA, focused public red/green, complete diff, raw-after manifest and targeted/type/lint logs go to `task3v-viewport-repair1/`.

## Contract and diagnosed cause

Refs: docs/specs/2026-09-25-chart-first-review-ui-elements.md E04/E08/E19; docs/specs/2026-09-25-chart-first-review-ui.md §main chart/viewport, exact docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png and 04-holding-stage.png. Read actual source/reference before editing. Scope: desktop daily 1440x900 / 1280x800 DPR1/100%, nav collapsed72; touch/narrow/hourly excluded by user.

Actual first A: 49 unique known daily OHLC, no facts/whitespace, yet last4 at far left and blank right; subsequent remount lays out all49. Root actual same pinned SDK blank-page experiment (`task3v-sdk-empty-fit-probe-result.json`) verifies fit[-3,51] on empty then setData49 yields actual [45,99]; setData then fit yields [-3,51]. App ResizeObserver currently uses unapplied candlesRef length and marks initial fitting complete before the series receives data. Preserve this actual result and the original screenshots; do not claim the app internal frame order was directly recorded.

## Minimum change and user journey

Initial sizing may size the chart, but must not apply/count an initial candle fit as complete while chart-owned applied data is empty. First genuine nonempty applied data must get the intended initial fit once at usable dimensions. Delayed usable-size recovery must still fit; respect supplied focusRange / viewport identity and pending explicit navigation priority. Do not blanket fit on resize, array refresh, text edit, append or stage transition, and never expose future OHLC or use future extremes to scale. No new viewport persistence V claim.

Write one public reproduction of ResizeObserver-before-first-setData (expected known bars visible, no empty-axis range applied) and a distinct delayed-size counterpart only if current tests lack it. Reuse existing same-key refresh/resize/user pan/reveal regressions; no CSS/method-name mirror test. Default timeouts, no removed assertions. Author unit mocks are not actual SDK acceptance. Root will freeze exact2SHA and review all diff; non-author tests plus actual app initial mount at both desktops, real B/C/D reveal/400ms, return/reload and state safety are separate gates. No author browser. If two paths cannot fix, return rootcause evidence before expanding.

Original 3V01/02 first FAIL, 1440/1280 nativeblur harness FAIL retained; this is new visible root cause, attempt1, consecutive no-progress0. Five consecutive no-progress attempts record and move, never use new seed or renamed test to evade.
