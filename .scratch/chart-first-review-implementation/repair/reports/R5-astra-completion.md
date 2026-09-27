# R5 Astra completion bounded independent review

2026-09-26. Product/source/data read-only; only this report written. No browser, database writes, product edits, or tests. Read AGENTS.md, R5-astra-visual.md, approved spec completion/stage rules, R5-data-audit.md, completion/capture/context/retention source. Opened actual `R5-complete-global-cutoff-fail-1440.png`. This is a review of the first revealRecallHistory patch, not acceptance of subsequent edits.

**Result: NOT CLOSED.** The first patch fixes only the decision + post-review cursor branch; phase retention and alternate completion/viewport paths remain open.

## Root cause and evidence

Completion intentionally commits decision Text in its original context, discards that image, then restores the separately owned global graph. The global graph can still have the pre-entry cursor/viewport. The old code captured this stale graph and cleared phase for decision-origin completion. The screenshot independently shows post-review and completed while footer says 08-10 01:59 / execution not revealed and actual-result cards unknown. C's readonly revision-19 audit establishes the same cutoff in the persisted global image/bundle and no manual revision IDs. These are two separate faults: stale capture boundary and dropped phase-dependent retention semantics.

## Findings

1. **P1: phase still cleared.** `recall-workspace.tsx:2395` sets `completionFromDecision ? undefined : phase`. `retained-bundles.ts:116-125` explicitly supplies `sourceRevisionIds: []` unless snapshot.phase is post-review. Therefore revealing all candles alone cannot retain manual evaluations or identify this image as a post-review representative. Preserve the actual post-review capture semantics, and assert bundle manual revision IDs as well as snapshot phase in the new regression test.
2. **P1: direct global path bypasses repair.** The new reveal is nested inside `completionFromDecision && globalGraph`. `selectDecision(global)` from post-review changes phase to holding (1506-1510) and restores the old global cursor (1532 onwards). Completing directly there still captures the early boundary; all decision snapshots/closed episode satisfy existing completion guards. The source path is definite; this review did not execute it in browser. Define a consistent completion boundary for both entry paths or explicitly prevent invalid completion; merely checking post-review inside the decision branch does not cover it.
3. **P1 pending real-chart verification: cross-timeframe viewport.** On same timeframe the patch copies current viewport. On different timeframe it retains the old global viewport and explicitly restores it after switching chart (2350). A full replay cutoff may therefore produce an image of the early window. Root must verify a different-period global context in the actual chart. A valid fix needs a deliberate period/viewport contract, not just all candles in state. Also verify direct global post completion's working metadata, since this branch uses live replay for snapshot while the base working cursor may originate from older saved context.

## Ownership and freezing assessment

The separate initial decision capture and global drawingHistory switch preserve graph ownership in principle: decision drawings are saved to that decision draft, while global snapshot receives global drawings. Do not copy/rename the entire decision graph into global merely to obtain a full cursor. The screenshot should match the global drawing list; missing stage-local Text on global is not itself an ownership defect, because the post decision snapshot remains independently retained.

The shared `capture()` commits Text before taking generation/drawing refs and rejects changes during capture. Completion reserves the save queue, builds an immutable bundle from the actual capture, uses revision CAS/finalize, and reconciles newer drafts. No new freeze regression is demonstrated by the small cursor patch. However two captures plus intervening chart flush are not one atomic freeze: meaningful edits during the inter-capture flush are not covered by one overall generation barrier (the initial-plan-specific comparison catches only changed newly frozen initial plans). This is a residual source-level concern requiring a bounded concurrency check if that transition stays asynchronous, not a reproduced failure in this review.

## Required acceptance before closing

- Decision post → complete: latest market cutoff, last execution cutoff, phase post-review, closed net 6760 / 1.69R, both exit revisions and manual revision retained.
- Direct global completion after post/global selection: no pre-entry final bundle.
- Different timeframe global context: final image visibly contains intended last bar/trades and uses matching period/viewport; metadata agrees with pixels.
- Decision Text remains decision-owned; global Text remains global-owned; old retained bundles unchanged.
- Focused Text + completion, and edits while capture/flush pending: image/drawings/structured revisions remain a coherent frozen set or completion rejects without losing draft.

Original failure evidence must remain. Worker test cursor assertions alone do not prove phase/manual retention or viewport closure.
