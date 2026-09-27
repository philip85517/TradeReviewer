# R5 Astra independent final acceptance — in progress

2026-09-26. Reviewer: Astra (bounded independent review). Product and database read-only; no browser actions and no delegated agents. This report does not replace the coordinator's actual browser journey. Final completion owner and responsive owner are still working; no feature acceptance is signed.

## Evidence read independently

- Current AGENTS.md, development-workflow.md, task-decomposition.md.
- Approved `docs/specs/2026-09-25-chart-first-review-ui.md` and `...-ui-elements.md` (E01–E22).
- Actual reference images opened: 02-chart-workspace, 05-final-review, 06-export-storyboard, 07-interaction-states.
- Prior R5-astra-completion, R5-astra-visual, R5-data-audit, current SESSION-NOTES and R5-JOURNEY. Historical acceptance remains scoped and is not silently promoted.

## Completion review, pending freeze

The current candidate repairs the old decision-only branch by rebuilding full replay for any global graph and explicitly marking the global snapshot `post-review`/`hasSeenFuture`. Manual revision retention consequently reaches the correct post-review branch in retained-bundles.ts. Different timeframes discard the incompatible viewport and call fitAll; actual last bar/trade visibility still requires the coordinator's real chart evidence.

New counterexample sent to the completion owner and coordinator: `restoreWorkingFromDocument` prioritizes `working.phaseContexts[working.phase]` over working's global cursor/selection. Merely updating snapshot phase and global working cursor leaves an old holding/post decision context able to replace the newly saved global context on reopen. The owner must define and test the final working phase/context, including direct-global completion.

The two-capture transition also needs a bounded pending-flush mutation check. Each individual capture guards generation and drawing identity, but that alone does not cover edits between the decision capture and final global capture. This is a source-level concern, not a claimed reproduced browser failure.

## Already checked in current source

- Text editor hint is 12px (the old 9px failure has been removed).
- E13 expected R includes an explicit `R · ratio:1` explanation.
- Holding secondary details no longer request default-open, preserving the revision entry while avoiding duplicated primary metrics by default.
- These are source checks; matching final screenshots remain required.

## Read-only data integrity

Fresh SQLite URI `mode=ro` audit: `quick_check=ok`, 24 execution rows SHA256 `e6fb7f410f9692fb3ce9e7bd05ec3456af61ba4e52bdb31563f779d01764cf55`. Excluding the three fresh delivery fixture IDs leaves the original 21 rows SHA256 `24a9793c206dbea76d03211a18d387ea89f6acfc999b5845857f9abdae64384d`. Both match R5-fresh-fixture.json. No write was performed.

## Outstanding

- Frozen completion source/tests; current formal bundle/working state and reopened result.
- New matching 1440/1280/390/navigation-open screenshots and measured dimensions after responsive fix.
- Actual PPTX render and native editable structured table evidence.
- True phone software keyboard price/exit-reason inputs remain **unverified**, with no approved waiver.

Overall status: **not accepted**. Pending requirements are not inferred passing from worker reports, test counts, or old screenshots.

## Independent image review — boundary scenarios

Actually opened `R5-unknown-fees-1440.png`, `R5-partial-open-1440.png`, and `R5-no-exit-manual-1440.png`.

- Unknown fees: final net/R render “费用待补齐”, not zero; initial frozen risk 4000 remains distinct. **Pass for this visible unknown-value state.**
- Partial open: remaining 400, realized net 4776 and unrealized 3288 are distinct; final episode net/R both “尚未平仓”. **Pass for this visible open-result state.**
- No exit: “暂无可确认的退出决策” coexists with episode manual tags and evidence entry; original plan is explicitly unrecorded. **Pass for visible availability and source labeling.**

These images predate the pending responsive freeze; no responsive completion is inferred. They do not themselves prove save/reopen or native export behavior.

## New reproduced E08 failure — right-bottom editor

Coordinator supplied an actual 3049 UI case (20:44 build): pre-entry, sidebar closed, click Text at (1310,745), 32px font, desired card width 36, three Chinese lines. Independently opened `R5-text-edge-editor-1440.png` and checked drawing-canvas/replay-chart source.

