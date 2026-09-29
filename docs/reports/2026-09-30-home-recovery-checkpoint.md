# Homepage recovery checkpoint

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
