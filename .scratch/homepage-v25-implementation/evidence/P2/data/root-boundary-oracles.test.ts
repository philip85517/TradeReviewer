import { expect, it } from "vitest";
import {
  buildHomepageV25PerformanceFromEntries,
  prepareHomepageV25Source,
  projectHomepageV25Boundaries,
  type HomepageV25PrepareInput,
} from "../../../../../app/lib/reviews/homepage-v25-performance";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";

// Independent root fixtures: literal quantities/costs below are acceptance
// oracles, not a second financial implementation. No DB, provider or UI writes.
const cn = { id: "CN-SH:600100", symbol: "600100", name: "ROOT-CN", market: "CN-SH", currency: "CNY" };
const hk = { id: "HK:00700", symbol: "00700", name: "ROOT-HK", market: "HK", currency: "HKD" };
const asOf = "2026-01-23T08:30:00.000Z";
function execution(id: string, changes: Partial<TradeExecution> = {}): TradeExecution {
  return { id, instrument: cn, accountId: "root-account", accountLabel: "ROOT", side: "buy", quantity: "1", price: "100", fee: "2", executedAt: "2026-01-20T02:00:00.000Z", ...changes, source: { platform: "statement", row: 1, ...changes.source, tradeNature: changes.source?.tradeNature ?? "live" } };
}
function candle(instrument: typeof cn, date: string, close: string): DailyCandleRecord {
  return { instrumentId: instrument.id, tradingDate: date, open: close, high: close, low: close, close, currency: instrument.currency, volume: "1", provider: "eastmoney", providerSymbol: instrument.symbol, adjustmentMode: "raw", fetchedAt: `${date}T08:30:00.000Z` };
}
function input(fills: TradeExecution[] = [execution("root-buy")], overrides: Partial<HomepageV25PrepareInput> = {}): HomepageV25PrepareInput {
  const instruments = [...new Map(fills.map(fill => [fill.instrument.id, fill.instrument])).values()];
  const candlesByInstrument = Object.fromEntries(instruments.map(instrument => [instrument.id, [candle(instrument, "2026-01-20", "100"), candle(instrument, "2026-01-21", "120"), candle(instrument, "2026-01-22", "130"), candle(instrument, "2026-01-23", "140")]]));
  return {
    entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), candlesByInstrument, Object.fromEntries(instruments.map(instrument => [instrument.id, "ready" as const]))),
    candlesByInstrument, fxObservations: [], currentFxSnapshot: null,
    lifetimeSourceCoverage: instruments.map(instrument => ({ accountId: "root-account", instrumentId: instrument.id, nature: "live", simulationRunId: null, state: "complete", coversInception: true, through: asOf, knownAt: "2026-01-01T00:00:00.000Z", evidenceIds: ["root-complete-source"], reasons: [] })),
    revisions: { trades: "root-t1", metadata: "root-m1", quotes: "root-q1", fx: "root-f1" }, ...overrides,
  };
}
function project(sourceInput: HomepageV25PrepareInput, periodStart = "2026-01-22") {
  return projectHomepageV25Boundaries(prepareHomepageV25Source(sourceInput), { periodStart, asOf, endpoints: [{ key: "jan22", at: "2026-01-22" }], targetCurrency: "CNY" });
}

