# R01 — deterministic workspace test journeys

State: closed
Status: accepted
Coordinator: /root

Read Task 2 in `../IMPLEMENTATION-PLAN.md`, Global Constraints, `../reports/workspace-three-diagnosis.md`, exact tests and the current chart-first spec before edits. Model: gpt-5.6-luna / medium. File ownership: only `app/components/trade-review-workspace.test.tsx`; all earlier dirty files belong to other tasks.

Existing red evidence: both `affected-files.log` (two workers) and `workspace-three-red.log` (one worker) show the same three tests timeout at 5000ms. All other eight affected files passed unchanged; no assertion demonstrates a product bug. User asked for repair of unit tests, preserving behavior.

## Allowed repair

1. For `retains a Recall drawing draft per episode and gates completion until a snapshot exists` and `keeps the latest Recall drawing draft while completion is gated`, control the actual 1000ms autosave timer using Vitest fake timers and React `act`. Complete fixture setup/market readiness before starting the controlled clock. Use userEvent's advanceTimers option for interactions while the clock is controlled. Restore real timers in a failure-safe finally/cleanup boundary before unrelated cases. Preserve the real drawing, keyboard entry/rename, pending-autosave message, saved status, repository content, per-episode return/reopen and completion-rejection assertions; advancing virtual time cannot replace them.
2. Scope repeated accessibility queries to known accessible Recall workspace, chart toolbar, records or library regions with `within(...)` when the target actually belongs there. Preserve visibility/accessibility checks and real user click/type/keyboard/upload flows. Do not use hidden:true or disable pointerEventsCheck.
3. For `keeps library context through a confirmed import with failed market refresh`, first apply the same local query scoping where supported. Preserve actual import confirmation, three merged executions, chart readiness, return navigation and persisted search context. If it still fails, capture per-action timing within this owned case and report the blocked action; do not guess a provider/product fix. Temporary timing instrumentation must be removed before the implementation-ready report.

Imports and necessary cleanup in this test file may change to support the two controlled clock cases; no unrelated test/helper behavior change. Do not skip cases, remove/relax assertions, increase timeouts, directly invoke private component handlers, or mutate product state to bypass user flows. No product, shared setup/config, browser/service/business DB, full suite, nested agents, commit or remote actions.

## Reopened clock compatibility boundary

The first repair attempt still fails all three. The installed RTL `asyncWrapper` (`node_modules/@testing-library/react/dist/pure.js:83`) drains through a zero-delay timer and advances it only when Jest globals exist; this Vitest project imports `vi` and has no Jest globals. A diagnostic drawing log stops immediately after installing fake timers. Root authorizes a case-local RTL asyncWrapper / clock compatibility boundary in the owned test file, using React act and failure-safe restoration of the exact previous configuration. Keep real userEvent actions, queue flushing, pending/saved/repository assertions and real-clock navigation. No shared setup/config change, suppression of errors, or loss of act semantics. Preserve attempted red logs and remove temporary instrumentation before ready status. Root must review the actual boundary before acceptance.

## Evidence and report

Run the three named cases together with `--maxWorkers=1` and then `--maxWorkers=2`, all original timeouts. Save `workspace-three-green-one.log` and `workspace-three-green-two.log`. Once these pass, run the full 91-case workspace file with `--maxWorkers=2`, saving `workspace-full-green.log`. Report `workspace-implementation.md`: exact scoped diff rationale, timer restoration, complete retained behavior assertions, commands/counts, and concerns. No extra full-file repeats once green unless new changes/failures justify them.

Coordinator will independently inspect the actual diff and fresh full-suite evidence; product UI/visual/persistence acceptance is not applicable to a test-only change. Any required product change must reopen approved contract coverage first.

## Revised minimal implementation ruling

