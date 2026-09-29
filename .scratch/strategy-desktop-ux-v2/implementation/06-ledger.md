# 06 Ledger implementation report — Synthetic execution overrides

- Ticket: [06 — 快速展开与异常恢复：取消、失败、重试和继续](../issues/06-bulk-reveal-and-recovery.md), ledger slice C30.
- Implementation model: gpt-6-luna / max.
- State: ledger slice implementation ready; runtime/UI integration and root acceptance remain open. This report does not accept or close ticket 06.
- Writable scope used: [running-model.ts](../../../app/components/strategy-prototype/running-model.ts) and this report only. No runtime/UI component, API, browser, or database was changed or operated by this slice.
- Contract confirmation: runtime owner `/root/desktop_workbench_01` confirmed the exported `ExecutionOverride`, `ExecutionStatus`, optional `TradeEvent.executionStatus/executionNote/plannedTrades`, fifth `buildLedger` argument, and `nextExecutionCursor` signature. Runtime/results consumers treat absent execution status as `filled` and absent planned trades as the existing `trades`, preserving old events. UI owner is scheduled after this model slice by the coordinator.

## Implemented

- Exported `ExecutionOverride = { cursor, kind: "partial" | "unfilled" }` and `ExecutionStatus = "filled" | "partial" | "unfilled"`. `TradeEvent` keeps its existing fields and adds optional `executionStatus`, `executionNote`, and `plannedTrades`.
- `buildLedger(calendar, maxCursor, draft, strategy, overrides?)` accepts overrides only on existing deterministic initial-entry/rebalance dates and only within the calendar range. Without an override, it retains the previous arithmetic and event object shape; the runtime consumer treats that legacy shape as a filled event.
- Partial execution fills exactly 50% of each planned quantity delta. `plannedTrades` records the full plan, while `trades` contains only actual fills. Unfilled execution retains the planned event, sets actual `trades` to an empty array, and leaves cash and quantities unchanged. Both states include a synthetic execution note; no fee or real matching is claimed. Target and actual weights are calculated separately at the event's opening prices.
- `nextExecutionCursor(calendar, fromCursor, draft, strategy)` returns the strictly later, next planned execution cursor from the existing deterministic template, without inspecting or disclosing market values. A no-candidate strategy has no planned execution; after the initial entry an initial-hold preset returns `null`.

## Verification

- `npm run typecheck` — **PASS**, exit code 0.
- `npx eslint app/components/strategy-prototype/running-model.ts` — **PASS**, exit code 0.
- Baseline fingerprints were captured before implementation and compared after it with Node's built-in type stripping (`node --experimental-strip-types --input-type=module -e '<inline assertion harness>'`). For the same partial-scenario, three-month, strategy-following inputs, both complete snapshot arrays were byte-for-byte JSON-equivalent by SHA-256:

  - EMA: `4b22a14f036d2b16530ddf0c9a6855aef3e918c010972965bdc7f885cedff708`
  - Quality: `185d1452811f1b59c811429dcefdad67f297de3f122d316511c69af4ba6c979f`

- The same assertion harness checked partial and unfilled execution for both strategies: opening/event accounting, full planned versus actual half-deltas, no actual unfilled trades, no negative quantities, cash plus holdings equals equity across all snapshots, unique event cursors and per-event actual fills, repeat calculation idempotency, and ignored overrides on non-execution dates. Output:

  ```text
  PASS: baseline fingerprints match; EMA and quality partial/unfilled ledger cash/equity/quantities, planned-vs-actual deltas, prefix idempotency, invalid override, and next scheduled cursor assertions passed.
  baseline fingerprints: {"ema":"4b22a14f036d2b16530ddf0c9a6855aef3e918c010972965bdc7f885cedff708","quality":"185d1452811f1b59c811429dcefdad67f297de3f122d316511c69af4ba6c979f"}
  cursor checks: {"emaFirst":20,"emaAfterFirst":24,"qualityAfterFirst":39}
  ```

- The coordinator independently confirmed the baseline EMA day-5 equity remained `99592.29383259668`, first-entry partial cash was `55000` for EMA and `60000` for quality, unfilled first entry retained `100000` cash, and 20-prefix/equity/no-negative-quantity/cursor checks passed.
- Browser/UI presentation and results FIFO integration remain **NOT VERIFIED** for this model slice and belong to the runtime/UI owners and root. Database persistence is **NOT APPLICABLE**; all state is synthetic and in memory.