**Fail:** editor right edge 1423 is inside the full canvas but beyond the candle pane's right edge 1341, covering the 84px price axis. `textEditorFrame` clamps against `size.width`, while DrawingCanvas covers the chart including its price axis. Its comment claiming price-axis avoidance is not implemented by these bounds. This invalidates the earlier source-only R2-3a conclusion as a sufficient acceptance of plot containment; original evidence remains preserved.

Also the 32px textarea with rows=3 outgrows the fixed 54px minimum used to reserve shell height. The shell's shared vertical scroll moves the style bar outside the visible shell while editing near the bottom. A bounded editor should reserve usable controls and hint, scroll the text region, and move upward as needed.

Suggested owner boundary: introduce actual live pane bounds for editor clamping only, without changing the full drawing canvas or existing normalized drawing coordinates. Respect real measured price-axis width and time-axis/pane height; avoid a hard-coded 84px assumption. Keep desired card width and anchor semantics unchanged. Verify right-bottom 32px/36px/long Chinese with sidebar open/closed and narrow viewport in the real chart.

## Manual price window / actual retained PNG

Read-only extracted revision 23 of 999992's partial-exit snapshot `recall-snapshot-1790428284542-44e0ru` to `R5-stored-manual-window.png`. Opened that actual stored PNG and `R5-manual-price-after.png`.

- **Pass scoped:** manual price scale (`autoScale=false`) still shows target 64 sell in live and retained chart. Holding context cutoff is 2026-08-14 16:00Z / partial execution; actual projection includes entry+partial only, remaining 400, gross realized 4800, floating gross 2400. Unknown-fee net values remain null. No final 8/20 execution leaks. Last retained candle is 8/13, with 8/14 actual execution shown on whitespace as intended.
- **Fail, actual export/capture:** live rightmost sell label is placed to the left of its diamond; retained PNG label remains to the right and enters the price axis. Source confirms `canonical-chart-capture.ts` invokes `drawExecutionMarkers` without `maxX` although the shared painter uses that field for right-edge avoidance. The renderer supports the behavior; the capture consumer omitted the boundary. This is an independently observed artifact defect, not a hypothetical visual concern. Coordinate fix must use the capture chart's actual pane width in media coordinates (account for pixelRatio).
- Rechecked execution integrity after extraction: all 24 and preserved old 21 hashes unchanged; quick_check ok.

## Low-price actual screenshot

Opened `R5-low-price-after.png`: the 30 CNY opening diamond is visible below the known 50–56 candles, and the price window expands approximately 24–58. This closes the narrow question of low-price marker visibility in the live chart. It does **not** close E07 readability: the rightmost “买入” text runs into the yellow cost-30 label extending leftward from the price axis, visibly cutting into the right character. Sent to the chart owner/root for minimal shared label avoidance; the actual marker's time/price must remain unchanged.

A new isolated low-price fixture raises the baseline to 25; root supplied R5-low-price-fixture.json. The previous 24/21 audits remain historical, not rewritten. A later final audit should exclude the new low-price prefix to verify the 24 baseline and then exclude the delivery prefix to verify the original 21.

## E22 expanded records access

Opened `R5-storyboard-1440.png`. Three representative selectors are visible, but expanded storyboard content is cut by the bottom of the 900px viewport. Coordinator measured the all-records entry at y1071, More body overflow visible, enclosing layout overflow clip; therefore the full records entry is not reachable in this state. **Fail E22**, even though representative selection itself was reported to preserve phase/cursors. Owner is assigned by root; requires actual scroll/access verification after correction. The reduced 220px chart also puts rightmost Text cards over price labels, so recheck the chart/annotation boundary in the repaired expanded state.

## Retained A vs unretained B — database pass

Independent SQLite read of 999996 revision 23 confirms `R5-retained-A-working-B.json`: post snapshot `recall-snapshot-1790426381010-uh29nu` and bundle `bundle-9d44182b-8166-4cce-b88b-b0061f4c9892` retain Text A at textRevision 1 and manual `position` tag. Its PNG is byte-for-byte identical to the earlier audit file `R5-stored-999996-post.png` (SHA256 `c88250d6073efa5e1fcd283455d3c9bab27030b4a9e250a73d65821da7b54a3f`). Working editingContext independently holds Text B at textRevision 2; manual draft is `analysis`. The three storyboard references point to the expected 20:24 pre, 20:34 holding partial, and 20:39 post-A snapshots. **Pass for immutable retained image/Text/manual data and selected reference persistence.** Actual exported A artifact still requires inspection.

