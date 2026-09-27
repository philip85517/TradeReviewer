# R3 Astra independent source review

Status: source review frozen; integrated visual acceptance pending root’s fresh browser evidence. No product files changed, browser used, or full suite run. This is not whole-feature acceptance.

Reviewed latest R3-layout worker report, workspace/sidebar/storyboard implementation and their CSS, sizing/plans domain, D02/D05/D06/D07 contract (D05–D07 reference PNGs directly viewed this round).

## Finding requiring journey verification / resolution

**Stage-specific secondary panel state persists into post-review.** `recall-workspace.tsx:486–490` initializes `open` once with `useState(initialOpen)`. Caller near 2796 supplies `initialOpen={sidebarPhase === "holding"}` without phase key. Moving from holding to post-review preserves the same component and its true open state; thus the full actual-results/plan/revision secondary panel remains expanded, unlike direct post-review entry. This undermines the reported default compact post layout. Verify normal holding → post journey and choose an explicit phase transition policy. Source mechanism is definite; actual first-screen impact awaits root screenshot. Preserve user toggles within a stage.

## Source-supported local passes

- Plan entry exposes quantity/amount/ratio buttons using the sizing domain converter; resolved quantities, rounding evidence, unknown capital and mismatched currencies remain explicit.
- Invalid raw plan strings are retained in `planEdits` with errors. `capture()` rejects all plan errors, revision/exit/manual validation errors and false manual validity before requesting chart PNG; retain and completion routes call this barrier.
- An initially suspected capital division crash is **excluded**: calculateRecallPlan validates capital first, suppresses initialRisk on invalid capital, and the sidebar division short-circuits. Do not repair based on that discarded hypothesis.
- Manual episode evaluation is independently mounted in post-review, outside exit availability. No-exit episodes therefore retain the manual entry point.
- Snapshot manual/exit panels receive readonly mode and frozen revision ID lists, defaulting to empty lists rather than live draft refs. Actual snapshot evidence uses retained bundle projections. Fresh runtime persistence checks remain root-owned.
- Storyboard selection clones the document and changes only storyboard references plus updatedAt; it does not mutate working cursor, frozen images, or lastCompleted. Formal view disables selection and uses lastCompleted.
- Sidebar breakpoint uses actual named container width (1105px work / 1134px collapsed layout / 1380px expanded layout), not only viewport. Input rules are 14px; narrow container inputs are 44px; quantity segment and detail summaries have coarse-pointer 44px rules. Full broad touch-device conformance is not inferred from these isolated rules.
- Header/footer CSS preserves explicit compact geometry and single-line desktop control labels. Footer short dates retain full title/aria values. Actual overflow and all key-value visibility require measured DOM/screenshots.

## Remaining evidence

Root must supply matching 1440/1280 and narrow screenshots for pre long-number/error/capital-expanded state, normal holding→post with two exits and manual tags, no-exit manual, snapshot readonly panels, storyboard/formal view, and footer/header. Source presence is not visual acceptance. Touch targets, chart axis visibility and compact post density require real measurements. R5 broader checks remain tracked separately and unverified checks are not silently passed.

Directed independent test: `npx vitest run app/lib/recall/storyboard.test.ts -t 'round trips only|keeps completion' --maxWorkers=1 --reporter=dot` (result to append).

Independent result: 1 file passed, 2 tests passed / 11 skipped, 7.93s, start 20:02:17. This validates the two chosen reference/frozen-completion domain cases only.
