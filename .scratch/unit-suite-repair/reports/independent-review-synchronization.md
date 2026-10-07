# Independent review — synchronization deltas

Reviewer: `/root/unit_review`. Source review only; no tests, source edits, nested agents, service, database or remote actions. This report is the only written file.

Scope: the newly frozen confirmed-import synchronization at `app/components/trade-review-workspace.test.tsx:3684–3688` and the canonical-preference assertion synchronization at `app/components/trade-review-workspace.alias-recovery.test.tsx:147–149`. The earlier four-file review remains in `independent-review-final.md` and `independent-review-scoped.md`; this review does not replace it or accept the integrated suite.

Reviewed current main-test content hash: `9da7b6ded0d0e46316be48fbedff3b6681a059a6`. Reviewed alias-test content hash: `306070d24e4c55c4b55569a21db7e2ad0278a0aa`. Main comparison uses the previously inspected third-case content recorded by `independent-review-final.md` (main hash `622c268e9af1b1219658465c9a9dfcefb3792269`) and the original assertion inventory from HEAD `63690a494b8ad403081c7720985be54a95db60c7`. The prior content hash is not a persisted Git object, so this is not a fresh Git blob-to-blob diff. The alias diff is directly compared with HEAD.

## Spec review: PASS, scoped

Strengths:

- Main lines 3680–3683 still perform actual file upload, actual confirmation-button click and the original merge-three-executions assertion. Lines 3684–3688 add an observable completion boundary and obtain the currently mounted Recall before the original `toBeInTheDocument()` toolbar assertion. The original library heading and XPEV search assertions remain at 3694–3695, following the actual return action at 3692. No original assertion, case, fixture or user action was deleted or replaced by a private handler or synthetic state update.
- The confirmation boundary matches production: `confirmImport` awaits `storageClient.mergeExecutions` at workspace source 5135–5140, publishes merged executions at 5151–5152, selects the imported episode at 5186–5188 and clears `pendingImport` at 5194. The actual dialog is conditional on that state at 6350 and wired to `confirmImport` at 6373. Its role and accessible title are real (`import-confirm-dialog.tsx:119–130`); `use-modal-focus.ts` only manages focus and keyboard behavior, and does not hide the dialog. Thus waiting for disappearance follows the completed import transition rather than only observing entry into the merge spy.
- Recall is genuinely gated by local market hydration/readiness at workspace source 6086–6099. Re-querying its mounted region avoids retaining a pre-transition node, while the toolbar document-membership assertion still rejects a detached result. The real provider-502 fixture and real storage/hydration path remain unchanged. The dialog boundary does not prove provider refresh has finished: production schedules that update without awaiting it at 5190–5193, and this review does not make such a claim.
- Alias lines 139–150 retain the deferred loader, the pre-alias null canonical-key assertion, all three exact UI values, the exact canonical JSON object (including canonical account and null simulation run), and the legacy-key assertion. Only the original persisted-object assertion is wrapped in `waitFor`. Production resolves aliases and sets restored scope at workspace source 2542/2561–2564, then writes the canonical preference in a separate effect at 1292–1299. The underlying writer still writes only the v2 key (`migration-browser-alias.ts:165–175`). Awaiting that observable storage result is consistent with the existing asynchronous lifecycle; the test never writes the expected canonical result itself.

Critical: none. Important: none. Minor: none.

These deltas meet the R01 closure ruling in `issues/01-workspace-implementation.md` and R12 in `DESIGN-COVERAGE.md`. No assertion weakening, fixture bypass, production behavior change, new skip or removed test was found.

## Code-quality review: PASS, scoped

The waits are attached to distinct real asynchronous boundaries and retain exact assertions. Both files use existing Testing Library APIs and default options. Installed Testing Library uses `asyncUtilTimeout: 1000` (`node_modules/@testing-library/dom/dist/config.js:15`), and `waitFor` uses that default (`wait-for.js:14–19`) while preserving assertion errors for final rejection (`121–156`). It will fail if the canonical object is absent or wrong; it does not catch the failure and report success.

Neither reviewed case supplies a larger timeout, and neither new wait supplies a timeout option. The jsdom case budget remains Vitest's default 5000 ms (`node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:538`); the config and setup do not override it. Adding a distinct default wait introduces an additional synchronization opportunity, but does not raise any configured timeout or the overall case budget. This is the explicitly bounded synchronization change in the current issue ruling, not a numeric timeout relaxation.

Critical: none. Important: none. Minor: none.

## Evidence and recommendation

The preserved `reports/full-unit-final.log` records the prior integrated failures: canonical storage received null after the UI checks, and the post-import global toolbar query failed. Source inspection supports the new boundaries; it does not independently prove runtime stability. Read-only inspection of root's `reports/workspace-alias-synchronization-v2.log` shows the complete alias file plus the exact import case passing (5 tests); its 90 unselected main-file tests are filter omissions, not newly added skips.

Recommendation: accept these two source deltas for continued integration verification. Overall status remains integration-pending. Root's fresh bare full suite, required native unit entrypoints, typecheck and scoped lint remain the acceptance gates; this report makes no full-suite-green claim.
