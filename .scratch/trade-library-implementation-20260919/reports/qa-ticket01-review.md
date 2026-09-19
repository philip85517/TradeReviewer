# Independent QA — ticket 01 shared browse state

Date: 2026-09-19\
Reviewer: Luna QA\
Scope: independent read-only review of the ticket 01 state module, its current `TradeLibrary` integration, and the parent return path. No production edits, browser run, or full-suite run.

## Verification

```text
npx vitest run app/components/library/library-browse-state.test.ts app/components/library/trade-library.test.tsx
  2 files, 33 tests passed
```

The current parent wiring uses `defaultMode="stocks"` (`app/components/trade-review-workspace.tsx:4120-4124`), so the previously suspected queue-default issue is closed. The state unit tests cover the live/stocks/all/newest default, legacy migration, filtering before stock aggregation, latest-execution ordering, reset, and nature compatibility.

## Findings and handoff gates

### P1 — expansion and local reviewed-scope state is persisted but not rendered yet

`TradeLibraryBrowseState` defines `expandedStockIds` and `includeReviewedStockIds` and the component has toggle callbacks (`app/components/library/library-browse-state.ts:31-32,104-106`; `app/components/library/trade-library.tsx:352-364`). The current stock JSX still renders the legacy flat list (`trade-library.tsx:847-967`); it never calls those callbacks or renders `LibraryStockRounds`. Clicking a stock row immediately invokes `onOpenInReview` (`trade-library.tsx:894-904`) instead of recording expansion or using the local “include reviewed” scope.

This is the ticket 03 integration boundary, not a reason to reopen the accepted state module. Until the row component is wired, R4/R6 acceptance cannot pass: a filtered stock cannot expand its matching rounds, “查看全部回合” cannot relax review status for only that stock, and the expanded ID cannot be restored after review. The required regression scenario is a pending-only view with one completed sibling: enabling the stock-local option adds that sibling while global rows, counts, metrics, and other stocks remain unchanged; opening a child and returning must restore the same expanded stock and `scrollTop`.

### P1 — current stock aggregation still uses the pre-05 metric contract

`aggregateTradeLibraryStocks` maps every matched item into `netPnlValues` and returns `null` when any item is unavailable (`app/components/library/library-browse-state.ts:223-234`). An open round, an unknown-cost closed round, or any other null metric therefore erases the valid closed sample. For example, two trusted closed rounds of `+1000` and `-300` plus one open round must show closed net PnL `+700` and a separate open count; the current path produces no stock net PnL. It also combines all nature/run rows under one instrument when `tradeNature="all"`, then marks performance unavailable instead of rendering the separate nature/run groups required by the final rulings.

`TradeLibrary` still calls this function for `filteredEntries` (`trade-library.tsx:257-259`). The pure 05/06 module correctly selects trusted closed rows, but it is not called by this UI path yet. Ticket 05/06 integration must replace this aggregation for displayed metrics and add the mixed closed/open, unknown-cost, all-nature, and multi-run acceptance fixtures before the stock list can be accepted.

### P1 — stock detail/continuation is still keyed to one source entry

The old detail path filters `browseRows` by `entryKey(selectedEntry)` (`trade-library.tsx:261-264`). Since one instrument can have separate live, account, and simulation-run entries, a stock-level child list must pass the displayed instrument group and its run grouping into review. Otherwise a selected stock can show only the first source entry’s rounds, and “continue” receives `queueRows` for that narrower scope. Ticket 03 should either remove this legacy detail path in favor of `LibraryStockRounds`’ displayed rows or explicitly prove the selected scope is intentional. The regression fixture should use one instrument with two accounts and two simulation runs and assert the clicked child ID and continuation IDs stay within the rendered group.

## Scroll and parent-return memo

`scrollTop` is updated from the library section’s scroll handler in both views (`trade-library.tsx:733,736`) and restored when the selected instrument is cleared (`trade-library.tsx:187-191`). The parent return handler clears only `selectedInstrumentId`/`selectedEpisodeId` while spreading the rest of the canonical state (`trade-review-workspace.tsx:3735-3743`), so it preserves the saved scroll and future expansion IDs. Queue scroll restoration is covered by the passing 33-test suite and the existing workspace regression.

The missing case is stock expansion: the current stock-row click bypasses state, so parent return has no expanded selection to restore. Once ticket 03 routes expansion through `expandedStockIds`, keep the parent’s selected-ID clearing and verify restoration after both the explicit “返回交易库” action and a completed review flow. The restore effect intentionally depends on selected-ID transition so ordinary scrolling does not jump back to the saved position.

## Verdict

Ticket 01’s state tests and current default/queue wiring pass independently. The remaining acceptance work is integration owned by tickets 03 and 05/06: connect expansion/local reviewed scope and replace the legacy mixed-sample aggregation with the trusted closed metrics pipeline. No database was written and no production file was changed by this review.