The fake-clock experiments were reverted: RTL's compatibility shim resolved userEvent's zero-delay drain but did not produce a green saved-state journey. They added lifecycle complexity without accepted evidence. Root therefore authorizes real-clock journeys with exact accessible query scoping as the next bounded repair; the actual 1000ms autosave and every original assertion remain. No fake-clock shim, global stub or timer lifecycle change should remain unless new specific red/green evidence warrants it. Third-case DOM evidence is `main.trade-review-app.is-review` (the global navigation's library button is not proof of the active library view); read `reports/import-readiness-followup.md` and capture actual post-import local-market read completion if needed. All original 1/2-worker and complete-file gates remain.

## 21:20 contention audit / next diagnostic gate

The latest scoped real-clock probe still fails the first and third cases; only the second drawing case passed. `reports/workspace-diagnostic-timing.log` records first-case render ~2969ms and autosave-pending ~3847ms. It does not contain enough third-case action markers to locate its current boundary. Root independently found another worktree's full single-worker Vitest run active (0ff3 checkout, parent PID 69437, >10 minutes, worker >100% CPU). This process is outside this task: do not kill it, mutate that checkout or message its chat. Pause this task's test execution until it finishes; preserve current failed evidence as resource-contaminated, not accepted product/fixture latency proof.

After the external suite finishes, instrument every relevant awaited action, and install any market-read spy on the actual client before render. Capture getMarketData start/finish for daily/1h/15m, current view and loading gate without dumping business data. Remove instrumentation afterward. Precise scoping may use the existing drawing-toolbar, replay-controls, more-records, library filter and tablist labels while retaining each actual role/name/visibility query and all user actions. No fixture or helper behavior changes are authorized by incomplete timing evidence.

## Narrow automatic-clock candidate / scheduling ruling

Read-only comparison found an existing compatible Vitest pattern in `app/components/dashboard/review-dashboard.test.tsx:22`: `shouldAdvanceTime: true` keeps RTL's zero-delay drain progressing without a Jest global. The earlier unsuccessful experiment froze those drains and also faked other APIs. Root authorizes a bounded trial for the two drawing cases only: complete real IDB/bootstrap/navigation/chart readiness first, then fake only setTimeout/clearTimeout with shouldAdvanceTime:true; create a matching userEvent with advanceTimers; advance the actual 1000ms autosave inside React act, retaining pending/saved/repository checks, and restore real timers in finally before fresh real-user navigation/reopen. No Date, IDB, setImmediate, rAF, Jest shim or private handler changes. This new exact compatibility evidence warrants revisiting the clock boundary; a failed trial must be removed.

The external full suite is outside this task and its finish time is unknown. Narrow probes may now run with that load explicitly recorded, to continue useful repair work; integrated acceptance will wait for it to finish, with no competing heavy test process from this task. For the import case, capture all meaningful action boundaries and pre-render market-read timing before proposing a fixture change. This ruling supersedes the blanket pause for narrowly scoped diagnosis only.

## 21:29 ownership handoff / structural correction

Previous worker stopped without completing the narrow-clock diagnostic. Fresh owner: `/root/unit_workspace_finish`, gpt-5.6-luna / medium, same sole allowed file. Root independently found unverified structural errors: act was not imported; text tool belongs to DrawingToolbar's `绘图工具` label, while `图层` belongs to `图表工具栏`; replay controls are a labeled div. Correct these by reading actual components, then run the explicitly allowed narrow probes. Preserve all previous failures; do not treat existing WIP as accepted implementation.

## Confirmation query boundary ruling

The fresh three-case diagnostic passes both drawing cases but times out in the import journey. Per-action trace records about 1924ms in the global confirmation helper and 1199ms in its click, with individual empty market reads around 0.2–0.3s. The coordinator verified `app/components/import/import-confirm-dialog.tsx:119–130`: the confirmation section is an accessible dialog named `确认导入交易记录`. Authorize scoping `findImportConfirmation` to this exact dialog, then checking its original heading and original confirmation button with `within(dialog)`. Keep the existing helper and case timeout values, all fixture/provider behavior, actual upload/click/merge/return/search assertions, and the full 91-case regression gate. This is query scoping, not a new product or fixture seam. Remove every temporary diagnostic import/marker/market spy before review; preserve previous red evidence and write unique new logs.

## Reopened narrow probe / remaining scope

`workspace-three-final-two.log` remains red: first default-5s timeout; third post-confirm toolbar unavailable within its original readiness wait. One scoped run finishing third in 3.215s exposed detached DOM; retain the document-membership assertion and re-query the current mounted view. This is not stable acceptance. The first diagnostic records 2680ms initial helper work and 747ms global return-button interaction. Root authorizes further purely accessible query scoping: dashboard calendar queries stay within the actual `历史交易与复盘` region; library tab queries stay within `交易库浏览视图` tablist; return-button query stays within `当前股票交易导航`. These existing containers are verified in `review-dashboard.tsx`, `trade-library.tsx` and `stock-episode-navigation.tsx`. Preserve the exact actual entry path and all actions/assertions; no new fixture or timeout change under this ruling. Independent read-only audit is examining the third case's HTTP-client fixture separately.

Correction: the coordinator's `当前股票交易导航` recommendation applies only to `showDemo=true` at workspace source line 6070. These cases use `showDemo=false`; the actual return button comes from `headerActions` in Recall's header. The failed label/role probes are preserved in `workspace-first-scoped-v3.log` / `v4.log`. Use the mounted Recall root or its actual header (anchored by `复盘标的` label) for this role/name query. Do not query the absent legacy aside. Before any fixture change, run the third case independently: an unfinished first-case async chain after timeout could contaminate later cases.

## Independent red / final query refinement

`workspace-first-scoped-v6.log` passes in 4680ms; `workspace-import-isolated-current.log` independently times out at 5211ms. Full acceptance remains pending. Authorize the remaining exact container scopes in these three cases: return button in current Recall header anchored by `复盘标的`; layer actions in chart toolbar and layer inputs in `绘图图层面板`; library tab in `交易库浏览视图`; episode open button in the expanded stock round region. Preserve all original assertions, especially `expect(await screen.findByLabelText("图表工具栏")).toBeInTheDocument()` after import. The current candidate accidentally converted that assertion into a plain wait: restore document membership, requery current mounted Recall after hydration, and remove unused pre-import `recall`. No timeout, fixture, or path bypass is allowed in this owned file. Coordinator will run tests once both this refinement and the disjoint adapter task are frozen.

## Full-run readiness failure

reports/full-unit-final.log completes with 3062 passed / 2 failed / 6 original skips in 488.87s. Third-case failure is at line3684: default toolbar find cannot complete after merge-call observation; main stays is-review. Source confirmImport clears pendingImport only after merged executions, selection and market-update scheduling; the confirmation dialog is therefore a visible completion boundary stronger than merge spy call entry. Authorize only this third case to await disappearance of the actual confirmation dialog after click/merge observation, then await current mounted Recall before checking original toolbar document membership and querying current header. All waits use existing defaults and case retains original5s budget. Preserve actual upload/confirm, merge3, chart, return and XPEV search assertions, original fixture, real clocks. No old-Recall-removal requirement/private handler/mock bypass or timeout increases. Root tests targeted case plus complete alias file, then bare full suite supplies the complete91 and all-consumer regression again.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

Bounded implementation accepted after final root command and independent source review. Real import/return/library context, autosave storage/reopen and completion gating assertions remain. Default5s budgets preserved; no Jest compatibility shim or diagnostic instrumentation remains. Frozen final source hash is recorded in frozen-candidate-final-v2.json. Complete91 cases pass in full-unit-final-v2.log; independent-review-final.md plus independent-review-synchronization.md close all source gates.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
