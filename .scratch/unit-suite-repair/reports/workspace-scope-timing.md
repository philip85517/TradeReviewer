# R01 scope timing follow-up

The temporary timing probe was removed after one narrow run. In the first drawing case, the existing `renderGoldReplay` completed at about 2969ms and the pending autosave text appeared at about 3847ms. The case then timed out before the saved marker, so the 1s autosave plus repository/UI update exceeds the unchanged 5s test budget; query scoping did not remove that cost.

The import case produced no action marker before the 5s timeout in the combined run, so it remains blocked before confirmation. A `getMarketData` spy did not emit because the case timed out before reaching that post-confirmation phase. The earlier readiness report remains the supported explanation: confirmation changes the hydration key and re-enters daily then 1h/15m fake-IDB reads, while the toolbar is gated on both hydration sets.

The test file contains no timing instrumentation, fake timers, global shims, timeout changes, skips, or weakened assertions. The only remaining changes are scoped queries and the optional root for `openMoreRecords`.
