import { describe, expect, it } from "vitest";
import { buildHomepageV25Performance as build, type HomepageV25Input } from "../../../../../app/lib/reviews/homepage-v25-performance";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import type { TradeExecution } from "../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";

const instrument = { id: "US:MSFT", symbol: "MSFT", name: "Microsoft", market: "US" as const, currency: "USD" };
const buy = (id: string, executedAt: string): TradeExecution => ({
  id, accountId: "acceptance-account", accountLabel: "Acceptance", instrument,
  side: "buy", quantity: "1", price: "100", fee: "0", executedAt,
  source: { platform: "statement", row: 1, tradeNature: "live" },
});
const candle = (tradingDate: string, close: string): DailyCandleRecord => ({
  instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, volume: "1", currency: "USD",
  provider: "eastmoney", providerSymbol: "MSFT", adjustmentMode: "raw", fetchedAt: `${tradingDate}T23:00:00Z`,
});
function project(executions: TradeExecution[], overrides: Partial<HomepageV25Input> = {}) {
  const candlesByInstrument = { [instrument.id]: [candle("2025-12-31", "100"), candle("2026-01-31", "110")] };
  return build({
    period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31",
    executions: [], openingPositions: [], valuations: [],
    entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [instrument.id]: "ready" }),
    candlesByInstrument, ...overrides,
  });
}

describe("coordinator restored F production contract", () => {
  it("converts using the production complete FX pair keys", () => {
    const result = project([buy("known", "2026-01-15T15:00:00Z")], {
      targetCurrency: "CNY", fxSnapshot: { id: "fx-real", baseCurrency: "CNY", asOf: "2026-01-31", source: "acceptance", status: "complete", rates: { "USD/CNY": "7" } },
    });
    expect(result.net.value).toBe("70");
    expect(result.currentMarketValue.value).toBe("770");
  });
  it("does not claim converted completeness from a missing FX snapshot", () => {
    const result = project([buy("known", "2026-01-15T15:00:00Z")], {
      targetCurrency: "CNY", fxSnapshot: { id: "fx-incomplete", baseCurrency: "CNY", asOf: "2026-01-31", source: "acceptance", status: "missing", rates: { "USD/CNY": "7" } },
    });
    expect(result.net.available).toBe(false);
    expect(result.currentMarketValue.available).toBe(false);
  });
  it("keeps unknown opening fees unknown without losing a known current quantity", () => {
    const execution = buy("unknown-fee", "2026-01-15T15:00:00Z");
    execution.source.feeStatus = "unknown";
    const result = project([execution]);
    expect(result.net.value).toBeNull();
    expect(result.net.available).toBe(false);
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("does not turn an uncertain inventory into a complete zero market value", () => {
    const execution = buy("unknown-quantity", "2026-01-15T15:00:00Z");
    execution.source.historyIncomplete = ["unresolved-instrument-position"];
    const result = project([execution]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.available).toBe(false);
  });
});
