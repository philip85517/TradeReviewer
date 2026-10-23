# Ordinary collection readiness — bounded implementation candidate

2026-10-23 CST. Worker: `/root/workspace_integration`, gpt-6.1-sol / ultra. This is the candidate prepared under `ROOT-WORKSPACE-FIX-DISPATCH.md`; **P1 formally remains 2/3 FAIL** until root's independent third-round acceptance. P2/P3 remain 0/3. This report does not accept the feature or reset a round.

## Scope and contract

Only `app/components/trade-review-workspace.tsx`, its test, `app/components/homepage-v25/use-homepage-host.ts`, and its test were edited. No session-model expansion was needed. Other workers' existing changes in the working tree are preserved; the entire diff from HEAD is not solely this repair. No subagent, commit, push, shared tracker, browser, business/test database, service, performance run, full Workspace suite, or full repository suite was used by this worker.

Read current AGENTS and linked development, decomposition, UI task, and frontend audit workflows, plus systematic-debugging, test-driven-development, and verification-before-completion skills. Read the root dispatch and diagnostic report before implementation.

|Design coverage|Exact source|Affected journey / evidence|
|---|---|---|
|HV25-09/10|`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`, HP03:113–190; `images/search-detail.svg`|Metadata directory → exact ordinary collection → fresh source return; existing test #1|
|HV25-23/24/27/29|Same spec HP04:295–316|Explicit-live holdings and unknown identity boundaries; existing production journey tests|
|HV25-31|Same spec HP06:436–448; `images/holding-return.svg`|Detail → ordinary collection → explicit user round selection → guarded return; existing journey tests and host tests|
|HV25-53/55|Same spec HP09:467–514|Cold collection, generation, source/catalog validation, replay consumer safety; original #3/#4, new host and late-result tests|

SVG source was read directly. This worker could not render those SVGs with the available local viewer and therefore makes no visual comparison or fidelity claim. Root owns whole-page visual consistency and complete persisted data-flow acceptance. No dimensions, hierarchy, CSS, Surface behavior, or library component were changed by this repair.

## Minimal interface and implementation

The host reload callback keeps the existing one-argument call contract compatible and adds an optional `{ destination: "home" | "trades" }` context. Destination is captured from the actual route/intent, including native initialization, navigation, pop, retry and explicit reload. Workspace opts into `readCollections`; existing host consumers retain their prior default behavior.

- A trades read loads a fresh bootstrap and alias readiness, builds that bootstrap's catalog, and returns `kind: "collection"`. It does not await unrelated daily caches or FX. Generation and fresh account/security identity checks still precede acceptance.
- `collectionData` is owned by the accepted native route key. It is hidden while a newer global read is pending or the route key differs. It does not introduce another committed scope. A collection acceptance retains the previously committed homepage financial bundle; returning home performs the complete bootstrap/FX/all-daily read again and commits it atomically.
- Accepted bootstrap inventory updates the existing Workspace inventory owner. A read-start review baseline, review updatedAt, drawing save sequence and dirty-draft ownership prevent that bootstrap from replacing newer local review state. Daily cache acceptance merges only daily-owned fields into an existing instrument state, preserving the selected consumer's intraday readiness and pending restore context.
- Ordinary collections still require the user to choose a stock and a child round. No automatic first-episode selection, old seed bypass, early deferred resolution, or changed test timeout was introduced.

## RED and bounded verification

All Vitest commands use the pinned wrapper. The exact final commands and source/log hashes are in `freeze.json` and `commands.json` beside this report. No broad suite is claimed.

