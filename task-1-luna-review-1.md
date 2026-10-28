### Spec Compliance

- ❌ Issues found: the matcher can silently accept an apparent duplicate when both records carry the same file fingerprint but neither `source.row` is a legal stable locator. This violates the §5.1 rule that insufficient identity evidence remains a reviewable association requiring an explicit choice.
- ✅ The requested four-file scope is present in the candidate package, and the implementation does preserve the existing reconciliation and decision APIs.
- ⚠️ Cannot verify from this Task 1 diff: the Task 5 persisted prepare/commit gate, plan version checks, and whole-plan atomic confirmation are explicitly deferred to Task 5 (`task-1-report.md:129-134`). I do not count that deferred boundary as a Task 1 finding.
- ⚠️ The report says full typecheck, lint, build, and the full test suite were not run (`task-1-report.md:100`); those checks remain for the coordinator.

### Strengths

- `executionScopeIdentity` separates account, instrument/currency, resolved trade nature, simulation run, simulation trade/role, and the time precision before candidate matching (`app/lib/import/execution-reconciliation.ts:86-103`). This directly protects the required account/nature/simulation boundaries.
- Stable-row and China Merchants semantic identities are attempted before cross-source value matching (`app/lib/import/execution-reconciliation.ts:313-420`), while the cross-source path pairs at most one current observation with one incoming observation (`app/lib/import/execution-reconciliation.ts:422-444`). The added tests cover row `0`, changed-row core/time conflicts, one-to-one multiplicity, and explicit choice for different file versions (`app/lib/import/execution-reconciliation.scope.test.ts:23-65,107-125`).
- Conflicts require a decision and `keep-both` is preserved by the existing decision application path (`app/lib/import/execution-reconciliation.ts:454-482`). The real Store test uses an in-memory SQLite database and demonstrates the normal account, stable-row, cross-file, and unresolved-nature paths (`app/lib/storage/sqlite-store.reconciliation-scope.test.ts`).

### Issues

#### Critical (Must Fix)

#### Important (Should Fix)

1. **Same fingerprint plus an invalid row locator is treated as an independent accepted row.** `executionSourceIdentity` marks every non-empty fingerprint as `verified: true`, without checking the locator (`app/lib/import/execution-reconciliation.ts:134-152`). Separately, `executionRowIdentity` rejects non-integer and negative rows and returns `undefined` (`app/lib/import/execution-reconciliation.ts:313-321`). In the cross-source pass, two such records therefore have the same verified `sourceInstanceId`, so the `sourceInstanceId !==` guard prevents pairing (`app/lib/import/execution-reconciliation.ts:422-443`); because no pair is made, the incoming record stays in `acceptedIncoming` instead of entering `conflicts`.

   This is reachable through the existing input contract rather than a hypothetical object that the application cannot receive: `TradeExecution.source.row` is only typed as `number` (`app/lib/trades/types.ts:59-88`), and `validateExecution` only checks `typeof source.row === "number"` (`app/lib/storage/sqlite-store.ts:530-540`). Fractional and negative finite numbers pass that validator. Historical rows are also rehydrated from the stored evidence source without a locator-shape check (`app/lib/storage/sqlite-store.ts:850-860`). A focused fixed-Node run with identical account/instrument/nature/time/core and `row=-1` versus `row=1.5` produced `{"accepted":["incoming"],"duplicates":[],"conflicts":[]}`. `mergeExecutionsInTransaction` then writes every accepted incoming record (`app/lib/storage/sqlite-store.ts:1773-1803`), so this bypasses the required review gate and can persist an unproven duplicate.

   Fix by rejecting malformed source locators at the input boundary or, if they must remain diagnosable, marking the fingerprint evidence unverified whenever the row is not a legal non-negative integer so the current/incoming pair becomes a conflict requiring a decision. Add a regression test for same-fingerprint records with fractional/negative rows and assert no `acceptedIncoming` and a missing-decision failure. Keep the valid-row case (`row=0` and distinct integer rows) independent as already tested.

#### Minor (Nice to Have)

1. The implementer's reported GREEN run contains an unfiltered Node `[DEP0205] module.register()` deprecation warning (`task-1-report.md:85-100`). The 93 passing assertions are useful, but the evidence is not warning-free; identify the dependency/runtime source or record the accepted baseline warning in the verification procedure.

### Assessment

**Task quality:** Needs fixes

**Reasoning:** The scope and normal stable-row/cross-source behavior are well structured and materially covered, but the confirmed invalid-locator path silently persists an unproven duplicate instead of requiring review. That is an Important identity-safety failure under §5.1.4 and blocks acceptance until fixed and regression-tested.

Checks run: fixed native Node focused in-memory matcher probes only; no business database access, no source mutation beyond this review file, and no full-suite rerun.
