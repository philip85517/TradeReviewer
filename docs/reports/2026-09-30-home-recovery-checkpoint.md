# Homepage recovery — integration status

The user explicitly requested pushing this version and merging it into master after being informed of the remaining import-readiness and performance failures. Integration is requested with these known limitations; this is not a claim that all acceptance gates pass.

## Current verified state

- Build12 integrates the upstream unified header and latest strategy prototype changes. Typecheck and production build passed; the 779-file source manifest remained unchanged during build and after diagnostic test restoration. Typecheck was rerun successfully before publication.
- Real-page checks passed for compact Recall controls/layers/provenance, the 820px toolbar, narrow pagination, canonical simulation-account filter/period restoration, four-source duplicate-only imports, and daily/weekly save/reopen. Independent screenshot review passed these scoped responsive fixes.
- Original protected execution, provisional-principal and migration records were unchanged across real-browser acceptance: 1866 executions, 82 canonical simulation executions and four provenance runs. Review timeframe autosaves were deliberately exercised and are outside the unchanged-record claim.
- The experimental publication caller was withdrawn after its cancellation/retry safety proof remained incomplete. No performance improvement is claimed.

## Known unresolved results

- Latest frozen targeted regression: 9 passed, 1 failed. The confirmed-import journey did not recover its chart toolbar within the existing query deadline. A single diagnostic run failed earlier and did not establish the cause; the original test source was restored without weakening assertions or timeouts.
- The last full suite ran before the final follow-ups: 3056 passed, 5 failed, 6 skipped across 322 files. Subsequent scoped checks do not establish a new full-suite pass.
- Last normal exclusive performance baseline: first quote 4290 ms and all 236 reads 32380 ms, exceeding the unchanged 3000/10000 ms budgets.
- One newer diagnostic trace showed substantial main-thread work and Worker synchronous dispatch cost. It was not a normal-budget benchmark, did not isolate SQLite service time, and recorded one unattributed HTTP502 console response alongside zero page errors and zero failed daily reads.
- Complete-valuation visuals and physical-touch behavior remain unverified. Current partial-data screenshots cannot establish those states.

Private database snapshots, source documents, browser payloads and screenshots remain local and are not published. The records below are historical and do not override this current status.

---

# Historical checkpoint records

This branch is a reviewable checkpoint, not a completed release.

## Changes

- Treat the approved TradingView imports as one canonical simulation account while retaining source-run provenance and legacy account isolation.
- Reconcile historical and current parser identities for safe same-source reimport, with explicit financial/nature conflict rejection.
- Preserve migrated review associations and provide preview, commit/readback, alias recovery and rollback-preview infrastructure.
- Add provisional account principal and cash-baseline revision/history handling without inventing missing dates or cash balances.
- Repair canonical library statistics/filter consumers and Recall actual metrics; preserve daily market boundaries when changing chart timeframe.
- Improve homepage read scheduling and history calculation, plus responsive controls and missing-data presentation.

## Verified checkpoint

Typecheck and production build passed. A 756-file source hash comparison showed no source changes during build10. GPT-6 Luna/max implemented bounded repairs; GPT-6 Astra/low independently reviewed them.

Real-browser acceptance used the explicitly selected deployed SQLite instance. Four original CSV imports previewed 34/24/12/12 duplicates; confirmation generated no trade write attempts. The execution/source/principal/migration audit was exactly unchanged (1866 executions, 82 canonical simulation executions, four source runs).

Both homepage-to-library navigation paths retained their immediate filters; displayed descending PnL order was checked. Reopening the original simulation review retained its two drawing layers and no longer rejected canonical metrics. Daily → weekly save → return/reload → daily save retained the market boundary; SQLite readback matched the saved revision/timeframe.

Private database snapshots, original documents, private browser payloads and raw screenshots are intentionally not included in this commit.

## Open release gates

- Homepage performance still fails the existing budgets: build10 cold first holding quote 3408 ms; all 236 daily reads 30801 ms; zero read/page errors. Budgets remain 3000/10000 ms. The publication batching module is tested, but its actual workspace caller is not integrated in this checkpoint.
- Reload returns to the homepage and resets the additional filter/period state. Re-entering the same history source then produces a current-year empty range instead of the previous all-period range. Do not infer filter persistence from unchanged account or instrument counts.
- Remote master contains the unified page-header changes. Their semantic integration, conflict resolution and affected regression/visual acceptance remain outstanding.
- Final integrated full-page responsive visual acceptance and release regression are not complete. Do not merge this checkpoint until required gates are resolved.

## Publication attempt and full regression

The complete Vitest run (`node node_modules/vitest/vitest.mjs run --maxWorkers=2`) finished with 312 passing files, 4 failing files, 3 skipped files; 3006 passing tests, 19 failing tests, 6 skipped tests. Failures are in the workspace integration suite, TradingView dispatcher compatibility, SQLite store compatibility and storage-boundary checks. Some assertions reflect the former run/schema contract, while other failures concern interaction/state behavior; they have not been triaged or waived. This result blocks release acceptance.

The checkpoint commit was created locally. Three Git HTTPS push attempts failed (HTTP/2 framing, empty server reply, then GitHub port 443 connection failure). GitHub API verification showed the remote task branch still at `bbdc2de2a888881f3bbc0d215b72c2da294dcb86`; no new PR or remote merge was created. That remote branch is also not an ancestor of the local task branch, so its history must be reconciled before a normal push; do not force-push to conceal the divergence.

## Bounded follow-up repairs

The current parser's source evidence now passes SQLite validation alongside the legacy evidence shape. Historical current-parser rows without a role remain compatible, including their typed exit report; malformed financial evidence and conflicting explicit nature/identity remain rejected. A pure review parser now supplies both migration aliases and the legacy storage API without importing storage side effects into the alias resolver. Canonical-account and schema assertions were updated with explicit legacy-isolation coverage.

The homepage now persists only applied page-local filters and the statistics period. Shared account/nature/currency scope remains authoritative, uncommitted date drafts are excluded, explicit return context takes precedence, and reset replaces the saved preference. This repair has component coverage but has not yet been accepted through a fresh production browser reload.

Luna implementation checks report 80 storage/import tests and 46 dashboard/preference tests passing. Astra independently passed four additional state/storage counterexamples and narrow existing regressions. Coordinator typecheck passed. Workspace failures remain under classification, and integrated build, browser, performance and visual gates remain open; these results do not replace the historical full-suite failure record.

Git HTTP/1.1 remote listing and fetch now succeed; the remote task branch and master have not changed. No follow-up push or merge has occurred yet.
