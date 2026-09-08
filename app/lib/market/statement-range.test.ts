import { expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { statementReplayBounds } from "./statement-range";

it("extends requested history through a no-trade inventory boundary without changing trade dates", () => {
  const summary = buildInstrumentTradeSummaries([{ id: "buy", accountId: "a", accountLabel: "a", instrument: { id: "US:ABC", market: "US", symbol: "ABC", name: "ABC", currency: "USD" }, executedAt: "2025-01-02T15:00:00Z", side: "buy", quantity: "100", price: "10", fee: "0", source: { platform: "futu", row: 1, statementPositions: [{ accountId: "a", market: "US", symbol: "ABC", date: "2025-04-30", phase: "closing", quantity: "50", source: [{ page: 1, row: 2 }] }] } }])[0];
  expect(statementReplayBounds(summary).lastAt).toBe("2025-04-30");
  expect(summary.lastTradeAt).toBe("2025-01-02T15:00:00Z");
});
