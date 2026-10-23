# HistoryChart candidate 1 implementation report — preparation only

History leaf candidate1, formal0/3; P4 whole0/3. Actual assigned model gpt-6.1-sol / ultra. Implementer /root/contribution_bars. Root is the independent functional, whole-page visual and complete data/persistence owner. This report requests root review of the frozen candidate; it is not feature acceptance or completed UI delivery.

## Result and API

Only history-chart.tsx/.css/.test.tsx were added as products. HistoryChart accepts immutable caller-committed data|null, four existing HomepageHistoryChartMode values, reportCurrency and ready/pending/error/empty readState. Data carries sourceId/requestGeneration, month/year grain, range business label/start/end/timeZone, and ordered keyed points. Each point independently supplies period/cumulative HomepageV25Metric facts with original amounts/FX/coverage, count/winning-count/rate strings with available/reasons, semantic label, interval and explicit state/reasons. Runtime code performs presentation validation, field selection, formatting and SVG scale geometry only. It never fetches, writes, calculates finances/FX/attribution/cumulative/winrate or builds totals from known subsets.

The actual320px SVG renders lines, r3points, separate gap regions, stable all-mode axis slots and semantic month/year labels. Exact full strings and provenance remain in the normal-flow temporary reading. Future/loading/error suppress every point financial fact in all4 modes; source-missing permits independently known count/rate; no-round cumulative is drawn only if caller explicitly provides it. Invalid rate/count/amount and currency mismatch fail closed. Truezero stays distinguishable from unknown. Left/right/Home/End include gaps and every dense annual point. Leave/blur/Esc close readings; new data/source/generation/mode/currency permanently clears selection, including A→B→A. Parent supplies complete old data during globalpending/error; leaf keeps no old financial snapshot.

## Exact version

| Product | SHA256 | Bytes / lines |
|---|---|---|
| history-chart.tsx |03b9825a52e797b795e6f163697d98acd658d9f2e3a2427747f0d66f0fc4fc5d|19570 /250|
| history-chart.css |0db1c089e2d2522ce3a9e0755df6c47353e719f77cb760d4f2d7d2b652df9dfe|3271 /39|
| history-chart.test.tsx |b1526865de7b34cea7a9465685baa5b6dbbcf7586638fec917fba112ffed0851|34397 /417|

Complete /dev/null new-file diff: complete-new-files.diff. Machine-readable product hashes: PRODUCT-SHA256.json. Shared checkout HEAD/status, old frozenBars hashes and post-check shared dependency hashes: scope-snapshot.txt. Candidate evidence manifest is generated at freeze, with self-referential marker excluded. No commits/stage/reset or other product edits were made by this worker.

## Verification

| Check | Final evidence | Result |
|---|---|---|
| Actual SVG minimum plus fullHC01–15 |green-candidate1-final.log; exactsingleinclude/maxWorkers1,pinnedNode26.0.0|49/49 PASS|
| Strict scoped dependency-inclusive tsc |tsc-candidate1-final.log, all command flags/stdout/stderr/exit preserved|PASS exit0|
| ESLint scopedtwoTSX --max-warnings0 |lint-candidate1-final.log|PASS exit0/no warnings|
| Static motion/status/style audit |MOTION-STATIC.md|Scoped source/behavior evidence only|
| Prerequisite minimal native-browserjourney |ROOT-MINIMAL-JOURNEY-GATE.md written byroot before expansion|Limited PASS on historicalminimalversions only|
| Finalversion real-browser functional/visual |Root owns actual1440×1000/1280×800/390×1000,DPR1andboundaries|NOT VERIFIED byworker|

No wholeWorkspace/fullsuite/build/rebenchmark ran. Parent quiet performance window was respected until explicit release. Vitest emits existing DEP0205 module.register deprecation warning; retained in rawstderr. Earlier shared ledger/finance tsc failures remain in tsc-final/tsc-final-corrected/tsc-freeze logs; original owners fixed them, this worker did not. The final strict command nowpasses. No leaf test/type diagnostic is hidden or excluded through a stub.

## TDD and preserved failures

- Minimal: red-minimal.log is infrastructure pathfailure and explicitly not featureRED; corrected red-minimal-feature.log then green-minimal.log1/1.
- Full matrix: red-matrix.log21FAIL/12PASS beforefullbehavior; green-matrix.log34PASS.
- Root-discovered endpoint focus: red-focus-endpoint.log retains3-period rightedge failure; final3/12period regressionspass.
- Fullreading/labels: red-reading-labels.log3FAIL then green-reading-labels.log7PASS. Hooklint warning retained in lint-reading-labels.log, resolved with stableEMPTY_POINTS and properdependencies.
- Sub-unitmoneytick and extremecountaxis each preserve dedicatedRED; green-small-extreme-axes.log2PASS.
- Olddata status containment: red-status-slot.log3FAIL→green-status-slot.log3PASS.
- Dense30/40years: red-dense-years.log2FAIL→green-dense-years.log2PASS, preserving allpointsemantics.
- Former760px boundary: red-label-boundary.log2FAIL/1PASS→green-label-boundary.log3PASS afterroot clarified actual-spacing decisions across widths.
- Intermediate43/46casepasses andexternaltypefailures remain unchanged. Final49case fulloutput supersedes them without deleting them.

## Design, state and limitations

All nine originalSVGs were personally viewed through faithful1440×1000 PNGs in references/, and the complete round5 prototype was read. DESIGN-COVERAGE.md maps everyHC01–15/approvedelementID to the original spec/reference, owner, journey and evidence. CONTROL-STATE-MATRIX.md maps49cases to the finalthreeSHAvalues.

Root explicitly approved: status safe bandy44–62 so pending/error do not add normal-flowheight; actual-width label single/tworow y298/312 at11px; and30/40year visualtick thinning only ifbothrowsstillfail, with first/last/everypoint/AX/keyboard/reading andfourmodealignment retained. The old<760hardgate was removed underexplicitrootclarification. Exact deterministicstride, fallbacktextmeasure, longreasonellipsis/fullAX/titleboundary, normal-flowlongreading, endpoint containment and12pxright-insetdifference fromoriginal are fully disclosed in AUTHORIZED-DEVIATIONS.md and appended to ROOT-DISPATCH atrootrequest. These are authorized candidates for comparison, not accepted visual fidelity.

Actual final-version native mouse, native keyboard, reducedmotion/cascade, labelcrowding, focusoutline and longreading/downstream pixelbehavior remain rootNV. Emulatedtouch and physicaltouch remain separatelyNV. No browser/toolcontrolledservice was used byworker. Hostfinancial/three-partatomicrange/context/return/reload/persistence is NOT VERIFIED futureintegration. DBwrites N/A because this pureleaf exposesnoIO; that doesnot exempt hostpersistence acceptance. No previewservice was started byworker; root retains its realharness/previewowner role.

Old ContributionBars is frozen formal3/3FAIL and paused; its exact hashes are checked in scope-snapshot. This task doesnot repair it, reset anycounter, bypass finance/publicstagegates, or claim P4accepted.

When IMPLEMENTATION-READY.md and manifest are written, product/evidence writing stops. Root may independently accept or formally reject candidate1 undertheexistingthree-roundlimit. AnyrequiredNV orknownfailure blocks featurecompletion.
