import { describe, expect, it } from "vitest";
import { buildHomepageV25Performance as build } from "../../../../app/lib/reviews/homepage-v25-performance";
import type { HomepageV25Input } from "../../../../app/lib/reviews/homepage-v25-performance";
import type { TradeExecution } from "../../../../app/lib/trades/types";
import type { TradeLibraryEntry } from "../../../../app/lib/trades/library";

const base = (overrides: Partial<HomepageV25Input>): HomepageV25Input => ({ period: { start: "2026-01-01", end: "2026-01-31" }, executions: [], openingPositions: [], valuations: [], ...overrides });
const position = { accountId: "a", instrumentId: "CN:AAA", direction: "long" as const, quantity: "1", unitCost: "100", currency: "CNY" };
const valuation = (kind: "period-start" | "period-end" | "current", quantity: string, price: string, date: string) => ({ date, accountId: "a", instrumentId: "CN:AAA", quantity, price, currency: "CNY", kind });
const buy: TradeExecution = { id: "buy", accountId: "a", accountLabel: "A", instrument: { id: "CN:AAA", symbol: "AAA", name: "AAA", market: "CN", currency: "CNY" }, side: "buy", quantity: "1", price: "100", fee: "0", executedAt: "2026-01-01T02:00:00Z", source: { platform: "statement", row: 1 } };
const candle = (date: string, close: string) => ({ instrumentId: "CN:AAA", tradingDate: date, open: close, high: close, low: close, close, volume: "1", currency: "CNY", provider: "eastmoney" as const, providerSymbol: "AAA", adjustmentMode: "raw" as const, fetchedAt: `${date}T09:00:00Z` });
const entry = { instrument: buy.instrument, episodes: [{ episode: { id: "ep", accountId: "a", accountLabel: "A", instrument: buy.instrument, direction: "long", status: "open", startedAt: buy.executedAt, openingQuantity: "1", remainingQuantity: "1", executions: [buy] }, metrics: {}, reviewStatus: "pending", confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null }], executions: [buy] } as unknown as TradeLibraryEntry;

describe("coordinator independent financial counterexamples round 2", () => {
  it("does not publish a complete number when valuation inventory contradicts the ledger", () => {
    const result = build(base({ openingPositions: [position], valuations: [valuation("period-start", "1", "100", "2026-01-01"), valuation("period-end", "0", "120", "2026-01-31")] }));
    expect(result.net.value).toBeNull();
  });
  it("never accepts a current quote later than asOf", () => {
    const result = build(base({ asOf: "2026-01-31", openingPositions: [position], valuations: [valuation("current", "1", "999", "2027-01-01")] }));
    expect(result.currentMarketValue.value).toBeNull();
  });
  it("does not seed period-start executions into opening inventory and replay them twice", () => {
    const result = build(base({ asOf: "2026-01-31", entries: [entry], candlesByInstrument: { "CN:AAA": [candle("2025-12-31", "100"), candle("2026-01-01", "100"), candle("2026-01-31", "110")] } }));
    expect(result.openingUnrealized.value).toBe("0");
    expect(result.closingUnrealized.value).toBe("10");
    expect(result.net.value).toBe("10");
    expect(result.reasons).not.toContain("valuation-quantity-mismatch");
  });
  it("propagates missing opening cost rather than manufacturing a complete zero", () => {
    const result = build(base({ openingPositions: [{ ...position, unitCost: "unavailable" }] }));
    expect(result.net.value).toBeNull();
  });
  it("does not silently turn invalid settlement fees into zero", () => {
    const result = build(base({ executions: [{ ...buy, source: { ...buy.source, settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "100", fees: { commission: "unavailable" } } } }], valuations: [valuation("period-end", "1", "110", "2026-01-31")] }));
    expect(result.net.value).toBeNull();
  });
});
