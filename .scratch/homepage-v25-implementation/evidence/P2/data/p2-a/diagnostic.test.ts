import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { prepareHomepageV25Source, projectHomepageV25Boundaries } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
const instrument = { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple", currency: "USD" };
it("records the exact opening evidence", () => {
 const executions: TradeExecution[] = [{ id: "buy", accountId: "a", accountLabel: "A", instrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt: "2025-12-15T15:00:00Z", source: { platform: "test", row: 1, tradeNature: "live" } }, { id: "sell", accountId: "a", accountLabel: "A", instrument, side: "sell", quantity: "1", price: "130", fee: "0", executedAt: "2026-01-15T15:00:00Z", source: { platform: "test", row: 2, tradeNature: "live" } }];
 const quotes = { "US:AAPL": [{ instrumentId: "US:AAPL", tradingDate: "2025-12-30", open: "120", high: "120", low: "120", close: "120", volume: "1", currency: "USD", adjustmentMode: "raw" as const, provider: "eastmoney", providerSymbol: "AAPL", fetchedAt: "2025-12-30T23:00:00Z" }] };
 const source = prepareHomepageV25Source({ entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), quotes, { "US:AAPL": "ready" }), candlesByInstrument: quotes, fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [], revisions: { trades: "1", metadata: "1", quotes: "1", fx: "1" } });
 writeFileSync(".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/04-opening-trace.json", JSON.stringify(projectHomepageV25Boundaries(source, { periodStart: "2026-01-01", asOf: "2026-02-02T10:00:00Z", endpoints: [{ key: "p", at: "2026-01-30" }] }), null, 2));
});
