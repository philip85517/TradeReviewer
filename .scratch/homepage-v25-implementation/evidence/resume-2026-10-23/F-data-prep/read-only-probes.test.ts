import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, expect, it, vi } from "vitest";
import * as ledger from "../../../../../app/lib/replay/position-ledger";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../app/lib/reviews/homepage-v25-performance";
import { buildHomepageHoldings } from "../../../../../app/components/homepage-v25/holdings-model";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";
import type { StatementEvent } from "../../../../../app/lib/import/monthly-statement";

const directory = ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep";
const instrument = { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" };
const fill = (id: string, extra: Partial<TradeExecution> = {}): TradeExecution => ({ id, instrument, accountId: "a", accountLabel: "A", side: "buy", quantity: "1", price: "100", fee: "0", executedAt: "2026-01-05T05:00:00Z", ...extra, source: { platform: "statement", row: 1, tradeNature: "live", ...extra.source } });
const candle = (tradingDate: string, close = "110"): DailyCandleRecord => ({ instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, currency: "USD", volume: "1", provider: "eastmoney", providerSymbol: "TEST", adjustmentMode: "raw", fetchedAt: `${tradingDate}T23:00:00Z` });
function input(executions: TradeExecution[]) {
  const candlesByInstrument = { [instrument.id]: [candle("2025-12-31", "100"), ...["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-18", "2026-01-31"].map(date => candle(date))] };
  return { entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [instrument.id]: "ready" as const }), candlesByInstrument, period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31" };
}
const results: unknown[] = [];
afterAll(() => writeFileSync(`${directory}/probe-results.json`, JSON.stringify(results, null, 2) + "\n"));

it("records the gross/net open-fee difference between current holdings and frozen F", () => {
  const cases = [
    { name: "open-fee", fills: [fill("buy", { quantity: "2", fee: "2" })], grossUF: "20", netUF: "18", openFees: "2", realized: "0" },
    { name: "partial-close-fee", fills: [fill("buy", { quantity: "2", fee: "2" }), fill("sale", { side: "sell", price: "120", fee: "1", executedAt: "2026-01-10T05:00:00Z" })], grossUF: "10", netUF: "9", openFees: "1", realized: "18" },
  ];
  for (const row of cases) {
    const prepared = input(row.fills);
    const performance = buildHomepageV25PerformanceFromEntries(prepared);
    const holdings = buildHomepageHoldings(prepared.entries, { scope: { live: true, market: "us", accounts: ["*"], rangeMode: "all" }, asOf: prepared.asOf,
      quotesByInstrument: { [instrument.id]: { price: "110", currency: "USD", quoteDate: prepared.asOf, fetchedAt: "2026-01-31T08:00:00Z", provider: "probe", freshness: "current" } } });
    const canonical = ledger.replayPositionAtPrice({ executions: row.fills, markPrice: "110", cursor: "2026-01-31T15:59:59.999Z" });
    expect([holdings.totalUnrealizedPnl, canonical.unrealizedPnl, performance.closingUnrealized.value, performance.instruments[0].evidence.current.openFees, performance.periodRealized.value]).toEqual([row.grossUF, row.grossUF, row.netUF, row.openFees, row.realized]);
    results.push({ kind: "holdings-fees", name: row.name, input: prepared, performance, holdings, canonical });
  }
});

it("counts call-through canonical work when the existing full builder is repeated for daily boundaries", () => {
  for (const count of [20, 100]) {
    const fills = Array.from({ length: count }, (_, index) => fill(`fill-${index}`, { executedAt: new Date(Date.parse("2026-01-05T05:00:00Z") + index * 60_000).toISOString(), side: index % 2 ? "sell" : "buy", price: index % 2 ? "110" : "100", fee: "1" }));
    const prepared = input(fills);
    const spy = vi.spyOn(ledger, "replayPositionAtPrice");
    const started = performance.now();
    const outputs = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-31"].map(end => buildHomepageV25PerformanceFromEntries({ ...prepared, period: { ...prepared.period, end } }));
    const elapsedMs = performance.now() - started;
    const signatures = spy.mock.calls.map(([argument]) => createHash("sha256").update(JSON.stringify(argument)).digest("hex"));
    const callCount = spy.mock.calls.length;
    const uniqueCalls = new Set(signatures).size;
    const selectedPrefixSizes = spy.mock.calls.reduce((sum, [argument]) => sum + (argument.visibleExecutionIds?.length ?? 0), 0);
    spy.mockRestore();
    expect(outputs.map(row => row.net.value)).toEqual(Array(4).fill(String(count / 2 * 8)));
    expect(callCount).toBeGreaterThan(uniqueCalls);
    results.push({ kind: "repeated-builder-work", fills: count, requestedDays: 4, elapsedMs, canonicalCalls: callCount, identicalCanonicalInputs: uniqueCalls, selectedPrefixSizes, net: outputs[0].net.value, note: "spy calls through original canonical implementation; four projections only, no production data/database" });
  }
});

it("keeps the same visible execution IDs while late refund knowledge changes canonical cost availability", () => {
  const common = { accountId: "a", market: "US", symbol: "TEST", currency: "USD", source: [{ page: 1, row: 1 }] };
  const events: StatementEvent[] = [
    { ...common, id: "application", kind: "ipo", date: "2026-01-08", amount: "-220", description: "IPO application" },
    { ...common, id: "fee", kind: "fee", date: "2026-01-08", amount: "-2", description: "IPO fee" },
    { ...common, id: "allocation", kind: "ipo", date: "2026-01-10", quantity: "2", displayTimePolicy: "session-open", description: "IPO allotment" },
    { ...common, id: "refund", kind: "ipo", date: "2026-01-20", amount: "20", description: "IPO refund" },
  ];
  const fills = [fill("sale", { side: "sell", price: "120", fee: "1", executedAt: "2026-01-15T05:00:00Z", source: { platform: "statement", row: 1, positionEvents: events } }), fill("future-carrier", { executedAt: "2026-02-05T05:00:00Z" })];
  const prepared = input(fills);
  const early = buildHomepageV25PerformanceFromEntries({ ...prepared, asOf: "2026-01-18", period: { start: "2026-01-01", end: "2026-01-18" } });
  const late = buildHomepageV25PerformanceFromEntries(prepared);
  expect(early.instruments[0].evidence.current.executionIds).toEqual(late.instruments[0].evidence.current.executionIds);
  expect(early.net.value).toBeNull();
  expect([late.periodRealized.value, late.closingUnrealized.value, late.net.value]).toEqual(["18", "9", "27"]);
  results.push({ kind: "knowledge-cache-key", input: prepared, early, late });
});
