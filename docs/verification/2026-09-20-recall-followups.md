# Recall follow-up findings

This bounded review inspected the merged Recall workspace and replay chart. It made no production edits and did not run a broad suite. The following two paths are preexisting outside the current merge guard scope. These are code-review findings and proposed reproduction steps, not browser-verified failures. They remain follow-up work, not fixes claimed by this merge.

## History mode navigation can restore future data

`RecallWorkspace.selectDecision` remains clickable while `historyMode` is true. Selecting a decision snapshots the all-history `replay` into `globalWorkingContextRef`. If the user then returns from history and selects the global summary, that saved graph is restored as the global graph, so replay remains in history mode and future candles and executions are visible after leaving history. The same path also leaves the history banner active while the selected decision has a replay-limited cursor.

Reproduction: enter a replay, click `完整历史`, select a decision, click `返回回放`, then click `全局总结`. The global view restores the earlier full-history graph.

## Timeframe changes truncate history mode

`ChartToolbar` remains enabled while `historyMode` is true. `changeTimeframe` calls `mapCursorToTimeframe` on the history cursor; that helper maps the last revealed execution and truncates `revealedCandles` through that execution candle while preserving `mode: "history"`. Switching timeframe in `完整历史` therefore hides post-close/history bars even though the banner still claims that full history is shown.

Reproduction: enter `完整历史`, change the timeframe, and observe that candles after the last execution disappear. The history branch should either block the change or rebuild the replay with `revealRecallHistory` for the new timeframe.

The requested merge review found no new replay-chart future leak: markers use the executions supplied for the current revealed boundary, and capture flushes through `takeScreenshot` without waiting for `requestAnimationFrame`.
