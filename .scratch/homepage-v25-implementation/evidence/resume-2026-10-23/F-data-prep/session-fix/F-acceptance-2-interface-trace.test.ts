import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildHomepageV25PerformanceFromEntries, type HomepageV25EntriesInput } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import { replayPositionAtPrice } from "../../../../../../app/lib/replay/position-ledger";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../../app/lib/market/contracts";

const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const fill = (id: string, executedAt: string, extra: Partial<TradeExecution> = {}): TradeExecution => ({ id, executedAt, instrument, accountId: "a", accountLabel: "A", side: "buy", quantity: "1", price: "100", fee: "0", ...extra, source: { platform: "statement", row: 1, tradeNature: "live", ...extra.source } });
const candle = (tradingDate: string, close: string): DailyCandleRecord => ({ instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, currency: "USD", volume: "1", provider: "eastmoney", providerSymbol: "AAPL", adjustmentMode: "raw", fetchedAt: `${tradingDate}T23:00:00Z` });
function trace(label: string, executions: TradeExecution[], candles: DailyCandleRecord[], overrides: Partial<HomepageV25EntriesInput> = {}) {
  const summaries = buildInstrumentTradeSummaries(executions);
  const candlesByInstrument = { [instrument.id]: candles };
  const entries = buildTradeLibraryEntries(summaries, candlesByInstrument, { [instrument.id]: "ready" });
  const input = { entries, candlesByInstrument, period: { start: "2026-01-02", end: "2026-01-31" }, asOf: "2026-01-31", ...overrides };
  const output = buildHomepageV25PerformanceFromEntries(input);
  const canonical = output.instruments.map(row => ({ key: row.key, snapshots: Object.fromEntries(Object.entries(row.evidence).filter(([key]) => key !== "executionIds").map(([key, value]) => {
    const evidence = value as typeof row.evidence.current;
    return [key, replayPositionAtPrice({ executions, markPrice: "0", cursor: evidence.knowledgeCursor, visibleExecutionIds: evidence.executionIds })];
  })) }));
  return { label, input, summaries, output, canonical };
}
it("records real library, boundary, canonical and projection interfaces", () => {
  const traces = [
    trace("average-cost-components", [fill("old100", "2025-12-15T15:00:00Z"), fill("old200", "2025-12-16T15:00:00Z", { price: "200" }), fill("new300", "2026-01-15T15:00:00Z", { price: "300" }), fill("sell400", "2026-01-20T15:00:00Z", { side: "sell", price: "400" })], [candle("2025-12-31", "200"), candle("2026-01-30", "350")]),
    trace("unknown-fees-known-market-value", [fill("unknown-fees", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, feeStatus: "unknown" } })], [candle("2026-01-30", "110")]),
    trace("statement-future-knowledge", [fill("known", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, statementPositions: [{ accountId: "a", market: "US", symbol: "AAPL", phase: "closing", date: "2026-01-31", quantity: "9", source: [{ page: 1, row: 1 }] }] } })], [candle("2026-01-30", "110")]),
    trace("raw-reversal-settlement", [fill("buy", "2026-01-05T15:00:00Z"), fill("reverse", "2026-01-10T15:00:00Z", { side: "sell", quantity: "2", price: "120", fee: "2", source: { platform: "statement", row: 2, positionEffect: "open-short", positionEffectEvidence: { kind: "explicit", confidence: "high", reason: "broker short sale" }, settlement: { currency: "USD", quantity: "2", grossAmount: "240", netAmount: "238", fees: { commission: "2" } } } })], [candle("2026-01-30", "110")]),
    trace("production-fx-provenance", [fill("known", "2026-01-15T15:00:00Z")], [candle("2026-01-30", "110")], { targetCurrency: "CNY", fxSnapshot: { id: "fx-pair", baseCurrency: "CNY", asOf: "2026-01-31", source: "broker", status: "complete", rates: { "USD:CNY": "7" } } }),
  ];
  expect(traces.map(t => [t.output.net.value, t.output.currentMarketValue.value])).toEqual([["400", "700"], [null, "110"], ["10", "110"], ["28", "-110"], ["70", "770"]]);
  writeFileSync(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/traces/interface-traces.json", JSON.stringify(traces, null, 2) + "\n");
});
