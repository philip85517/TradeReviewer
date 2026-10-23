import { describe, expect, it } from "vitest";
import { buildHomepageV25PerformanceFromEntries as build } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
import type { RoomFxSnapshot } from "../../../../../../app/lib/reviews/trading-room-scope";

const instrument = { id: "US:CURRENT", symbol: "CURRENT", name: "Current contract", market: "US" as const, currency: "USD" };
const fill = (id: string, side: "buy" | "sell", quantity: string, price: string, fee: string, executedAt: string, accountId = "one"): TradeExecution => ({
  id, accountId, accountLabel: accountId, instrument, side, quantity, price, fee, executedAt,
  source: { platform: "acceptance", row: 1, tradeNature: "live", ...(id === "short" ? { positionEffect: "open-short" as const, positionEffectEvidence: { kind: "explicit" as const, confidence: "high" as const, reason: "isolated short opening evidence" } } : id === "cover" ? { positionEffect: "close-short" as const } : {}) },
});
function project(executions: TradeExecution[], fxSnapshot?: RoomFxSnapshot) {
  const candlesByInstrument = { [instrument.id]: [{ instrumentId: instrument.id, tradingDate: "2026-01-21", open: "110", high: "110", low: "110", close: "110", volume: "1", currency: "USD", provider: "acceptance", providerSymbol: "CURRENT", adjustmentMode: "raw" as const, fetchedAt: "2026-01-22T14:00:00Z" }] };
  return build({ entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [instrument.id]: "ready" }), candlesByInstrument,
    period: { start: "2026-01-01", end: "2026-01-10" }, asOf: "2026-01-22T15:00:00Z", ...(fxSnapshot ? { targetCurrency: "CNY", fxSnapshot } : {}) });
}

describe("coordinator current metrics supplement", () => {
  it("uses current exposure independently from a past selected period and future fills", () => {
    const result = project([fill("buy", "buy", "2", "100", "2", "2026-01-11T15:00:00Z"), fill("partial", "sell", "1", "120", "1", "2026-01-20T15:00:00Z"), fill("future", "sell", "1", "130", "1", "2026-01-22T15:01:00Z")]);
    expect(result.net.value).toBe("0");
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.currentUnrealized.value).toBe("9");
    expect(result.currentOpenFees.value).toBe("1");
    expect(result.instruments[0].evidence.current.executionIds).toEqual(["buy", "partial"]);
  });
  it("retains signed short exposure and prorates the remaining open fee", () => {
    const result = project([fill("short", "sell", "3", "120", "3", "2026-01-11T15:00:00Z"), fill("cover", "buy", "1", "100", "1", "2026-01-20T15:00:00Z")]);
    expect(result.currentMarketValue.value).toBe("-220");
    expect(result.currentUnrealized.value).toBe("18");
    expect(result.currentOpenFees.value).toBe("2");
  });
  it("requires complete current FX while retaining original per-account amounts", () => {
    const result = project([fill("one", "buy", "1", "100", "1", "2026-01-11T15:00:00Z"), fill("two", "buy", "2", "100", "2", "2026-01-11T15:00:00Z", "two")],
      { id: "partial", baseCurrency: "CNY", asOf: "2026-01-22T14:00:00Z", source: "acceptance", status: "partial", rates: { "USD/CNY": "7" } });
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentUnrealized.value).toBeNull();
    expect(result.currentOpenFees.value).toBeNull();
    expect(result.instruments.map(row => [row.identity.accountId, row.currentUnrealized.money.originalByCurrency.USD, row.currentOpenFees.money.originalByCurrency.USD])).toEqual([["one", "9", "1"], ["two", "18", "2"]]);
  });
});