it("root B01: independent current, selected period and lifetime keep distinct values", () => {
  const batch = project(input());
  const point = batch.points[0];
  expect(point.marketValue.value).toBe("130");
  expect(point.openingUnrealized.value).toBe("18");
  expect(point.closingUnrealized.value).toBe("28");
  expect(point.periodRealized.value).toBe("0");
  expect(point.unrealizedChange.value).toBe("10");
  expect(point.net.value).toBe("10");
  expect(point.lifetimeRealizedNet.value).toBe("0");
  expect(point.lifetimeNet.value).toBe("28");
  expect(point.periodFees.value).toBe("0");
  expect(batch.current.currentMarketValue.value).toBe("140");
  expect(batch.current.currentUnrealized.value).toBe("38");
  expect(batch.current.currentOpenFees.value).toBe("2");
});
it("root B02: realized fee release differs from actual incurred period fees", () => {
  const point = project(input([execution("buy"), execution("sell", { side: "sell", price: "130", fee: "3", executedAt: "2026-01-22T02:00:00.000Z" })])).points[0];
  expect(point.periodRealized.value).toBe("25");
  expect(point.openingUnrealized.value).toBe("18");
  expect(point.closingUnrealized.value).toBe("0");
  expect(point.net.value).toBe("7");
  expect(point.lifetimeRealizedNet.value).toBe("25");
  expect(point.periodFees.value).toBe("3");
});
it("root L01: missing inception coverage gates lifetime alone", () => {
  const point = project(input(undefined, { lifetimeSourceCoverage: [] })).points[0];
  expect(point.net.value).toBe("10");
  expect(point.marketValue.value).toBe("130");
  expect(point.lifetimeRealizedNet.value).toBeNull();
  expect(point.lifetimeNet.value).toBeNull();
});
it("root X01: native endpoint difference uses one endpoint FX, not historical FX subtraction", () => {
  const fxAt = "2026-01-22T08:30:00.000Z";
  const source = input([execution("hk-buy", { instrument: hk, fee: "0" })], {
    fxObservations: [
      { id: "fx-old", source: "root-fixture", sourceRevision: "old", businessDate: "2026-01-21", rates: { "HKD/CNY": "7" }, status: "complete", publishedAtByPair: { "HKD/CNY": "2026-01-21T08:30:00.000Z" }, knownAtByPair: { "HKD/CNY": "2026-01-21T08:30:00.000Z" }, fetchedAt: "2026-01-21T08:30:00.000Z", evidenceIds: ["old-pair-proof"] },
      { id: "fx-end", source: "root-fixture", sourceRevision: "end", businessDate: "2026-01-22", rates: { "HKD/CNY": "8" }, status: "complete", publishedAtByPair: { "HKD/CNY": fxAt }, knownAtByPair: { "HKD/CNY": fxAt }, fetchedAt: fxAt, evidenceIds: ["end-pair-proof"] },
    ],
    currentFxSnapshot: { snapshot: { id: "fx-current", baseCurrency: "CNY", source: "root-fixture", asOf: "2026-01-23T08:00:00.000Z", status: "complete", rates: { "HKD/CNY": "9" } }, fetchedAt: "2026-01-23T08:00:00.000Z", publishedAtByPair: { "HKD/CNY": "2026-01-23T08:00:00.000Z" }, sourceRevision: "current", evidenceIds: ["current-pair-proof"] },
  });
  const batch = project(source);
  expect(batch.points[0].net.value).toBe("80");
  expect(batch.points[0].unrealizedChange.value).toBe("80");
  expect(batch.points[0].openingUnrealized.value).toBe("160");
  expect(batch.points[0].closingUnrealized.value).toBe("240");
  expect(batch.current.currentMarketValue.value).toBe("1260");
  expect(batch.current.currentUnrealized.value).toBe("360");
});
it("root Q01: missing required daily quote gates historical net without hiding realized fees", () => {
  const source = input();
  source.candlesByInstrument = { [cn.id]: source.candlesByInstrument[cn.id]!.filter(quote => quote.tradingDate !== "2026-01-22") };
  const batch = project(source);
  const point = batch.points[0];
  expect(point.marketValue.value).toBeNull();
  expect(point.net.value).toBeNull();
  expect(point.periodRealized.value).toBe("0");
  expect(point.periodFees.value).toBe("0");
  expect(point.instruments[0].quoteCoverage.endpoint.state).toBe("missing-completed-session");
  expect(point.instruments[0].quoteCoverage.endpoint.selectedDate).toBe("2026-01-21");
  expect(batch.current.currentMarketValue.value).toBe("140");
});
it("root I01: captured source is independent of caller mutation; actual content changes identity", () => {
  const source = input();
  const prepared = prepareHomepageV25Source(source);
  const request = { periodStart: "2026-01-22", asOf, endpoints: [{ key: "end", at: "2026-01-22" }] };
  const before = projectHomepageV25Boundaries(prepared, request);
  source.candlesByInstrument[cn.id]![2].close = "999";
  expect(projectHomepageV25Boundaries(prepared, request)).toEqual(before);
  expect(prepareHomepageV25Source(source).sourceId).not.toBe(prepared.sourceId);
  expect(Object.isFrozen(before)).toBe(true);
  expect(Object.isFrozen(before.points)).toBe(true);
  expect(Object.isFrozen(before.points[0].net)).toBe(true);
});
it("root C01: independent current agrees with the accepted wrapper", () => {
  const source = input();
  const batch = project(source);
  const legacy = buildHomepageV25PerformanceFromEntries({ entries: source.entries, candlesByInstrument: source.candlesByInstrument, period: { start: "2026-01-22", end: "2026-01-22" }, asOf, targetCurrency: "CNY" });
  expect(batch.current.currentMarketValue).toEqual(legacy.currentMarketValue);
  expect(batch.current.currentUnrealized).toEqual(legacy.currentUnrealized);
  expect(batch.current.currentOpenFees).toEqual(legacy.currentOpenFees);
});