|Evidence file|Result and meaning|
|---|---|
|`red-existing.log`|Before product change: original saved pending intraday and unrelated-stock cases both FAIL at blocked collection region; 2 FAIL / 97 skipped, 9.40s|
|`red-late.log`|Before product change: the two new host counterexamples FAIL. Its first Workspace late fixture failed earlier at a mistaken navigation target and is not the causal Workspace RED|
|`red-late-workspace.log`|Corrected actual-route fixture, before product change: new late-result test FAIL after old homepage completion removes/disables selected 15m consumer; 1 FAIL / 99 skipped, 8.97s|
|`green-workspace-final.log`|Before the final pendingRestore observation enhancement: all 11 affected tests PASS / 90 skipped, 24.40s|
|`final-workspace-timeout.log`|Final frozen test version: enhanced late test and 9 others PASS; refresh-all hits the unchanged 5000ms timeout at 5091ms, 10 PASS / 1 FAIL / 90 skipped. This failed run remains evidence|
|`final-late-refresh.log`|Same frozen sources, separate bounded rerun: enhanced late and refresh-all both PASS / 99 skipped, 10.96s|
|`final-host.log`|Same frozen host sources: all 24 host tests PASS, 2.40s|
|`final-workspace-remaining.log`|Same frozen sources: remaining 9 affected tests plus three existing production route journeys PASS; 12 PASS / 89 skipped, 21.81s|
|`final-eslint.log`|0 errors / 10 warnings on the four files, before the final test-only stock/round selection expansion; no auto-fix. Warnings concern existing imports/hooks in Workspace; lint does not establish final test-source types, browser behavior or visual fidelity|

The enhanced late case observes selected saved 15m data still pending (`aria-busy=true`, toolbar absent), then resolves that intraday read and confirms the saved holding phase, 14:45 market cursor and 14:30 execution cutoff. It then produces a newer review-state write, completes the older home daily read, and checks selected heading, enabled 15m, both cutoffs, Recall working state and latest review-state write remain unchanged. The unrelated-stock case still keeps the other instrument unresolved until after the selected review is available and checks late completion preserves selection/cutoffs. Original #3 preserves its daily/intraday deferrals and saved cursor assertions.

Earlier intermediate failures remain in `green-core.log`, `green-targeted.log`, `green-workspace-affected.log`, and `check-*.log`. `green-core.log` included a default 5s timeout for original #3 during a combined two-file run; `core-pending-check.log` separately passed that unchanged test. Metadata assertions were corrected against the actual localized child-round presentation rather than Recall's raw instrument heading or stock row label.

Evidence limitation: the first pendingRestore enhancement attempt at 05:52:57 returned 10 PASS / 1 FAIL because the generic `enterImportedReviewFromLibrary` helper awaited the toolbar before the test could resolve its deliberately pending intraday promise. Its log path was subsequently reused; the raw file is not retained. That attempt is recorded in the tool transcript and this report, not presented as product RED. The final test expands actual stock/round selection before observing busy state. Later logs have distinct paths and are retained. Pre-change RED logs did not capture four source hashes at execution time; diagnostic `static-inputs.json` binds the pre-repair static source separately, not retroactively as a runtime hash.

## Limited test causality repairs (#1–9)

1. Metadata-only directory/return keeps exact identity, empty collection, fresh name, query, scroll=143 and focus assertions. It observes bootstrap reads increasing across the actual return phase instead of a fixed total that includes background metadata hydration.
2. Metadata completion is marked by the actual deferred resolve response, rather than the cold bootstrap count. Per-instrument interval assertions retain XPEV 1D/1h/15m and OTHER 1D; metadata's zero additional cache reads/review-state writes is checked against the stable pre-metadata baseline. The zero-write assertion occurs before guarded navigation, which intentionally saves state. Returned child-round presentation must contain the refreshed localized name.
3. Original pending restore case remains unresolved until its original consumer stage. No timeout or core saved-state assertion was removed.
4. Original unrelated daily stays pending until selected replay is usable; late completion now also checks selected heading and dual-cutoff aria unchanged.
5. Hourly failure waits for actual 15m fallback, checks the exact per-instrument intervals, and still opens the persisted unavailable-data details.
6. Refresh-all fault fixture now fails only `/api/market-data/`, with valid independent aliases/resolve/FX responses. Both refreshes still verify the full historical episode range, selected episode/control DOM identity and edited plan. Before finishing, each actual terminal `source-unavailable` job is observed; the second canonical-name merge also contains all four executions.
7–8. Cancel/confirm import fixtures use the same endpoint-limited market fault. Cancel still requires no execution merge and a usable chart. Confirm still checks actual 3-execution merge, closed dialog, saved review and returned XPEV query.
9. Workbench test waits for the actual library region before its tab and explicit child-round selection; account/history/context assertions remain.

