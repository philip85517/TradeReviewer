# Independent correctness/spec review

Reviewed the supplied implementation plan/report/diff and current production service plus workspace integration against the original caller. Read both low-level synchronizers and current focused tests. No production edits or full-suite run. Current service includes the later public `MarketDataRefreshError` type and DOMException status correction; these were reviewed rather than relying on the initial review package.

## Findings

1. **P2 — UI loses coverage-read failure when daily sync also has a partial error.** `app/components/trade-review-workspace.tsx:2818` assigns `dailyError = error ?? refreshError` and checks `error` before `refreshErrorSource`. If daily sync returns useful candles plus a provider/gap error, then the post-sync coverage read fails, the service correctly returns both errors and `storage-error`. The UI persists only the provider error and message; the storage-read failure disappears, despite being the reason for the interval status. The previous implementation explicitly replaced the message on coverage-read failure. Give coverage failure precedence in the terminal error/message, or combine both messages without changing persistence schema. Add a workspace test with simultaneous partial sync error and rejected post-sync coverage read; assert fetched candles survive and terminal job/UI explain storage failure.

2. **P2 — structured storage diagnostics leak DOMException numeric codes.** `app/lib/market/market-data-service.ts:80-84` treats any object with `code` as a domain diagnostic. Native DOMException has numeric `.code`: an `InvalidStateError` from repository access becomes `refreshError.code = "11"`, even though status is `storage-error`. This newly added structural branch produces meaningless domain codes and undermines consumers classifying refresh failures. Normalize DOMException to `storage-error` before structural extraction; only preserve validated/string domain codes. Cover daily and hourly repository rejection; retain their prior data and the other interval success.

## Interface / coverage follow-up

- The public range metadata is now typed, resolving the initial need for a consumer cast. However `errorDetail(MarketDataSyncError)` still drops `failedRanges`, even though the low-level exception carries them. This is inherited UI behavior, not a new data-loss regression, but is a meaningful limitation of the new reusable diagnostic seam. Preserve `failedRanges` and derive `failedCount` when mapping the typed exception; test a hard daily failure with two gaps. `requestedRanges: []` on rejection then need not be mistaken for no attempted work.
- The result `status` and `source` are not uniformly display-data properties: with retained 15m candles, they describe the attempted 1h refresh; daily retained-on-rejection status instead describes prior coverage. Document these field semantics (and requested versus returned interval), or add an explicitly named attempt status before future consumers rely on the implementation report claim that status describes displayed data. No wider interface redesign is necessary for this extraction.
- Existing coverage-failure test uses empty prior coverage, so it cannot catch loss of nonempty prior coverage. Add a nonempty prior segment and assert exact retention with fetched daily data and successful hourly result.
- Add the symmetric hourly-rejection/daily-success retention test. Current mocked tests only exercise daily rejection; cache-only real integration does not exercise failures. The delayed coverage-read cancellation test now present protects the final signal check; explicit child Error(name=AbortError) and hourly child cancellation are useful small cases.

## Invariants checked

- Both synchronizers remain independent via allSettled; one rejected interval does not overwrite the other fulfilled interval.
- The final signal check, already-aborted check, and child/coverage-read AbortError checks prevent publishing a result after cancellation.
- Post-sync daily coverage failure preserves fetched daily candles and copies prior coverage.
- Empty hourly fulfillment preserves previous legacy 15m candles, interval and coverage.
- No provider policy, schema, normalization, or trade-data changes appear in the production extraction.
- Workspace still computes all episode ranges and supplies the same default range/refresh options. The reported `refreshes every trade episode regardless of the selected episode` suite failure remains a coordinator verification blocker; static review does not explain it or override it. Its first request assertions wait for request initiation rather than terminal refresh, so completion timing is worth checking before attributing the failure to changed range planning.

No critical correctness issue found. Two actionable P2 diagnostic findings above should be resolved before accepting the truthful-diagnostics claim. This review does not substitute for coordinator test/browser acceptance.

## Scoped final re-review — 2026-09-22

Reviewed `final-review-package.txt`, current service/workspace changes, the focused test additions, and ADR 0006. No test suite was run for this scoped re-review.

- **Finding 1 — ADDRESSED.** Coverage-read failures now take precedence in the persisted daily error; the message explicitly states the coverage-read failure and also includes the partial provider error when both exist. This resolves the status/error mismatch without dropping fetched candles or changing persistence schema.
- **Finding 2 — ADDRESSED.** DOMException is now normalized to `storage-error` before structural extraction, which only accepts nonempty string codes. AbortError is still intercepted before this mapping. A focused test covers both interval diagnostic codes.
- **Hard daily failure range detail — ADDRESSED in production.** Mapping `MarketDataSyncError` now preserves its `failedRanges` and derives `failedCount`. The actual class guarantees that array exists. A direct regression test remains useful but is not a blocker to this bounded extraction.
- **Field semantics — ADDRESSED by documentation.** ADR 0006 explicitly explains daily retained-cache status, hourly attempted-refresh status when retaining 15m, source ambiguity, and consumers needing diagnostics plus `retainedPrevious`. No further source comment is required for acceptance.
- **Workspace race test — reasonable targeted correction.** Waiting for the first refresh button to become enabled before selecting another episode observes the UI terminal transition rather than merely request initiation. Range assertions are preserved. The coordinator/owner rerun still determines whether the reported failure is resolved.

No new important/critical breakage identified in these fixes. The remaining suggested symmetric hourly-rejection test, nonempty prior-coverage assertion, and direct workspace dual-error test are noncritical coverage improvements (some may be added by the owner after this review). The current module-level dual-error test protects retention of both diagnostics, but does not by itself protect UI message priority.

**Verdict: scoped production review accepted; both P2 findings closed.** Final delivery still depends on coordinator verification and browser acceptance, not this static review.
