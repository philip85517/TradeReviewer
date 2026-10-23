import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../app/lib/reviews/homepage-v25-performance";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { replayPositionAtPrice } from "../../../../../app/lib/replay/position-ledger";
import type { TradeExecution } from "../../../../../app/lib/trades/types";
import type { StatementEvent } from "../../../../../app/lib/import/monthly-statement";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";

const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const fill = (id: string, executedAt: string, overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id, accountId: "a", accountLabel: "A", instrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt,
  ...overrides, source: { platform: "statement", row: 1, tradeNature: "live", ...overrides.source },
});
const raw = (date: string, close: string): DailyCandleRecord => ({ instrumentId: instrument.id, tradingDate: date, open: close, high: close, low: close, close, volume: "1", currency: "USD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "AAPL", fetchedAt: `${date}T23:00:00Z` });
const traces: Record<string, unknown> = {};
function run(name: string, executions: TradeExecution[], period = { start: "2026-01-01", end: "2026-01-31" }) {
  const candlesByInstrument = { [instrument.id]: [raw("2025-12-31", "150"), raw("2026-01-31", "110")] };
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [instrument.id]: "ready" });
  const result = buildHomepageV25PerformanceFromEntries({ entries, candlesByInstrument, period, asOf: "2026-01-31" });
  const canonical = replayPositionAtPrice({ executions, markPrice: "110", cursor: "2026-01-31T15:59:59.999Z" });
  traces[name] = { executions, entries, result, canonical };
  return result;
}
function ipo(quantity: string): StatementEvent[] {
  const common = { accountId: "a", market: "US", symbol: "AAPL", currency: "USD", source: [{ page: 1, row: 2 }] };
  return [
    { ...common, id: "ipo-allot", kind: "ipo", date: "2026-01-15", quantity, displayTimePolicy: "session-open", description: "IPO allotment" },
    { ...common, id: "ipo-app", kind: "ipo", date: "2026-01-14", amount: String(-100 * Number(quantity) - 10), description: "IPO application" },
    { ...common, id: "ipo-refund", kind: "ipo", date: "2026-01-15", amount: "10", description: "IPO refund" },
    { ...common, id: "ipo-fee", kind: "fee", date: "2026-01-15", amount: "-3", description: "IPO fee" },
  ];
}
afterAll(() => fs.writeFileSync(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-peer-review/actual.json", JSON.stringify(traces, null, 2)));
describe("independent F contract peer probes", () => {
  it("assigns old short and IPO acquisition fees to a full non-execution close", () => {
    const result = run("ipo-full-close", [fill("short", "2026-01-02T02:00:00Z", { side: "sell", price: "150", fee: "2", source: { platform: "statement", row: 1, positionEffect: "open-short", positionEvents: ipo("1") } })]);
    expect(result.currentMarketValue.value).toBe("0");
    expect(result.periodRealized.value).toBe("45");
    expect(result.net.value).toBe("45");
    expect(result.instruments[0].evidence.current.openFees).toBe("0");
  });
  it("assigns the IPO fee across short close and new long inventory", () => {
    const result = run("ipo-reverse", [fill("short", "2026-01-02T02:00:00Z", { side: "sell", price: "150", fee: "2", source: { platform: "statement", row: 1, positionEffect: "open-short", positionEvents: ipo("2") } })]);
    expect(result.periodRealized.value).toBe("46.5");
    expect(result.closingUnrealized.value).toBe("8.5");
    expect(result.net.value).toBe("55");
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("does not trust one arbitrary quantity from conflicting raw execution duplicates", () => {
    const original = fill("same", "2026-01-02T02:00:00Z");
    const result = run("duplicate-conflicting-quantity", [original, { ...original, quantity: "2" }]);
    expect(result.periodRealized.value).toBeNull();
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("duplicate-execution-conflict");
  });
  it("deduplicates identical raw executions without reducing known market value", () => {
    const original = fill("same", "2026-01-02T02:00:00Z");
    const result = run("duplicate-identical", [original, original]);
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.instruments[0].evidence.current.executionIds).toEqual(["same"]);
  });
  it("keeps ordinary cross-period fee bridge correct", () => {
    const result = run("ordinary-fee-control", [fill("old", "2025-12-02T02:00:00Z", { fee: "2" }), fill("close", "2026-01-02T02:00:00Z", { side: "sell", price: "120", fee: "1" })]);
    expect([result.periodRealized.value, result.openingUnrealized.value, result.closingUnrealized.value, result.net.value]).toEqual(["17", "48", "0", "-31"]);
    expect(result.currentMarketValue.value).toBe("0");
  });
});