### Refresh-to-cancel cross-test cleanup finding

The preceding refresh-all test initially ended after observing the network request/control state while canonical metadata persistence was still outstanding. The later canceled-import case occasionally displayed the preceding test's Jan 6 execution context after seeding its own Jan 2 history. Static cause: Workspace's refresh metadata `.then` calls `persistInstrumentName` → the old legacy client's `mergeExecutions`; `await metadataRefresh` precedes terminal `putMarketDataJob`. Test `afterEach` does `cleanup()` and resets mocks, and the following `beforeEach` clears local/session storage and replaces `mockSqliteClient.current`; cleanup did not prove that prior asynchronous legacy persistence had finished. Thus the old async client can write into the shared fixture storage after the next test begins. This is the bounded causal explanation from observed wrong history plus the awaited write chain, not a claim of a full call-level trace.

The finite test repair waits for actual terminal job calls after each refresh and the second expected four-fill canonical-name merge before cleanup. It does not extend 5s or remove any post-refresh range/plan/selected-control assertions. The final combined run's 5s timeout is retained rather than hidden by retry results.

## Retained #10 / #11 FAIL and migration proposal

Both original tests are unchanged, neither skipped nor deleted. They remain known FAIL from root's 88 PASS / 11 FAIL baseline. This worker did not rerun the full Workspace suite or claim all 101 tests pass.

- **#10, `passes stored instrument metadata into the trading room scope` (current line 5475):** current production uses HomeSurface; old ReviewDashboard's ETF filter consumer is absent. A trustworthy complete identity fixture should be tested through current catalog → search/detail → exact ordinary collection, alongside a missing-exchange negative case. Keep the legacy component seam independently if still supported. This metadata migration alone cannot accept ETF filtering: the actual attachment/category consumer and its effect on entries must be implemented and tested under root's separate P3 authorization. Do not fabricate an exchange or replace the old region selector and call the missing behavior accepted.
- **#11, `returns to the trading room with its filters, period, and calendar view after opening a holding review` (current line 5654):** migrate the approved journey using explicit-live exact identity: holding detail → ordinary collection → user selects round → guarded return with fresh data and query/sort/page/scroll/focus restoration. The old direct-first-round shortcut must not be restored. Actual attachment filters, period behavior and calendar year-level restoration remain required FAIL/NOT VERIFIED until their real consumers exist; changing to “尚未接入” or deleting those assertions cannot satisfy them.

## Independent acceptance still required

|Gate|Worker status / boundary|
|---|---|
|Cold ordinary collection without unrelated daily/FX blocking|Component evidence only; root real browser NOT VERIFIED here|
|Saved replay phase, market/execution cutoffs, pendingRestore, newer state and late completion|Component evidence only; real chart revealing intended bars/trades and future visibility NOT VERIFIED here|
|Detail → exact collection → explicit round → fresh return/reload|Component route evidence only; real navigation/reload and isolated DB persistence NOT VERIFIED here|
|FX failure retains committed home scope and retry recovery|Component evidence only; real service failure/cancel/late response recovery NOT VERIFIED here|
|1440×1000, 1280×800, 390×844 visual comparison / affected responsive controls|NOT VERIFIED by worker; no screenshots or CSS acceptance claimed|
|Mouse, keyboard, emulated touch, physical touch|NOT VERIFIED by worker; component userEvent is not real device evidence|
|Original #10/#11 missing attachment/period/calendar consumers|FAIL retained; P3 work belongs to root's separate dispatch|
|Typecheck, full Workspace and repository suites|NOT RUN by worker under bounded scope; root owns broader affected suite|

Implementation candidate is frozen for independent review. It is **implementation-ready**, not accepted. Root must reconcile the retained timeout and run the required real-browser, visual and persistence gates before any delivery/acceptance claim.