function hkFxSource(): HomepageV25PrepareInput {
  const at = "2026-01-22T08:30:00.000Z";
  return input([execution("hk-fx", { instrument: hk, fee: "0" })], { fxObservations: [{ id: "root-fx-id", source: "root-fixture", sourceRevision: "root-fx-rev", businessDate: "2026-01-22", rates: { "HKD/CNY": "8" }, status: "complete", publishedAtByPair: { "HKD/CNY": at }, knownAtByPair: { "HKD/CNY": at }, fetchedAt: at, evidenceIds: ["root-fx-row"] }] });
}
it("root X02: conflicting same-ID FX observations cannot choose the first value", () => {
  const source = hkFxSource();
  source.fxObservations = [...source.fxObservations, { ...source.fxObservations[0], rates: { "HKD/CNY": "7" } }];
  const point = project(source).points[0];
  expect(point.net.value).toBeNull();
  expect(point.fxCoverage.state).not.toBe("complete");
  expect(point.net.reasons.length).toBeGreaterThan(0);
});
it("root X03: missing actual source/revision does not become historical FX evidence", () => {
  const source = hkFxSource();
  source.fxObservations = [{ ...source.fxObservations[0], source: "", sourceRevision: "" }];
  const point = project(source).points[0];
  expect(point.net.value).toBeNull();
  expect(point.fxCoverage.state).not.toBe("complete");
});
it("root X04: a late pair and a history-only snapshot cannot fill earlier/current FX", () => {
  const source = hkFxSource();
  source.fxObservations = [{ ...source.fxObservations[0], knownAtByPair: { "HKD/CNY": "2026-01-23T00:00:00.000Z" } }];
  const batch = project(source);
  expect(batch.points[0].net.value).toBeNull();
  expect(batch.current.currentMarketValue.value).toBeNull();
  expect(batch.current.currentUnrealized.value).toBeNull();
});
it("root Q02: a true flat position needs no quote to produce zero period net", () => {
  const source = input([execution("flat-buy"), execution("flat-sell", { side: "sell", price: "110", fee: "1", executedAt: "2026-01-21T02:00:00.000Z" })], { candlesByInstrument: {} });
  const point = project(source).points[0];
  expect(point.marketValue.value).toBe("0");
  expect(point.unrealizedNet.value).toBe("0");
  expect(point.net.value).toBe("0");
  expect(point.lifetimeRealizedNet.value).toBe("7");
  expect(point.periodFees.value).toBe("0");
});
it("root D01: the entire request rejects duplicate endpoint keys", () => {
  const source = prepareHomepageV25Source(input());
  expect(() => projectHomepageV25Boundaries(source, { periodStart: "2026-01-22", asOf, endpoints: [{ key: "same", at: "2026-01-22" }, { key: "same", at: "2026-01-23" }] })).toThrow();
});
