# Independent G06 refresh-journey review

Reviewer: `/root/unit_review`, 2026-10-07 (Asia/Shanghai).

**Final frozen correction: scoped Spec PASS / Quality PASS. Initial rejected candidate and its R01 finding remain preserved below.** No test was run by this reviewer. Review uses the exact test-only diff against HEAD `cf7d48cc4d0052841b64690085e68b23325ffaea`, the current issue/diagnosis, retained coordinator logs and relevant unchanged component source. Only this report was written; no source edits, services, database operations, browser, remote actions or nested agents were performed. This accepts the bounded test correction, not G06 whole-suite acceptance or merge readiness.

## Initial candidate finding — Important, R01

`app/components/trade-review-workspace.refresh.test.tsx:191` initially replaced the original asynchronous `screen.findByRole("button", { name: "数据" })` with a synchronous `screen.getByRole("navigation", { name: "主导航" })`. This removed initial storage-readiness synchronization. Product `trade-review-workspace.tsx:5650–5658` returns only the SQLite storage-status page while `storageState !== "ready"`; its real navigation at line 5702 is rendered only after that early return is passed. A synchronous query immediately after `render()` therefore throws before any journey can run.

The coordinator's `refresh-final-targeted.log` records all eight cases failing at that helper with “Unable to find an accessible element with the role navigation and name 主导航”, while the rendered page contains the busy SQLite storage region. This is a concrete test regression, not a product navigation failure or the original 5000ms timeout. Initial Spec result: FAIL, because the readiness boundary was removed. Initial Quality result: NEEDS CHANGE. Critical: none; Important: R01; Minor: none in the exact test scope.

Required correction: preserve the navigation scope while awaiting its actual availability through the default asynchronous role query. Final frozen source now implements that correction; R01 is resolved in the final version. The initial rejection remains retained here rather than relabelled as a passing final run.

## Retained diagnosis and assertion inventory

`refresh-original-targeted.log`/`refresh-diagnosis.md` preserve the original isolated 7 PASS / 1 timeout result at 5114ms and the integrated timeout at 5121ms. The milestone file records an instrumented eight-case run passing, with the target's final assertions at 3287ms. At return navigation, the old data-management region was connected and identical to the newly queried region. Product lines 5890–5900 also keep `DataManagement` mounted and toggle its parent's visibility. The stale-node explanation is therefore disproved as the dominant cause; reacquisition is navigation hygiene.

The recorded milestones locate long intervals around detail/navigation actions. They are consistent with reducing broad/duplicate role queries, but do not isolate query CPU cost or prove that the final uninstrumented edit consistently satisfies the original budget. Final targeted and bare whole-suite results remain coordinator-owned requirements.

The exact diff preserves all eight case names and all 60 `expect` calls. The fixture/mock/setup prefix preceding `openDataManagement` is byte-identical to HEAD. No production component, storage seam, provider fixture or cleanup is changed by this test delta. The sole pre-existing explicit `waitFor` timeout of 5000ms is in the separate running-batch case and is unchanged; no new timeout, skip, fake timer or temporary timing output is introduced.

For the target journey at lines 381–449, the preserved outcomes are: initial partial count1; daily provider once; intraday provider once; returned complete count1; returned partial count0; visible 1h details; absent15m details; absent “待重试 0 个标的”. Each original assertion/matcher and the real round/detail/refresh/navigation sequence remain. The two summary assertion containers are reacquired after returning, not replaced with fixed expected data.

The real 主导航 is the labelled `<nav>` at product line 5702; its 数据 button at lines 5748–5762 calls `setActiveView("data")`. Narrowing its query is an actual product DOM contract. Collapsing `findByRole` followed by `getByRole` for the same detail button into clicking the awaited result preserves the asynchronous ready boundary and actual click. No direct state setter or fake component bypass is introduced.

Product lines 3984–4013 await the terminal storage write, update the durable-job ref/state, then refresh the saved global summary for a non-batch update. Lines 3316–3360 derive that summary from current executions and durable jobs. The test delta retains that existing product/storage chain; source inspection does not establish a new product persistence defect.

## Final frozen correction — scoped acceptance

After the coordinator's explicit freeze notification, the exact final diff was reread. Worktree SHA-256 is `f1ce6c9d5b288ab17a542e8aae8764f49e3dc3faa75622febebb508dbcdcc943` for `app/components/trade-review-workspace.refresh.test.tsx`.

At line 191 the helper now uses `await screen.findByRole("navigation", { name: "主导航" })`, with no timeout option. The real ready navigation and its 数据 button are rendered together; clicking the scoped button after that wait preserves the original asynchronous storage-ready boundary. The synchronous return-navigation lookup at lines 436–437 occurs after successful navigation into a real round/detail dialog; the main navigation remains mounted at that stage. The data page is subsequently awaited by its accessible region role/name. R01 is therefore closed at source level without a new fixture, timer or product-state bypass.

The final diff consists only of this shared navigation scope, the two duplicate detail-button lookup reductions, and retaining the freshly queried data-management region for the two original summary assertions. All eight case names and all 60 `expect` calls were rechecked against HEAD. The original real storage adapter, complete/partial provider fixtures, provider-once checks, round navigation and reentered interval/detail assertions remain. No assertion or matcher is removed or relaxed. No skip, higher timeout, fake timer, fixed response, component mock or product change masks the original journey.

The coordinator's distinct `refresh-final-targeted-v2.log` records one file / eight tests PASS, with 13.19s of file test execution (19.17s total). This is the final uninstrumented targeted evidence, separate from the earlier instrumented pass and initial candidate's eight failures. The log does not report the target case's individual duration; no invented per-case timing claim is made here.

Final findings: Critical none; Important none unresolved within the exact test diff; Minor none. Spec PASS for preserved contract/navigation/assertions. Quality PASS for the bounded query/ready-boundary correction. Accept this source for continued integration. Fresh bare whole-unit, applicable type/scoped-lint checks and regression-record updates remain required before the coordinator closes G06. This report makes no full-suite or merge-ready claim.
