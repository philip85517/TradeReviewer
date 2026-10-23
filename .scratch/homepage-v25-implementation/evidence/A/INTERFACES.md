# Workspace and dashboard interfaces

The single implementation owner for this page is the Luna P1 page owner (currently awaiting coordinator assignment). `/root` owns the integrated data-flow and visual acceptance. No separate “trade-library owner” is assumed for this ticket.

`ReviewDashboardProps` in `app/components/dashboard/review-dashboard.tsx` provides real `entries`, `instrumentMetadata`, `holdingsQuotesByInstrument`, `holdingsCandlesByInstrument`, `holdingsAsOf`, `holdingsStaleAfterDays`, `positionSnapshotsByEpisode`, `onOpenDataCheck`, and the current migration seam `onOpenInReview(...)`. `ReviewDashboard` owns `DashboardBrowseState.holdingsBrowseState` (`query`, `page`) and passes `browseState` plus `onBrowseStateChange` to `RoomHoldingsPanel`.

`RoomHoldingsPanelProps` in `app/components/dashboard/room-holdings.tsx` exposes the current browse data and callbacks. The existing direct review callback is legacy behavior only. The target integration must add/use the approved holding-detail route and the unique “查看交易” handoff to ordinary `/trades`, carrying the Appendix 2 URL contract and restoring `/home` context. It must not make `onOpenInReview`, queue IDs, or direct replay the P1 target.

The current workspace call site is `app/components/trade-review-workspace.tsx:5838-5889`; it is a migration point for preserving selected identity and return context, not a design recommendation. The Luna P1 page owner should own the complete holdings/detail/navigation surface across files, while `/root` independently checks data consistency, visual fidelity and acceptance evidence.