## Completion freeze independent recheck (21:29)

Read `R5-completion-fix.md`, actual frozen workspace/sidebar/CSS and tests. Independently ran the two scoped files: **2 files / 61 tests passed**, 31.06s, log `R5-astra-completion-tests.txt`.

Source + scoped tests now establish full global replay on both decision-origin and direct-global completion, post-review phase/manual revision retention, distinct decision/global Text ownership, saved global post-review context, and remount restoring global selection/last execution. The captured viewport is persisted from captureResult rather than the discarded pre-flush context. Those original source defects are addressed; real chart completion/reopen still awaits the new build.

Two precise residual items sent to owner/root:

1. **Viewport containment defect:** `keepsLatestCandleVisible` only tests `logicalRange.to >= lastIndex`. A viewport fully to the right (`from > lastIndex`) also passes, preserving an all-whitespace final image. Include the lower containment bound and a regression. Newest execution may sit on whitespace beyond the last candle; real chart verification must also check its visibility.
2. **Pending flush evidence gap:** the new generation check occurs after the context-switch flush and before final capture, which is the correct boundary in source. However the 61-test suite's flush mock always resolves immediately, so it does not exercise a user edit in that interval. Existing first-capture pending/initial-plan test proves a different interval. Add a controlled pending-flush mutation case that rejects formal save while retaining the edit.

More CSS now gives the details/body `min-height:0`, flex layout and vertical overflow; the parent replay bar has no explicit height/max-height and the body uses percentage max-height. The browser must establish the resulting definite available height; source alone cannot prove records beyond y1071 became reachable. Test actual scrolling to both all-records and representative entries with chart >=220, including 390 footer last actions. Overall acceptance remains open.

## Chart pane-boundary freeze source review

Read `R5-text-editor-fix.md` and source/new tests, without rerunning the reported 91 tests as requested. Independent source checks:

- Actual `timeScale().width()` and first pane height are passed to DrawingCanvas, while full canvas dimensions and normalized coordinate denominators remain intact.
- New-position Text card layout, painter and 44px toggle geometry use bounded pane dimensions; legacy cards keep their previous geometry. The actual capture painter receives corresponding pane bounds.
- Capture's right-edge marker consumer now passes maxX; capture converts chart/pane measurements to media coordinates by dividing by coordinateScale (DPR). The new renderCanonicalChartCapture test checks the actual consumer rather than only the standalone painter.
- Cost-label avoidance is shared by live/capture via a half-price-axis-width reserve. This addresses the observed short cost label geometrically; it is a reserve rule rather than measured per-label collision, so the new actual image remains required.

**New source regression sent back to owner/root:** editor shell now sets `height = maxHeight`, but frame maxHeight is all remaining space from top to pane bottom. At a normal upper/middle click this forces a several-hundred-pixel editor, unnecessarily covering the chart. Keep fixed controls/textarea scrolling, but cap actual target height separately from available maximum and test ordinary upper/middle clicks as well as the right-bottom case. No visual acceptance signed for this freeze.

Completion follow-up source now includes both from/to containment for latest candle. The new controlled pending-flush test truly pauses between captures, edits Text, expects no finalized save while preserving the draft, and retries successfully. This closes the previously identified test-coverage omission in source; prior 61-test run remains its original version, not falsely relabeled as covering the newly added test.

### Editor height follow-up

Owner corrected actual height to `min(preferredHeight, maxHeight)`, removing the deterministic grow-to-pane-bottom regression. Fixed preferredHeight currently equals 116px. It does not adapt to actual style-bar height, wrapped hint, or font line height; the textarea sets fontSize but no explicit lineHeight. This is now a **DOM verification requirement**, not an asserted browser failure: measure 32px textarea usable content height against one complete line, along with style/hint heights, in the new build. Root explicitly chose actual measurement before any further change; source review does not override that decision.
